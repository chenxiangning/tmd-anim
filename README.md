# tmd-anim

<p align="center">
  <img src="public/icon.png" alt="tmd-anim logo" width="128" />
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://github.com/chenxiangning/tmd-anim/actions/workflows/ci.yml"><img src="https://github.com/chenxiangning/tmd-anim/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/chenxiangning/tmd-anim/releases"><img src="https://img.shields.io/github/v/release/chenxiangning/tmd-anim?include_prereleases" alt="Release" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/Tauri-2-24C8D8?logo=tauri&logoColor=white" alt="Built with Tauri 2" />
</p>

<p align="center">
  <strong>技术动画视频制作工具 —— 场景 JSON 进,确定性视频出。专为 coding agent 设计的动画协议:
  ZCode / Claude Code / omp 直接产出与修改动画,编辑器可视化精修,一键导出 mp4。</strong>
</p>

---

## 这是什么?

tmd-anim 是 tmd-cli 的姊妹项目(2026-10-13 立项),做一个「技术讲解白板动画」的制作工具:
项目主页 + 编辑器(元素库 / 画布 / 属性面板 / 多场景 / 动画时间轴)+ mp4 导出。

核心差异化是**场景 JSON 按 agent 可写设计**——元素用平面坐标与显式字段描述、渲染器宽容归一化
(半成品 JSON 也能播),agent 无需打开界面就能生成和迭代动画;人再进编辑器做可视化精修。
渲染是 `(project, t)` 的纯函数,预览与逐帧导出走同一条 `drawFrame` 路径,「预览即导出」。

立项决策与竞品调研见 tmd-cli 仓:`../tmd-cli/docs/research/tech-animation-video-tool.md`。

## 功能一览

- **场景 JSON v1 协议**:10 种元素(标题 / 艺术字 / 正文 / 形状 / 代码块 / 终端 / 表格 / 数组格 / 连线 / 图片)、
  10 种入场动画 + 缓动、多场景时间轴拼接;契约见 [`docs/schema.md`](docs/schema.md),活例见 `src/samples/bpe.json`
- **Canvas 2D 纯函数渲染器**:零 UI 依赖,可在 node 侧复用;连线三路由(smooth / elbow / straight)与元素绑定跟随
- **完整编辑器**:画布选中 / 拖拽 / 缩放 / 多选框选、schema 驱动属性面板、时间轴拖拽调时与擦洗、
  双击行内改文本、⌘C/⌘V、撤销重做、三面板折叠、自动保存(600ms 防抖)
- **场景配音**:每场一条,选音频文件或 TTS 文字合成(macOS 系统嗓音本机生成,可调嗓音/语速),
  播放随场景起点对齐,时间线以独立音轨条并行展示波形,HTML 与 MP4 导出一并包含
- **项目管理主页**:新建 / 导入 / 复制 / 删除 / 封面,时间分组
- **双后端存储**:浏览器 localStorage(零安装即用)/ Tauri 落盘 `~/.tmd-anim/projects/`
- **导出三件套**:场景 JSON、单文件 HTML 动画(内嵌播放器,双击即播)、MP4 视频
- **MP4 导出**:WebCodecs 逐帧确定性编码(H.264 + AAC 配音混流),Worker 后台渲染不卡编辑,
  实时进度 + 剩余时间估算,取消即时生效;已规避 Safari 27 编码器停摆 bug

## 快速开始

```bash
pnpm install
pnpm dev        # 浏览器版(http://localhost:1431),拖入项目 JSON 即可播放
pnpm tauri:dev  # 桌面壳(项目落盘 ~/.tmd-anim/projects/)
```

给 agent 的最小工作流:读 [`docs/schema.md`](docs/schema.md) → 写一份场景 JSON →
`pnpm dev` 后从主页「导入 JSON」预览 → 迭代字段 → 编辑器里「导出视频」出片。

## 命令

| 命令 | 作用 |
|---|---|
| `pnpm check` | 交付前全链:300 行铁则 + typecheck + test + build |
| `pnpm dev` | Vite 开发服务(端口 1431,避开 tmd-cli 的 1421) |
| `pnpm tauri:dev` | Tauri 桌面窗口 |
| `pnpm tauri:build` | 打桌面安装包 |
| `node scripts/gen-icon.mjs` | 重新生成图标母版(icns/ico 由 `pnpm tauri icon` 派生) |

## 版本与发布

版本号三处同步:`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml`。
发版流程:在 [`CHANGELOG.md`](CHANGELOG.md) 追加 `## [x.y.z] - 日期` 小节 → 三处改版本号 →
提交后推 tag(`git tag vX.Y.Z && git push --tags`)→ CI 自动构建产物并建 Draft Release,
正文自动抠取 CHANGELOG 对应小节。

### macOS 首次打开提示「已损坏」

文件没有损坏,是 Gatekeeper 拦截未签名产物:CI 构建没有 Apple 开发者证书,app 只带
ad-hoc 封签,对带浏览器隔离标记(`com.apple.quarantine`)的下载包一律报「已损坏」。
本机终端执行一次即可:

```sh
codesign --force --deep --sign - /Applications/tmd-anim.app  # 补 ad-hoc 封签
xattr -dr com.apple.quarantine /Applications/tmd-anim.app    # 清隔离标记
```

也可走「系统设置 -> 隐私与安全性 -> 仍要打开」。彻底解除需配置 Apple Developer 签名与
公证:`release.yml` 已预留 `APPLE_*` secrets 注入位,配置后 CI 产物自动签名公证。

### 应用内自动更新

桌面版「设置 -> 更新」一键 检查 -> 下载 -> 安装 -> 重启(tauri-plugin-updater,
GitHub Releases `latest.json` 通道,minisign 验签,密钥对与 tmd-cli 共用)。
CI 依赖 repo secret `TAURI_SIGNING_PRIVATE_KEY`(已配置);未注入时构建仍成功,
仅更新通道无产物。浏览器版无应用内更新,设置页回落为 Releases 跳转。

## 路线图

- **M0(已落地)**:场景 JSON v1 契约 + Canvas 2D 纯函数渲染器 + 播放器(浏览器 / 桌面壳)+ BPE 示例项目。验收:agent 写 JSON -> 播放器看得见。
- **M1(已落地)**:项目主页(新建/导入/复制/删除/封面)+ 完整编辑器:元素库 10 种元素(点击加中央/拖到指定位置)、画布选中/拖拽/8 向缩放/中心吸附、schema 驱动属性面板、多场景管理(新建/复制/删除/移位/重命名/停留秒数)、时间轴条目拖拽调 start/duration + 播放头擦洗、自动保存(600ms 防抖 + 卸载 flush)、撤销(手势合并)、预览模式、双后端存储(浏览器 localStorage / Tauri 落盘 ~/.tmd-anim/projects/)。
- **M1 打磨轮(已落地)**:对照专业剪辑/设计软件——三面板可折叠(状态持久化)、元素库 SVG 图标 + 分组 + 新增「艺术字」、入场动画扩到 10 种 + easing 缓动字段、属性面板新增入场动画区(类型/缓动/开始/时长/重播)与本地图片选择器、时间轴重做(缩放/适应/0.1s 吸附(Shift 关闭)/拖拽阈值/停留区斑马纹/空白区点选擦洗/按类型着色的条)。
- **M1 打磨轮二(已落地)**:交互细节——连线端点吸附元素(角/边中点/中心锚点优先,贴边次之,绿圈指示)、画布双击元素行内改文本(文本/代码/标签/表格单元/数组格,样式贴合元素)、元素 ⌘C/⌘X/⌘V 复制剪切粘贴(粘贴新 id + 逐次 24px 错位)、预览态去掉白色幕布卡片(视频直接浮于深色背景)。
- **M1 打磨轮三(已落地)**:画布对标 Excalidraw 的核心编辑体验(评估后不引入,保持自研渲染与 agent JSON 协议)——连线绑定元素(`fromEl`/`toEl` 进 schema,端点投影到元素包围盒,拖动元素连线跟随;整体拖线/手改端点坐标解除绑定)、鼠标多选(空白处框选、Shift 点选并入、多选整体移动/删除/复制/方向键微调)、幕布贴合(编辑态 letterbox 底色跟随 canvas.bg,画布视觉占满舞台)、连线三路由(读 Excalidraw 源码复刻:smooth 自适应三次/elbow 直角正交——出口方向按绑定元素搜索锥判定、拐角半径 16 圆滑/straight 直线,属性面板可切换)。
- **M2 出片(已落地)**:Mediabunny(WebCodecs)逐帧确定性导出 mp4;Worker 后台编码 + 二次确认弹窗 + 实时进度;WebKit 编码器停摆规避。
- **M3 打磨**:校验/截图 CLI、手绘风格(rough.js)、音频后置(ffmpeg)、对齐辅助线增强。

## 目录

```
src/core/        数据模型与渲染核心(纯 TS,零 UI 依赖,可在 node 侧复用)
  types.ts         场景 JSON v1 类型(契约,配 docs/schema.md)
  timeline.ts      时间轴数学:场景拼接/定位/缓动
  highlight.ts     高亮短语 -> 富文本原子
  wrap.ts          贪心折行
  normalize.ts     宽容归一化(agent 半成品也能播)
  render/          Canvas 2D 绘制(预览与导出唯一路径)
src/editor/      编辑器(画布交互/属性面板/时间轴/场景条/撤销/导出弹窗)
src/export/      导出链路(JSON/HTML/MP4;MP4 = Worker 渲染编码 + 主线程回退)
src/app/         主页(项目管理)与视图路由
src/store/       项目仓库双后端(localStorage / Tauri plugin-fs)
src/samples/     示例项目(bpe.json 同时是 schema 活例)
src-tauri/       Tauri 2 桌面壳(fs 能力仅限 ~/.tmd-anim/)
docs/schema.md   场景 JSON 契约(agent 协议权威文档)
docs/ai-workflow.md  AI 工作流(agent 制作/调整动画的闭环与 tmd-cli 联动)
```

## License

[MIT](./LICENSE)
