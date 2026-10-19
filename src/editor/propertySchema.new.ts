import type {
  AiChatElement, AvatarElement, BarChartElement, CodeDiffElement, CodeElement, CursorElement,
  DevNodeElement, DevNodeVariant, FolderTreeElement, GridBgElement, LaneElement, LineChartElement,
  PersonElement, PieChartElement, SceneElement, SpotlightElement,
} from "../core/types";
import { DEV_META } from "../core/render/devNode";
import type { FieldDef } from "./propertySchema";

/** 并行批次新增组件的属性 schema:每种元素一组字段的纯数据注册表。
 *  file-size-exempt:字段声明按 kind 聚集,拆散会让同 kind 的字段定义与读写逻辑分离。 */

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
  barChart: {
    title: "柱状图属性",
    fields: [
      plain("title", "标题", "text"),
      {
        key: "series", label: "数据(每行:名称⇥值[⇥颜色])", type: "lines",
        read: (el) => (el as BarChartElement).series.map((s) => [s.label, s.value, s.color ?? ""].filter((v, i) => !(i === 2 && v === "")).join("\t")).join("\n"),
        write: (el, v) => patch(el, {
          series: v.split("\n").map((ln) => ln.trim()).filter(Boolean).map((ln) => {
            const [label = "", value = "0", color] = ln.split("\t");
            return { label, value: numOr(value, 0), ...(color ? { color } : {}) };
          }),
        }),
      },
      numberField("fontSize", "字号", 28),
      boolField("horizontal", "水平条形", (el) => str((el as BarChartElement).horizontal === true)),
      boolField("showValue", "显示数值", (el) => str((el as BarChartElement).showValue !== false)),
      boolField("axis", "显示坐标轴", (el) => str((el as BarChartElement).axis !== false)),
      numberField("max", "数值上限(0=自动)", 0),
    ],
  },
  lineChart: {
    title: "折线图属性",
    fields: [
      plain("title", "标题", "text"),
      {
        key: "series", label: "数据(每行:名称⇥逗号数值[⇥颜色])", type: "lines",
        read: (el) => (el as LineChartElement).series.map((s) => [s.label, s.points.join(","), s.color ?? ""].filter((v, i) => !(i === 2 && v === "")).join("\t")).join("\n"),
        write: (el, v) => patch(el, {
          series: v.split("\n").map((ln) => ln.trim()).filter(Boolean).map((ln) => {
            const [label = "", pts = "", color] = ln.split("\t");
            return { label, points: pts.split(",").map((n) => numOr(n.trim(), 0)), ...(color ? { color } : {}) };
          }),
        }),
      },
      numberField("fontSize", "字号", 26),
      boolField("smooth", "平滑曲线", (el) => str((el as LineChartElement).smooth === true)),
      boolField("dot", "数据点", (el) => str((el as LineChartElement).dot !== false)),
      boolField("area", "面积填充", (el) => str((el as LineChartElement).area === true)),
    ],
  },
  pieChart: {
    title: "饼图属性",
    fields: [
      plain("title", "标题", "text"),
      {
        key: "slices", label: "数据(每行:名称⇥值[⇥颜色])", type: "lines",
        read: (el) => (el as PieChartElement).slices.map((s) => [s.label, s.value, s.color ?? ""].filter((v, i) => !(i === 2 && v === "")).join("\t")).join("\n"),
        write: (el, v) => patch(el, {
          slices: v.split("\n").map((ln) => ln.trim()).filter(Boolean).map((ln) => {
            const [label = "", value = "0", color] = ln.split("\t");
            return { label, value: numOr(value, 0), ...(color ? { color } : {}) };
          }),
        }),
      },
      numberField("fontSize", "字号", 26),
      boolField("donut", "环形", (el) => str((el as PieChartElement).donut === true)),
      {
        key: "legend", label: "图例", type: "select",
        options: [{ value: "right", label: "右侧" }, { value: "bottom", label: "底部" }, { value: "none", label: "无" }],
        read: (el) => (el as PieChartElement).legend ?? "right",
        write: (el, v) => patch(el, { legend: v }),
      },
    ],
  },
  cursor: {
    title: "光标属性",
    fields: [
      {
        key: "points", label: "路径(每行:x,y)", type: "lines",
        read: (el) => (el as CursorElement).points.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join("\n"),
        write: (el, v) => patch(el, {
          points: v.split("\n").map((ln) => ln.trim()).filter(Boolean).map((ln) => {
            const [x = "0", y = "0"] = ln.split(",");
            return [numOr(x, 0), numOr(y, 0)];
          }),
        }),
      },
      {
        key: "clicks", label: "点击时刻(逗号,秒)", type: "text",
        read: (el) => (el as CursorElement).clicks?.join(",") ?? "",
        write: (el, v) => patch(el, { clicks: v.split(",").map((n) => Number(n.trim())).filter((n) => Number.isFinite(n)) }),
      },
      {
        key: "hold", label: "按压区间(a,b 秒)", type: "text",
        read: (el) => (el as CursorElement).hold?.join(",") ?? "",
        write: (el, v) => {
          const nums = v.split(",").map((n) => Number(n.trim())).filter((n) => Number.isFinite(n));
          return patch(el, nums.length === 2 ? { hold: [nums[0], nums[1]] } : {});
        },
      },
    ],
  },
  folderTree: {
    title: "文件树属性",
    fields: [
      plain("root", "根目录名", "text", { placeholder: "my-app" }),
      {
        key: "items", label: "条目(每行:名称⇥dir/file⇥深度[⇥注释])", type: "lines",
        read: (el) => (el as FolderTreeElement).items.map((it) => [it.name, it.icon ?? "", it.depth ?? "", it.comment ?? ""].filter((v, i) => i < 2 || v !== "").join("\t")).join("\n"),
        write: (el, v) => patch(el, {
          items: v.split("\n").map((ln) => ln.trim()).filter(Boolean).map((ln) => {
            const [name = "", icon = "", depth = "", comment] = ln.split("\t");
            return {
              name,
              ...(icon === "dir" || icon === "file" ? { icon } : {}),
              ...(depth !== "" && Number.isFinite(Number(depth)) ? { depth: Math.max(0, Math.round(Number(depth))) } : {}),
              ...(comment ? { comment } : {}),
            };
          }),
        }),
      },
      numberField("fontSize", "字号", 26),
    ],
  },
  codeDiff: {
    title: "代码对比属性",
    fields: [
      plain("filename", "文件名", "text", { placeholder: "api.ts" }),
      {
        key: "hunks", label: "差异块(JSON)", type: "textarea", rows: 8,
        read: (el) => JSON.stringify((el as CodeDiffElement).hunks, null, 2),
        write: (el, v) => {
          try {
            const parsed = JSON.parse(v);
            return patch(el, Array.isArray(parsed) ? { hunks: parsed } : {});
          } catch {
            return el;
          }
        },
      },
      numberField("fontSize", "字号", 24),
      boolField("dark", "深色底", (el) => str((el as CodeDiffElement).dark !== false)),
    ],
  },
  spotlight: {
    title: "聚光灯属性",
    fields: [
      {
        key: "shape", label: "光圈形状", type: "select",
        options: [{ value: "rect", label: "圆角矩形" }, { value: "ellipse", label: "椭圆" }],
        read: (el) => (el as SpotlightElement).shape ?? "rect",
        write: (el, v) => patch(el, { shape: v }),
      },
      numberField("strength", "暗角强度(0-1)", 0.65),
    ],
  },
  gridBg: {
    title: "网格背景属性",
    fields: [
      numberField("step", "间距(px)", 40),
      plain("color", "线色", "color"),
      boolField("dot", "点阵模式", (el) => str((el as GridBgElement).dot === true)),
      boolField("axis", "中心加重", (el) => str((el as GridBgElement).axis === true)),
    ],
  },
  groupPanel: {
    title: "分组面板属性",
    fields: [
      plain("title", "标题", "text", { placeholder: "可留空" }),
      plain("accent", "标题色", "color"),
      plain("fill", "填充色", "color"),
      plain("stroke", "边框色", "color"),
      numberField("radius", "圆角", 24),
    ],
  },
  lane: {
    title: "泳道属性",
    fields: [
      {
        key: "direction", label: "方向", type: "select",
        options: [{ value: "h", label: "横向条带" }, { value: "v", label: "纵向条带" }],
        read: (el) => (el as LaneElement).direction ?? "h",
        write: (el, v) => patch(el, { direction: v }),
      },
      numberField("count", "条带数(2-4)", 3),
      {
        key: "labels", label: "标签(每行一个)", type: "lines",
        read: (el) => (el as LaneElement).labels?.join("\n") ?? "",
        write: (el, v) => patch(el, { labels: v.split("\n").map((s) => s.trim()).filter(Boolean) }),
      },
      numberField("gutter", "条带间距", 6),
    ],
  },
  quote: {
    title: "引用属性",
    fields: [
      plain("text", "引文", "textarea", { rows: 3 }),
      plain("author", "署名", "text"),
      plain("accent", "竖条色", "color"),
      numberField("fontSize", "字号", 36),
    ],
  },
  formula: {
    title: "公式属性",
    fields: [
      plain("text", "TeX 表达式", "textarea", { rows: 2, placeholder: "E = mc^2 或 \\frac{a}{b}" }),
      numberField("fontSize", "字号", 64),
      plain("color", "颜色", "color"),
    ],
  },
  avatar: {
    title: "头像属性",
    fields: [
      plain("name", "名称", "text"),
      {
        key: "src", label: "图片", type: "image",
        read: (el) => str((el as AvatarElement).src),
        write: (el, v) => patch(el, { src: v }),
      },
      plain("initials", "首字符(无图时)", "text", { placeholder: "缺省取名称首字" }),
      {
        key: "status", label: "状态", type: "select",
        options: [{ value: "online", label: "在线" }, { value: "busy", label: "忙碌" }, { value: "offline", label: "离线" }],
        read: (el) => (el as AvatarElement).status ?? "online",
        write: (el, v) => patch(el, { status: v }),
      },
      plain("color", "底色", "color"),
    ],
  },
  person: {
    title: "人物属性",
    fields: [
      {
        key: "pose", label: "姿势", type: "select",
        options: [{ value: "stand", label: "站立" }, { value: "point", label: "指向" }, { value: "think", label: "思考" }],
        read: (el) => (el as PersonElement).pose ?? "stand",
        write: (el, v) => patch(el, { pose: v }),
      },
      plain("color", "颜色", "color"),
    ],
  },
};
