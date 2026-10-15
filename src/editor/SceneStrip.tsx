import { useRef, useState } from "react";
import type { Project, Scene } from "../core/types";
import { sceneDuration } from "../core/timeline";
import { useAudioDuration } from "./sceneAudio";
import { TtsDialog } from "./TtsDialog";

interface SceneStripProps {
  project: Project;
  sceneIdx: number;
  onSelectScene: (idx: number) => void;
  onAddScene: () => void;
  onDuplicateScene: () => void;
  onRemoveScene: () => void;
  onMoveScene: (delta: -1 | 1) => void;
  onRenameScene: (name: string) => void;
  onDwell: (seconds: number) => void;
  onSetAudio: (audio: Scene["audio"] | undefined) => void;
}

const btn =
  "shrink-0 whitespace-nowrap rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40";

/** 场景配音控件:未设置 = 「＋ 配音」;已设置 = 替换 + 音量滑杆(0–2)+
 *  有效时长提示(原始时长/语速)+ 显式移除。配音比画面长时场景自动延长(见 timeline),
 *  时长经 metadata 级探测(useAudioDuration),设置/替换保留原音量与语速。
 *  「TTS」入口走 TtsDialog 文字合成,产物同为 dataURL。 */
function SceneAudioControl({
  scene,
  onSet,
}: {
  scene: Scene;
  onSet: SceneStripProps["onSetAudio"];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ttsOpen, setTtsOpen] = useState(false);
  const audio = scene.audio;
  const src = audio?.src;
  const volume = audio?.volume ?? 1;
  const probed = useAudioDuration(src);
  const sceneSec = sceneDuration(scene);
  // 画面够长的部分:元素动画+停留;被配音顶长的部分显示为「配音延长」
  const contentEnd = scene.elements.reduce((m, el) => Math.max(m, el.anim.start + el.anim.duration), 0);
  const baseSec = Math.max(contentEnd, 0.1) + Math.max(0, scene.dwell ?? 0);
  const extended = sceneSec - baseSec;

  const pick = (): void => {
    const input = fileRef.current;
    if (!input) return;
    input.value = "";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      // 新文件 duration 未知,置空待探测回填;volume/rate 沿用
      reader.onload = () => onSet({ src: String(reader.result), volume, rate: audio?.rate });
      reader.readAsDataURL(file);
    };
    input.click();
  };

  if (!src) {
    return (
      <>
        <button className={`${btn} !border-emerald-300 !text-emerald-700`} onClick={pick} title="给本场景添加配音:选音频文件,随场景起点播放;MP4/HTML 导出一并包含">
          ＋ 配音
        </button>
        <button className={`${btn} !border-emerald-300 !text-emerald-700`} onClick={() => setTtsOpen(true)} title="文字配音:输入文字,系统嗓音本机合成并嵌入本场景">
          TTS
        </button>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" />
        {ttsOpen && <TtsDialog scene={scene} onSet={onSet} onClose={() => setTtsOpen(false)} />}
      </>
    );
  }
  const rate = audio?.rate ?? 1;
  const raw = audio?.duration ?? probed;
  const eff = raw !== null ? raw / rate : null;
  const over = eff !== null && eff > sceneSec + 0.05;
  return (
    <>
      <button className={`${btn} !border-emerald-300 !text-emerald-700`} onClick={pick} title="替换本场景配音文件">
        ♪ 配音
      </button>
      <button className={`${btn} !border-emerald-300 !text-emerald-700`} onClick={() => setTtsOpen(true)} title="文字配音:输入文字,系统嗓音本机合成并替换本场景配音">
        TTS
      </button>
      <input
        type="range"
        min={0}
        max={2}
        step={0.1}
        value={volume}
        title={`配音音量 ${volume.toFixed(1)}x(0–2)`}
        onChange={(e) => onSet({ ...audio, volume: Number(e.target.value) })}
        className="h-1 w-14 shrink-0 cursor-pointer accent-emerald-600"
      />
      <span className="w-7 shrink-0 font-mono text-neutral-500">{volume.toFixed(1)}x</span>
      <span
        className={`shrink-0 whitespace-nowrap font-mono ${over ? "text-amber-600" : "text-neutral-400"}`}
        title="配音有效时长(原始时长/语速)/ 本幕时长;配音更长时本幕自动延长到播完"
      >
        ♪{eff !== null ? `${eff.toFixed(1)}s` : "?"}
        {rate !== 1 && raw !== null ? `(原始${raw.toFixed(1)}s×${rate.toFixed(2)})` : ""}/{sceneSec.toFixed(1)}s
      </span>
      {extended > 0.05 && (
        <span className="shrink-0 whitespace-nowrap font-mono text-emerald-600" title="配音未播完的部分自动延长本幕,播完才切下一幕">
          延长 +{extended.toFixed(1)}s
        </span>
      )}
      <button className={btn} onClick={() => onSet(undefined)} title="移除本场景配音">
        ✕
      </button>
      <input ref={fileRef} type="file" accept="audio/*" className="hidden" />
      {ttsOpen && <TtsDialog scene={scene} onSet={onSet} onClose={() => setTtsOpen(false)} />}
    </>
  );
}

/** 操作台场景组:场景芯片 + 管理 + 停留秒数 + 场景配音;外框由 TimelinePanel 统一提供。 */
export function SceneStrip({
  project,
  sceneIdx,
  onSelectScene,
  onAddScene,
  onDuplicateScene,
  onRemoveScene,
  onMoveScene,
  onRenameScene,
  onDwell,
  onSetAudio,
}: SceneStripProps) {
  const scene = project.scenes[sceneIdx];
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
      <span className="shrink-0 text-[10px] text-neutral-400">场景</span>
      {project.scenes.map((s, i) => {
        const active = i === sceneIdx;
        return active ? (
          <input
            key={s.id}
            className="w-20 shrink-0 whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[10px] text-white outline-none"
            value={s.name}
            title="场景名,直接编辑"
            onChange={(e) => onRenameScene(e.target.value)}
          />
        ) : (
          <button
            key={s.id}
            onClick={() => onSelectScene(i)}
            className="shrink-0 whitespace-nowrap rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 transition-colors hover:bg-neutral-200"
          >
            {i + 1}. {s.name}
          </button>
        );
      })}
      <span className="mx-0.5 h-4 w-px shrink-0 bg-neutral-200" />
      <button className={btn} onClick={onAddScene}>
        + 新建
      </button>
      <button className={btn} onClick={onDuplicateScene}>
        复制
      </button>
      <button className={btn} onClick={onRemoveScene} disabled={project.scenes.length <= 1}>
        删除
      </button>
      <button className={btn} onClick={() => onMoveScene(-1)} disabled={sceneIdx === 0}>
        左移
      </button>
      <button className={btn} onClick={() => onMoveScene(1)} disabled={sceneIdx === project.scenes.length - 1}>
        右移
      </button>
      {scene && (
        <label className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-neutral-500">
          <SceneAudioControl scene={scene} onSet={onSetAudio} />
          停留
          <input
            type="number"
            min={0}
            step={0.5}
            className="w-12 rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] outline-none focus:border-slate-400"
            value={scene.dwell ?? 1.5}
            onChange={(e) => onDwell(Number(e.target.value) || 0)}
          />
          秒
          <span className="ml-1 font-mono text-neutral-400">本幕 {sceneDuration(scene).toFixed(1)}s</span>
        </label>
      )}
    </div>
  );
}
