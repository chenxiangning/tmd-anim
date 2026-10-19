import { ANIM_TYPE_OPTIONS, EASING_OPTIONS, EXIT_TYPE_OPTIONS, parseEasing } from "./animMeta";
import type { SceneElement } from "../core/types";

export const labelCls = "mb-1 block text-[11px] font-medium text-neutral-500";
export const inputCls =
  "w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-800 outline-none transition-colors hover:border-neutral-300 focus:border-slate-500";

interface TimelineSectionsProps {
  selected: SceneElement;
  onReplay: () => void;
  patchAnim: (fields: Record<string, unknown>, key: string) => void;
  patchExit: (fields: Record<string, unknown>, key: string) => void;
  clearExit: () => void;
}

/** 属性面板的时间轴区:入场动画(与时间轴一一对应)+ 离场动画 + 强调/补间提示。
 *  强调事件与属性补间由 AI/JSON 编辑,这里只读展示数量。 */
export function TimelineSections({ selected, onReplay, patchAnim, patchExit, clearExit }: TimelineSectionsProps) {
  return (
    <>
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
      <div className="mt-4 border-t border-neutral-100 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-neutral-400">离场动画</span>
          {selected.exit ? (
            <button className="rounded px-1.5 py-0.5 text-[11px] text-red-500 transition-colors hover:bg-red-50" onClick={clearExit}>
              移除离场
            </button>
          ) : (
            <button className="rounded px-1.5 py-0.5 text-[11px] text-sky-600 transition-colors hover:bg-sky-50" onClick={() => patchExit({}, "add")}>
              + 添加离场
            </button>
          )}
        </div>
        {selected.exit && (
          <>
            <label className="mb-2 block">
              <span className={labelCls}>类型</span>
              <select
                className={inputCls}
                value={selected.exit.type}
                onChange={(e) => patchExit({ type: e.target.value }, "type")}
              >
                {EXIT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className={labelCls}>开始(秒)</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className={inputCls}
                  value={selected.exit.start}
                  onChange={(e) => patchExit({ start: Math.max(0, Number(e.target.value) || 0) }, "start")}
                />
              </label>
              <label>
                <span className={labelCls}>时长(秒)</span>
                <input
                  type="number"
                  min={0.05}
                  step={0.1}
                  className={inputCls}
                  value={selected.exit.duration}
                  onChange={(e) => patchExit({ duration: Math.max(0.05, Number(e.target.value) || 0.5) }, "duration")}
                />
              </label>
            </div>
          </>
        )}
        {selected.emphasis?.length || selected.tweens?.length ? (
          <div className="mt-2 text-[11px] leading-relaxed text-neutral-400">
            {selected.emphasis?.length ? `强调事件 ${selected.emphasis.length} 个` : ""}
            {selected.emphasis?.length && selected.tweens?.length ? " · " : ""}
            {selected.tweens?.length ? `属性补间 ${selected.tweens.length} 个` : ""}
            <br />
            (经 AI / JSON 编辑,时间轴面板可视化)
          </div>
        ) : null}
      </div>
    </>
  );
}
