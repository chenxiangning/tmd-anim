/** 属性 schema 注册表(normalize 后新增批次):file-size-exempt —— 字段声明按 kind 聚集,拆散会让同 kind 的字段定义与读写逻辑分离。 */
import type {
  AiChatElement, AvatarElement, BarChartElement, ChipRowElement, ChipStyle, CodeDiffElement, CodeElement, ConfettiElement,
  CursorElement, DevNodeElement, DevNodeVariant, FolderTreeElement, GridBgElement, GroupPanelElement, LaneElement,
  LineChartElement, LoopArrowElement, MascotElement, PersonElement, PieChartElement, SceneElement, SpotlightElement,
  StackListElement,
} from "../core/types";
import { DEV_META } from "../core/render/devNode";
import type { FieldDef } from "./propertySchema";

/** 并行批次新增组件的属性 schema:每种元素一组字段的纯数据注册表。 */

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

/** 坐标字段:「x, y」文本,非数部分回落原值(回环箭头没有绑定端点,只能填绝对坐标) */
const pointField = (key: "from" | "to", label: string): FieldDef => ({
  key,
  label,
  type: "point",
  placeholder: "x, y",
  read: (el) => {
    const p = (el as LoopArrowElement)[key];
    return p ? `${Math.round(p[0])}, ${Math.round(p[1])}` : "";
  },
  write: (el, v) => {
    const parts = v.split(/[,\s]+/).filter(Boolean).map(Number);
    const fallback = (el as LoopArrowElement)[key] ?? [el.x, el.y];
    const point: [number, number] = [
      Number.isFinite(parts[0]) ? parts[0] : fallback[0],
      Number.isFinite(parts[1]) ? parts[1] : fallback[1],
    ];
    return patch(el, { [key]: point });
  },
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
  cardFlow: {
    title: "流程卡组属性",
    fields: [
      numberField("active", "高亮卡索引(0 起,-1 无)", 0),
      plain("note", "底部结论", "text", { placeholder: "一句话结论" }),
      plain("accent", "强调色", "color"),
      numberField("fontSize", "字号", 26),
    ],
  },
  specRow: {
    title: "规格行属性",
    fields: [
      plain("num", "编号", "text", { placeholder: "C1" }),
      plain("title", "标题", "text"),
      plain("path", "路径(mono)", "text", { placeholder: "systemprompt.md" }),
      plain("badge", "徽章", "text", { placeholder: "every call" }),
      plain("accent", "强调色", "color"),
      numberField("fontSize", "字号", 24),
    ],
  },
  docStack: {
    title: "文档堆属性",
    fields: [
      numberField("count", "张数(1-5)", 3),
      plain("label", "下方标注", "text", { placeholder: "K 份记录" }),
      plain("accent", "强调色", "color"),
      numberField("fontSize", "字号", 24),
    ],
  },
  chipRow: {
    title: "胶囊组属性",
    fields: [
      {
        key: "items", label: "胶囊(每行:文本⇥颜色⇥风格)", type: "lines",
        read: (el) => (el as ChipRowElement).items.map((it) => [it.text, it.color ?? "", it.style ?? ""].filter((v, i) => !(i > 0 && v === "")).join("\t")).join("\n"),
        write: (el, v) => patch(el, {
          items: v.split("\n").map((ln) => ln.trim()).filter(Boolean).map((ln) => {
            const [text = "", color, style] = ln.split("\t");
            return { text, ...(color ? { color } : {}), ...(style ? { style: style as ChipStyle } : {}) };
          }),
        }),
      },
      numberField("fontSize", "字号", 22),
      numberField("gap", "间距(0=自动)", 0),
      {
        key: "align", label: "组内对齐", type: "select",
        options: [{ value: "left", label: "左" }, { value: "center", label: "中" }, { value: "right", label: "右" }],
        read: (el) => str((el as ChipRowElement).align ?? "left"),
        write: (el, v) => patch(el, { align: v === "left" ? undefined : (v as ChipRowElement["align"]) }),
      },
    ],
  },
  ringNode: {
    title: "圆环节点属性",
    fields: [
      plain("label", "主文字", "text", { placeholder: "模型" }),
      plain("sub", "副文字", "text", { placeholder: "可选" }),
      plain("accent", "环色", "color"),
      numberField("fontSize", "字号", 34),
      numberField("ring", "环粗细倍数", 1),
    ],
  },
  stackList: {
    title: "编号叠纸属性",
    fields: [
      plain("label", "顶部标题", "text", { placeholder: "执行记录" }),
      {
        key: "keys", label: "段编号(每行一个,最多 3)", type: "lines",
        read: (el) => ((el as StackListElement).keys ?? ["1", "K"]).join("\n"),
        write: (el, v) => patch(el, { keys: v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3) }),
      },
      numberField("sheets", "每段张数(1-4)", 2),
      boolField("ellipsis", "段间省略号", (el) => str((el as StackListElement).ellipsis !== false)),
      plain("accent", "强调色", "color"),
      numberField("fontSize", "字号", 24),
    ],
  },
  loopArrow: {
    title: "回环箭头属性",
    fields: [
      pointField("from", "起点"),
      pointField("to", "终点"),
      {
        key: "side", label: "折返方向", type: "select",
        options: [{ value: "bottom", label: "向下" }, { value: "top", label: "向上" }, { value: "left", label: "向左" }, { value: "right", label: "向右" }],
        read: (el) => str((el as LoopArrowElement).side ?? "bottom"),
        write: (el, v) => patch(el, { side: v as LoopArrowElement["side"] }),
      },
      numberField("depth", "折返深度(0=自动)", 0),
      plain("label", "标签", "text", { placeholder: "可选" }),
      plain("color", "颜色", "color"),
      numberField("width", "线宽", 5),
      boolField("dash", "虚线", (el) => str((el as LoopArrowElement).dash === true)),
      boolField("arrow", "箭头", (el) => str((el as LoopArrowElement).arrow !== false)),
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
      plain("subtitle", "副标题", "text", { placeholder: "可留空" }),
      {
        key: "series", label: "数据(每行:名称⇥值[⇥颜色];分组模式改用 groups)", type: "lines",
        read: (el) => ((el as BarChartElement).series ?? []).map((s) => [s.label, s.value, s.color ?? ""].filter((v, i) => !(i === 2 && v === "")).join("\t")).join("\n"),
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
      plain("subtitle", "副标题", "text", { placeholder: "可留空" }),
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
      plain("subtitle", "副标题", "text", { placeholder: "可留空" }),
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
      plain("subtitle", "副标题", "text", { placeholder: "给出后标题改为内嵌左上" }),
      plain("accent", "标题色", "color"),
      plain("fill", "填充色", "color"),
      plain("stroke", "边框色", "color"),
      numberField("radius", "圆角", 24),
      {
        key: "dash",
        label: "虚线边框",
        type: "bool",
        read: (el) => str((el as GroupPanelElement).dash === true),
        write: (el, v) => patch(el, { dash: v === "true" }),
      },
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
  mascot: {
    title: "吉祥物属性",
    fields: [
      {
        key: "variant", label: "变体", type: "select",
        options: [{ value: "doc", label: "文档精" }, { value: "bot", label: "机器人" }],
        read: (el) => str((el as MascotElement).variant ?? "doc"),
        write: (el, v) => patch(el, { variant: v === "bot" ? "bot" : "doc" }),
      },
      {
        key: "mood", label: "表情", type: "select",
        options: [{ value: "happy", label: "开心" }, { value: "wink", label: "眨眼" }, { value: "worried", label: "焦虑" }],
        read: (el) => str((el as MascotElement).mood ?? "happy"),
        write: (el, v) => patch(el, { mood: v }),
      },
      plain("badge", "胸牌/铭牌", "text", { placeholder: "如 PDF / 文枢" }),
      plain("badgeColor", "胸牌底色", "color"),
      plain("body", "机身/纸面底色", "color"),
      plain("label", "名牌(bot 机身内 / doc 脚下)", "text", { placeholder: "如 最终版.pdf" }),
    ],
  },
  confetti: {
    title: "纸屑属性",
    fields: [
      {
        key: "mode", label: "模式", type: "select",
        options: [{ value: "rain", label: "飘落(循环)" }, { value: "burst", label: "迸发(一次)" }],
        read: (el) => str((el as ConfettiElement).mode ?? "rain"),
        write: (el, v) => patch(el, { mode: v === "burst" ? "burst" : "rain" }),
      },
      numberField("count", "粒子数(10-200)", 80),
      numberField("seed", "随机种子", 42),
      {
        key: "colors", label: "色板(逗号分隔,留空默认)", type: "text",
        placeholder: "#F87171,#FBBF24",
        read: (el) => ((el as ConfettiElement).colors ?? []).join(","),
        write: (el, v) => patch(el, { colors: v.split(/[,，]/).map((s) => s.trim()).filter(Boolean) }),
      },
    ],
  },
};
