# tmd-anim —— 技术动画视频制作工具

> 场景 JSON 进,确定性视频出。tmd-cli 的姊妹项目,2026-10-13 立项。

做一个「技术讲解白板动画」的制作工具(对标视频号「神秘的鱼仔」用 ZCode 生成的技术动画制作站):
项目主页 + 编辑器(元素库 / 画布 / 属性面板 / 多场景 / 动画时间轴)+ mp4 导出,核心差异化是
**场景 JSON 按 agent 可写设计**——让 ZCode / Claude Code / omp 等 coding agent 直接产出与修改动画。

立项决策与竞品调研见 tmd-cli 仓:`../tmd-cli/docs/research/tech-animation-video-tool.md`
(结论:独立项目形态;自建场景 JSON + Canvas 2D 纯函数渲染器;导出走 Mediabunny/WebCodecs)。

## 快速开始

```bash
pnpm install
pnpm dev        # 浏览器预览器(http://localhost:1431),拖入项目 JSON 即可播放
pnpm tauri:dev  # 桌面壳
```

## 命令

| 命令 | 作用 |
|---|---|
| `pnpm check` | 交付前全链:300 行铁则 + typecheck + test + build |
| `pnpm dev` | Vite 开发服务(端口 1431,避开 tmd-cli 的 1421) |
| `pnpm tauri:dev` | Tauri 桌面窗口 |
| `node scripts/gen-icon.mjs` | 重新生成图标母版(icns/ico 由 `pnpm tauri icon` 派生) |

## 路线图

- **M0(已落地)**:场景 JSON v1 契约 + Canvas 2D 纯函数渲染器 + 播放器(浏览器 / 桌面壳)+ BPE 示例项目。验收:agent 写 JSON -> 播放器看得见。
- **M1(已落地)**:项目主页(新建/导入/复制/删除/封面)+ 完整编辑器:元素库 10 种元素(点击加中央/拖到指定位置)、画布选中/拖拽/8 向缩放/中心吸附、schema 驱动属性面板、多场景管理(新建/复制/删除/移位/重命名/停留秒数)、时间轴条目拖拽调 start/duration + 播放头擦洗、自动保存(600ms 防抖 + 卸载 flush)、撤销(手势合并)、预览模式、双后端存储(浏览器 localStorage / Tauri 落盘 ~/.tmd-anim/projects/)。
- **M1 打磨轮(已落地)**:对照专业剪辑/设计软件——三面板可折叠(状态持久化)、元素库 SVG 图标 + 分组 + 新增「艺术字」、入场动画扩到 10 种 + easing 缓动字段、属性面板新增入场动画区(类型/缓动/开始/时长/重播)与本地图片选择器、时间轴重做(缩放/适应/0.1s 吸附(Shift 关闭)/拖拽阈值/停留区斑马纹/空白区点选擦洗/按类型着色的条)。
- **M1 打磨轮二(已落地)**:交互细节——连线端点吸附元素(角/边中点/中心锚点优先,贴边次之,绿圈指示)、画布双击元素行内改文本(文本/代码/标签/表格单元/数组格,样式贴合元素)、元素 ⌘C/⌘X/⌘V 复制剪切粘贴(粘贴新 id + 逐次 24px 错位)、预览态去掉白色幕布卡片(视频直接浮于深色背景)。
- **M1 打磨轮三(已落地)**:画布对标 Excalidraw 的核心编辑体验(评估后不引入,保持自研渲染与 agent JSON 协议)——连线绑定元素(`fromEl`/`toEl` 进 schema,端点投影到元素包围盒,拖动元素连线跟随;整体拖线/手改端点坐标解除绑定)、鼠标多选(空白处框选、Shift 点选并入、多选整体移动/删除/复制/方向键微调)、幕布贴合(编辑态 letterbox 底色跟随 canvas.bg,画布视觉占满舞台)、连线三路由(读 Excalidraw 源码复刻:smooth 自适应三次/elbow 直角正交——出口方向按绑定元素搜索锥判定、拐角半径 16 圆滑/straight 直线,属性面板可切换)。
- **M2 出片**:Mediabunny(WebCodecs)逐帧确定性导出 mp4。
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
src/editor/      编辑器(画布交互/属性面板/时间轴/场景条/撤销)
src/app/         主页(项目管理)与视图路由
src/store/       项目仓库双后端(localStorage / Tauri plugin-fs)
src/samples/     示例项目(bpe.json 同时是 schema 活例)
src-tauri/       Tauri 2 桌面壳(fs 能力仅限 ~/.tmd-anim/)
docs/schema.md   场景 JSON 契约(agent 协议权威文档)
```
