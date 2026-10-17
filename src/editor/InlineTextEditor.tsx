import { useEffect, useRef, useState } from "react";
import type { ViewTransform } from "./stageOverlay";
import type { TextTarget } from "./textTarget";
import { MONO, SANS } from "../core/render/text";

interface InlineTextEditorProps {
  target: TextTarget;
  view: ViewTransform;
  onCommit(value: string): void;
  onClose(): void;
}

/**
 * 画布行内文本编辑浮层:双击元素出现,位置/字号/配色贴合元素本身。
 * 提交 = 失焦,或单行 Enter,或多行 Cmd/Ctrl+Enter;Esc 取消。
 */
export function InlineTextEditor({ target, view, onCommit, onClose }: InlineTextEditorProps) {
  const [value, setValue] = useState(target.value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (commit: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (commit && value !== target.value) onCommit(value);
    onClose();
  };
  const s = view.scale;
  return (
    <textarea
      ref={ref}
      className="absolute z-10 resize-none overflow-hidden rounded-sm outline-none ring-2 ring-sky-400"
      style={{
        left: view.ox + target.rect.x * s,
        top: view.oy + target.rect.y * s,
        width: target.rect.w * s,
        height: target.rect.h * s,
        fontSize: target.fontSize * s,
        lineHeight: `${target.lineHeight * s}px`,
        fontFamily: target.mono ? MONO : SANS,
        fontWeight: 600,
        color: target.color,
        background: target.bg,
        textAlign: target.align,
        transform: target.rotate ? `rotate(${target.rotate}deg)` : undefined,
        transformOrigin: "center center",
        padding: 0,
        paddingLeft: target.padLeft * s,
        paddingRight: target.padLeft * s,
      }}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        } else if (e.key === "Enter" && (!target.multiline || e.metaKey || e.ctrlKey) && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        }
      }}
    />
  );
}
