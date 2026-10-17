/**
 * tmd-anim 场景数据模型 v1:一个项目 = 一个自包含 JSON 文件,纯数据、字段可枚举(协议文档见 docs/schema.md);
 * 渲染是 (project, t) 的纯函数,预览与导出走同一条绘制路径;字段变更必须同步 docs/schema.md 与 normalize.ts。
 */

export type ElementKind =
  | "title" | "artText" | "text" | "shape" | "input" | "code" | "table" | "note" | "badge" | "arrayCells"
  | "connector" | "image" | "list" | "stepCard" | "terminal" | "progress" | "kbd" | "browser"
  | "devNode" | "phone" | "aiChat";
export type ShapeVariant =
  | "rect" | "ellipse" | "triangle" | "diamond" | "hexagon"
  | "star" | "cylinder" | "blockArrow" | "speechBubble";

/** 入场动画:pop 弹出/fade 淡入/riseUp 上浮/slideLeft|slideRight 侧滑/dropDown 落入/wipe 擦除/typewriter 打字机/zoomIn 缩放/spinIn 旋转 */
export type AnimType =
  | "pop" | "fade" | "riseUp" | "slideLeft" | "slideRight" | "dropDown"
  | "wipe" | "typewriter" | "zoomIn" | "spinIn";

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
  /** 绕中心旋转角度(度,顺时针);缺省 0,便签保持历史缺省 -2(见 schema 通用字段) */
  rotate?: number;
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
  dev: "database" | "redis" | "obs" | "cloud" | "server" | "api" | "queue" | "container";
  label?: string; // 主名称,缺省取变体中文名
  sub?: string;
  fontSize?: number;
}

export type DevNodeVariant = DevNodeElement["dev"];

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

export type SceneElement =
  | TitleElement | ArtTextElement | TextElement | ShapeElement | InputElement | CodeElement
  | TableElement | NoteElement | BadgeElement | ArrayCellsElement | ConnectorElement | ImageElement
  | ListElement | StepCardElement | TerminalElement | ProgressElement | KbdElement | BrowserElement
  | DevNodeElement | PhoneElement | AiChatElement;

export interface Scene {
  id: string;
  name: string;
  dwell?: number; // 末元素结束后的停留秒数(默认 1.5)
  elements: SceneElement[];
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
