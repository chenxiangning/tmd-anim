import type { ReactNode } from "react";
import type { SceneElement, ShapeVariant } from "../core/types";
import { KIND_LABELS, kindColor } from "./defaults";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { usePanelResize } from "./usePanelResize";

interface LibraryItem {
  kind: SceneElement["kind"];
  /** 形状变体或连线变体(connector:line = 直线) */
  variant?: ShapeVariant | "line";
  label?: string;
}

interface ElementLibraryProps {
  onAdd(kind: SceneElement["kind"], variant?: string): void;
  onCollapse(): void;
}

function icon(paths: ReactNode, opts?: { stroke?: boolean }): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill={opts?.stroke ? "none" : "currentColor"}
      stroke={opts?.stroke ? "currentColor" : "none"}
      strokeWidth={opts?.stroke ? 2 : undefined}
      strokeLinecap={opts?.stroke ? "round" : undefined}
      strokeLinejoin={opts?.stroke ? "round" : undefined}
    >
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
};

const GROUPS: ReadonlyArray<{ label: string; items: ReadonlyArray<LibraryItem> }> = [
  {
    label: "文字",
    items: [{ kind: "title" }, { kind: "artText" }, { kind: "text" }],
  },
  {
    label: "形状",
    items: [
      { kind: "shape", variant: "rect", label: "矩形" },
      { kind: "shape", variant: "ellipse", label: "圆形" },
      { kind: "shape", variant: "triangle", label: "三角形" },
      { kind: "shape", variant: "diamond", label: "菱形" },
      { kind: "shape", variant: "hexagon", label: "六边形" },
      { kind: "shape", variant: "star", label: "星形" },
      { kind: "shape", variant: "blockArrow", label: "块箭头" },
      { kind: "shape", variant: "cylinder", label: "圆柱" },
      { kind: "shape", variant: "speechBubble", label: "对话框" },
    ],
  },
  {
    label: "组件",
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
  return item.variant ? `${item.kind}:${item.variant}` : item.kind;
}

/** 左栏元素库:图标 + 名称分组;点击添加到画布中央,拖到画布落到指定位置;右缘可拖拽调宽。 */
export function ElementLibrary({ onAdd, onCollapse }: ElementLibraryProps) {
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
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="mb-1.5 px-0.5 text-[10px] text-neutral-400">{group.label}</div>
            <div className="grid grid-cols-2 gap-2">
              {group.items.map((item) => (
                <button
                  key={itemIconKey(item)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/x-tmd-anim-kind", itemIconKey(item));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onAdd(item.kind, item.variant)}
                  className="flex cursor-grab flex-col items-start gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-slate-300 hover:bg-neutral-50 active:cursor-grabbing"
                  title={`${item.label ?? KIND_LABELS[item.kind]}:点击添加到画布中央,或直接拖到画布`}
                >
                  <span style={{ color: kindColor(item.kind) }}>{ICONS[itemIconKey(item)]}</span>
                  <span className="text-xs text-neutral-700">{item.label ?? KIND_LABELS[item.kind]}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="px-0.5 text-[10px] leading-relaxed text-neutral-300">
          点击添加到画布中央,或拖到目标位置
          <br />
          画布上双击元素可改文字,⌘C/⌘V 复制粘贴
        </div>
      </div>
    </aside>
  );
}
