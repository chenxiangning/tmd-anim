import { useEffect, useRef, useState } from "react";
import bpeSample from "../../samples/bpe.json";
import xiaoheiSample from "../../samples/xiaohei.json";

interface SampleMenuProps {
  /** 传入示例 JSON 文本,由调用方统一走 parseProjectText 建副本 */
  onCreate(text: string): void;
}

/** 首页「从示例新建」下拉:两个内置示例(协议全家福 / 小黑插画风格)。 */
export function SampleMenu({ onCreate }: SampleMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const samples = [
    { key: "bpe", label: "BPE 分词示例", hint: "协议元素全家福,改它起步最快", json: bpeSample },
    { key: "xiaohei", label: "小黑插画示例", hint: "手绘怪诞风,配 docs/xiaohei-style.md", json: xiaoheiSample },
  ];

  return (
    <div className="relative" ref={ref}>
      <button className={"btn btn-secondary"} onClick={() => setOpen((v) => !v)}>
        从示例新建
      </button>
      {open && (
        <div className="absolute top-full right-0 z-20 mt-1 w-64 rounded-lg border border-neutral-200 bg-white py-1 shadow-md">
          {samples.map((s) => (
            <button
              key={s.key}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-neutral-50"
              onClick={() => {
                setOpen(false);
                onCreate(JSON.stringify(s.json));
              }}
            >
              <span className="text-xs font-medium text-neutral-800">{s.label}</span>
              <span className="text-[11px] text-neutral-400">{s.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
