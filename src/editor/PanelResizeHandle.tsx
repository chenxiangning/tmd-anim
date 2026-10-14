interface PanelResizeHandleProps {
  side: "left" | "right";
  onStart(e: React.PointerEvent): void;
  onReset(): void;
}

const SIDE_CLS = {
  left: "inset-y-0 left-0",
  right: "inset-y-0 right-0",
};

/** 侧栏宽度拖拽把手:贴边 6px 常显细条,悬停加深,双击复位。 */
export function PanelResizeHandle({ side, onStart, onReset }: PanelResizeHandleProps) {
  return (
    <div
      className={`absolute z-20 w-1.5 cursor-ew-resize bg-neutral-100 transition-colors hover:bg-slate-400 ${SIDE_CLS[side]}`}
      title="拖拽调整宽度,双击复位"
      onPointerDown={onStart}
      onDoubleClick={onReset}
    />
  );
}
