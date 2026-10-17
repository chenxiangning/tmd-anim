import type { ArrayCellsElement, CodeElement, ConnectorElement, SceneElement, ShapeElement, TableElement, TextElement } from "../core/types";
import { KIND_LABELS } from "./defaults";
import { NEW_KIND_SCHEMAS } from "./propertySchema.new";

/**
 * 属性面板字段 schema:每种元素一组字段,read/write 直接面向元素对象,
 * 面板组件保持通用渲染,不知道任何具体 kind 的字段细节。
 * 并行特性新增组件(browser/list/stepCard/terminal/progress/kbd)的条目在 propertySchema.new.ts。
 */

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "color"
  | "select"
  | "tags"
  | "tsv"
  | "lines"
  | "bool"
  | "point"
  | "image";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  rows?: number;
  options?: Array<{ value: string; label: string }>;
  read: (el: SceneElement) => string;
  write: (el: SceneElement, value: string) => SceneElement;
}

const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v));
const numOr = (v: string, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const patch = (el: SceneElement, fields: Record<string, unknown>): SceneElement =>
  ({ ...el, ...fields }) as SceneElement;

const plain = (key: string, label: string, type: FieldType, extra?: Partial<FieldDef>): FieldDef => ({
  key,
  label,
  type,
  read: (el) => str((el as unknown as Record<string, unknown>)[key]),
  write: (el, v) => patch(el, { [key]: v }),
  ...extra,
});

const numberField = (key: string, label: string, fallback: number): FieldDef => ({
  key,
  label,
  type: "number",
  read: (el) => str((el as unknown as Record<string, unknown>)[key] ?? fallback),
  write: (el, v) => patch(el, { [key]: numOr(v, fallback) }),
});

const fontSizeField = (fallback: number): FieldDef => numberField("fontSize", "字号", fallback);

const tagsField: FieldDef = {
  key: "highlight",
  label: "关键词(逗号分隔)",
  type: "tags",
  placeholder: "高亮甲,高亮乙",
  read: (el) => ((el as TextElement).highlight ?? []).join(","),
  write: (el, v) =>
    patch(el, {
      highlight: v
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
    }),
};

const pointField = (key: "from" | "to", label: string): FieldDef => ({
  key,
  label,
  type: "point",
  placeholder: "x, y",
  read: (el) => {
    const p = (el as ConnectorElement)[key];
    return `${Math.round(p[0])}, ${Math.round(p[1])}`;
  },
  write: (el, v) => {
    const parts = v.split(/[,\s]+/).filter(Boolean).map(Number);
    const fallback = (el as ConnectorElement)[key];
    const point: [number, number] = [
      Number.isFinite(parts[0]) ? parts[0] : fallback[0],
      Number.isFinite(parts[1]) ? parts[1] : fallback[1],
    ];
    // 手改端点坐标即视为脱离元素绑定
    return patch(el, { [key]: point, [`${key}El`]: undefined });
  },
});

const tsvField: FieldDef = {
  key: "table",
  label: "表格数据(首行表头,Tab 分列)",
  type: "tsv",
  rows: 5,
  read: (el) => {
    const table = el as TableElement;
    return [table.header, ...table.rows].map((row) => row.join("\t")).join("\n");
  },
  write: (el, v) => {
    const lines = v.split("\n").filter((line) => line.trim().length > 0);
    const cells = lines.map((line) => line.split("\t").map((c) => c.trim()));
    const [header = [], ...rows] = cells;
    return patch(el, { header, rows });
  },
};

const cellsField: FieldDef = {
  key: "cells",
  label: "色块内容(每行一块)",
  type: "lines",
  rows: 5,
  read: (el) => (el as ArrayCellsElement).cells.join("\n"),
  write: (el, v) => patch(el, { cells: v.split("\n").map((s) => s.trim()).filter(Boolean) }),
};

const SHAPE_VARIANTS = new Set(["rect", "ellipse", "triangle", "diamond", "hexagon", "star", "cylinder", "blockArrow", "speechBubble"]);

const shapeOptions = [
  { value: "rect", label: "矩形" },
  { value: "ellipse", label: "圆形" },
  { value: "triangle", label: "三角形" },
  { value: "diamond", label: "菱形" },
  { value: "hexagon", label: "六边形" },
  { value: "star", label: "星形" },
  { value: "cylinder", label: "圆柱" },
  { value: "blockArrow", label: "块箭头" },
  { value: "speechBubble", label: "对话框" },
];

const colorsField: FieldDef = {
  key: "colors",
  label: "逐块底色(每行一个,可留空)",
  type: "lines",
  rows: 4,
  placeholder: "#DBEAFE",
  read: (el) => ((el as ArrayCellsElement).colors ?? []).join("\n"),
  write: (el, v) => {
    const colors = v.split("\n").map((s) => s.trim()).filter(Boolean);
    return patch(el, { colors: colors.length > 0 ? colors : undefined });
  },
};

export const SCHEMAS = {
  title: {
    title: "标题属性",
    fields: [
      plain("text", "文本", "textarea", { rows: 2 }),
      tagsField,
      fontSizeField(64),
      plain("color", "颜色", "color"),
    ],
  },
  artText: {
    title: "艺术字属性",
    fields: [
      plain("text", "文本", "textarea", { rows: 2 }),
      fontSizeField(96),
      plain("color", "填充色", "color"),
      plain("stroke", "描边色", "color"),
    ],
  },
  text: {
    title: "正文属性",
    fields: [
      plain("text", "文本", "textarea", { rows: 3 }),
      tagsField,
      fontSizeField(40),
      plain("color", "颜色", "color"),
      {
        key: "align",
        label: "对齐",
        type: "select",
        options: [
          { value: "left", label: "左对齐" },
          { value: "center", label: "居中" },
        ],
        read: (el) => str((el as TextElement).align ?? "left"),
        write: (el, v) => patch(el, { align: v === "center" ? "center" : "left" }),
      },
    ],
  },
  shape: {
    title: "形状属性",
    fields: [
      {
        key: "shape",
        label: "形状",
        type: "select",
        options: shapeOptions,
        read: (el) => str((el as ShapeElement).shape ?? "rect"),
        write: (el, v) => patch(el, { shape: SHAPE_VARIANTS.has(v) ? v : "rect" }),
      },
      plain("fill", "填充(留空则无填充)", "color"),
      plain("stroke", "描边色", "color"),
      numberField("strokeWidth", "描边宽", 5),
      numberField("radius", "圆角(矩形)", 24),
      plain("text", "内嵌文本", "text", { placeholder: "居中显示" }),
      fontSizeField(28),
      plain("color", "文字色(留空自动)", "color"),
    ],
  },
  badge: {
    title: "徽章属性",
    fields: [
      plain("text", "文本", "text"),
      plain("bg", "底色", "color"),
      plain("color", "文字色", "color"),
      fontSizeField(34),
    ],
  },
  note: {
    title: "便签属性",
    fields: [
      plain("text", "文本", "textarea", { rows: 3 }),
      plain("bg", "底色", "color"),
      fontSizeField(30),
    ],
  },
  input: {
    title: "输入框属性",
    fields: [plain("text", "文本", "text"), fontSizeField(36)],
  },
  code: {
    title: "代码块属性",
    fields: [
      plain("code", "代码", "textarea", { rows: 8 }),
      plain("filename", "文件名", "text", { placeholder: "demo.js" }),
      fontSizeField(26),
      {
        key: "dark",
        label: "深色底",
        type: "bool",
        read: (el) => str((el as CodeElement).dark === true),
        write: (el, v) => patch(el, { dark: v === "true" }),
      },
    ],
  },
  table: { title: "表格属性", fields: [tsvField, fontSizeField(30), plain("headerBg", "表头底色", "color")] },
  arrayCells: {
    title: "数组格属性",
    fields: [cellsField, colorsField, numberField("cellSize", "块尺寸", 88), numberField("gap", "间距", 14), numberField("perRow", "每行块数", 0), fontSizeField(44)],
  },
  connector: {
    title: "连线属性",
    fields: [
      pointField("from", "起点"),
      pointField("to", "终点"),
      {
        key: "route", label: "路由", type: "select",
        options: [{ value: "smooth", label: "自动平滑" }, { value: "elbow", label: "直角" }, { value: "straight", label: "直线" }],
        read: (el) => str((el as ConnectorElement).route ?? "smooth"),
        write: (el, v) => patch(el, { route: v === "smooth" ? undefined : v }),
      },
      numberField("curve", "弯曲度(0=自动)", 0),
      plain("label", "标签", "text", { placeholder: "可选" }),
      plain("color", "颜色", "color"),
      numberField("width", "线宽", 5),
      {
        key: "arrow",
        label: "箭头",
        type: "bool",
        read: (el) => str((el as ConnectorElement).arrow !== false),
        write: (el, v) => patch(el, { arrow: v === "true" }),
      },
    ],
  },
  image: {
    title: "图片属性",
    fields: [
      plain("src", "图片(dataURL/路径)", "image", { rows: 2, placeholder: "点「选择图片」或粘贴路径" }),
      numberField("radius", "圆角", 12),
    ],
  },
  ...NEW_KIND_SCHEMAS,
} as Record<SceneElement["kind"], { title: string; fields: FieldDef[] }>;

export function schemaTitle(kind: SceneElement["kind"]): string {
  return `${KIND_LABELS[kind]}属性`;
}
