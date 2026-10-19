# 叙事配方库(recipes)

> 面向 coding agent 的构图模板:`schema.md` 教字段,这里教「怎么摆才好看」。
> 每个配方 = 适用场景 + 元素骨架 + 时间编排要点 + 填槽说明。
> 骨架里的坐标按 1920x1080 默认画布给,换画布等比换算;`…` 处按内容填。

## 通用约定

- 开场 0-0.5s 给主标题,0.5s 后逐个上配角,同刻入场不超过 4 个(lint 会警告堆叠)。
- 讲解中段用「一个画面只讲一个要点」:主元素 + 至多 2 个配角。
- 收尾要么总结列表,要么下集预告 badge,停留 1.2-1.5s(dwell)。
- 需要逐段显现的列表/代码/文件树/图表,入场动画用 `typewriter`(分段显现),其余类型一次性全显。

## 1. 开场钩子(30 秒以内的片头)

适用:视频第 1 幕、章节转场。

骨架:
- `artText` 大字主题(如 "HTTP"),y=100,h=240,`zoomIn` 0.8s
- `title` 一句话副题,y=390,`highlight` 命中 1-2 个关键词,`pop` 延迟 0.5s
- `input` 或 `kbd` 做「动作暗示」,y=545,`riseUp` 延迟 1.0s
- 底部 `badge` 条(作者/系列名),y=950,`fade` 延迟 1.5s

填槽:主题词 2-6 个字母最出彩;副题不超过 20 字。

## 2. 三步教程

适用:任何「第 1 步/第 2 步/第 3 步」的 how-to。

骨架(单场景 or 三幕连播):
- 顶部 `title` 说明目标(「三分钟配好 CI」)
- 三个 `stepCard` 横排,y=560,h=170,w=560,间距 40:x=80/680/1280
  - `num` 01/02/03,`accent` 统一主色
  - 入场依次 `riseUp`,start=0.4/0.8/1.2(错开!)
- 每卡上方可各配一个迷你 `terminal` 或 `code` 片段(start 与卡片对齐)

填槽:desc 里用 `highlight` 标出命令/文件名,讲解时眼睛有落点。

## 3. 前后对比(diff)

适用:重构前后、优化前后、错误 vs 正确。

骨架:
- 左 `codeDiff`(优化前),右 `codeDiff`(另一种改法)或右 `code` 理想态
- 中间 `connector` `route:"elbow"` 从旧块连到新块,`label`:"改这里"
- 两侧各配 `avatar`(旧方案/新方案)或 `badge`(✗ 之前/✓ 之后)
- 入场:左右两块 `slideLeft`/`slideRight` 对向滑入,连线最后 `fade`

填槽:hunks 的 ctx 行写函数签名,增减行保持缩进对齐原文件。

## 4. 架构数据流

适用:请求链路、数据管道、系统拓扑。

骨架:
- `gridBg` 垫底(elements[0],step 40)
- `lane` 分角色带(v: 客户端/网关/服务/存储),元素落带内
- `devNode` 组件节点(database/api/queue…),`label` 主名 + `sub` 规格
- `connector` 绑 `fromEl/toEl`(元素移动自动跟随),关键链路加
  `emphasis:[{type:"dashFlow", start, duration:2.5}]` 让数据包流动
- 讲解聚焦某一组件时,整个场景末尾放一个 `spotlight` 元素(数组最后一位)

填槽:节点不超过 6 个;链路标签写协议/动作("POST /order"),不写名词。

## 5. 性能对比(数据图表)

适用:压测结果、版本对比、增长故事。

骨架:
- `barChart` 分组柱状(3-5 根最佳),`title` 给结论式标题
  (「P95 延迟下降 62%」而不是「压测结果」)
- 需要趋势就换 `lineChart`(≤3 条线),`smooth:true`,关键拐点用 `emphasis` 的 `ring`/`pulse` 打在对应元素上
- 图表旁边 `note` 便签写「为什么」(根因/取舍),`rotate` 保持默认微倾

填槽:数值差拉大才好看;图例标签短于 6 字。

## 6. UI 操作演示

适用:产品功能演示、操作教学。

骨架:
- `browser`(或 `phone`)做容器,后绘制元素叠在内容区充当界面
- `folderTree` 展示工程结构(根目录 + 5-8 行,`typewriter` 逐行显现)
- `cursor` 是灵魂:`points` 3-4 个路径点(元素坐标系内),`clicks` 在关键点击时刻,
  `hold` 表示拖拽区间;入场 duration 拉到 2-3s 让轨迹可读
- 点击处可用 `spotlight`(椭圆孔)聚焦目标按钮

填槽:cursor 路径点用目标元素的中心坐标;每段路径留 0.6s 以上。

## 7. 概念三分图解

适用:三大特性、三个组成部分、三个误区。

骨架:
- 中心 `shape:ellipse`(或 artText)写主题
- 三个 `groupPanel` 呈三角/一字排开,各包一个 `list`(3 条以内)
- 中心到各面板 `connector` `arrow:false` `curve` 弓量 60-90
- 每面板 `title` 芯片用不同 `accent` 色

填槽:每组先给结论短语(≤8 字),细节放 list 条目。

## 8. 报错排查故事

适用:bug 复盘、踩坑记录、调试过程。

骨架:
- `terminal` 红字报错(`$ 命令` 行绿,输出行走 `highlight` 命中错误关键词)
- `codeDiff` 给修复 diff(配方 3)
- `person` pose:"think" 站左侧当「排查者」,`avatar`(线上用户)站右侧
- `lane` h 向两条:上「现象」下「根因」,按时间先后入场

填槽:报错文本截取关键 3-5 行,别整屏贴。

## 9. 公式/原理讲解

适用:算法、复杂度、协议原理。

骨架:
- `formula` 主角:`E = mc^2`、`\frac{a+b}{2}`、`\sum_{i=1}^{n} i`
  (TeX 子集:frac/sqrt/上下标/希腊字母/∑∫),字号 64-90
- `text` 逐变量解释,变量名用 `highlight` 芯片
- 推导步骤用多个 `formula` + `stepCard` 串联,旧式 `exit: slideOutLeft`,新式 `slideRight`

填槽:一行公式只放一个 `formula`;超长拆两步。

## 10. 收尾总结

适用:每集结尾、章节回顾。

骨架:
- `list` marker:"check" 3-5 条要点,`typewriter` 逐条显现
- 右下角 `badge`:「下集:XXX」
- 背景可叠极浅 `gridBg`(step 80,color 透明感)增质感

填槽:每条 ≤14 字;最后一条给行动指令(「动手试试」)。
