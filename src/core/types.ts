/**
 * tmd-anim 场景数据模型 v1。
 *
 * 这是面向 coding agent 的协议(契约文档见 docs/schema.md):
 * - 一个项目 = 一个自包含 JSON 文件,纯数据、无逻辑、字段可枚举;
 * - 渲染是 (project, t) 的纯函数,预览与导出走同一条绘制路径;
 * - 字段变更必须同步 docs/schema.md 与 normalize.ts。
 */

export type ElementKind =
  | "title"
  | "artText"
  | "text"
  | "shape"
  | "input"
  | "code"
  | "table"
  | "note"
  | "badge"
  | "arrayCells"
  | "connector"
  | "image"
  | "list"
  | "stepCard"
  | "terminal"
  | "progress"
  | "kbd"
  | "browser";

/** 基础形状变体 */
export type ShapeVariant =
  | "rect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "hexagon"
  | "star"
  | "cylinder"
  | "blockArrow"
  | "speechBubble";

/**
 * 入场动画类型:
 * pop 弹出 / fade 淡入 / riseUp 上浮 / slideLeft 左侧滑入 / slideRight 右侧滑入 /
 * dropDown 顶部落入 / wipe 左向右擦除 / typewriter 打字机 / zoomIn 缩放入场 / spinIn 旋转入场
 */
export type AnimType =
  | "pop"
  | "fade"
  | "riseUp"
  | "slideLeft"
  | "slideRight"
  | "dropDown"
  | "wipe"
  | "typewriter"
  | "zoomIn"
  | "spinIn";

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

interface ElementBase {
  id: string;
  /** 画布坐标(逻辑像素,默认画布 1920x1080) */
  x: number;
  y: number;
  w: number;
  h: number;
  anim: Anim;
}

export interface TitleElement extends ElementBase {
  kind: "title";
  text: string;
  /** 命中的短语渲染为黑底白字圆角芯片 */
  highlight?: string[];
  fontSize?: number;
  color?: string;
}

/** 艺术字:描边大字(对标参考站的「艺术字」),无高亮芯片 */
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

/** 基础形状:矩形(可圆角)/ 圆形 / 三角形 / 菱形 / 六边形 / 星形 / 圆柱 / 块箭头 / 对话框,填充与描边独立可控 */
export interface ShapeElement extends ElementBase {
  kind: "shape";
  shape: ShapeVariant;
  /** 填充色;空 = 无填充 */
  fill?: string;
  /** 描边色;空 = 无描边 */
  stroke?: string;
  strokeWidth?: number;
  /** 矩形圆角 */
  radius?: number;
}

/** 输入框:白底描边圆角矩形 + 文本 + 静态光标(静态保证导出确定性) */
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
  /** 旋转角度(度,默认 -2) */
  rotate?: number;
}

export interface BadgeElement extends ElementBase {
  kind: "badge";
  text: string;
  bg?: string;
  color?: string;
  fontSize?: number;
}

/** 色块数组:从 (x, y) 起按 perRow 折行的圆角色块;w/h 仅为占位,不参与布局 */
export interface ArrayCellsElement extends ElementBase {
  kind: "arrayCells";
  cells: string[];
  /** 逐块底色(可省,省略时走粉彩色板) */
  colors?: string[];
  cellSize?: number;
  gap?: number;
  perRow?: number;
  fontSize?: number;
}

/** 连线:from/to 为画布绝对坐标;curve 为控制点相对中点的垂直偏移像素(0 = 直线);x/y/w/h 不参与布局。
 *  fromEl/toEl 为可选绑定元素 id:存在时该端点按元素布局包围盒实时解析(拖动元素连线跟随),from/to 退化为未绑定时的兜底值。
 *  arrow 缺省 true 画切线箭头,false = 纯直线/曲线。 */
export interface ConnectorElement extends ElementBase {
  kind: "connector";
  from: [number, number];
  to: [number, number];
  fromEl?: string;
  toEl?: string;
  color?: string;
  label?: string;
  width?: number;
  curve?: number;
  arrow?: boolean;
  /** 路由:smooth 自适应平滑(缺省)/ elbow 直角正交 / straight 直线 */
  route?: "smooth" | "elbow" | "straight";
}

export interface ImageElement extends ElementBase {
  kind: "image";
  /** 本地路径或 dataURL */
  src: string;
  radius?: number;
}

/** 要点列表:items 每行一条,marker 为 dot 圆点 / check 勾选 / number 序号 */
export interface ListElement extends ElementBase {
  kind: "list";
  items: string[];
  marker?: "dot" | "check" | "number";
  /** 标记与序号芯片的强调色 */
  accent?: string;
  fontSize?: number;
  color?: string;
}

/** 步骤卡片:序号芯片 + 标题 + 描述,desc 支持高亮芯片 */
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

/** 终端窗口:mac 三点标题栏 + 等宽行,$ 开头行提示符着色 */
export interface TerminalElement extends ElementBase {
  kind: "terminal";
  code: string;
  title?: string;
  fontSize?: number;
  dark?: boolean;
}

/** 进度条:可选 label + 轨道 + 百分比填充,percent 0-100 */
export interface ProgressElement extends ElementBase {
  kind: "progress";
  label?: string;
  percent?: number;
  barColor?: string;
  trackColor?: string;
  showText?: boolean;
  fontSize?: number;
}

/** 按键:text 按空格拆成键帽,单独的 + 连接符渲染为普通文本 */
export interface KbdElement extends ElementBase {
  kind: "kbd";
  text: string;
  bg?: string;
  fontSize?: number;
}

/** 浏览器窗口:mac 三点 + 地址栏胶囊,内容区默认白底,后绘制元素可叠加内容 */
export interface BrowserElement extends ElementBase {
  kind: "browser";
  url?: string;
  fontSize?: number;
  /** 内容区底色;空 = 透明白 */
  body?: string;
}

export type SceneElement =
  | TitleElement
  | ArtTextElement
  | TextElement
  | ShapeElement
  | InputElement
  | CodeElement
  | TableElement
  | NoteElement
  | BadgeElement
  | ArrayCellsElement
  | ConnectorElement
  | ImageElement
  | ListElement
  | StepCardElement
  | TerminalElement
  | ProgressElement
  | KbdElement
  | BrowserElement;

export interface Scene {
  id: string;
  name: string;
  /** 末元素结束后的停留秒数(默认 1.5) */
  dwell?: number;
  elements: SceneElement[];
  /** 场景配音:src 为 dataURL 或本地路径,volume 0-2(默认 1),随场景起点播放 */
  audio?: { src: string; volume?: number };
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
