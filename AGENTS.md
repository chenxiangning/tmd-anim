# AGENTS.md —— tmd-anim AI 协作约定

> 本文件是所有 AI 工具在本仓库的唯一规范入口;与通用习惯冲突时以本文件为准。

## 1. 项目定位

技术动画视频制作工具,tmd-cli 的姊妹项目(2026-10-13 立项,形态决策见
`../tmd-cli/docs/research/tech-animation-video-tool.md`):场景 JSON 进,确定性视频出。

两条架构生命线,动代码前先想:

1. **渲染是 (project, t) 的纯函数**,预览与将来的逐帧导出必须走同一条绘制路径
   (`src/core/render/index.ts` 的 `drawFrame`),禁止在 UI 层另做一套「导出态」渲染。
2. **场景 JSON 是面向 coding agent 的协议**:改字段必须同步 `docs/schema.md` 与
   `src/core/normalize.ts`(宽容归一化),并跑通 `src/samples/bpe.json` 活例。

## 2. 技术栈(与 tmd-cli 同源,不引入新框架)

React 19 + TypeScript(strict)+ Tailwind 4 + Vite 8 + Tauri 2。
视频导出(M2)规划用 Mediabunny(WebCodecs),到 M2 才引入;M0/M1 前端零新增依赖。

## 3. 验证(交付前必跑)

- 前端:`pnpm check`(300 行铁则 + typecheck + test + build)。
- Rust:`cargo check`(后续补 clippy/fmt);Rust 改动需重启 tauri:dev。
- UI 行为改动必须 `pnpm tauri:dev` 真窗口目检,测试绿不算数。

## 4. 约定

- 300 行铁则:单文件 ≤300 行(.ts/.tsx/.rs/.css),`pnpm check:file-size` 把关;
  豁免须文件头 10 行内标 `file-size-exempt`。
- 文档与注释:简体中文,半角标点混排,不用 emoji;结论先行。
- 提交信息:`type(scope): 中文一句话祈使句`。
- 文档落盘:根 `README.md` + `docs/` 平铺;不另造平行文档体系。
- 用户当次指令 > 本文件 > 通用默认。
