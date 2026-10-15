import { useRef } from "react";
import type { Project, Scene, SceneElement } from "../core/types";
import { sceneDuration } from "../core/timeline";
import { moveElement, updateElement } from "./editOps";
import { ANIM_TYPE_OPTIONS, EASING_OPTIONS, parseEasing } from "./animMeta";
import { AudioPropsCard } from "./AudioPropsCard";
import { SCHEMAS } from "./propertySchema";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { usePanelResize } from "./usePanelResize";

interface PropertyPanelProps {
  project: Project;
  sceneIdx: number;
  selected: SceneElement | null;
  /** 画布当前多选总数(单选时为 1) */
  selCount: number;
  /** 当前场景配音;audioSelected 时面板切到配音编辑卡 */
  audio?: Scene["audio"];
  audioSelected?: boolean;
  onPatch: (next: Project, coalesceKey?: string) => void;
  onPatchAudio?(next: Scene["audio"], coalesceKey?: string): void;
  onDelete: () => void;
  onReplay: () => void;
  onCollapse: () => void;
}

const labelCls = "mb-1 block text-[11px] font-medium text-neutral-500";
const inputCls =
  "w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-800 outline-none transition-colors hover:border-neutral-300 focus:border-slate-500";

/** 右栏属性面板:几何/层级 + schema 内容字段 + 入场动画区(与时间轴一一对应);
 *  选中配音条时切到配音编辑卡;多选时只提示数量;左缘可拖拽调宽。 */
export function PropertyPanel({
  project, sceneIdx, selected, selCount, audio, audioSelected, onPatch, onPatchAudio, onDelete, onReplay, onCollapse,
}: PropertyPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { size: width, startResize, resetSize } = usePanelResize({
    axis: "x",
    key: "tmd-anim:prop-w",
    def: 288,
    min: 224,
    maxRatio: 0.35,
    dir: -1,
  });
  const asideCls = "relative flex shrink-0 flex-col border-l border-neutral-200 bg-white";
  if (audioSelected && onPatchAudio) {
    return (
      <aside className={asideCls} style={{ width }}>
        <PanelResizeHandle side="left" onStart={startResize} onReset={resetSize} />
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-neutral-100 px-3">
          <span className="text-sm font-semibold text-neutral-800">配音</span>
          <CollapseButton onClick={onCollapse} />
        </div>
        {audio ? (
          <AudioPropsCard
            audio={audio}
            sceneSec={sceneDuration(project.scenes[sceneIdx])}
            onPatch={(next, key) => onPatchAudio(next, key)}
            onRemove={() => onPatchAudio(undefined, "sceneAudio")}
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-[11px] leading-relaxed text-neutral-400">
              本场景未设置配音。用操作台右上「＋ 配音」选择音频文件,或「TTS」文字合成;
              配音随场景起点播放,播完才切下一幕。
            </p>
          </div>
        )}
      </aside>
    );
  }
  if (!selected) {
    return (
      <aside className={asideCls} style={{ width }}>
        <PanelResizeHandle side="left" onStart={startResize} onReset={resetSize} />
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-neutral-100 px-3">
          <span className="text-[11px] font-medium text-neutral-400">属性</span>
          <CollapseButton onClick={onCollapse} />
        </div>
        <div className="mt-24 flex flex-col items-center px-6 text-center">
          <svg viewBox="0 0 24 24" className="mb-3 h-8 w-8 text-neutral-200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="text-xs leading-relaxed text-neutral-400">
          {selCount > 1 ? (
            <>
              已选 {selCount} 个元素
              <br />
              拖动整体移动,Delete 批量删除
            </>
          ) : (
            <>
              未选中元素
              <br />
              在画布中点击元素后可编辑属性
            </>
          )}
          </span>
        </div>
      </aside>
    );
  }
  const schema = SCHEMAS[selected.kind];
  const patchEl = (fields: Record<string, unknown>, key?: string) => {
    onPatch(updateElement(project, sceneIdx, selected.id, fields), key ? `prop:${selected.id}:${key}` : undefined);
  };
  const patchAnim = (fields: Record<string, unknown>, key: string) => {
    onPatch(
      updateElement(project, sceneIdx, selected.id, { anim: { ...selected.anim, ...fields } }),
      `anim:${selected.id}:${key}`,
    );
  };
  const pickImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => patchEl({ src: String(reader.result) }, "src");
    reader.readAsDataURL(file);
  };
  return (
    <aside className={asideCls} style={{ width }}>
      <PanelResizeHandle side="left" onStart={startResize} onReset={resetSize} />
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-neutral-100 px-3">
        <span className="text-sm font-semibold text-neutral-800">{schema.title}</span>
        <div className="flex items-center gap-1">
          <button
            className="rounded px-2 py-1 text-[11px] text-red-500 transition-colors hover:bg-red-50"
            onClick={onDelete}
          >
            删除
          </button>
          <CollapseButton onClick={onCollapse} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["x", "y", "w", "h"] as const).map((axis) => (
          <label key={axis}>
            <span className={labelCls}>{axis.toUpperCase()}</span>
            <input
              type="number"
              className={inputCls}
              value={Math.round(selected[axis])}
              onChange={(e) => patchEl({ [axis]: Number(e.target.value) || 0 }, `geo:${axis}`)}
            />
          </label>
        ))}
      </div>

      <div className="mb-4">
        <span className={labelCls}>层级</span>
        <div className="grid grid-cols-4 gap-1.5">
          {(["back", "down", "up", "front"] as const).map((dir) => (
            <button
              key={dir}
              className="rounded-md border border-neutral-200 py-1 text-[11px] text-neutral-600 transition-colors hover:bg-neutral-100"
              onClick={() => onPatch(moveElement(project, sceneIdx, selected.id, dir), `z:${selected.id}:${dir}`)}
            >
              {{ back: "置底", down: "下移", up: "上移", front: "置顶" }[dir]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {schema.fields.map((field) => {
          const value = field.read(selected);
          const onChange = (v: string) => {
            const next = field.write(selected, v);
            onPatch(updateElement(project, sceneIdx, selected.id, next as unknown as Record<string, unknown>), `field:${selected.id}:${field.key}`);
          };
          return (
            <label key={field.key} className="block">
              <span className={labelCls}>{field.label}</span>
              {field.type === "textarea" && (
                <textarea rows={field.rows ?? 3} className={`${inputCls} resize-y font-mono`} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
              )}
              {(field.type === "text" || field.type === "tags" || field.type === "point") && (
                <input type="text" className={`${inputCls}${field.type === "point" ? " font-mono" : ""}`} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
              )}
              {field.type === "number" && (
                <input type="number" className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
              )}
              {field.type === "color" && (
                <div className="flex items-center gap-2">
                  <input type="color" className="h-7 w-10 cursor-pointer rounded border border-neutral-200" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} />
                  <input type="text" className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
                </div>
              )}
              {field.type === "select" && (
                <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
              {(field.type === "tsv" || field.type === "lines") && (
                <textarea rows={field.rows ?? 4} className={`${inputCls} resize-y font-mono`} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
              )}
              {field.type === "bool" && (
                <input type="checkbox" className="h-4 w-4 accent-slate-900" checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "false")} />
              )}
              {field.type === "image" && (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    className="w-full rounded-md border border-dashed border-neutral-300 py-1.5 text-[11px] text-neutral-600 transition-colors hover:border-slate-400 hover:bg-neutral-50"
                    onClick={() => fileRef.current?.click()}
                  >
                    选择本地图片
                  </button>
                  {value && <img src={value} alt="" className="h-16 w-full rounded-md object-contain ring-1 ring-neutral-200" />}
                  <textarea rows={field.rows ?? 2} className={`${inputCls} resize-y font-mono`} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) pickImage(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
            </label>
          );
        })}
      </div>

      {/* 入场动画:与时间轴条目一一对应 */}
      <div className="mt-4 border-t border-neutral-100 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-neutral-400">入场动画</span>
          <button
            className="rounded px-1.5 py-0.5 text-[11px] text-sky-600 transition-colors hover:bg-sky-50"
            onClick={onReplay}
            title="把播放头挪到该元素动画起点并播放"
          >
            ▶ 重播
          </button>
        </div>
        <label className="mb-2 block">
          <span className={labelCls}>类型</span>
          <select className={inputCls} value={selected.anim.type} onChange={(e) => patchAnim({ type: e.target.value }, "type")}>
            {ANIM_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-2 block">
          <span className={labelCls}>缓动</span>
          <select
            className={inputCls}
            value={selected.anim.easing ?? "auto"}
            onChange={(e) => patchAnim({ easing: parseEasing(e.target.value) }, "easing")}
          >
            {EASING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className={labelCls}>开始(秒)</span>
            <input type="number" min={0} step={0.1} className={inputCls} value={selected.anim.start} onChange={(e) => patchAnim({ start: Math.max(0, Number(e.target.value) || 0) }, "start")} />
          </label>
          <label>
            <span className={labelCls}>时长(秒)</span>
            <input type="number" min={0.05} step={0.1} className={inputCls} value={selected.anim.duration} onChange={(e) => patchAnim({ duration: Math.max(0.05, Number(e.target.value) || 0.5) }, "duration")} />
          </label>
        </div>
      </div>
      </div>
    </aside>
  );
}

function CollapseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
      onClick={onClick}
      title="折叠属性面板"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}
