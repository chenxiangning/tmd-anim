import type { AiChatElement, CodeElement, DevNodeElement, DevNodeVariant, SceneElement } from "../core/types";
import { DEV_META } from "../core/render/devNode";
import type { FieldDef } from "./propertySchema";

/** 并行特性新增组件的属性 schema:browser / list / stepCard / terminal / progress / kbd。 */

const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v));
const numOr = (v: string, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const patch = (el: SceneElement, fields: Record<string, unknown>): SceneElement =>
  ({ ...el, ...fields }) as SceneElement;

const plain = (key: string, label: string, type: FieldDef["type"], extra?: Partial<FieldDef>): FieldDef => ({
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

const boolField = (key: string, label: string, read: (el: SceneElement) => string): FieldDef => ({
  key,
  label,
  type: "bool",
  read,
  write: (el, v) => patch(el, { [key]: v === "true" }),
});

export const NEW_KIND_SCHEMAS: Partial<Record<SceneElement["kind"], { title: string; fields: FieldDef[] }>> = {
  browser: {
    title: "浏览器属性",
    fields: [plain("url", "地址", "text", { placeholder: "https://example.com" }), plain("body", "内容区底色", "color"), numberField("fontSize", "字号", 26)],
  },
  list: {
    title: "要点列表属性",
    fields: [
      { key: "items", label: "要点(每行一条)", type: "lines", rows: 5, read: (el) => (el as unknown as { items: string[] }).items.join("\n"), write: (el, v) => patch(el, { items: v.split("\n").map((s) => s.trim()).filter(Boolean) }) },
      {
        key: "marker", label: "标记", type: "select",
        options: [{ value: "dot", label: "圆点" }, { value: "check", label: "勾选" }, { value: "number", label: "序号" }],
        read: (el) => str((el as unknown as { marker?: string }).marker ?? "dot"),
        write: (el, v) => patch(el, { marker: v }),
      },
      plain("accent", "强调色", "color"),
      numberField("fontSize", "字号", 36),
    ],
  },
  stepCard: {
    title: "步骤卡片属性",
    fields: [
      plain("num", "序号", "text", { placeholder: "01" }),
      plain("title", "标题", "text"),
      plain("desc", "描述", "textarea", { rows: 2 }),
      plain("accent", "强调色", "color"),
      numberField("fontSize", "字号", 32),
    ],
  },
  terminal: {
    title: "终端属性",
    fields: [
      plain("code", "命令输出", "textarea", { rows: 6 }),
      plain("title", "标签", "text", { placeholder: "zsh" }),
      numberField("fontSize", "字号", 24),
      boolField("dark", "深色底", (el) => str((el as CodeElement).dark !== false)),
    ],
  },
  progress: {
    title: "进度条属性",
    fields: [
      plain("label", "标签", "text", { placeholder: "可选" }),
      numberField("percent", "百分比(0-100)", 72),
      plain("barColor", "填充色", "color"),
      plain("trackColor", "轨道色", "color"),
      boolField("showText", "显示百分比", (el) => str((el as unknown as { showText?: boolean }).showText !== false)),
      numberField("fontSize", "字号", 28),
    ],
  },
  kbd: {
    title: "按键属性",
    fields: [plain("text", "按键(空格分键帽)", "text"), plain("bg", "底色", "color"), numberField("fontSize", "字号", 30)],
  },
  phone: {
    title: "手机属性",
    fields: [plain("body", "屏幕底色", "color"), plain("frame", "机身色", "color")],
  },
  aiChat: {
    title: "AI 对话属性",
    fields: [
      plain("title", "标题", "text", { placeholder: "AI 助手" }),
      plain("prompt", "用户消息", "text"),
      plain("reply", "AI 回复", "textarea", { rows: 4 }),
      numberField("fontSize", "字号", 26),
      boolField("dark", "深色模式", (el) => str((el as AiChatElement).dark === true)),
    ],
  },
  devNode: {
    title: "开发组件属性",
    fields: [
      {
        key: "dev", label: "组件类型", type: "select",
        options: (Object.keys(DEV_META) as DevNodeVariant[]).map((v) => ({ value: v, label: DEV_META[v].name })),
        read: (el) => str((el as DevNodeElement).dev),
        write: (el, v) => patch(el, { dev: v }),
      },
      plain("label", "名称", "text", { placeholder: "缺省取类型名" }),
      plain("sub", "副标题", "text", { placeholder: "规格/说明,可留空" }),
      numberField("fontSize", "字号", 26),
    ],
  },
};
