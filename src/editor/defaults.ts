import type { Anim, Project, SceneElement, ShapeVariant } from "../core/types";

/** 元素工厂与空白项目模板:新元素的合理缺省,与示例项目同一审美基调。 */

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
  }
}

/** 元素展示摘要:时间轴/图层面板用的短标签 */
export function elementLabel(el: SceneElement): string {
  const raw =
    "text" in el && el.text
      ? el.text
      : el.kind === "shape"
        ? SHAPE_LABELS[el.shape]
        : el.kind === "arrayCells"
          ? el.cells.join("")
          : el.kind === "table"
            ? el.header.join(" ")
            : el.kind === "code"
              ? el.code.split("\n")[0]
              : el.kind === "connector"
                ? (el.label ?? "连线")
                : el.kind === "list"
                  ? el.items.join(" ")
                  : el.kind === "stepCard"
                    ? el.title
                    : el.kind === "terminal"
                      ? el.code.split("\n")[0]
                      : el.kind === "progress"
                        ? (el.label ?? "进度")
                        : el.kind;
  return raw.replace(/\s+/g, " ").slice(0, 12) || KIND_LABELS[el.kind];
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
