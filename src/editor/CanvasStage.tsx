import { useEffect, useRef, useState } from "react";
import type { Project, SceneElement } from "../core/types";
import { drawFrame } from "../core/render";
import { resolveConnector } from "../core/render/misc";
import { locate } from "../core/timeline";
import { updateElement } from "./editOps";
import { hitTest } from "./hitTest";
import { InlineTextEditor } from "./InlineTextEditor";
import { resolveTextTarget, type TextTarget } from "./textTarget";
import { useStageDrag } from "./useStageDrag";
import { useStageView } from "./useStageView";
import {
  drawAssistOverlay,
  drawHoverOverlay,
  drawSelectionOverlay,
  HANDLE_CURSORS,
  hitHandle,
  type ViewTransform,
} from "./stageOverlay";

const HANDLE_R = 9;

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

/** 中央画布:渲染当前帧 + 选中覆盖层;点击/框选/Shift 多选、拖拽移动、手柄缩放(角手柄等比,Shift 自由);
 *  连线端点吸附并绑定元素;双击改文本;悬停给光标与淡框反馈。手势细节在 useStageDrag。 */
export function CanvasStage({ project, t, selIds, previewing, onSelectIds, onLivePatch, onGestureBegin, onGestureEnd, onDropCreate }: CanvasStageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pw = project.canvas?.width ?? 1920;
  const ph = project.canvas?.height ?? 1080;
  const { view, setView, viewRef, computeView, zoomAt, beginPan, movePan, endPan } = useStageView(wrapRef, pw, ph);
  const [editing, setEditing] = useState<{ id: string; target: TextTarget } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const selIdsRef = useRef(selIds);
  selIdsRef.current = selIds;

  const located = locate(project, t);
  const scene = project.scenes[located.index];

  const { startDrag, dragging, guides, snapDot, marquee } = useStageDrag({
    project,
    t,
    sceneIdx: located.index,
    localT: located.localT,
    canvasW: pw,
    canvasH: ph,
    canvasRef,
    viewRef,
    selIdsRef,
    onLivePatch,
    onSelectIds,
    onGestureBegin,
    onGestureEnd,
  });

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
      const next: ViewTransform = computeView(cw, ch);
      const prev = viewRef.current;
      if (prev.scale !== next.scale || prev.ox !== next.ox || prev.oy !== next.oy) setView(next);
      viewRef.current = next;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.setTransform(dpr * next.scale, 0, 0, dpr * next.scale, dpr * next.ox, dpr * next.oy);
      drawFrame(ctx, project, t);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!previewing && scene) {
        if (hoverId) {
          const el = scene.elements.find((item) => item.id === hoverId);
          if (el) drawHoverOverlay(ctx, el, next);
        }
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
  }, [project, t, selIds, hoverId, view, guides, snapDot, marquee, previewing, pw, ph]);

  // 滚轮缩放(绕指针):原生监听以便 preventDefault 吃掉页面滚动
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY);
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const toLogical = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const v = viewRef.current;
    return rect ? { x: (clientX - rect.left - v.ox) / v.scale, y: (clientY - rect.top - v.oy) / v.scale } : { x: 0, y: 0 };
  };

  /** 悬停反馈:手柄按方向变光标,元素变 move 光标并描淡框;拖拽/预览/行内编辑中不干扰 */
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (previewing || dragging || editing) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !scene) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    let cursor = "";
    if (selIds.length === 1) {
      const el = scene.elements.find((item) => item.id === selIds[0]);
      const resolved = el?.kind === "connector" ? resolveConnector(el, scene.elements) : el;
      const hh = resolved ? hitHandle(resolved, viewRef.current, sx, sy, HANDLE_R, scene.elements) : null;
      if (hh) cursor = hh.isConnector ? "grab" : HANDLE_CURSORS[hh.handle];
    }
    const pt = toLogical(e.clientX, e.clientY);
    const id = hitTest(project, t, pt.x, pt.y);
    e.currentTarget.style.cursor = cursor || (id ? "move" : "");
    setHoverId(id && !selIds.includes(id) ? id : null);
  };

  const onPointerLeave = () => setHoverId(null);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (previewing) return;
    // 中键拖拽平移视口
    if (e.button === 1) {
      e.preventDefault();
      beginPan(e.clientX, e.clientY);
      document.body.style.cursor = "grabbing";
      const onMove = (ev: PointerEvent) => movePan(ev.clientX, ev.clientY);
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        endPan();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return;
    }
    const pt = toLogical(e.clientX, e.clientY);
    const rect = canvasRef.current?.getBoundingClientRect();
    // 已单选:手柄优先于一切命中——手柄命中圆有一半在元素外,悬停光标承诺了方向,按下必须兑现
    if (!previewing && selIds.length === 1 && scene && rect) {
      const sel = scene.elements.find((item) => item.id === selIds[0]);
      const resolvedSel = sel?.kind === "connector" ? resolveConnector(sel, scene.elements) : sel;
      const selHit = resolvedSel ? hitHandle(resolvedSel, viewRef.current, e.clientX - rect.left, e.clientY - rect.top, HANDLE_R, scene.elements) : null;
      if (selHit && resolvedSel) {
        startDrag({ mode: selHit.mode, handle: selHit.handle, id: selIds[0], startX: pt.x, startY: pt.y, origin: resolvedSel, origins: [resolvedSel], addMode: false, sceneIdx: located.index, changed: false, lastSnap: null });
        return;
      }
    }
    const id = hitTest(project, t, pt.x, pt.y);
    if (id && scene) {
      const el = scene.elements.find((item) => item.id === id);
      const resolvedEl = el?.kind === "connector" ? resolveConnector(el, scene.elements) : el;
      // 未选中连线:端点/曲线点可直接拖(命中半径放宽)
      const hit =
        rect && resolvedEl?.kind === "connector"
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
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
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
