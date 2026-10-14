import playerJs from "../generated/player.iife.js?raw";
import type { Project } from "../core/types";

/**
 * HTML 动画导出:项目 JSON + 预构建播放器(playEntry 的 IIFE)内联成单文件,
 * 双击即可在浏览器播放;渲染与编辑器同走 drawFrame,所见即所得。
 */

/** JSON 内联进 <script> 标签需防提前闭合 */
function escapeScript(json: string): string {
  return json.replace(/</g, "\\u003c").replace(/<!--/g, "\\u003c!--");
}

/** 播放器代码同样要防 </script> 提前闭合 */
function safePlayerJs(code: string): string {
  return code.replace(/<\/script/gi, "<\\/script");
}

export function buildStandaloneHtml(project: Project): string {
  const name = (project.name || "tmd-anim").replace(/[\\/:*?"<>|]/g, "_");
  const data = escapeScript(JSON.stringify(project));
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} · tmd-anim</title>
<style>
  html, body { margin: 0; height: 100%; background: #171717; overflow: hidden; }
  body { display: flex; flex-direction: column; align-items: center; }
  #tmd-stage-box { flex: 1; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
  #tmd-stage { box-shadow: 0 8px 40px rgba(0,0,0,0.45); cursor: pointer; }
  #tmd-bar { height: 44px; width: 100%; display: flex; align-items: center; gap: 12px;
    padding: 0 16px; box-sizing: border-box; background: #262626; color: #a3a3a3;
    font: 500 12px/1 system-ui, sans-serif; }
  #tmd-track { flex: 1; height: 4px; border-radius: 2px; background: #404040; overflow: hidden; }
  #tmd-progress-bar { height: 100%; width: 0; background: #3b82f6; }
  #tmd-play-icon { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    pointer-events: none; opacity: 0; transition: opacity 0.15s; }
  #tmd-play-icon span { background: rgba(23,23,23,0.72); color: #fff; border-radius: 999px;
    padding: 18px 22px; font-size: 30px; }
</style>
</head>
<body>
<div id="tmd-stage-box"><canvas id="tmd-stage"></canvas></div>
<div id="tmd-play-icon"><span>播放 ▶</span></div>
<div id="tmd-bar">
  <span id="tmd-time">0.0s</span>
  <div id="tmd-track"><div id="tmd-progress-bar"></div></div>
  <span>tmd-anim 导出 · 点击画面或按空格播放/暂停,← → 快退快进 5s</span>
</div>
<script type="application/json" id="tmd-project-data">${data}</script>
<script>
${safePlayerJs(playerJs)}
</script>
</body>
</html>
`;
}
