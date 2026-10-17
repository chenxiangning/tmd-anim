import { useCallback, useRef, useState, type RefObject } from "react";
import type { Project, SceneElement } from "../core/types";
import { animState } from "../core/render/anim";
import { centerRayFocus, elementBounds, resolveConnector, type Rect } from "../core/render/misc";
import { updateElement } from "./editOps";
import { idsInRect, normRect } from "./hitTest";
import {
  connectorPatch,
  HANDLE_CURSORS,
  movePatch,
  resizePatch,
  rotatePatch,
  scaledFontSize,
  snapMove,
  snapConnectorPoint,
  type GestureMode,
  type HandleName,
  type SnapPoint,
  type ViewTransform,
} from "./stageOverlay";

interface DragGesture {
  mode: GestureMode | "marquee";
  handle: HandleName;
  id: string;
  startX: number;
  startY: number;
  origin: SceneElement | null;
  /** 多选整体移动的全部选中元素 */
  origins: SceneElement[];
  /** 框选并入模式(Shift) */
  addMode: boolean;
  sceneIdx: number;
  changed: boolean;
  /** 端点手势最后一次吸附:决定落点绑定 */
  lastSnap: SnapPoint | null;
}

export interface StageDragOptions {
  project: Project;
  /** 框选命中所用时刻(手势起点快照) */
  t: number;
  sceneIdx: number;
  /** 端点吸附候选的动画状态判定所用场景内时刻 */
  localT: number;
  canvasW: number;
  canvasH: number;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewRef: RefObject<ViewTransform>;
  selIdsRef: RefObject<string[]>;
  onLivePatch(next: Project): void;
  onSelectIds(ids: string[]): void;
  onGestureBegin(): void;
  onGestureEnd(): void;
}

/** 画布手势层:移动/缩放/连线端点与曲线/框选,拖拽期间锁 body 光标;
 *  guides/snapDot/marquee 暴露给覆盖层绘制,dragging 供悬停反馈避让。 */
export function useStageDrag(opts: StageDragOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const dragRef = useRef<DragGesture | null>(null);
  const marqueeRef = useRef<Rect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [snapDot, setSnapDot] = useState<SnapPoint | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);

  const startDrag = useCallback((gesture: DragGesture) => {
    const o = optsRef.current;
    dragRef.current = gesture;
    setDragging(true);
    o.onGestureBegin();
    // 手势期间锁光标与选区:指针滑出画布也持续生效,且不选中界面文字
    document.body.style.cursor =
      gesture.mode === "move" ? "move" : gesture.mode === "resize" ? HANDLE_CURSORS[gesture.handle] : gesture.mode === "marquee" ? "default" : "grab";
    document.body.style.userSelect = "none";
    // 手势内自持的项目快照:同步连发的 pointermove/up 之间 React 不会重渲染,读 props 会拿到旧状态
    let working = o.project;
    const localT = o.localT;
    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      const canvas = o.canvasRef.current;
      if (!drag || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const v = o.viewRef.current;
      const px = (ev.clientX - rect.left - v.ox) / v.scale;
      const py = (ev.clientY - rect.top - v.oy) / v.scale;
      const dx = px - drag.startX;
      const dy = py - drag.startY;
      if (!drag.changed && Math.hypot(dx * v.scale, dy * v.scale) < 2) return;
      drag.changed = true;
      if (drag.mode === "marquee") {
        const r = normRect(drag.startX, drag.startY, px, py);
        marqueeRef.current = r;
        setMarquee(r);
        return;
      }
      if (drag.mode === "move") {
        // 吸附候选 = 同场景其余元素(动画未激活的不算;整组选中时排除组内所有元素,避免吸到自己的旧边线)
        const others = (working.scenes[drag.sceneIdx]?.elements ?? []).filter(
          (item) => !drag.origins.some((og) => og.id === item.id) && item.kind !== "connector" && animState(localT, item.anim).active,
        );
        if (drag.origins.length > 1) {
          // 多选:以选中集包围盒为吸附探针(连线除外),校正量应用到每个元素
          const boxes = drag.origins.filter((og) => og.kind !== "connector");
          const bb = boxes.reduce(
            (acc, og) => ({
              x1: Math.min(acc.x1, og.x), y1: Math.min(acc.y1, og.y),
              x2: Math.max(acc.x2, og.x + og.w), y2: Math.max(acc.y2, og.y + og.h),
            }),
            { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity },
          );
          const s = boxes.length
            ? snapMove({ x: bb.x1, y: bb.y1, w: bb.x2 - bb.x1, h: bb.y2 - bb.y1 }, dx, dy, o.canvasW, o.canvasH, 8 / v.scale, others)
            : { dx, dy, guideX: null, guideY: null };
          setGuides({ x: s.guideX, y: s.guideY });
          let next = working;
          for (const og of drag.origins) next = updateElement(next, drag.sceneIdx, og.id, movePatch(og, s.dx, s.dy, o.canvasW, o.canvasH, 0).patch);
          working = next;
          o.onLivePatch(next);
          return;
        }
        if (!drag.origin) return;
        // 吸附阈值按屏幕 8px 换算成逻辑像素,缩放状态下手感一致
        const moved = movePatch(drag.origin, dx, dy, o.canvasW, o.canvasH, 8 / v.scale, others);
        setGuides({ x: moved.guideX, y: moved.guideY });
        working = updateElement(working, drag.sceneIdx, drag.id, moved.patch);
        o.onLivePatch(working);
        return;
      }
      if (drag.mode === "resize") {
        if (!drag.origin) return;
        // 角手柄默认等比(文字类字号随动),按住 Shift 切回自由两轴
        const proportional = drag.handle.length === 2 && !ev.shiftKey;
        const geo = resizePatch(drag.origin, drag.handle, dx, dy, proportional);
        const fs = proportional ? scaledFontSize(drag.origin, geo) : null;
        working = updateElement(working, drag.sceneIdx, drag.id, fs ? { ...geo, ...fs } : geo);
        o.onLivePatch(working);
        return;
      }
      if (drag.mode === "rotate") {
        if (!drag.origin) return;
        working = updateElement(working, drag.sceneIdx, drag.id, rotatePatch(drag.origin, px, py, ev.shiftKey));
        o.onLivePatch(working);
        return;
      }
      // 端点靠近其他元素时自动粘连,落点绑定该元素实现连线跟随
      const others = (working.scenes[drag.sceneIdx]?.elements ?? []).filter(
        (item) => item.id !== drag.id && item.kind !== "connector" && animState(localT, item.anim).active,
      );
      const snap = snapConnectorPoint(others, px, py);
      drag.lastSnap = snap;
      setSnapDot(snap);
      // 拖拽端点(nw/se)期间实时解除本端绑定,否则渲染端点被 focus 钉在元素上、松手才跳变;曲线手柄不动绑定
      const isEndpoint = drag.handle === "nw" || drag.handle === "se";
      const bindField = drag.handle === "nw" ? "fromEl" : "toEl";
      const focusField = drag.handle === "nw" ? "fromFocus" : "toFocus";
      working = updateElement(working, drag.sceneIdx, drag.id, {
        ...connectorPatch(drag.origin as never, drag.handle, snap?.x ?? px, snap?.y ?? py),
        ...(isEndpoint ? { [bindField]: undefined, [focusField]: undefined } : {}),
      });
      o.onLivePatch(working);
    };
    const onUp = () => {
      const drag = dragRef.current;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setDragging(false);
      setGuides({ x: null, y: null });
      setSnapDot(null);
      if (drag?.mode === "marquee") {
        const r = marqueeRef.current;
        marqueeRef.current = null;
        setMarquee(null);
        if (drag.changed && r) {
          const ids = idsInRect(working, o.t, r);
          o.onSelectIds(drag.addMode ? [...new Set([...o.selIdsRef.current, ...ids])] : ids);
        }
      } else if (drag?.mode === "endpoint" && drag.changed && working.scenes[drag.sceneIdx]) {
        // 落在元素上绑定并记录归一化锚点(元素移动端点固定),落空解除绑定(基于手势内最新项目,不回滚拖拽位移)
        const field = drag.handle === "nw" ? "fromEl" : "toEl";
        const focusField = drag.handle === "nw" ? "fromFocus" : "toFocus";
        const snap = drag.lastSnap;
        let patch: Record<string, unknown> = { [field]: snap?.elId, [focusField]: undefined };
        if (snap?.elId) {
          const target = working.scenes[drag.sceneIdx]?.elements.find((e) => e.id === snap.elId);
          const b = target ? elementBounds(target) : null;
          if (b && b.w > 0 && b.h > 0) {
            let fx = (snap.x - b.x) / b.w;
            let fy = (snap.y - b.y) / b.h;
            if (fx > 0 && fx < 1 && fy > 0 && fy < 1) {
              // 吸到元素中心:端点投影到朝对端方向的边线,线从边界接入而不是穿进元素
              const cur = working.scenes[drag.sceneIdx]?.elements.find((e) => e.id === drag.id);
              const others = working.scenes[drag.sceneIdx]?.elements ?? [];
              const r = cur?.kind === "connector" ? resolveConnector(cur, others) : null;
              const [ox, oy] = field === "toEl" ? (r?.from ?? [snap.x, snap.y]) : (r?.to ?? [snap.x, snap.y]);
              [fx, fy] = centerRayFocus(b, ox, oy);
            }
            patch = { [field]: snap.elId, [focusField]: [Math.min(1, Math.max(0, fx)), Math.min(1, Math.max(0, fy))] };
          }
        }
        working = updateElement(working, drag.sceneIdx, drag.id, patch);
        o.onLivePatch(working);
      }
      o.onGestureEnd();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  return { startDrag, dragging, guides, snapDot, marquee };
}
