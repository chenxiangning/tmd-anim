import type { RefObject } from "react";
import type { Scene } from "../core/types";
import { AUDIO_SEL } from "./sceneAudio";
import { AudioLaneLabel } from "./AudioLane";
import { elementLabel, kindColor } from "./defaults";

interface TimelineLabelsProps {
  scene: Scene;
  selIds: string[];
  rulerH: number;
  rowH: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onScroll: () => void;
}

/** 时间轴左侧标签列:与右侧元素条按行对齐;点击选中,配色与画布元素一致。 */
export function TimelineLabels({ scene, selIds, rulerH, rowH, scrollRef, onSelect, onScroll }: TimelineLabelsProps) {
  return (
    <div className="relative w-36 shrink-0 border-r border-neutral-200">
      <div
        className="absolute inset-x-0 top-0 z-10 flex items-center border-b border-neutral-100 bg-white px-2 text-[10px] text-neutral-400"
        style={{ height: rulerH }}
      >
        元素 / 时间线
      </div>
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingTop: rulerH }}
        onScroll={onScroll}
      >
        {scene.elements.map((el) => (
          <button
            key={el.id}
            onClick={() => onSelect(el.id)}
            className={`flex w-full items-center gap-1.5 px-2 text-left text-[11px] ${selIds.includes(el.id) ? "bg-amber-50 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50"}`}
            style={{ height: rowH }}
          >
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: kindColor(el.kind) }} />
            <span className="truncate">{elementLabel(el)}</span>
          </button>
        ))}
        <AudioLaneLabel
          hasAudio={!!scene.audio?.src}
          selected={selIds.includes(AUDIO_SEL)}
          onSelect={() => onSelect(AUDIO_SEL)}
        />
      </div>
    </div>
  );
}
