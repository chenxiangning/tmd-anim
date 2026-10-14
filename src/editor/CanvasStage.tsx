import { useEffect, useRef, useState } from "react";
import type { Project, SceneElement } from "../core/types";
import { drawFrame } from "../core/render";
import { animState } from "../core/render/anim";
import { resolveConnector, type Rect } from "../core/render/misc";
import { locate } from "../core/timeline";
import { updateElement } from "./editOps";
import { hitTest, idsInRect, normRect } from "./hitTest";
import { InlineTextEditor } from "./InlineTextEditor";
import { resolveTextTarget, type TextTarget } from "./textTarget";
import {
  connectorPatch,
  drawAssistOverlay,
  drawSelectionOverlay,
  hitHandle,
  movePatch,
  resizePatch,
  snapConnectorPoint,
  type GestureMode,
  type HandleName,
  type SnapPoint,
  type ViewTransform,
} from "./stageOverlay";

const HANDLE_R = 9;
const SNAP = 8;
interface CanvasStageProps {
  project: Project;
  t: number;
  selIds: string[];
  previewing: boolean;
  onSelectIds(ids: string[]): void;
  onLivePatch(next: Project): void;
  onGestureBegin(): void;
  onGestureEnd(): void;
  onDropCreate(kind: string, x: number, y: number): void;
}

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

/** 中央画布:渲染当前帧 + 选中覆盖层;点击/框选/Shift 多选、拖拽移动、手柄缩放;连线端点吸附并绑定元素;双击改文本。 */
export function CanvasStage({ project, t, selIds, previewing, onSelectIds, onLivePatch, onGestureBegin, onGestureEnd, onDropCreate }: CanvasStageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<ViewTransform>({ scale: 1, ox: 0, oy: 0 });
  const [view, setView] = useState<ViewTransform>(viewRef.current);
  const dragRef = useRef<DragGesture | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [snapDot, setSnapDot] = useState<SnapPoint | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [editing, setEditing] = useState<{ id: string; target: TextTarget } | null>(null);
  const marqueeRef = useRef<Rect | null>(null);
  const selIdsRef = useRef(selIds);
  selIdsRef.current = selIds;

  const pw = project.canvas?.width ?? 1920;
  const ph = project.canvas?.height ?? 1080;
  const located = locate(project, t);
  const scene = project.scenes[located.index];

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cw = wrap.clientWidth;
      const ch = wrap.clientHeight;
      if (!cw || !ch) return;
      const bw = Math.round(cw * dpr);
      const bh = Math.round(ch * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const scale = Math.min(cw / pw, ch / ph);
      const next: ViewTransform = { scale, ox: (cw - pw * scale) / 2, oy: (ch - ph * scale) / 2 };
      const prev = viewRef.current;
      if (prev.scale !== next.scale || prev.ox !== next.ox || prev.oy !== next.oy) setView(next);
      viewRef.current = next;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * next.ox, dpr * next.oy);
      drawFrame(ctx, project, t);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!previewing && scene) {
        const withHandles = selIds.length === 1;
        for (const id of selIds) {
          const el = scene.elements.find((item) => item.id === id);
          if (!el) continue;
          drawSelectionOverlay(ctx, el.kind === "connector" ? resolveConnector(el, scene.elements) : el, next, withHandles, scene.elements);
        }
        drawAssistOverlay(ctx, next, cw, ch, guides, snapDot, marquee);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [project, t, selIds, guides, snapDot, marquee, previewing, pw, ph]);

  function startDrag(gesture: DragGesture): void {
    dragRef.current = gesture;
    onGestureBegin();
    const localT = located.localT;
    // 手势内自持的项目快照:同步连发的 pointermove/up 之间 React 不会重渲染,读 props 会拿到旧状态
    let working = project;
    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      const canvas = canvasRef.current;
      if (!drag || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const v = viewRef.current;
      const px = (ev.clientX - rect.left - v.ox) / v.scale;
      const py = (ev.clientY - rect.top - v.oy) / v.scale;
      const dx = px - drag.startX;
      const dy = py - drag.startY;
      if (!drag.changed && Math.hypot(dx * v.scale, dy * v.scale) < 2) return;
      drag.changed = true;
      if (drag.mode === "marquee") {
        const rect = normRect(drag.startX, drag.startY, px, py);
        marqueeRef.current = rect;
        setMarquee(rect);
        return;
      }
      if (drag.mode === "move") {
        if (drag.origins.length > 1) {
          let next = working;
          for (const o of drag.origins) next = updateElement(next, drag.sceneIdx, o.id, movePatch(o, dx, dy, pw, ph, 0).patch);
          working = next;
          onLivePatch(next);
          return;
        }
        if (!drag.origin) return;
        const moved = movePatch(drag.origin, dx, dy, pw, ph, SNAP);
        setGuides({ x: moved.guideX, y: moved.guideY });
        working = updateElement(working, drag.sceneIdx, drag.id, moved.patch);
        onLivePatch(working);
        return;
      }
      if (drag.mode === "resize") {
        if (!drag.origin) return;
        working = updateElement(working, drag.sceneIdx, drag.id, resizePatch(drag.origin, drag.handle, dx, dy));
        onLivePatch(working);
        return;
      }
      // 端点靠近其他元素时自动粘连,落点绑定该元素实现连线跟随
      const others = (working.scenes[drag.sceneIdx]?.elements ?? []).filter(
        (item) => item.id !== drag.id && item.kind !== "connector" && animState(localT, item.anim).active,
      );
      const snap = snapConnectorPoint(others, px, py);
      drag.lastSnap = snap;
      setSnapDot(snap);
      working = updateElement(working, drag.sceneIdx, drag.id, connectorPatch(drag.origin as never, drag.handle, snap?.x ?? px, snap?.y ?? py));
      onLivePatch(working);
    };
    const onUp = () => {
      const drag = dragRef.current;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dragRef.current = null;
      setGuides({ x: null, y: null });
      setSnapDot(null);
      if (drag?.mode === "marquee") {
        const rect = marqueeRef.current;
        setMarquee(null);
        if (drag.changed && rect) onSelectIds(drag.addMode ? [...new Set([...selIdsRef.current, ...idsInRect(working, t, rect)])] : idsInRect(working, t, rect));
      } else if (drag?.mode === "endpoint" && drag.changed && working.scenes[drag.sceneIdx]) {
        // 落在元素上绑定,落空解除绑定(基于手势内最新项目,不回滚拖拽位移)
        const field = drag.handle === "nw" ? "fromEl" : "toEl";
        working = updateElement(working, drag.sceneIdx, drag.id, { [field]: drag.lastSnap?.elId });
        onLivePatch(working);
      }
      onGestureEnd();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const toLogical = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const v = viewRef.current;
    return rect ? { x: (clientX - rect.left - v.ox) / v.scale, y: (clientY - rect.top - v.oy) / v.scale } : { x: 0, y: 0 };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (previewing) return;
    const pt = toLogical(e.clientX, e.clientY);
    const id = hitTest(project, t, pt.x, pt.y);
    if (id && scene) {
      const el = scene.elements.find((item) => item.id === id);
      const resolvedEl = el?.kind === "connector" ? resolveConnector(el, scene.elements) : el;
      const rect = canvasRef.current?.getBoundingClientRect();
      // 手柄命中优先于整体移动:缩放手柄仅单一选中时显示;连线端点/曲线点未选中也可直接拖
      const hit =
        rect && resolvedEl && selIds.length === 1 && id === selIds[0]
          ? hitHandle(resolvedEl, viewRef.current, e.clientX - rect.left, e.clientY - rect.top, HANDLE_R, scene.elements)
          : rect && resolvedEl?.kind === "connector"
            ? hitHandle(resolvedEl, viewRef.current, e.clientX - rect.left, e.clientY - rect.top, HANDLE_R + 4, scene.elements)
            : null;
      if (hit && resolvedEl) {
        onSelectIds([id]);
        startDrag({ mode: hit.mode, handle: hit.handle, id, startX: pt.x, startY: pt.y, origin: resolvedEl, origins: [resolvedEl], addMode: false, sceneIdx: located.index, changed: false, lastSnap: null });
        return;
      }
      if (e.shiftKey) {
        onSelectIds(selIds.includes(id) ? selIds.filter((x) => x !== id) : [...selIds, id]);
        return;
      }
      const group = selIds.includes(id) ? selIds : [id];
      onSelectIds(group);
      if (!el) return;
      const origins = group.map((gid) => scene.elements.find((item) => item.id === gid)).filter((x): x is SceneElement => Boolean(x));
      startDrag({ mode: "move", handle: "se", id, startX: pt.x, startY: pt.y, origin: el, origins, addMode: false, sceneIdx: located.index, changed: false, lastSnap: null });
      return;
    }
    // 空白处:按下即清选,拖动成框选(Shift 并入现有选择)
    if (!e.shiftKey) onSelectIds([]);
    startDrag({ mode: "marquee", handle: "se", id: "", startX: pt.x, startY: pt.y, origin: null, origins: [], addMode: e.shiftKey, sceneIdx: located.index, changed: false, lastSnap: null });
  };

  /** 双击元素进入行内文本编辑;历史经手势 begin/end 记为一条 undo */
  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (previewing || !scene) return;
    const pt = toLogical(e.clientX, e.clientY);
    const id = hitTest(project, t, pt.x, pt.y);
    if (!id) return;
    onSelectIds([id]);
    const el = scene.elements.find((item) => item.id === id);
    if (!el) return;
    const target = resolveTextTarget(el, pt.x, pt.y);
    if (!target) return;
    onGestureBegin();
    setEditing({ id, target });
  };

  const commitInline = (value: string) => {
    if (!editing) return;
    onLivePatch(updateElement(project, located.index, editing.id, editing.target.patch(value)));
  };
  const closeInline = () => {
    setEditing(null);
    onGestureEnd();
  };

  return (
    <div
      className="min-h-0 flex-1"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const data = e.dataTransfer.getData("text/x-tmd-anim-kind");
        if (!data) return;
        const pt = toLogical(e.clientX, e.clientY);
        onDropCreate(data, pt.x, pt.y);
      }}
    >
      <div
        ref={wrapRef}
        className={`relative h-full w-full overflow-hidden ${previewing ? "" : "ring-1 ring-neutral-200"}`}
        style={previewing ? undefined : { background: project.canvas?.bg ?? "#F4F4F1" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          onPointerDown={onPointerDown}
          onDoubleClick={onDoubleClick}
        />
        {editing && <InlineTextEditor key={editing.id} target={editing.target} view={view} onCommit={commitInline} onClose={closeInline} />}
        {previewing && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-[11px] text-white">
            预览中 · Esc 退出
          </div>
        )}
      </div>
    </div>
  );
}
