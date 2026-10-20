import { useState, type ReactNode } from "react";
import type { DevNodeVariant, SceneElement, ShapeVariant } from "../core/types";
import { KIND_LABELS, kindColor } from "./defaults";
import { ICONS } from "./elementIcons";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { usePanelResize } from "./usePanelResize";

interface LibraryItem {
  kind: SceneElement["kind"];
  /** 形状/连线/开发组件/吉祥物/纸屑变体(connector:line = 直线,mascot:bot = 机器人,confetti:burst = 迸发);sketch = 手绘标记 */
  variant?: ShapeVariant | "line" | DevNodeVariant | "bot" | "burst";
  sketch?: boolean;
  label?: string;
}

interface ElementLibraryProps {
  onAdd(kind: SceneElement["kind"], variant?: string, sketch?: boolean): void;
  onCollapse(): void;
}



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
  { kind: "devNode", variant: "gateway", label: "网关" },
  { kind: "devNode", variant: "loadBalancer", label: "负载均衡" },
  { kind: "devNode", variant: "cdn", label: "CDN" },
  { kind: "devNode", variant: "auth", label: "认证" },
  { kind: "devNode", variant: "function", label: "函数计算" },
  { kind: "devNode", variant: "git", label: "代码仓库" },
];

interface LibraryGroup {
  label: string;
  items: ReadonlyArray<LibraryItem>;
  /** tab1 页签名(缺省「常规」);tab2 = 第二页签(形状的手绘/组件的开发) */
  tab1?: string;
  tab2?: { label: string; items: ReadonlyArray<LibraryItem> };
}

const GROUPS: ReadonlyArray<LibraryGroup> = [
  {
    label: "文字",
    items: [{ kind: "title" }, { kind: "artText" }, { kind: "text" }, { kind: "quote" }, { kind: "formula" }],
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
      { kind: "badge" }, { kind: "note" }, { kind: "input" }, { kind: "kbd" }, { kind: "browser" },
      { kind: "list" }, { kind: "stepCard" }, { kind: "progress" }, { kind: "code" }, { kind: "terminal" },
      { kind: "table" }, { kind: "phone" }, { kind: "aiChat" },
    ],
    tab2: { label: "开发", items: DEV_ITEMS },
  },
  {
    label: "图表",
    items: [{ kind: "barChart" }, { kind: "lineChart" }, { kind: "pieChart" }],
  },
  {
    label: "演示",
    items: [{ kind: "folderTree" }, { kind: "cursor" }, { kind: "codeDiff" }],
  },
  {
    label: "舞台",
    items: [{ kind: "groupPanel" }, { kind: "lane" }, { kind: "gridBg" }, { kind: "spotlight" }, { kind: "confetti" }],
  },
  {
    label: "角色",
    items: [{ kind: "avatar" }, { kind: "person" }, { kind: "mascot" }, { kind: "mascot", variant: "bot", label: "机器人" }],
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
  const [tab2On, setTab2On] = useState<Record<string, boolean>>({}); // 各分组第二页签激活态(按组名)
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
