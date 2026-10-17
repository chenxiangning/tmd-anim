import { useState, type ReactNode } from "react";
import type { DevNodeVariant, SceneElement, ShapeVariant } from "../core/types";
import { KIND_LABELS, kindColor } from "./defaults";
import { DEV_ICONS } from "./devIcons";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { usePanelResize } from "./usePanelResize";

interface LibraryItem {
  kind: SceneElement["kind"];
  /** 形状/连线/开发组件变体(connector:line = 直线);sketch = 手绘标记 */
  variant?: ShapeVariant | "line" | DevNodeVariant;
  sketch?: boolean;
  label?: string;
}

interface ElementLibraryProps {
  onAdd(kind: SceneElement["kind"], variant?: string, sketch?: boolean): void;
  onCollapse(): void;
}


function icon(paths: ReactNode, opts?: { stroke?: boolean }): ReactNode {
  const st = opts?.stroke;
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill={st ? "none" : "currentColor"} stroke={st ? "currentColor" : "none"} strokeWidth={st ? 2 : undefined} strokeLinecap={st ? "round" : undefined} strokeLinejoin={st ? "round" : undefined}>
      {paths}
    </svg>
  );
}

/** 图标键 = kind 或 kind:variant,形状对应画布上的真实外观。 */
const ICONS: Record<string, ReactNode> = {
  title: icon(<path d="M5 4h14v3h-5.5v13h-3V7H5z" />),
  artText: icon(<path d="M12 4l7 16M12 4L5 20M7.8 14.5h8.4" />, { stroke: true }),
  text: icon(<path d="M4 6h16M4 11.5h12M4 17h16" />, { stroke: true }),
  "shape:rect": icon(<rect x="4" y="6" width="16" height="12" rx="3" />, { stroke: true }),
  "shape:ellipse": icon(<circle cx="12" cy="12" r="8.5" />, { stroke: true }),
  "shape:triangle": icon(<path d="M12 4.5L20.5 19h-17z" />, { stroke: true }),
  "shape:diamond": icon(<path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z" />, { stroke: true }),
  "shape:hexagon": icon(<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" />, { stroke: true }),
  "shape:star": icon(<path d="M12 3.2l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.6l-5.6 3 1.1-6.3L2.9 9.9l6.3-.9z" />),
  "shape:cylinder": icon(
    <>
      <ellipse cx="12" cy="6.3" rx="8" ry="2.8" strokeWidth="1.8" />
      <path d="M4 6.3v11.4c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8V6.3" strokeWidth="1.8" />
    </>,
    { stroke: true },
  ),
  "shape:blockArrow": icon(<path d="M4 9.2h8.5V4.5L20.5 12l-8 7.5v-4.7H4z" />),
  "shape:speechBubble": icon(<path d="M4.5 4h15A2.5 2.5 0 0122 6.5v7a2.5 2.5 0 01-2.5 2.5H11l-5.5 4.2V16H4.5A2.5 2.5 0 012 13.5v-7A2.5 2.5 0 014.5 4z" />),
  badge: icon(<rect x="3" y="8" width="18" height="8" rx="4" />),
  note: icon(
    <>
      <path d="M5 4h14v11l-5 5H5z" opacity="0.25" />
      <path d="M5 4h14v11l-5 5H5zM19 15l-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>,
  ),
  input: icon(
    <>
      <rect x="3" y="7" width="18" height="10" rx="2" strokeWidth="1.8" />
      <path d="M7 10.5v3" strokeWidth="1.8" />
    </>,
    { stroke: true },
  ),
  kbd: icon(
    <>
      <rect x="3" y="6.5" width="18" height="11.5" rx="2" strokeWidth="1.8" />
      <path d="M7 10.5h.01M11 10.5h.01M15 10.5h.01M17 10.5h.01M8 14.5h8" strokeWidth="1.8" />
    </>,
    { stroke: true },
  ),
  browser: icon(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth="1.8" />
      <path d="M3 9.5h18" strokeWidth="1.5" />
      <circle cx="6" cy="6.8" r="0.9" />
      <circle cx="9" cy="6.8" r="0.9" />
      <rect x="5.5" y="12" width="13" height="5" rx="2.5" opacity="0.45" />
    </>,
    { stroke: true },
  ),
  code: icon(<path d="M9 6L3 12l6 6M15 6l6 6-6 6" />, { stroke: true }),
  terminal: icon(
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" strokeWidth="1.8" />
      <path d="M7 9.5l3 3-3 3M12.5 15.5H17" strokeWidth="1.8" />
    </>,
    { stroke: true },
  ),
  table: icon(
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" strokeWidth="1.8" />
      <path d="M3 9.5h18M3 14.5h18M9.5 4v16" strokeWidth="1.5" />
    </>,
    { stroke: true },
  ),
  list: icon(
    <>
      <circle cx="5" cy="6" r="1.7" />
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="5" cy="18" r="1.7" />
      <path d="M9.5 6H20M9.5 12H20M9.5 18H20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>,
  ),
  stepCard: icon(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="1.8" />
      <rect x="6" y="8.5" width="4" height="4" rx="1" />
      <path d="M12.5 9.5H18M12.5 12h4M6 15.5h12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>,
    { stroke: true },
  ),
  progress: icon(
    <>
      <rect x="3" y="9" width="18" height="6" rx="3" opacity="0.3" />
      <rect x="3" y="9" width="11.5" height="6" rx="3" />
    </>,
  ),
  arrayCells: icon(
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" opacity="0.65" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" opacity="0.65" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" opacity="0.4" />
    </>,
  ),
  connector: icon(<path d="M4 18L17 7M12 6h6v6" />, { stroke: true }),
  "connector:line": icon(<path d="M5 19L19 5" />, { stroke: true }),
  image: icon(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="1.8" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M5 17l5-5 3.5 3.5L16 13l3 3" strokeWidth="1.8" />
    </>,
    { stroke: true },
  ),
  ...DEV_ICONS,
};

/** 形状基础条目:常规页签直接复用,手绘页签加 sketch 标记派生 */
const SHAPE_ITEMS: ReadonlyArray<LibraryItem> = [
  { kind: "shape", variant: "rect", label: "矩形" },
  { kind: "shape", variant: "ellipse", label: "圆形" },
  { kind: "shape", variant: "triangle", label: "三角形" },
  { kind: "shape", variant: "diamond", label: "菱形" },
  { kind: "shape", variant: "hexagon", label: "六边形" },
  { kind: "shape", variant: "star", label: "星形" },
  { kind: "shape", variant: "blockArrow", label: "块箭头" },
  { kind: "shape", variant: "cylinder", label: "圆柱" },
  { kind: "shape", variant: "speechBubble", label: "对话框" },
];

/** 开发组件条目:架构图常用资源,落库为 devNode */
const DEV_ITEMS: ReadonlyArray<LibraryItem> = [
  { kind: "devNode", variant: "database", label: "数据库" },
  { kind: "devNode", variant: "redis", label: "Redis" },
  { kind: "devNode", variant: "obs", label: "对象存储" },
  { kind: "devNode", variant: "cloud", label: "云" },
  { kind: "devNode", variant: "server", label: "服务器" },
  { kind: "devNode", variant: "api", label: "API" },
  { kind: "devNode", variant: "queue", label: "消息队列" },
  { kind: "devNode", variant: "container", label: "容器" },
];

interface LibraryGroup {
  label: string;
  items: ReadonlyArray<LibraryItem>;
  /** 页签一名字(有 tab2 才显示页签栏);缺省「常规」 */
  tab1?: string;
  /** 第二页签:形状的手绘 / 组件的开发 */
  tab2?: { label: string; items: ReadonlyArray<LibraryItem> };
}

const GROUPS: ReadonlyArray<LibraryGroup> = [
  {
    label: "文字",
    items: [{ kind: "title" }, { kind: "artText" }, { kind: "text" }],
  },
  {
    label: "形状",
    items: SHAPE_ITEMS,
    tab2: { label: "手绘", items: SHAPE_ITEMS.map((it) => ({ ...it, sketch: true })) },
  },
  {
    label: "组件",
    tab1: "基础",
    items: [
      { kind: "badge" },
      { kind: "note" },
      { kind: "input" },
      { kind: "kbd" },
      { kind: "browser" },
      { kind: "list" },
      { kind: "stepCard" },
      { kind: "progress" },
      { kind: "code" },
      { kind: "terminal" },
      { kind: "table" },
    ],
    tab2: { label: "开发", items: DEV_ITEMS },
  },
  {
    label: "图示与媒体",
    items: [
      { kind: "arrayCells" },
      { kind: "connector" },
      { kind: "connector", variant: "line", label: "直线" },
      { kind: "image" },
    ],
  },
];

function itemIconKey(item: LibraryItem): string {
  return item.variant ? `${item.kind}:${item.variant}${item.sketch ? ":sketch" : ""}` : item.kind;
}

/** 图标回退:手绘变体复用常规形状的图标(结构相同) */
function itemIcon(item: LibraryItem): ReactNode {
  const key = itemIconKey(item);
  return ICONS[key] ?? (item.variant ? ICONS[`${item.kind}:${item.variant}`] : undefined) ?? ICONS[item.kind];
}

/** 左栏元素库:图标 + 名称分组;点击添加到画布中央,拖到画布落到指定位置;右缘可拖拽调宽。
 *  形状组(常规/手绘)与组件组(基础/开发)各带页签切换。 */
export function ElementLibrary({ onAdd, onCollapse }: ElementLibraryProps) {
  /** 各分组第二页签是否激活(按组名记) */
  const [tab2On, setTab2On] = useState<Record<string, boolean>>({});
  const { size: width, startResize, resetSize } = usePanelResize({
    axis: "x",
    key: "tmd-anim:lib-w",
    def: 192,
    min: 160,
    maxRatio: 0.35,
    dir: 1,
  });
  return (
    <aside className="relative flex shrink-0 flex-col border-r border-neutral-200 bg-white" style={{ width }}>
      <PanelResizeHandle side="right" onStart={startResize} onReset={resetSize} />
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-neutral-100 px-3">
        <span className="text-[11px] font-medium text-neutral-400">元素</span>
        <button
          className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          onClick={onCollapse}
          title="折叠元素库"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {GROUPS.map((group) => {
          const on2 = group.tab2 ? (tab2On[group.label] ?? false) : false;
          const items = group.tab2 && on2 ? group.tab2.items : group.items;
          return (
            <div key={group.label} className="mb-3">
              <div className="mb-1.5 flex items-center justify-between px-0.5">
                <span className="text-[10px] font-medium tracking-wide text-neutral-400">{group.label}</span>
                {group.tab2 && (
                  <div className="flex rounded-md border border-neutral-200 p-px text-[10px]">
                    {[group.tab1 ?? "常规", group.tab2.label].map((label, i) => (
                      <button
                        key={label}
                        onClick={() => setTab2On((s) => ({ ...s, [group.label]: i === 1 }))}
                        className={`rounded-[5px] px-2 py-0.5 transition-colors ${on2 === (i === 1) ? "bg-slate-700 text-white" : "text-neutral-500 hover:text-neutral-700"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {items.map((item) => (
                  <button
                    key={itemIconKey(item)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/x-tmd-anim-kind", itemIconKey(item));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => onAdd(item.kind, item.variant, item.sketch)}
                    className="flex cursor-grab flex-col items-start gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-left transition-all hover:border-slate-300 hover:bg-neutral-50 hover:shadow-sm active:cursor-grabbing"
                    title={`${item.label ?? KIND_LABELS[item.kind]}:点击添加到画布中央,或直接拖到画布`}
                  >
                    <span style={{ color: kindColor(item.kind) }}>{itemIcon(item)}</span>
                    <span className="text-xs text-neutral-700">{item.label ?? KIND_LABELS[item.kind]}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div className="px-0.5 text-[10px] leading-relaxed text-neutral-300">点击添加到画布中央,或拖到目标位置;双击元素改文字</div>
      </div>
    </aside>
  );
}
