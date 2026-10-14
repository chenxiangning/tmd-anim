interface PanelRailProps {
  side: "left" | "right" | "bottom";
  label: string;
  onExpand(): void;
}

/** 面板折叠后的窄条:左/右为竖排文字轨,底部为横条,点击展开。 */
export function PanelRail({ side, label, onExpand }: PanelRailProps) {
  if (side === "bottom") {
    return (
      <button
        className="flex h-9 shrink-0 items-center gap-2 border-t border-neutral-200 bg-white px-3 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-50"
        onClick={onExpand}
        title={`展开${label}`}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 15l-6-6-6 6" />
        </svg>
        {label}
      </button>
    );
  }
  const isLeft = side === "left";
  return (
    <button
      className={`flex ${isLeft ? "w-9 border-r" : "w-9 border-l"} shrink-0 flex-col items-center gap-3 border-neutral-200 bg-white py-3 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-50`}
      onClick={onExpand}
      title={`展开${label}面板`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d={isLeft ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
      </svg>
      <span className="tracking-[0.3em]" style={{ writingMode: "vertical-rl" }}>
        {label}
      </span>
    </button>
  );
}
