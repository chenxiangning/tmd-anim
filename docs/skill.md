---
name: tmd-anim
description: 制作与修改 tmd-anim 技术动画(场景 JSON 进,确定性视频出),含「小黑」手绘怪诞风配图动画。用户提到 做动画/改动画/tmd-anim/小黑/手绘配图/怪诞插画/正文配图动画 等任务时使用。
---

# tmd-anim 动画制作

<!-- 本文件是模板:双花括号占位符由 tmd-anim 桌面版安装时替换为当前系统绝对路径(mac 得 /Users/…,Windows 得 C:\Users\…) -->

本文件是 tmd-anim 桌面版安装的指路牌:权威协议与风格包已由应用投递到
`{{PROTOCOL_DIR}}`,以那里的文件为准,不要凭记忆生成字段。

1. 读 `{{SCHEMA_MD}}`:场景 JSON v1 字段权威定义。
2. 构图模板(开场/三步教程/diff/架构数据流/图表/UI 演示/三分图解/排错/公式/收尾/拟人科普/学术信息图):
   读 `{{RECIPES_MD}}`,先套模板再填内容,比从零摆坐标又快又稳。
3. 活例:`{{HTTP_EXAMPLE_JSON}}`(协议全家福)、
   `{{SHOWCASE_EXAMPLE_JSON}}`(新元素全家福,含时间轴三段)、
   `{{INFOGRAPHIC_EXAMPLE_JSON}}`(学术信息图:分组柱图+胶囊组+叠纸 K+回环箭头)、
   `{{XIAOHEI_EXAMPLE_JSON}}`(小黑风格)。
4. 用户要「小黑 / 手绘 / 怪诞 / 正文配图」风格时,必读
   `{{XIAOHEI_STYLE_MD}}`(身体/腿臂坐标配方、部件语法表、
   入场编排节奏、构图模式、自查清单)。
5. 新建项目:在 `{{PROJECTS_DIR}}` 落一个不重名的 `<id>.json`,保存后
   tmd-anim 桌面版自动热重载;修改现有项目直接改目标文件。
6. 自查:在 tmd-anim 仓目录运行 `pnpm anim validate <文件>`(exit 2 = 必须修;
   加 `--layout` 输出元素落位与生命周期);无仓时靠应用内「导出帧」出 PNG 回看。
7. 本文件内容随应用更新,重新安装技能即可刷新;协议目录永远是最新版。
