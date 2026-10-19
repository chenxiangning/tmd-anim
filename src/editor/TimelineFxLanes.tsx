import type { SceneElement } from "../core/types";
import { exitTypeLabel } from "./animMeta";

interface TimelineFxLanesProps {
  elements: SceneElement[];
  pps: number;
  rowTop: (i: number) => number;
  barH: number;
}

/** 时间轴的离场(红)/强调(琥珀)只读泳道条:与元素条同排叠放,不参与拖拽。 */
export function TimelineFxLanes({ elements, pps, rowTop, barH }: TimelineFxLanesProps) {
  return (
    <>
      {elements.map((el, i) => {
        const laneTop = rowTop(i);
        return (
          <div key={`fx-${el.id}`}>
            {el.exit && (
              <div
                className="absolute rounded-[3px] bg-red-400/80"
                style={{ left: el.exit.start * pps, width: Math.max(el.exit.duration * pps, 5), top: laneTop + barH - 4, height: 4 }}
                title={`离场:${exitTypeLabel(el.exit.type)} ${el.exit.start.toFixed(1)}s + ${el.exit.duration.toFixed(1)}s`}
              />
            )}
            {el.emphasis?.map((ev, j) => (
              <div
                key={`em-${el.id}-${j}`}
                className="absolute rounded-[3px] bg-amber-400/90"
                style={{ left: ev.start * pps, width: Math.max(ev.duration * pps, 5), top: laneTop, height: 3 }}
                title={`强调:${ev.type} ${ev.start.toFixed(1)}s + ${ev.duration.toFixed(1)}s`}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
