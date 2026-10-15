# 更新日志

本文件记录 tmd-anim 每个版本的变更,格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。
版本号与 Git tag(`vX.Y.Z`)及 [GitHub Releases](https://github.com/chenxiangning/tmd-anim/releases) 一一对应;
发版时在此追加小节,推送 tag 后 CI 自动构建并挂产物到 Release(正文自动抠取对应小节)。

## [未发布]

## [0.1.2] - 2026-10-15

### 新增

- TTS 文字配音:操作台新增「TTS」入口,弹窗输入文字 → macOS 系统 `say` 本机合成(不联网)→ 自动嵌入场景配音;可选嗓音/语速、试听、时长对齐提示,文本按场景留底;产物与手工导入配音同走 dataURL 链路,协议零改动
- 时间线配音音轨:元素条下方新增独立音轨行,与动画条并行展示当前场景配音(TTS 或导入);解码波形峰值渲染,无配音显示虚线空轨占位
- 配音轨编辑:配音条与左列「配音」标签可点选,属性面板新增配音卡——语速 0.25–2x 压缩/拉伸(变速不变调)、音量、移除;选中锚定所在场景,播放头跨幕后编辑的仍是选中那幕
- 配音未播完不切幕:协议新增 `audio.duration`(编辑器探测自动回填,存量项目打开即迁移)与 `audio.rate`,配音有效时长(duration/rate)超过画面时本幕自动延长到播完;编辑器预览、导出 HTML、导出 MP4 三端时长一致,不再中途截断
- 设置页(主页/编辑器顶栏齿轮进入):关于(版本/GitHub 仓库/问题反馈/文档链接)、应用内更新、界面(面板布局一键复位)、存储说明
- 应用内自动更新(tauri-plugin-updater):GitHub Releases latest.json 通道,minisign 验签(与 tmd-cli 共用密钥对),设置页一键 检查→下载→安装→重启;浏览器版回落为 Releases 跳转

### 修复

- 编辑器 flash 提示改为 header 下悬浮气泡,不再挤压标题栏布局
- 预览配音断续根修:音频时钟「停走」误判(同帧重复同步按墙钟间隔判定)不再高频重启播放管线;稳态播放不再按墙钟回拉,仅起播/播放头跳变/真停走时对齐;播放循环改函数式累计并加单时钟守卫,渲染掉帧与 StrictMode 双挂载不再拖慢播放头(实测播放头与墙钟 1:1)
- 切后台/退出编辑器自动暂停全部配音:修复 rAF 停走而音频独走造成的声音泄漏与恢复后时间轴漂移(HTML 导出播放器同款行为)
- 方向键在配音选中态不再产生空撤销记录;`docs/schema.md` 同步 `audio.rate`/`audio.duration` 字段

### 优化

- UI/UX 二轮:共享按钮体系(btn-primary/secondary/ghost/danger)全站落地;编辑器顶栏导出三连收拢为分段控件;主页/卡片/弹窗按钮统一换用共享类
- UI/UX 打磨:全局字体平滑/选区色/细滚动条/键盘焦点环;主页内容限宽居中、空状态带引导操作、卡片封面占位图与分隔线;编辑器顶栏保存态指示灯、次级按钮统一描边样式;操作台控件圆角统一、时间条投影与悬停提亮;属性面板空态图标与输入框悬停/焦点反馈

### CI

- release.yml:tauri-action 注入 TAURI_SIGNING_PRIVATE_KEY 产出 .sig 与 latest.json;prep-release 复用旧 release 时先清陈旧 latest.json(tmd-cli v0.2.3 验签失败教训)
- 补 `bundle.createUpdaterArtifacts: true`(对齐 tmd-cli):tauri v2 缺此配置时即使注入签名私钥也不产出更新产物,v0.1.2 首次 CI 即因此无 .sig/latest.json,删草稿重打 tag 重发

## [0.1.1] - 2026-10-14

### 修复

- 补回 tauri.conf 的 `bundle.macOS.signingIdentity: "-"`(从 tmd-cli 对齐时遗漏):构建产物恢复 bundle 级 ad-hoc 封签,`codesign --verify` 可过;此前仅可执行文件带 linker 签名,v0.1.0 macOS 安装包已以修复后构建覆盖重发

### 文档

- README 新增「macOS 首次打开提示已损坏」:未签名产物的 Gatekeeper 拦截说明与本机解除步骤

## [0.1.0] - 2026-10-14

首个公开版本:M0 + M1 + M2 三个里程碑全量落地,场景 JSON 进、确定性视频出的完整链路可用。

### 新增

- 场景 JSON v1 契约(`docs/schema.md`)与宽容归一化:面向 coding agent 设计的动画协议,agent 半成品 JSON 也能播
- Canvas 2D 纯函数渲染器:`drawFrame(project, t)` 与预览共用唯一绘制路径,预览即导出
- 播放器:浏览器 / 桌面壳双形态,内嵌 IIFE 播放器可独立分发
- 项目主页:新建 / 导入 / 复制 / 删除 / 封面,时间分组
- 完整编辑器:元素库(标题/艺术字/正文/形状/代码块/终端/表格/数组格/连线/图片等)、画布选中/拖拽/缩放/多选/框选、schema 驱动属性面板、多场景管理、动画时间轴(拖拽调时/擦洗/缩放/吸附)、撤销重做、自动保存、预览模式
- 交互打磨:连线绑定元素与三路由(smooth/elbow/straight)、双击行内改文本、⌘C/⌘V 复制粘贴、三面板折叠、入场动画 10 种 + 缓动
- 双后端存储:浏览器 localStorage / Tauri 落盘 `~/.tmd-anim/projects/`
- 导出三件套:场景 JSON 下载、单文件 HTML 动画、MP4 视频(Mediabunny/WebCodecs 逐帧确定性编码 + 场景配音混流)
- MP4 导出体验:导出前二次确认(时长/帧数/分辨率)、Worker 后台渲染编码(编辑不卡顿)、实时进度 + 剩余时间估算、取消即时生效
- WebKit 兼容:规避 Safari 27 H.264 编码器 quality 模式停摆 bug(mediabunny#541),编码器停滞看门狗兜底
