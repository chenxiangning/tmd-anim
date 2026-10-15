//! macOS 本地 TTS:包装系统 `say` 命令,零外部依赖、不联网。
//! 产物为 22.05kHz 16bit 单声道 WAV,经 ipc Response 原样回传前端转 dataURL,
//! 落到 `scene.audio.src` 后与手工导入的配音走完全相同的同步/导出链路。

use serde::Serialize;
use std::collections::HashSet;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::ipc::Response;

/// 文本上限:配音是短解说,超长更像误粘贴,直接拒绝
const MAX_TEXT_CHARS: usize = 2000;
/// 语速(字/分)钳制范围,越界即截取
const RATE_RANGE: std::ops::RangeInclusive<u32> = 80..=320;

#[derive(Serialize)]
pub struct TtsVoice {
    pub name: String,
    pub lang: String,
    pub sample: String,
}

/// `say -v '?'` 单行解析:`名字(可带注记括号)  语言码  # 示例句`。
/// 名字可含空格与括号(如 `Tingting (中文（中国大陆）)`、`Ava (premium)`),
/// 语言码恒为 `#` 前最后一个空白分隔 token。
fn parse_voice_line(line: &str) -> Option<TtsVoice> {
    let (head, sample) = line.split_once('#')?;
    let head = head.trim_end();
    let lang = head.split_whitespace().last()?.to_string();
    let name = head[..head.len() - lang.len()].trim_end().to_string();
    if name.is_empty() {
        return None;
    }
    Some(TtsVoice {
        name,
        lang,
        sample: sample.trim().to_string(),
    })
}

/// 枚举系统可用嗓音(同名同语言去重,`say -v '?'` 存在重复行)
#[tauri::command]
pub fn tts_voices() -> Result<Vec<TtsVoice>, String> {
    let out = Command::new("say")
        .arg("-v")
        .arg("?")
        .output()
        .map_err(|e| format!("无法运行 say 命令:{e}(TTS 依赖 macOS 系统语音)"))?;
    if !out.status.success() {
        return Err(format!(
            "枚举系统嗓音失败:{}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    let mut voices: Vec<TtsVoice> = Vec::new();
    let mut seen: HashSet<(String, String)> = HashSet::new();
    for line in String::from_utf8_lossy(&out.stdout).lines() {
        if let Some(v) = parse_voice_line(line) {
            if seen.insert((v.name.clone(), v.lang.clone())) {
                voices.push(v);
            }
        }
    }
    Ok(voices)
}

/// 合成语音并返回 WAV 字节(ipc 原始 payload,前端 invoke 得到 ArrayBuffer)
#[tauri::command]
pub fn tts_speak(text: String, voice: Option<String>, rate: Option<u32>) -> Result<Response, String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("配音文本为空".into());
    }
    if text.chars().count() > MAX_TEXT_CHARS {
        return Err(format!("配音文本过长(上限 {MAX_TEXT_CHARS} 字)"));
    }
    let dir = std::env::temp_dir().join("tmd-anim-tts");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建临时目录失败:{e}"))?;
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let path = dir.join(format!("tts-{millis}.wav"));
    let mut cmd = Command::new("say");
    // 显式 WAVE + 22.05k 16bit 单声道:体积小,WebAudio 解码与 MP4 AAC 封装均直接支持
    cmd.arg("--file-format=WAVE")
        .arg("--data-format=LEI16@22050")
        .arg("-o")
        .arg(&path);
    if let Some(v) = voice.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
        cmd.arg("-v").arg(v);
    }
    cmd.arg("-r")
        .arg(rate.unwrap_or(190).clamp(*RATE_RANGE.start(), *RATE_RANGE.end()).to_string());
    cmd.arg(text);
    let out = cmd
        .output()
        .map_err(|e| format!("无法运行 say 命令:{e}"))?;
    if !out.status.success() {
        return Err(format!(
            "语音合成失败:{}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    let bytes = std::fs::read(&path).map_err(|e| format!("读取生成的音频失败:{e}"));
    let _ = std::fs::remove_file(&path);
    let bytes = bytes?;
    if bytes.is_empty() {
        return Err("语音合成结果为空".into());
    }
    Ok(Response::new(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 解析普通嗓音行() {
        let v = parse_voice_line("Albert              en_US    # Hello! My name is Albert.").unwrap();
        assert_eq!(v.name, "Albert");
        assert_eq!(v.lang, "en_US");
        assert_eq!(v.sample, "Hello! My name is Albert.");
    }

    #[test]
    fn 解析带本地化括号的嗓音名() {
        let v =
            parse_voice_line("Tingting (中文（中国大陆）) zh_CN    # 你好！我叫婷婷。").unwrap();
        assert_eq!(v.name, "Tingting (中文（中国大陆）)");
        assert_eq!(v.lang, "zh_CN");
        assert_eq!(v.sample, "你好！我叫婷婷。");
    }

    #[test]
    fn 解析带品质标注的嗓音名() {
        let v = parse_voice_line("Ava (premium)       en_US    # Hello, my name is Ava.").unwrap();
        assert_eq!(v.name, "Ava (premium)");
        assert_eq!(v.lang, "en_US");
    }

    #[test]
    fn 垃圾行返回空() {
        assert!(parse_voice_line("").is_none());
        assert!(parse_voice_line("没有井号").is_none());
        assert!(parse_voice_line("  # ").is_none());
    }

    /// 端到端:真调系统 say 合成一句中文,断言返回非空 WAV(RIFF)字节。
    #[test]
    #[cfg(target_os = "macos")]
    fn speak_真实合成返回wav() {
        use tauri::ipc::IpcResponse;
        let resp = tts_speak("端到端测试".into(), None, Some(190)).expect("tts_speak 失败");
        match resp.body().expect("response body") {
            tauri::ipc::InvokeResponseBody::Raw(bytes) => {
                assert!(bytes.len() > 1000, "音频过小:{}", bytes.len());
                assert_eq!(&bytes[..4], b"RIFF", "不是 WAV 文件头");
            }
            other => panic!("期望 Raw 字节,实际 {other:?}"),
        }
    }

    #[test]
    fn speak_空文本被拒绝() {
        assert!(tts_speak("   ".into(), None, None).is_err());
    }
}
