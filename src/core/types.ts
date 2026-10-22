/**
 * tmd-anim 场景数据模型 v1:一个项目 = 一个自包含 JSON 文件,纯数据、字段可枚举(协议文档见 docs/schema.md);
 * 渲染是 (project, t) 的纯函数,预览与导出走同一条绘制路径;字段变更必须同步 docs/schema.md 与 normalize.ts。
 * file-size-exempt:纯类型注册表,元素 kind 并集集中于此,拆分只会制造 import 噪音。
 */

export type ElementKind =
  | "title" | "artText" | "text" | "shape" | "input" | "code" | "table" | "note" | "badge" | "arrayCells"
  | "connector" | "image" | "list" | "stepCard" | "terminal" | "progress" | "kbd" | "browser"
  | "devNode" | "phone" | "aiChat";
export type ShapeVariant =
  | "rect" | "ellipse" | "triangle" | "diamond" | "hexagon"
  | "star" | "cylinder" | "blockArrow" | "speechBubble";

/** 入场动画:pop 弹出/fade 淡入/riseUp 上浮/slideLeft|slideRight 侧滑/dropDown 落入/wipe 擦除/typewriter 打字机/zoomIn 缩放/spinIn 旋转;
 *  戏剧化四件套:wobble 果冻摆动落定/bounce 弹跳落地/flip 翻面入场/swing 吊摆进人 */
export type AnimType =
  | "pop" | "fade" | "riseUp" | "slideLeft" | "slideRight" | "dropDown"
  | "wipe" | "typewriter" | "zoomIn" | "spinIn"
  | "wobble" | "bounce" | "flip" | "swing"
  | "draw";

/** 缓动:缺省(auto)时按动画类型取默认(pop/spinIn/dropDown 回弹,typewriter 线性,其余缓出) */
export type EasingKind = "linear" | "easeOut" | "easeInOut" | "back";

export interface Anim {
  type: AnimType;
  /** 场景内开始时刻(秒) */
  start: number;
  /** 动画时长(秒) */
  duration: number;
  easing?: EasingKind;
}

/** 离场动画类型:fadeOut 淡出 / 四向滑出 / zoomOut 缩小消失 / wipeOut 右向左擦除 */
export type ExitType =
  | "fadeOut" | "slideOutLeft" | "slideOutRight" | "slideOutUp" | "slideOutDown"
  | "zoomOut" | "wipeOut";

/** 离场动画:元素生命周期 = 入场 → 常态 → exit 窗口 → 不存在;exit 结束时刻计入场景时长 */
export interface ExitAnim {
  type: ExitType;
  /** 场景内离场开始时刻(秒);normalize 钳到不早于入场结束 */
  start: number;
  duration: number;
  easing?: EasingKind;
}

/** 强调事件类型:通用 pulse 缩放 / shake 抖动 / glow 发光 / flash 白闪 / ring 扩散圈 / burst 星芒迸发;
 *  专用 highlightLines(code/terminal 行区间高亮)、dashFlow(connector 虚线数据流) */
export type EmphasisType = "pulse" | "shake" | "glow" | "flash" | "ring" | "burst" | "highlightLines" | "dashFlow";

export interface EmphasisEvent {
  type: EmphasisType;
  /** 场景内开始时刻(秒) */
  start: number;
  duration: number;
  easing?: EasingKind;
  /** 强度倍率(0.1-3,默认 1) */
  strength?: number;
  /** highlightLines 的行区间,1 起含端点 */
  lines?: [number, number];
}

/** 属性补间:白名单字段随时间线性/缓动插值,白名单按版本扩,不上通用关键帧。
 *  percent = progress.percent(进度走到 to);activeIndex = arrayCells.activeIndex(高亮格游移) */
export interface Tween {
  field: "percent" | "activeIndex";
  /** 缺省取元素静态值(progress 静态 percent / arrayCells 静态 activeIndex) */
  from?: number;
  to: number;
  start: number;
  duration: number;
  easing?: EasingKind;
}

interface ElementBase {
  id: string;
  /** 画布坐标(逻辑像素,默认画布 1920x1080) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 绕中心旋转角度(度,顺时针);缺省 0,便签保持历史缺省 -2(见 schema 通用字段) */
  rotate?: number;
  anim: Anim;
  /** 离场动画(可选):缺省 = 入场后常驻到场景结束 */
  exit?: ExitAnim;
  /** 强调事件(可选,可多个):常驻期间叠加动效 */
  emphasis?: EmphasisEvent[];
  /** 属性补间(可选,可多个):白名单字段随时间变化 */
  tweens?: Tween[];
  /** 悬浮(可选):入场结束后持续轻微漂浮,呼吸感;true = 缺省参数 */
  float?: ElementFloat;
}

/** 悬浮参数:amp 幅度像素(2-40,缺省 8)/ period 秒(1-10,缺省 3)/ swing = 横向椭圆轨迹 */
export interface ElementFloat {
  amp?: number;
  period?: number;
  swing?: boolean;
}

export interface TitleElement extends ElementBase {
  kind: "title";
  text: string;
  /** 副标题(居中小字灰,占元素底部一条);主标题相应收进上方 */
  sub?: string;
  /** 命中的短语渲染为黑底白字圆角芯片 */
  highlight?: string[];
  fontSize?: number;
  color?: string;
}

export interface ArtTextElement extends ElementBase {
  kind: "artText";
  text: string;
  fontSize?: number;
  color?: string;
  stroke?: string;
}

export interface TextElement extends ElementBase {
  kind: "text";
  text: string;
  highlight?: string[];
  fontSize?: number;
  color?: string;
  align?: "left" | "center";
}

/** 基础形状:矩形(可圆角)/圆/三角/菱形/六边形/星形/圆柱/块箭头/对话框,填充描边独立可控 */
export interface ShapeElement extends ElementBase {
  kind: "shape";
  shape: ShapeVariant;
  /** 填充/描边色;空 = 无填充/无描边 */
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  text?: string; // 内嵌文本:居中绘制,默认文字色按填充亮度反推
  fontSize?: number;
  color?: string;
  /** 手绘描边:轮廓按 sketchSeed(缺省按 id)种子确定性抖动并叠复线,渲染仍是 (project,t) 纯函数 */
  sketch?: boolean;
  sketchSeed?: number; // 点击生成时的随机种子;重开关手绘/粘贴会换种子
  /** 柔和投影:把形状从底色上抬起一层,只随第一次上色(填充优先,否则描边)投一次 */
  shadow?: boolean;
}

export interface InputElement extends ElementBase {
  kind: "input";
  text: string;
  fontSize?: number;
}

export interface CodeElement extends ElementBase {
  kind: "code";
  filename?: string;
  code: string;
  fontSize?: number;
  /** true = 深色底 */
  dark?: boolean;
}

export interface TableElement extends ElementBase {
  kind: "table";
  header: string[];
  rows: string[][];
  fontSize?: number;
  headerBg?: string;
}

export interface NoteElement extends ElementBase {
  kind: "note";
  text: string;
  bg?: string;
  fontSize?: number;
}

export interface BadgeElement extends ElementBase {
  kind: "badge";
  text: string;
  bg?: string;
  color?: string;
  fontSize?: number;
}

export interface ArrayCellsElement extends ElementBase {
  kind: "arrayCells";
  cells: string[];
  /** 逐块底色(可省,省略时走粉彩色板) */
  colors?: string[];
  cellSize?: number;
  gap?: number;
  perRow?: number;
  fontSize?: number;
  /** 高亮格下标(0 起,-1/缺省 = 无高亮);tweens.field=activeIndex 可让高亮随时间游移 */
  activeIndex?: number;
}

/** 连线:from/to 画布绝对坐标;curve 为控制点相对中点的垂直偏移像素(0 = 直线);x/y/w/h 不参与布局。
 *  fromEl/toEl 绑定元素 id(可选):存在时端点按元素包围盒实时解析(from/to 兜底);fromFocus/toFocus = 端点在元素上的归一化位置,记录后固定不跳边。
 *  arrow 缺省 true 画切线箭头,false = 纯直线/曲线。 */
export interface ConnectorElement extends ElementBase {
  kind: "connector";
  from: [number, number];
  to: [number, number];
  fromEl?: string;
  toEl?: string;
  fromFocus?: [number, number];
  toFocus?: [number, number];
  color?: string;
  label?: string;
  width?: number;
  curve?: number;
  arrow?: boolean;
  /** 路由:smooth 自适应平滑(缺省)/ elbow 直角正交 / straight 直线 */
  route?: "smooth" | "elbow" | "straight";
  /** 虚线:表达"可选/回写/弱依赖"这类次要关系 */
  dash?: boolean;
}

export interface ImageElement extends ElementBase {
  kind: "image";
    src: string;
  radius?: number;
}

export interface ListElement extends ElementBase {
  kind: "list";
  items: string[];
  marker?: "dot" | "check" | "number";
  /** 标记与序号芯片的强调色 */
  accent?: string;
  fontSize?: number;
  color?: string;
}

export interface StepCardElement extends ElementBase {
  kind: "stepCard";
  num?: string;
  title: string;
  desc?: string;
  /** desc 中命中的短语渲染为高亮芯片 */
  highlight?: string[];
  /** 序号芯片与左侧强调色 */
  accent?: string;
  fontSize?: number;
}

export interface TerminalElement extends ElementBase {
  kind: "terminal";
  code: string;
  title?: string;
  fontSize?: number;
  dark?: boolean;
}

export interface ProgressElement extends ElementBase {
  kind: "progress";
  label?: string;
  percent?: number;
  barColor?: string;
  trackColor?: string;
  showText?: boolean;
  fontSize?: number;
}

export interface KbdElement extends ElementBase {
  kind: "kbd";
  text: string;
  bg?: string;
  fontSize?: number;
}

export interface BrowserElement extends ElementBase {
  kind: "browser";
  url?: string;
  fontSize?: number;
  /** 内容区底色;空 = 透明白 */
  body?: string;
}

/** 开发组件节点:左侧图标 + 主名称 + 副标题,图标与主色由 dev 变体决定(架构图常用资源) */
export interface DevNodeElement extends ElementBase {
  kind: "devNode";
  dev: "database" | "redis" | "obs" | "cloud" | "server" | "api" | "queue" | "container" | "gateway" | "loadBalancer" | "cdn" | "auth" | "function" | "git";
  label?: string; // 主名称,缺省取变体中文名
  sub?: string;
  fontSize?: number;
  /** 渐进点阵 0-1:节点底部画 8 点条,前 progress*8 个点亮(迭代进度叙事) */
  progress?: number;
}

export type DevNodeVariant = DevNodeElement["dev"];

/** 流程卡组:编号卡片横排,卡间箭头,active 卡高亮(蓝边浅底+底部进度条),底部一句结论 */
export interface CardFlowElement extends ElementBase {
  kind: "cardFlow";
  items: { num?: string; title: string; tags?: string[]; desc?: string }[];
  /** 高亮卡索引(缺省 -1 = 无) */
  active?: number;
  /** 底部居中结论文字(accent 色) */
  note?: string;
  accent?: string;
  fontSize?: number;
}

/** 规格行卡:编号芯片 + 标题 + mono 路径 + 右侧徽章药丸(架构文档条目);配 groupPanel 用 */
export interface SpecRowElement extends ElementBase {
  kind: "specRow";
  num?: string;
  title: string;
  /** 等宽字体路径,如 systemprompt.md */
  path?: string;
  /** 右侧徽章药丸文字,如 every call */
  badge?: string;
  accent?: string;
  fontSize?: number;
}

/** 文档堆叠:错位叠纸 + 折角,下方标注(K 份样本/执行记录叙事) */
export interface DocStackElement extends ElementBase {
  kind: "docStack";
  /** 张数,画 min(count,5) 张错位 */
  count?: number;
  /** 下方标注文字 */
  label?: string;
  accent?: string;
  fontSize?: number;
}

/** 胶囊组:一排彩色胶囊(状态/变体/字段名),四种风格;单行横排,由 align 决定组内对齐 */
export interface ChipRowElement extends ElementBase {
  kind: "chipRow";
  items: { text: string; color?: string; style?: ChipStyle }[];
  /** 胶囊间距,缺省字号 0.55 倍 */
  gap?: number;
  /** 整组对齐方式,缺省 left(贴 el.x) */
  align?: "left" | "center" | "right";
  fontSize?: number;
}

/** 胶囊风格:solid 实底白字 / tint 浅底同色字(缺省)/ outline 白底描边 / dashed 白底虚线边 */
export type ChipStyle = "solid" | "tint" | "outline" | "dashed";

/** 圆环节点:同心圆环 + 居中主文字/副文字(模型、内核、中枢这类抽象角色) */
export interface RingNodeElement extends ElementBase {
  kind: "ringNode";
  label?: string;
  sub?: string;
  accent?: string;
  fontSize?: number;
  /** 环粗细倍数,缺省 1(0.5 更细,2 更粗) */
  ring?: number;
}

/** 回环箭头:U 形折返箭头(反馈/下一轮),表达"走到头再回到开头"的循环语义 */
export interface LoopArrowElement extends ElementBase {
  kind: "loopArrow";
  from: [number, number];
  to: [number, number];
  /** U 形折返伸向哪一侧,缺省 bottom */
  side?: "top" | "bottom" | "left" | "right";
  /** 折返深度(px),缺省按两端跨度自适应,钳 24-400 */
  depth?: number;
  label?: string;
  color?: string;
  dash?: boolean;
  width?: number;
  arrow?: boolean;
}

/** 编号叠纸列:首段/末段编号 + 叠纸 + 中间省略号(Base Executions 的 1 … K 叙事) */
export interface StackListElement extends ElementBase {
  kind: "stackList";
  /** 顶部标题 */
  label?: string;
  /** 各段编号文字,缺省 ["1","K"],最多 3 段 */
  keys?: string[];
  /** 每段叠纸张数 1-4,缺省 2 */
  sheets?: number;
  /** 中间是否画竖向省略号,缺省 true(仅 2 段以上生效) */
  ellipsis?: boolean;
  accent?: string;
  fontSize?: number;
}

/** 手机 mock:圆角机身 + 刘海 + 屏幕区(body 底色),后绘制元素可叠加充当界面内容 */
export interface PhoneElement extends ElementBase {
  kind: "phone";
  body?: string; // 屏幕底色
  frame?: string; // 机身/边框色
}

/** AI 对话卡:星标头部 + 标题,用户消息气泡与 AI 回复区(reply 支持高亮芯片) */
export interface AiChatElement extends ElementBase {
  kind: "aiChat";
  title?: string;
  prompt?: string; // 用户消息
  reply?: string; // AI 回复
  fontSize?: number;
  dark?: boolean;
}

/** 柱状图:series 数据驱动,水平/垂直可选,逐柱生长入场(柱间窗口 = duration 均分) */
export interface BarChartElement extends ElementBase {
  kind: "barChart";
  title?: string;
  /** 标题下的副标题(小字灰),占两行标题高度 */
  subtitle?: string;
  /** 单系列数据;分组模式(groups)下可省略 */
  series?: { label: string; value: number; color?: string }[];
  horizontal?: boolean;
  showValue?: boolean;
  axis?: boolean;
  /** 数值上限,缺省按数据最大值取整放大 */
  max?: number;
  fontSize?: number;
  /** 分组模式:多系列按组对比(benchmark 图);给出时忽略 series/horizontal,只画竖向 */
  groups?: { label: string; values: number[]; deltas?: (string | null)[] }[];
  /** 分组模式的系列名(图例),长度须与每组 values 一致 */
  groupSeries?: string[];
}

/** 折线图:1-3 条序列,沿路径 draw-on 入场;smooth 贝塞尔平滑,area 填充渐变 */
export interface LineChartElement extends ElementBase {
  kind: "lineChart";
  title?: string;
  /** 标题下的副标题(小字灰),占两行标题高度 */
  subtitle?: string;
  series: { label: string; color?: string; points: number[]; dash?: boolean; dot?: boolean }[];
  smooth?: boolean;
  dot?: boolean;
  area?: boolean;
  axis?: boolean;
  grid?: boolean;
  min?: number;
  max?: number;
  fontSize?: number;
  /** 线尾直接标注系列名(替代顶部图例);开启时隐藏图例,末点加光晕 */
  endLabels?: boolean;
}

/** 饼图/环图:扫掠展开入场;donut 中央留白,legend right/bottom */
export interface PieChartElement extends ElementBase {
  kind: "pieChart";
  title?: string;
  /** 标题下的副标题(小字灰),占两行标题高度 */
  subtitle?: string;
  slices: { label: string; value: number; color?: string }[];
  donut?: boolean;
  legend?: "right" | "bottom" | "none";
  /** 起始角(度,缺省 -90 = 12 点方向) */
  startAngle?: number;
  fontSize?: number;
}

/** 鼠标光标:points 路径逐段插值移动(时间缺省均分),clicks 场景秒点涟漪,hold 按压区间 */
export interface CursorElement extends ElementBase {
  kind: "cursor";
  points: [number, number][];
  clicks?: number[];
  hold?: [number, number];
}

/** 文件树:mac 风格,逐行 stagger 入场(行窗口 = duration 均分);depth 缺省按 icon 推断(首行 dir=0) */
export interface FolderTreeElement extends ElementBase {
  kind: "folderTree";
  root?: string;
  items: { name: string; depth?: number; icon?: "dir" | "file"; comment?: string }[];
  fontSize?: number;
}

/** 代码 diff:行级增删改着色(+绿 -红 ctx 灰),per-line stagger 入场 */
export interface CodeDiffElement extends ElementBase {
  kind: "codeDiff";
  filename?: string;
  hunks: { ctx?: string; lines: { tag: " " | "+" | "-"; text: string }[] }[];
  fontSize?: number;
  dark?: boolean;
}

/** 聚光灯:全屏暗角、只亮本元素几何区(矩形/椭圆孔);约定元素数组靠后绘制,lint 强制校验 */
export interface SpotlightElement extends ElementBase {
  kind: "spotlight";
  shape?: "rect" | "ellipse";
  /** 暗角强度 0-1,缺省 0.65 */
  strength?: number;
}

/** 网格背景:坐标纸/点阵,为流程图垫底;约定元素数组首位绘制,lint 校验 */
export interface GridBgElement extends ElementBase {
  kind: "gridBg";
  step?: number;
  color?: string;
  /** true = 点阵,false = 细线 */
  dot?: boolean;
  /** 中线加重(坐标轴感) */
  axis?: boolean;
}

/** 分组面板:圆角卡片 + 标题芯片,纯视觉归拢(子元素仍绝对坐标);lint 警告孤儿 panel */
export interface GroupPanelElement extends ElementBase {
  kind: "groupPanel";
  title?: string;
  /** 标题下的副标题(小字灰);给出时标题改画在面板内左上,不再骑跨上边框 */
  subtitle?: string;
  accent?: string;
  fill?: string;
  stroke?: string;
  radius?: number;
  /** 虚线边框:表达"候选/待定"这类弱分组 */
  dash?: boolean;
}

/** 泳道:2-4 条平行色带 + 标签(角色/阶段分栏);元素置带内绝对坐标 */
export interface LaneElement extends ElementBase {
  kind: "lane";
  /** h = 横向条带(上下排),v = 纵向条带(左右列) */
  direction?: "h" | "v";
  count?: number;
  labels?: string[];
  gutter?: number;
}

/** 引用块:左侧竖条 + 正文,可署名 */
export interface QuoteElement extends ElementBase {
  kind: "quote";
  text: string;
  author?: string;
  accent?: string;
  fontSize?: number;
}

/** 数学公式:TeX 子集(frac/sqrt/上下标/和式积分/希腊字母)轻量排版;解析失败回落纯文本 + lint 警告 */
export interface FormulaElement extends ElementBase {
  kind: "formula";
  text: string;
  fontSize?: number;
  color?: string;
}

/** 头像:圆形(图片或 initials)+ 名称胶囊 + 在线状态点;配 lane 做角色分工 */
export interface AvatarElement extends ElementBase {
  kind: "avatar";
  name?: string;
  /** 图片路径/dataURL;与 initials 二选一,优先 src */
  src?: string;
  /** 缺省取 name 首字符 */
  initials?: string;
  status?: "online" | "offline" | "busy";
  color?: string;
}

/** 方块人:极简扁平角色(stand/point/think),服务「用户/系统/我们」叙事站位 */
export interface PersonElement extends ElementBase {
  kind: "person";
  pose?: "stand" | "point" | "think";
  color?: string;
}

/** 吉祥物:有脸的拟人生物(doc 文档精 / bot 机器人),表情 + 胸牌 + 脚下名牌,拟人化叙事主角 */
export interface MascotElement extends ElementBase {
  kind: "mascot";
  /** doc = 折角纸片精,bot = 圆角机器人(天线 + 铭牌) */
  variant?: "doc" | "bot";
  /** happy 笑脸 / wink 眨眼 / worried 焦虑(扁嘴 + 汗滴) */
  mood?: "happy" | "wink" | "worried";
  /** 胸牌/铭牌文字(doc 左上芯片,bot 顶部铭牌条) */
  badge?: string;
  /** 胸牌底色;缺省 doc 红 / bot 黄 */
  badgeColor?: string;
  /** 机身/纸面底色;缺省 doc 白 / bot 蓝 */
  body?: string;
  /** 名牌:doc 画在脚下元素外(构图预留 ~46px),bot 画在机身内底部白条 */
  label?: string;
}

/** 纸屑:种子确定性粒子(rain 全区循环飘落 / burst 自中心一次性迸发),庆祝/落版用 */
export interface ConfettiElement extends ElementBase {
  kind: "confetti";
  /** rain 持续飘落(循环)/ burst 迸发一次后归于寂静 */
  mode?: "rain" | "burst";
  /** 粒子数,10-200,缺省 80 */
  count?: number;
  /** 随机种子:同种子同帧恒同画面(渲染纯函数的前提) */
  seed?: number;
  /** 粒子色板;缺省六色粉彩 */
  colors?: string[];
}

export type SceneElement =
  | TitleElement | ArtTextElement | TextElement | ShapeElement | InputElement | CodeElement
  | TableElement | NoteElement | BadgeElement | ArrayCellsElement | ConnectorElement | ImageElement
  | ListElement | StepCardElement | TerminalElement | ProgressElement | KbdElement | BrowserElement
  | DevNodeElement | PhoneElement | AiChatElement
  | BarChartElement | LineChartElement | PieChartElement | CursorElement | FolderTreeElement
  | CodeDiffElement | SpotlightElement | GridBgElement | GroupPanelElement | LaneElement
  | QuoteElement | FormulaElement | AvatarElement | PersonElement
  | MascotElement | ConfettiElement
  | CardFlowElement | SpecRowElement | DocStackElement
  | ChipRowElement | RingNodeElement | LoopArrowElement | StackListElement;

export interface Scene {
  id: string;
  name: string;
  dwell?: number; // 末元素结束后的停留秒数(默认 1.5)
  elements: SceneElement[];
  /** 场景旁白字幕:固定画在画布底部居中的白底描边条(每幕一句,跨幕同位);空 = 不画 */
  caption?: string;
  /** 场景配音:src 为 dataURL 或本地路径,volume 0-2(默认 1);rate 播放速率 0.25-4(默认 1,
   *  >1 压缩 / <1 拉伸,变速不变调);duration 为探测的原始时长(秒,编辑器自动回填)。
   *  配音有效时长(duration/rate)超过画面时场景自动延长,保证播完再切幕。 */
  audio?: { src: string; volume?: number; rate?: number; duration?: number };
}

export interface Project {
  version: 1;
  name: string;
  canvas?: {
    width?: number;
    height?: number;
    bg?: string;
  };
  scenes: Scene[];
}
