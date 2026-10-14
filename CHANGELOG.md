# 更新日志

本文件记录 tmd-anim 每个版本的变更,格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。
版本号与 Git tag(`vX.Y.Z`)及 [GitHub Releases](https://github.com/chenxiangning/tmd-anim/releases) 一一对应;
发版时在此追加小节,推送 tag 后 CI 自动构建并挂产物到 Release(正文自动抠取对应小节)。

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
