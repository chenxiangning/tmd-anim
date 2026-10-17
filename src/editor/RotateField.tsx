import { useState } from "react";

/** 旋转角输入:聚焦期间用本地草稿,允许输入负号与中间态;失焦时未提交的非法值归 0。
 *  提交的数字按 0.1 度写回(与协议精度一致)。 */

const inputCls =
  "w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-800 outline-none transition-colors hover:border-neutral-300 focus:border-slate-500";
const labelCls = "mb-1 block text-[11px] font-medium text-neutral-500";

export function RotateField({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(Math.round(value * 10) / 10);
  return (
    <label>
      <span className={labelCls}>旋转°</span>
      <input
        type="number"
        className={inputCls}
        value={shown}
        onFocus={() => setDraft(String(Math.round(value * 10) / 10))}
        onChange={(e) => {
          const d = e.target.value;
          setDraft(d);
          const n = Number(d);
          if (d !== "" && d !== "-" && Number.isFinite(n)) onCommit(Math.round(n * 10) / 10);
        }}
        onBlur={() => {
          if (draft !== null && !Number.isFinite(Number(draft))) onCommit(0);
          setDraft(null);
        }}
      />
    </label>
  );
}
