# 场景 JSON 契约(version 1)

> 这是 agent 产出动画的权威协议文档。改字段必须同步 `src/core/types.ts`、
> `src/core/normalize.ts` 与本文件。活例:`src/samples/http.json`。

## 总则

- 一个项目 = 一个自包含 JSON 文件,UTF-8,根为对象。
- 纯数据无逻辑;渲染是 `(project, t)` 的纯函数,同一文件任何时刻渲染结果一致。
- 解析宽容:缺字段/类型跑偏会被 `normalize.ts` 补默认值或跳过,结构性错误才拒绝
  (version 非 1、scenes/elements 非数组、元素非对象)。未知 `kind` 的元素被静默跳过。

## 根对象

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `version` | `1` | 是 | 协议版本,只接受字面量 1 |
| `name` | string | 否 | 项目名,默认「未命名项目」 |
| `canvas` | object | 否 | `{ width?, height?, bg? }`,默认 1920x1080 / `#F4F4F1` |
| `scenes` | Scene[] | 是 | 场景序列,顺序播放 |

## Scene

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 否 | 缺省自动 `sc-N` |
| `name` | string | 否 | 场景名,默认「场景 N」 |
| `dwell` | number | 否 | 末元素结束后的停留秒数,默认 1.5,负值归 0 |
| `elements` | Element[] | 是 | 元素列表,数组顺序即绘制顺序(后者在上) |
| `audio` | object | 否 | 场景配音 `{ src, volume?, rate?, duration? }`:src 为 dataURL 或本地音频路径,volume 0-2 默认 1;rate 播放速率 0.25-4 默认 1(>1 压缩 / <1 拉伸,变速不变调);duration 为原始媒体时长(秒,编辑器探测后自动回填,可省)。编辑器播放、导出 HTML 与导出 MP4 均随场景起点对齐;配音有效时长(duration/rate)超过元素+dwell 时场景自动延长到配音结束,不会中途截断;src 非字符串视为无配音 |

时间模型:`场景时长 = max(max(元素 anim.start + anim.duration) + dwell, 配音有效时长 duration/rate)`(空场景保底 0.1s,无配音或未探测 duration 时退化为前者);
全局时间轴 = 场景顺序拼接。

## Anim(所有元素共有)

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `start` | number | 否 | 场景内开始时刻(秒),默认 0,负值归 0 |
| `duration` | number | 否 | 动画时长(秒),默认 0.5,下限 0.05 |
| `type` | string | 否 | `pop` 弹出 / `fade` 淡入 / `riseUp` 上浮 / `dropDown` 顶部落入 / `slideLeft` 左侧滑入 / `slideRight` 右侧滑入 / `zoomIn` 缩放入场 / `spinIn` 旋转入场 / `wipe` 左向右擦除 / `typewriter` 打字机(仅文本类元素生效,其余元素回落快速淡入) |
| `easing` | string | 否 | `linear` 线性 / `easeOut` 缓出 / `easeInOut` 缓入缓出 / `back` 回弹;缺省时按类型取默认(pop/spinIn/dropDown 回弹,typewriter 线性,其余缓出),非法值丢弃 |

## 元素共有字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 否 | 缺省自动 `el-N` |
| `kind` | string | 是 | 元素类型,见下表;未知 kind 被跳过 |
| `x` `y` `w` `h` | number | 否 | 画布坐标(逻辑像素),缺省 0/0/200/80;`arrayCells`/`connector` 的 w/h 不参与布局(仅占位) |
| `anim` | Anim | 否 | 见上 |

## 元素类型(18 种)

| kind | 专有字段 | 说明 |
|---|---|---|
| `title` | `text`, `highlight?`, `fontSize?(64)`, `color?` | 标题,默认水平居中;highlight 命中短语渲染为黑底白字圆角芯片 |
| `artText` | `text`, `fontSize?(120)`, `color?`(填充), `stroke?`(描边) | 艺术字:描边大字,水平居中,无高亮芯片 |
| `text` | `text`, `highlight?`, `fontSize?(40)`, `color?`, `align?("left")` | 正文段落,自动折行 |
| `input` | `text`, `fontSize?(34)` | 输入框视觉:白底描边圆角矩形 + 静态光标(不闪烁,保证导出确定性) |
| `code` | `code`, `filename?`, `fontSize?(26)`, `dark?` | 代码块:mac 三点标题栏 + 轻量词法着色(注释/字符串/数字/关键词,语言无关) |
| `terminal` | `code`, `title?("zsh")`, `fontSize?(24)`, `dark?(true)` | 终端窗口:mac 三点标题栏,等宽逐行输出;`$` 开头行 = 命令行(提示符着绿、命令用主文字色),其余行为弱化输出色 |
| `table` | `header: string[]`, `rows: string[][]`, `fontSize?(30)`, `headerBg?` | 表格:深色表头 + 斑马纹,列宽均分 |
| `note` | `text`, `bg?("FDE68A")`, `fontSize?(30)`, `rotate?(-2)` | 便签:圆角色块微旋转 |
| `badge` | `text`, `bg?`, `color?`, `fontSize?(34)` | 徽章胶囊;实际宽度取 `max(w, 文本宽+内边距)` 不会被裁 |
| `list` | `items: string[]`, `marker?("dot")`, `accent?`, `fontSize?(36)`, `color?` | 要点列表:每行一条(不折行,超宽溢出);marker = `dot` 圆点 / `check` 勾 / `number` 序号芯片,marker 与序号用 accent 色 |
| `stepCard` | `num?("1")`, `title`, `desc?`, `highlight?`, `accent?`, `fontSize?(32)` | 步骤卡片:白底圆角卡,accent 序号芯片 + 加粗标题,desc 支持高亮芯片 |
| `progress` | `label?`, `percent?(60)`, `barColor?`, `trackColor?`, `showText?(true)`, `fontSize?(30)` | 进度条:percent 钳 0-100;有 label 时 label 行在上(百分比右对齐同行)、轨道占下方;无 label 时轨道在垂直居中、百分比缀于右侧 |
| `kbd` | `text`, `bg?`, `fontSize?(36)` | 按键:text 按空格拆成键帽(白底描边 + 底部投影),单独 `+` 渲染为灰色连接符;整行水平居中 |
| `browser` | `url?`, `fontSize?(26)`, `body?("FFFFFF")` | 浏览器窗口:mac 三点 + 地址栏胶囊;内容区为纯色底,后绘制的元素叠加其上充当页面内容 |
| `arrayCells` | `cells: string[]`, `colors?`, `cellSize?(88)`, `gap?(14)`, `perRow?`, `fontSize?` | 色块数组(token/字节格),从 (x,y) 起按 perRow 折行;colors 按索引给逐块底色,缺省走粉彩色板 |
| `shape` | `shape("rect"/"ellipse"/"triangle"/"diamond"/"hexagon"/"star"/"cylinder"/"blockArrow"/"speechBubble")`, `fill?`, `stroke?`, `strokeWidth?`, `radius?`(矩形圆角) | 基础形状;fill 留空 = 无填充,fill 与描边都缺省时给浅灰底兜底。菱形(流程判断)/六边形/星形(强调)/圆柱(数据库)/块箭头(流向)/对话框为流程图与架构图常用变体 |
| `connector` | `from: [x,y]`, `to: [x,y]`, `fromEl?`, `toEl?`, `curve?`(0 或缺省 = 自适应平滑曲线:三次贝塞尔,控制点沿两端相对位移的主轴伸展,入射角随相对位置自动调整;非 0 = 手动弓量,二次控制点垂直偏移像素), `color?`, `label?`, `width?(5)`, `arrow?(true)`, `route?(smooth)` | 连线(直线/二次贝塞尔)+ 切线箭头 + 可选标签胶囊(曲线上 t=0.5 处);`arrow: false` = 纯直线/曲线。`route`:smooth 自适应平滑(缺省)/ elbow 直角正交(出口方向按绑定元素搜索锥判定,拐角半径 16 圆滑)/ straight 直线;非法值回落 smooth。`fromEl`/`toEl` 为可选的绑定元素 id:元素存在时该端点取「元素中心朝另一端」射线与包围盒边界的交点(向下连线挂底边而非角落),拖动被绑定元素连线自动跟随;元素被删或 id 无效时回落到 `from`/`to` 原始坐标。解析与动画状态无关 |
| `image` | `src`, `radius?(12)` | 图片,contain 适配圆角裁剪;src 为绝对路径或 dataURL |

## 高亮芯片规则

`highlight` 是短语数组;解析时游标从左往右、互不重叠、同位置取最长命中。
芯片渲染会占用额外水平空间(内边距 + 间隙),折行计算已计入。

## agent 工作流建议

1. 复制 `src/samples/http.json` 为模板改内容;桌面版协议副本在 `~/.tmd-anim/protocol/`
   (`schema.md`、`http-example.json`、`xiaohei-style.md`、`xiaohei-example.json`、`skill.md`,
   应用启动时自动投递)。需要小黑插画风格(手绘怪诞配图)时先读 `xiaohei-style.md`。
2. 自查:运行 `pnpm anim validate <文件>` —— 退出码 2 = 结构错误必须修;警告(未知 kind、悬空绑定、坐标越界、负 start、空 text)建议顺手修。`--json` 输出结构化结果。
3. 交付:Tauri 桌面版项目文件在 `~/.tmd-anim/projects/<id>.json`,应用 watch 该文件自动热重载,改完保存即生效(顶栏「重新载入」可手动兜底);浏览器版通过「导入 JSON」或拖拽载入。

## 导出

编辑器顶栏三个导出入口:

- **导出 JSON**:项目文件本身(浏览器后端)。
- **导出网页**:单文件 HTML(项目 JSON + 内嵌播放器),双击即可播放,配音同步包含在内;渲染与编辑器同走 `drawFrame`。
- **导出视频**:Canvas 逐帧渲染 + WebCodecs(mediabunny)编码 mp4(30fps,H.264 + AAC 音轨,`fastStart: in-memory`);需要环境支持 WebCodecs(Chrome/Edge 正常,Tauri WKWebView 以 `canEncodeVideo` 预检结果为准,不支持时给出可读报错)。
