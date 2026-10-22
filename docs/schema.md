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
| `caption` | string | 否 | 场景旁白字幕:固定画在画布底部居中的白底描边条(高 84px,距底 42px),每幕一句、跨幕同位,是拟人科普叙事的旁白位;空/缺省不画 |
| `transition` | object | 否 | 入幕转场 `{ type, duration? }`:本幕开头 duration(缺省 0.6s,钳 0.2-2)内从上一幕末帧过渡;type = `dissolve` 溶解 / `fadeBlack` 压黑 / `pushLeft` / `pushRight` 推镜 / `wipe` 左向右擦除 / `zoom` 推近(上一幕放大淡出,本幕从 1.12 缩回)。首幕无转场;非法 type 丢弃 |
| `camera` | object | 否 | 场景相机 `{ from?, to?, easing? }`:整幕连续运镜,pose 为 `{ zoom?, x?, y? }`(zoom ≥1 绕画布中心放大,钳 1-3;x/y 像素平移);按场景进度在 from→to 间插值,缓动缺省 easeInOut。播放/预览/导出生效,编辑器静态编辑视图不套相机(选择框坐标系不破) |
| `audio` | object | 否 | 场景配音 `{ src, volume?, rate?, duration? }`:src 为 dataURL 或本地音频路径,volume 0-2 默认 1;rate 播放速率 0.25-4 默认 1(>1 压缩 / <1 拉伸,变速不变调);duration 为原始媒体时长(秒,编辑器探测后自动回填,可省)。编辑器播放、导出 HTML 与导出 MP4 均随场景起点对齐;配音有效时长(duration/rate)超过元素+dwell 时场景自动延长到配音结束,不会中途截断;src 非字符串视为无配音 |

时间模型:`场景时长 = max(max(元素 anim.start + anim.duration) + dwell, 配音有效时长 duration/rate)`(空场景保底 0.1s,无配音或未探测 duration 时退化为前者);
全局时间轴 = 场景顺序拼接。

## Anim(所有元素共有)

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `start` | number | 否 | 场景内开始时刻(秒),默认 0,负值归 0 |
| `duration` | number | 否 | 动画时长(秒),默认 0.5,下限 0.05 |
| `type` | string | 否 | `pop` 弹出 / `fade` 淡入 / `riseUp` 上浮 / `dropDown` 顶部落入 / `slideLeft` 左侧滑入 / `slideRight` 右侧滑入 / `zoomIn` 缩放入场 / `spinIn` 旋转入场 / `wipe` 左向右擦除 / `typewriter` 打字机(仅文本类元素生效,其余元素回落快速淡入);戏剧化四件套:`wobble` 果冻摆动落定 / `bounce` 弹跳落地(多次触地)/ `flip` 翻面入场(经侧立压扁转到正面)/ `swing` 吊摆进人(钟摆衰减) / `draw` 连线生长(仅 `connector` 生效:线沿路径从起点长到终点,箭头与标签在末段浮现;其余元素回落快速淡入) |
| `easing` | string | 否 | `linear` 线性 / `easeOut` 缓出 / `easeInOut` 缓入缓出 / `back` 回弹 / `spring` 弹簧(衰减振荡,一次过冲后回稳);缺省时按类型取默认(pop/spinIn/dropDown 回弹,typewriter/bounce 线性,其余缓出),非法值丢弃 |

`typewriter` 也是分段显现开关:列表(list)/表格(table)/柱状图(barChart)/折线图(lineChart)/饼图(pieChart)/文件树(folderTree)/代码对比(codeDiff) 在其入场窗口内逐行/逐段/逐柱显现;其余动画类型这些元素一次性全显。

## 时间轴三段(元素级可选,缺省 = 入场后常驻到场景结束)

元素生命周期 = 入场(anim) → 常态 → 离场(exit)窗口 → 不存在。exit 与 tweens 的结束时刻都会撑起场景时长(不会被 dwell 截断)。

**exit 离场动画**:`{ type, start, duration?, easing? }`。type = `fadeOut` 淡出 / `slideOutLeft|slideOutRight|slideOutUp|slideOutDown` 四向滑出 / `zoomOut` 缩小消失 / `wipeOut` 右向左擦除;start 钳到不早于入场结束;默认缓入缓出。

**emphasis 强调事件**(数组,可多个,常驻期间叠加):`{ type, start, duration?, easing?, strength?, lines? }`。type = `pulse` 缩放脉动 / `shake` 抖动 / `glow` 发光 / `flash` 白闪 / `ring` 扩散圈 / `burst` 星芒迸发(10 道双色三角从元素边缘向外射出,主角登场配 pop 入场)/ `highlightLines`(仅 code/terminal,lines=[起,止] 行区间 1 起,扫过式高亮) / `dashFlow`(仅 connector,虚线滚动表数据流);strength 强度 0.1-3 默认 1;落在离场开始后的事件被丢弃。

**tweens 属性补间**(数组,白名单字段随时间插值,不上通用关键帧):`{ field, from?, to, start, duration, easing? }`。field = `percent`(仅 progress,进度从 from/静态值走到 to) / `activeIndex`(仅 arrayCells,高亮格从 from/静态值游移到 to,渲染取整)。

## 元素共有字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 否 | 缺省自动 `el-N` |
| `kind` | string | 是 | 元素类型,见下表;未知 kind 被跳过 |
| `x` `y` `w` `h` | number | 否 | 画布坐标(逻辑像素),缺省 0/0/200/80;`arrayCells`/`connector` 的 w/h 不参与布局(仅占位) |
| `anim` | Anim | 否 | 见上 |
| `rotate` | number | 否 | 绕元素中心旋转角度(度,顺时针),0.1 度精度;缺省 0,`note` 保留历史缺省 -2。命中测试与编辑器手柄随旋转生效。`connector` 不支持(绑定端点由元素决定,旋转无意义) |
| `float` | object \| true | 否 | 悬浮:入场结束后从静止渐入(0.6s)持续轻微漂浮,给画面呼吸感;`true` = 缺省参数。参数 `{ amp?, period?, swing? }`:amp 幅度像素(2-40,缺省 8)、period 周期秒(1-10,缺省 3)、swing = 横向椭圆轨迹(否则仅纵向);false/缺省不浮。`connector` 不支持。编辑器属性面板「悬浮」一键开关 |

## 元素类型(45 种)

| kind | 专有字段 | 说明 |
|---|---|---|
| `title` | `text`, `sub?`, `highlight?`, `fontSize?(64)`, `color?`, `kinetic?` | 标题,默认水平居中;`sub` 为副标题(居中小字灰,占元素底部一条,主标题相应收进上方);highlight 命中短语渲染为黑底白字圆角芯片;`kinetic: true` 主标题逐字错峰上浮入场(单行且无 highlight 时生效,配合 `easing:"spring"` 最佳) |
| `artText` | `text`, `fontSize?(120)`, `color?`(填充), `stroke?`(描边) | 艺术字:描边大字,水平居中,无高亮芯片 |
| `text` | `text`, `highlight?`, `fontSize?(40)`, `color?`, `align?("left")` | 正文段落,自动折行 |
| `input` | `text`, `fontSize?(34)` | 输入框视觉:白底描边圆角矩形 + 静态光标(不闪烁,保证导出确定性) |
| `code` | `code`, `filename?`, `fontSize?(26)`, `dark?` | 代码块:mac 三点标题栏 + 轻量词法着色(注释/字符串/数字/关键词,语言无关) |
| `terminal` | `code`, `title?("zsh")`, `fontSize?(24)`, `dark?(true)` | 终端窗口:mac 三点标题栏,等宽逐行输出;`$` 开头行 = 命令行(提示符着绿、命令用主文字色),其余行为弱化输出色 |
| `table` | `header: string[]`, `rows: string[][]`, `fontSize?(30)`, `headerBg?` | 表格:深色表头 + 斑马纹,列宽均分 |
| `note` | `text`, `bg?("FDE68A")`, `fontSize?(30)` | 便签:圆角色块微旋转(通用 `rotate` 缺省 -2) |
| `badge` | `text`, `bg?`, `color?`, `fontSize?(34)` | 徽章胶囊;实际宽度取 `max(w, 文本宽+内边距)` 不会被裁 |
| `list` | `items: string[]`, `marker?("dot")`, `accent?`, `fontSize?(36)`, `color?` | 要点列表:每行一条(不折行,超宽溢出);marker = `dot` 圆点 / `check` 勾 / `number` 序号芯片,marker 与序号用 accent 色 |
| `stepCard` | `num?("1")`, `title`, `desc?`, `highlight?`, `accent?`, `fontSize?(32)` | 步骤卡片:白底圆角卡,accent 序号芯片 + 加粗标题,desc 支持高亮芯片 |
| `progress` | `label?`, `percent?(60)`, `barColor?`, `trackColor?`, `showText?(true)`, `fontSize?(30)` | 进度条:percent 钳 0-100;有 label 时 label 行在上(百分比右对齐同行)、轨道占下方;无 label 时轨道在垂直居中、百分比缀于右侧;`tweens.field=percent` 可让进度走值 |
| `kbd` | `text`, `bg?`, `fontSize?(36)` | 按键:text 按空格拆成键帽(白底描边 + 底部投影),单独 `+` 渲染为灰色连接符;整行水平居中 |
| `browser` | `url?`, `fontSize?(26)`, `body?("FFFFFF")` | 浏览器窗口:mac 三点 + 地址栏胶囊;内容区为纯色底,后绘制的元素叠加其上充当页面内容 |
| `arrayCells` | `cells: string[]`, `colors?`, `cellSize?(88)`, `gap?(14)`, `perRow?`, `fontSize?`, `activeIndex?` | 色块数组(token/字节格),从 (x,y) 起按 perRow 折行;colors 按索引给逐块底色,缺省走粉彩色板;activeIndex(0 起,-1 无)高亮格描边 + 顶部指针,`tweens.field=activeIndex` 可游移 |
| `shape` | `shape("rect"/"ellipse"/"triangle"/"diamond"/"hexagon"/"star"/"cylinder"/"blockArrow"/"speechBubble")`, `fill?`, `stroke?`, `strokeWidth?`, `radius?`(矩形圆角), `text?`, `fontSize?(28)`, `color?`, `sketch?(false)`, `sketchSeed?`, `shadow?(false)` | 基础形状;fill 留空 = 无填充,fill 与描边都缺省时给浅灰底兜底。`text` 为居中内嵌文本,文字色缺省按填充亮度反推(亮色底深字/暗色底白字),`color` 可覆盖;画布上双击可改。`sketch: true` 手绘描边:轮廓按 `sketchSeed` 种子确定性抖动并叠复线——编辑器点击/粘贴时随机生成种子(缺省按元素 id 稳定展开),同种子永远同形状,预览与导出一致;协议侧想换一份手绘就换个种子。`shadow: true` 柔和投影:形状从底色上抬起一层(只随第一次上色投一次,手绘复线与内嵌文字不重复投影)。菱形(流程判断)/六边形/星形(强调)/圆柱(数据库)/块箭头(流向)/对话框为流程图与架构图常用变体 |
| `connector` | `from: [x,y]`, `to: [x,y]`, `fromEl?`, `toEl?`, `fromFocus?`, `toFocus?`, `curve?`(0 或缺省 = 自适应平滑曲线:三次贝塞尔,控制点沿两端相对位移的主轴伸展,入射角随相对位置自动调整;非 0 = 手动弓量,二次控制点垂直偏移像素), `color?`, `label?`, `width?(5)`, `arrow?(true)`, `route?(smooth)`, `dash?(false)` | 连线(直线/二次贝塞尔)+ 切线箭头 + 可选标签胶囊(曲线上 t=0.5 处);`arrow: false` = 纯直线/曲线。`route`:smooth 自适应平滑(缺省;路径被其他元素遮挡时自动改走直角避让重排,绕开障碍后仍回原语义)/ elbow 直角正交(始终避让:出口方向按绑定元素搜索锥判定,出口段钳到朝对端投影永不相交,被挡时枚举 L/Z 中段取不穿障的最短路径,拐角半径 16 圆滑)/ straight 直线(不避让);非法值回落 smooth。`fromEl`/`toEl` 为可选的绑定元素 id:元素存在时该端点实时解析——`fromFocus`/`toFocus`(归一化 [0..1, 0..1])存在则固定在元素上的相对位置(编辑器拖拽吸附绑定时自动记录,元素移动/缩放端点跟随且不滑动不跳边),否则取「元素中心朝另一端」射线与包围盒边界的交点;元素被删或 id 无效时回落到 `from`/`to` 原始坐标。解析与动画状态无关;`emphasis.field=dashFlow` 让其虚线滚动表数据流;`dash: true` 静态虚线,表「可选/回写/弱依赖」这类次要关系(可选/回写) |
| `image` | `src`, `radius?(12)` | 图片,contain 适配圆角裁剪;src 为绝对路径或 dataURL |
| `phone` | `body?`, `frame?` | 手机 mock:圆角深色机身 + 顶部刘海胶囊 + 底部 home 指示条,中间为屏幕区(body 底色);后绘制元素可叠加在屏幕上充当界面内容,与 browser 同模式 |
| `aiChat` | `title?`, `prompt?`, `reply?`, `fontSize?(26)`, `dark?` | AI 对话卡:紫色四角星徽标 + 标题头部;`prompt` 为右对齐用户气泡,`reply` 为左对齐 AI 回复区(支持高亮芯片,`dark: true` 深色模式);画布双击改 reply |
| `devNode` | `dev("database"/"redis"/"obs"/"cloud"/"server"/"api"/"queue"/"container"/"gateway"/"loadBalancer"/"cdn"/"auth"/"function"/"git")`, `label?`, `sub?`, `fontSize?(26)`, `progress?`(0-1) | 开发组件节点:架构图常用资源;左侧按变体程序化绘制的图标色块 + 主名称 + 副标题(规格/说明),主色随变体(数据库蓝/Redis 红/对象存储橙/云/服务器/API/消息队列/容器);画布上双击改名称。progress>0 时节点内底部画 8 点渐进点阵,前 progress*8 个点亮,表达迭代/完成度叙事 |
| `barChart` | `title?`, `subtitle?`, `series?: {label, value, color?}[]`(分组模式可省略), `horizontal?`, `showValue?(true)`, `axis?(true)`, `max?`(缺省按数据 niceCeil), `fontSize?(28)`, `groups?({label, values, deltas?}[])`, `groupSeries?(string[])` | 柱状图:数据驱动,垂直(缺省)或水平条形;typewriter 入场 = 逐柱生长(柱间窗口均分),其余类型一次性全显。分组模式(benchmark 图):groups 每组一组柱(系列色 = 调色板序),groupSeries 为系列名图例(>1 系列自动画),deltas[si] 非空时该柱顶画增益药丸(如 "+7.4");分组时忽略 series/horizontal 只画竖向 |
| `lineChart` | `title?`, `subtitle?`, `series: {label, color?, points: number[], dash?, dot?}[]`(≤3 条), `smooth?`, `dot?(true)`, `area?`, `axis?(true)`, `grid?(true)`, `min?/max?`(缺省按数据留边), `fontSize?(26)`, `endLabels?` | 折线图:沿路径 draw-on 入场(边界段插值);smooth 平滑曲线(Catmull-Rom 转三次贝塞尔,曲线穿过每个数据点,点圆点在线不脱支),area 面积填充;多序列自动图例。endLabels = 期刊风线尾标注:系列名直接画在线尾右侧(替代顶部图例),末点带同色光晕,draw-on 完成后才出现;系列级 `dash: true` 画虚线 + 空心点(主角实线/对照虚线),`dot: false` 只画线不画点 |
| `pieChart` | `title?`, `subtitle?`, `slices: {label, value, color?}[]`, `donut?`, `legend?("right"/"bottom"/"none")`, `startAngle?(-90)`, `fontSize?(26)` | 饼图/环图:扫掠展开入场;donut 中央显示合计;非正值 slice 被过滤 |
| `cursor` | `points: [x,y][]`(≥2), `clicks?: number[]`(场景秒,涟漪圈), `hold?: [start,end]`(按压区间) | 鼠标光标(mac 箭头):移动发生在入场窗口内(与 anim.start/duration 绑定,与动画类型无关),p=1 后停在末点;建议入场 duration 拉到 2-3s 让轨迹可读 |
| `folderTree` | `root?("project")`, `items: {name, depth?, icon?:dir/file, comment?}[]`, `fontSize?(26)` | 文件树:mac 圆角卡 + 根目录头;depth 缺省继承上一行(首行 0);typewriter 入场 = 逐行显现 |
| `codeDiff` | `filename?`, `hunks: {ctx?, lines: {tag:" "/"+"/"-", text}[]}[]`, `fontSize?(24)`, `dark?(true)` | 代码 diff:+绿/-红 行底与前缀,ctx 行灰色;typewriter 入场 = 逐行显现 |
| `spotlight` | `shape?("rect"/"ellipse")`, `strength?(0.65)` | 聚光灯:全屏暗角、只亮本元素几何区(圆角矩形/椭圆孔);约定放在 elements 数组末尾(其后的元素暗角盖不住,lint 强制校验) |
| `gridBg` | `step?(40)`, `color?`, `dot?(false)`, `axis?` | 网格/点阵背景,为流程图垫底;约定放在 elements[0](lint 校验,其前仅允许同为垫底层的 `aurora`) |
| `aurora` | `colors?`(2-3 色), `opacity?(0.22)`, `speed?(1)`, `seed?` | 动态极光背景:每色一团径向柔光围绕画布中心按 seed 相位慢漂,全屏垫底;与 gridBg 同层叠用(先 aurora 后网格);seed 换一个画面就换一份漂移 |
| `groupPanel` | `title?`, `subtitle?`, `accent?`, `fill?`, `stroke?`, `radius?(24)`, `dash?(false)` | 分组面板:圆角卡片 + 骑跨上边框的标题芯片;给出 `subtitle` 时标题改画在面板内左上(主标题 accent + 副标题灰小字,内容需自行留出 ~64px 顶边距);`dash: true` 虚线边表「候选/待定」弱分组;纯视觉归拢,子元素仍绝对坐标置内;lint 警告面板内无元素的孤儿 |
| `lane` | `direction?("h"/"v")`, `count?(2-4)`, `labels?: string[]`, `gutter?(6)` | 泳道:平行色带 + 标签(按角色/阶段分栏),元素置带内绝对坐标 |
| `quote` | `text`, `author?`, `accent?`, `fontSize?(36)` | 引用块:左侧竖条 + 引文,可署名 |
| `formula` | `text`(TeX 子集), `fontSize?(64)`, `color?` | 数学公式:支持 `\frac{}{}` `\sqrt{}` 上下标(`^`/`_`) `\sum` `\int` 希腊字母等;解析失败回落纯文本 + lint 警告;超界自动缩放到元素框内 |
| `avatar` | `name?`, `src?`(图片) 或 `initials?`, `status?("online"/"offline"/"busy")`, `color?` | 头像:圆形(图片 contain 裁剪,未就绪回退 initials)+ 名称胶囊 + 右下状态点 |
| `person` | `pose?("stand"/"point"/"think")`, `color?` | 方块人:极简扁平角色,服务「用户/系统/我们」叙事站位;think 姿态带头侧思考泡 |
| `mascot` | `variant?("doc"/"bot")`, `mood?("happy"/"wink"/"worried")`, `badge?`, `badgeColor?`, `body?`, `label?` | 吉祥物:有脸的拟人生物,拟人化叙事主角。doc = 折角纸片精(胸牌芯片 + 正文灰线 + 四肢,badge 缺省红);bot = 圆角机器人(天线绿灯 + 顶部铭牌条 + 机身内底部白条,badge 缺省黄、body 缺省蓝)。mood 驱动表情:wink 眨眼、worried 扁嘴 + 汗滴 + 双臂上举。label:doc 画在脚下元素外底部(构图预留 ~46px),bot 画在机身内底部白条。variant/mood 未知值回落 doc/happy |
| `confetti` | `mode?("rain"/"burst")`, `count?(80,钳10-200)`, `seed?(42)`, `colors?`(六色粉彩缺省) | 纸屑:种子确定性粒子,x/y/w/h 为撒布区。rain 全区循环飘落(左右摆动 + 自转,随场景时长持续);burst 自中心一次性迸发(1.6s,带重力抛物线后归于寂静)。同 seed 同帧恒同画面,预览与导出一致;想换一种撒法就换 seed |
| `cardFlow` | `items({num?, title, tags?, desc?}[])`, `active?`(高亮卡索引,缺省 -1), `note?`, `accent?`, `fontSize?(26)` | 流程卡组:编号卡片横排,卡间箭头;active 卡蓝边浅蓝底 + 底部短进度条;tags 渲染为 accent 药丸芯片(每行放不下自动截断);note 底部居中 accent 结论句。typewriter 入场 = 逐卡揭示(含箭头),其余一次性全显 |
| `specRow` | `num?`, `title`, `path?`(mono), `badge?`, `accent?`, `fontSize?(24)` | 规格行卡:左侧 accent 编号芯片 + 标题(700)+ 下行等宽路径 + 右侧徽章药丸(accent 14% 底);架构图文档条目,常与 groupPanel 纵向排布组合 |
| `docStack` | `count?(3,钳1-5)`, `label?`, `accent?`, `fontSize?(24)` | 文档堆叠:min(count,5) 张右上错位叠纸,末张 accent 描边 + 折角 + 文本行示意,label 下方居中;「K 份执行记录/样本」叙事。typewriter 入场 = 逐张出现 |
| `chipRow` | `items({text, color?, style?("tint")}[])`, `gap?`, `align?("left")`, `fontSize?(22)` | 胶囊组:一排彩色胶囊,宽度按文本自然宽度 + 内边距,单行不折行;style = `solid` 实底白字 / `tint` 浅底同色字(缺省)/ `outline` 白底描边 / `dashed` 白底虚线边(表「候选」);align 为整组对齐(left/center/right,相对元素框);typewriter 入场 = 逐个显现 |
| `ringNode` | `label?`, `sub?`, `accent?`, `fontSize?(34)`, `ring?(1)` | 圆环节点:外光晕 + 主圆环 + 内虚环,直径取 min(w,h);有 sub 时主文字上移、副文字在下。用于「模型/内核/中枢」这类抽象角色,与 devNode 的方角资源节点对位 |
| `stackList` | `label?`, `keys?(["1","K"])`, `sheets?(2,钳1-4)`, `ellipsis?(true)`, `accent?`, `fontSize?(24)` | 编号叠纸列:每段「编号 + 叠纸」纵向平分,段间竖排三点省略号,表达「1 … K 份执行记录/样本」;keys 最多 3 段(单段时不画省略号);typewriter 入场 = 逐段显现 |
| `loopArrow` | `from: [x,y]`, `to: [x,y]`, `side?("bottom")`, `depth?`(缺省按跨度自适应,钳 24-400), `label?`, `color?`, `width?(5)`, `dash?(false)`, `arrow?(true)` | 回环箭头:从 from 沿 side 折返一圈到 to 的 U 形箭头(拐角圆滑),箭头只画在 to;跨面板的「反馈/下一轮」语义,connector 的最短路径画不出来;label 画在折返段外侧(靠画布内一侧)。from/to 缺失或非有限数时该元素被整体丢弃 |

## 高亮芯片规则

`highlight` 是短语数组;解析时游标从左往右、互不重叠、同位置取最长命中。
芯片渲染会占用额外水平空间(内边距 + 间隙),折行计算已计入。

## agent 工作流建议

1. 复制 `src/samples/http.json` 为模板改内容,或先查 `docs/recipes.md`(叙事配方库:
   开场/三步教程/diff/架构数据流/图表/UI 演示/三分图解/排错/公式/收尾/拟人科普/学术信息图,
   拟人科普活例见 `src/samples/explainer.json`,学术信息图活例见 `src/samples/harness-loop.json`,
   套模板再填槽);
   桌面版协议副本在 `~/.tmd-anim/protocol/`
   (`schema.md`、`recipes.md`、`http-example.json`、`showcase-example.json`(新元素全家福)、
   `infographic-example.json`(学术信息图)、`xiaohei-style.md`、`xiaohei-example.json`、`skill.md`,
   应用启动时自动投递)。需要小黑插画风格(手绘怪诞配图)时先读 `xiaohei-style.md`。
2. 自查:运行 `pnpm anim validate <文件>` —— 退出码 2 = 结构错误必须修;警告(未知 kind、悬空绑定、
   坐标越界、负 start、空 text、场景稀疏、同刻堆叠、聚光灯次序、网格首位、孤儿面板、
   离场后强调被丢弃、光标点数不足、公式不可解析)建议逐条修。`--json` 输出结构化结果;
   `--layout` 额外输出每个元素的归一化落位与生命周期终点(免视觉自查构图)。
3. 交付:Tauri 桌面版项目文件在 `~/.tmd-anim/projects/<id>.json`,应用 watch 该文件自动热重载,改完保存即生效(顶栏「重新载入」可手动兜底);浏览器版通过「导入 JSON」或拖拽载入。

## 导出

编辑器顶栏三个导出入口:

- **导出 JSON**:项目文件本身(浏览器后端)。
- **导出网页**:单文件 HTML(项目 JSON + 内嵌播放器),双击即可播放,配音同步包含在内;渲染与编辑器同走 `drawFrame`。
- **导出视频**:Canvas 逐帧渲染 + WebCodecs(mediabunny)编码 mp4(30fps,H.264 + AAC 音轨,`fastStart: in-memory`);需要环境支持 WebCodecs(Chrome/Edge 正常,Tauri WKWebView 以 `canEncodeVideo` 预检结果为准,不支持时给出可读报错)。
