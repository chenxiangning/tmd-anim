import type { Anim, DevNodeVariant, Project, SceneElement, ShapeVariant } from "../core/types";
import { DEV_META } from "../core/render/devNode";

/** 元素工厂与空白项目模板:新元素的合理缺省,与示例项目同一审美基调。
 *  file-size-exempt:kind 标签/颜色/工厂/摘要的集中注册表,拆散会让同一 kind 的四处定义分离。 */

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const KIND_LABELS: Record<SceneElement["kind"], string> = {
  title: "标题",
  artText: "艺术字",
  text: "正文",
  shape: "形状",
  badge: "徽章",
  note: "便签",
  input: "输入框",
  code: "代码块",
  table: "表格",
  arrayCells: "数组格",
  connector: "连线",
  image: "图片",
  list: "要点列表",
  stepCard: "步骤卡片",
  terminal: "终端",
  progress: "进度条",
  kbd: "按键",
  browser: "浏览器",
  devNode: "开发组件",
  phone: "手机",
  aiChat: "AI 对话",
  barChart: "柱状图",
  lineChart: "折线图",
  pieChart: "饼图",
  cursor: "光标",
  folderTree: "文件树",
  codeDiff: "代码对比",
  spotlight: "聚光灯",
  gridBg: "网格背景",
  groupPanel: "分组面板",
  lane: "泳道",
  quote: "引用",
  formula: "公式",
  avatar: "头像",
  person: "人物",
  mascot: "吉祥物",
  confetti: "纸屑",
};

export const SHAPE_LABELS: Record<string, string> = {
  rect: "矩形",
  ellipse: "圆形",
  triangle: "三角形",
  diamond: "菱形",
  hexagon: "六边形",
  star: "星形",
  cylinder: "圆柱",
  blockArrow: "块箭头",
  speechBubble: "对话框",
};

export const KIND_ORDER: ReadonlyArray<SceneElement["kind"]> = [
  "title",
  "artText",
  "text",
  "shape",
  "badge",
  "note",
  "input",
  "code",
  "codeDiff",
  "table",
  "arrayCells",
  "connector",
  "image",
  "list",
  "stepCard",
  "terminal",
  "progress",
  "kbd",
  "browser",
  "devNode",
  "phone",
  "aiChat",
  "barChart",
  "lineChart",
  "pieChart",
  "folderTree",
  "cursor",
  "groupPanel",
  "lane",
  "gridBg",
  "spotlight",
  "quote",
  "formula",
  "avatar",
  "person",
  "mascot",
  "confetti",
];

/** 元素主色:元素库图标与时间轴条共用,保持「库-画布-时间轴」三者颜色一致 */
export function kindColor(kind: SceneElement["kind"]): string {
  const map: Record<SceneElement["kind"], string> = {
    title: "#111827",
    artText: "#F59E0B",
    text: "#475569",
    shape: "#3B82F6",
    badge: "#1D4ED8",
    note: "#F59E0B",
    input: "#64748B",
    code: "#059669",
    table: "#1E293B",
    arrayCells: "#0EA5E9",
    connector: "#78716C",
    image: "#A855F7",
    list: "#6366F1",
    stepCard: "#0EA5E9",
    terminal: "#334155",
    progress: "#16A34A",
    kbd: "#F59E0B",
    browser: "#A855F7",
    devNode: "#0284C7",
    phone: "#0F172A",
    aiChat: "#7C3AED",
    barChart: "#3B82F6",
    lineChart: "#10B981",
    pieChart: "#F59E0B",
    cursor: "#111827",
    folderTree: "#F59E0B",
    codeDiff: "#16A34A",
    spotlight: "#F59E0B",
    gridBg: "#94A3B8",
    groupPanel: "#64748B",
    lane: "#0EA5E9",
    quote: "#8B5CF6",
    formula: "#7C3AED",
    avatar: "#F59E0B",
    person: "#3B82F6",
    mascot: "#EC4899",
    confetti: "#F59E0B",
  };
  return map[kind];
}

export function createElement(kind: SceneElement["kind"], x: number, y: number, variant?: string, sketch?: boolean): SceneElement {
  const base: { id: string; x: number; y: number; anim: Anim } = {
    id: newId("el"),
    x,
    y,
    anim: { type: "pop", start: 0, duration: 0.6 },
  };
  // 手绘种子:点击瞬间随机,每次生成的手绘抖动都有细微差别;种子进项目所以渲染仍是纯函数
  const sketchFlag = sketch ? { sketch: true, sketchSeed: Math.round(Math.random() * 1e9) } : {};
  switch (kind) {
    case "title":
      return { ...base, kind, w: 1200, h: 120, text: "新的标题", highlight: ["标题"], fontSize: 64 };
    case "artText":
      return { ...base, kind, w: 1100, h: 200, text: "艺术字", fontSize: 120, color: "#F59E0B", stroke: "#111827" };
    case "shape": {
      // 新形状变体的缺省配色,与基础三件套同一粉彩基调
      const presets: Partial<Record<ShapeVariant, { w: number; h: number; fill: string; stroke: string }>> = {
        ellipse: { w: 300, h: 300, fill: "#FDE68A", stroke: "#F59E0B" },
        triangle: { w: 340, h: 300, fill: "#DCFCE7", stroke: "#16A34A" },
        diamond: { w: 300, h: 300, fill: "#EDE9FE", stroke: "#7C3AED" },
        hexagon: { w: 340, h: 280, fill: "#D1FAE5", stroke: "#059669" },
        star: { w: 300, h: 300, fill: "#FEF3C7", stroke: "#F59E0B" },
        cylinder: { w: 300, h: 320, fill: "#E0F2FE", stroke: "#0284C7" },
        blockArrow: { w: 380, h: 170, fill: "#DBEAFE", stroke: "#3B82F6" },
        speechBubble: { w: 380, h: 250, fill: "#FFF7ED", stroke: "#EA580C" },
      };
      const v = (variant ?? "") as ShapeVariant;
      const preset = presets[v];
      if (preset) {
        return { ...base, kind, shape: v, w: preset.w, h: preset.h, fill: preset.fill, stroke: preset.stroke, strokeWidth: 5, ...sketchFlag };
      }
      return { ...base, kind, shape: "rect", w: 340, h: 240, fill: "#DBEAFE", stroke: "#3B82F6", strokeWidth: 5, radius: 24, ...sketchFlag };
    }
    case "text":
      return { ...base, kind, w: 800, h: 100, text: "正文内容,支持 高亮 关键词", highlight: ["高亮"], fontSize: 40, align: "center" };
    case "badge":
      return { ...base, kind, w: 320, h: 76, text: "徽章", bg: "#1D4ED8", fontSize: 34 };
    case "note":
      return { ...base, kind, w: 380, h: 220, text: "便签:记得先预览,再导出", fontSize: 30 };
    case "input":
      return { ...base, kind, w: 900, h: 90, text: "输入框内容", fontSize: 36 };
    case "code":
      return {
        ...base,
        kind,
        w: 780,
        h: 300,
        filename: "demo.js",
        code: "function greet(name) {\n  return \"Hello, \" + name;\n}",
        fontSize: 26,
      };
    case "table":
      return {
        ...base,
        kind,
        w: 900,
        h: 320,
        header: ["名称", "类型"],
        rows: [["id", "string"], ["width", "number"]],
        fontSize: 30,
      };
    case "arrayCells":
      return { ...base, kind, w: 592, h: 110, cells: ["今", "天", "天", "气"], cellSize: 110, gap: 22, fontSize: 48 };
    case "connector":
      if (variant === "line") {
        return { ...base, kind, w: 24, h: 24, from: [x - 220, y] as [number, number], to: [x + 220, y] as [number, number], curve: 0, arrow: false };
      }
      return { ...base, kind, w: 24, h: 24, from: [x - 220, y] as [number, number], to: [x + 220, y] as [number, number], label: "调用", curve: 0 };
    case "image":
      return { ...base, kind, w: 480, h: 270, src: "", radius: 12 };
    case "list":
      return { ...base, kind, w: 640, h: 240, items: ["第一个要点", "第二个要点", "第三个要点"], marker: "dot", accent: "#2563EB", fontSize: 36 };
    case "stepCard":
      return { ...base, kind, w: 640, h: 170, num: "01", title: "步骤标题", desc: "支持 高亮 的步骤描述", highlight: ["高亮"], accent: "#2563EB", fontSize: 32 };
    case "terminal":
      return { ...base, kind, w: 780, h: 240, code: "$ npm run dev\nready in 283 ms", title: "zsh", fontSize: 24, dark: true };
    case "progress":
      return { ...base, kind, w: 700, h: 90, label: "进度", percent: 72, showText: true, fontSize: 28 };
    case "kbd":
      return { ...base, kind, w: 280, h: 80, text: "Cmd + K", fontSize: 30 };
    case "browser":
      return { ...base, kind, w: 900, h: 520, url: "https://example.com" };
    case "devNode": {
      const dev = ((variant ?? "database") as DevNodeVariant);
      return { ...base, kind, dev, w: 300, h: 96, label: DEV_META[dev]?.name ?? "组件", sub: "规格说明" };
    }
    case "phone":
      return { ...base, kind, w: 340, h: 700, body: "#FFFFFF", frame: "#0F172A" };
    case "aiChat":
      return { ...base, kind, w: 640, h: 420, title: "AI 助手", prompt: "帮我总结这份文档", reply: "好的,以下是三个要点:1) 背景 2) 核心方案 3) 落地步骤", fontSize: 26 };
    case "barChart":
      return {
        ...base, kind, w: 780, h: 500, title: "性能对比",
        series: [{ label: "版本 A", value: 42 }, { label: "版本 B", value: 78 }, { label: "版本 C", value: 58 }],
        showValue: true, fontSize: 28,
      };
    case "lineChart":
      return {
        ...base, kind, w: 780, h: 480, title: "增长曲线", smooth: true,
        series: [{ label: "访问量", points: [12, 25, 20, 48, 65] }, { label: "下单量", points: [5, 12, 18, 30, 52] }],
        fontSize: 26,
      };
    case "pieChart":
      return {
        ...base, kind, w: 700, h: 500, title: "流量构成", donut: true,
        slices: [{ label: "搜索", value: 45 }, { label: "直连", value: 30 }, { label: "外链", value: 25 }],
        fontSize: 26,
      };
    case "cursor":
      // 移动发生在入场窗口内:duration 拉长让轨迹可读
      return {
        ...base, kind, w: 40, h: 40,
        points: [[x, y], [x + 320, y + 180], [x + 560, y + 60]] as Array<[number, number]>,
        clicks: [0.8, 1.6],
        anim: { type: "fade", start: 0, duration: 2.2 },
      };
    case "folderTree":
      return {
        ...base, kind, w: 560, h: 430, root: "my-app", fontSize: 26,
        items: [
          { name: "src", icon: "dir" },
          { name: "index.ts", icon: "file", depth: 1 },
          { name: "app.ts", icon: "file", depth: 1 },
          { name: "components", icon: "dir", depth: 1 },
          { name: "Button.tsx", icon: "file", depth: 2 },
          { name: "package.json", icon: "file" },
        ],
        anim: { type: "typewriter", start: 0, duration: 1.2 },
      };
    case "codeDiff":
      return {
        ...base, kind, w: 840, h: 460, filename: "api.ts", fontSize: 24,
        hunks: [{
          ctx: "@@ fetchWithRetry @@",
          lines: [
            { tag: " ", text: "const cache = new Map();" },
            { tag: "-", text: "return fetch(url);" },
            { tag: "+", text: "return fetchWithTimeout(url, 3000);" },
            { tag: " ", text: "" },
          ],
        }],
        anim: { type: "typewriter", start: 0, duration: 1.2 },
      };
    case "spotlight":
      return { ...base, kind, x: x - 280, y: y - 160, w: 560, h: 320, shape: "rect", strength: 0.65, anim: { type: "fade", start: 0, duration: 0.4 } };
    case "gridBg":
      return { ...base, kind, x: 0, y: 0, w: 1920, h: 1080, step: 40, anim: { type: "fade", start: 0, duration: 0.3 } };
    case "groupPanel":
      return { ...base, kind, w: 560, h: 360, title: "核心服务", accent: "#3B82F6", anim: { type: "fade", start: 0, duration: 0.4 } };
    case "lane":
      return { ...base, kind, w: 1640, h: 820, direction: "v", count: 3, labels: ["客户端", "网关", "服务"], anim: { type: "fade", start: 0, duration: 0.4 } };
    case "quote":
      return { ...base, kind, w: 900, h: 200, text: "简洁是可靠的前提", author: "Edsger W. Dijkstra", fontSize: 36 };
    case "formula":
      return { ...base, kind, w: 640, h: 200, text: "E = mc^2", fontSize: 64 };
    case "avatar":
      return { ...base, kind, w: 260, h: 72, name: "王小黑", status: "online", color: "#3B82F6" };
    case "person":
      return { ...base, kind, w: 160, h: 340, pose: "stand", color: "#3B82F6" };
    case "mascot":
      return { ...base, kind, w: 260, h: 340, variant: ((variant ?? "doc") as "doc" | "bot"), mood: "happy", badge: "NEW", label: "新朋友" };
    case "confetti":
      return { ...base, kind, w: 1920, h: 1080, x: 0, y: 0, mode: (variant === "burst" ? "burst" : "rain"), count: 80, seed: Math.round(Math.random() * 1e9) };
  }
}

/** 元素展示摘要:时间轴/图层面板用的短标签 */
export function elementLabel(el: SceneElement): string {
  let raw: string;
  switch (el.kind) {
    case "shape":
      raw = SHAPE_LABELS[el.shape];
      break;
    case "table":
      raw = el.header.join(" ");
      break;
    case "arrayCells":
      raw = el.cells.join("");
      break;
    case "connector":
      raw = el.label ?? "连线";
      break;
    case "list":
      raw = el.items.join(" ");
      break;
    case "stepCard":
      raw = el.title;
      break;
    case "code":
    case "terminal":
      raw = el.code.split("\n")[0];
      break;
    case "progress":
      raw = el.label ?? "进度";
      break;
    case "devNode":
      raw = el.label ?? DEV_META[el.dev]?.name ?? "组件";
      break;
    case "barChart":
      raw = el.title ?? el.series?.[0]?.label ?? "柱状图";
      break;
    case "lineChart":
      raw = el.title ?? el.series?.[0]?.label ?? "折线图";
      break;
    case "pieChart":
      raw = el.title ?? el.slices?.[0]?.label ?? "饼图";
      break;
    case "cursor":
      raw = "光标";
      break;
    case "folderTree":
      raw = el.root ?? "文件树";
      break;
    case "codeDiff":
      raw = el.filename ?? "代码对比";
      break;
    case "spotlight":
      raw = "聚光灯";
      break;
    case "gridBg":
      raw = "网格背景";
      break;
    case "groupPanel":
      raw = el.title ?? "分组面板";
      break;
    case "lane":
      raw = el.labels?.join("/") ?? "泳道";
      break;
    case "quote":
      raw = el.text;
      break;
    case "formula":
      // formula 的 text 即 TeX 源,直出;缺省由尾部兜底转中文名
      raw = el.text;
      break;
    case "avatar":
      raw = el.name ?? "头像";
      break;
    case "person":
      raw = el.pose ?? "人物";
      break;
    case "mascot":
      raw = el.badge ?? el.label ?? (el.variant === "bot" ? "机器人" : "文档精");
      break;
    case "confetti":
      raw = el.mode === "burst" ? "纸屑迸发" : "纸屑飘落";
      break;
    case "title":
    case "artText":
    case "text":
    case "badge":
    case "note":
    case "input":
    case "kbd":
      raw = el.text;
      break;
    default:
      // image/phone/browser/aiChat 等无文本 kind:用中文库名兜底
      raw = KIND_LABELS[el.kind];
      break;
  }
  // shape 等 text 可选的 kind 可能是 undefined:统一兜底,空结果回落中文名
  return (raw ?? "").replace(/\s+/g, " ").slice(0, 12) || KIND_LABELS[el.kind];
}

export function createStarterProject(name: string): Project {
  return {
    version: 1,
    name,
    canvas: { width: 1920, height: 1080, bg: "#F4F4F1" },
    scenes: [
      {
        id: newId("sc"),
        name: "场景 1",
        dwell: 1.5,
        elements: [createElement("title", 360, 120)],
      },
    ],
  };
}
