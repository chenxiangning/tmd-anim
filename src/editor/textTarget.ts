import type {
  ArrayCellsElement,
  BrowserElement,
  CodeElement,
  ConnectorElement,
  KbdElement,
  ListElement,
  SceneElement,
  StepCardElement,
  TableElement,
  TerminalElement,
} from "../core/types";
import { connectorRoute } from "../core/render/connectorRoute";
import { readableOn } from "../core/render/elements";
import { PALETTE } from "../core/render/cells";
import { elementRotate } from "./hitTest";

/**
 * 双击行内编辑目标:把元素(和点击位置)解析成一个可编辑文本字段,
 * 含编辑框几何与贴合元素外观的样式;patch(value) 产出元素补丁。
 * shape 编辑内嵌 text;image 无文本,返回 null。
 */

export interface TextTarget {
  /** 提交的元素字段;cell 表示表格单元、数组格或列表条目 */
  field: "text" | "code" | "label" | "cell";
  value: string;
  multiline: boolean;
  mono: boolean;
  fontSize: number;
  /** 编辑框区域(画布逻辑坐标);lineHeight/padLeft 为逻辑像素 */
  rect: { x: number; y: number; w: number; h: number };
  lineHeight: number;
  padLeft: number;
  bg: string;
  color: string;
  align: "left" | "center";
  /** 元素静态旋转角(度);编辑框随元素一起转,缺省 0 */
  rotate?: number;
  patch(value: string): Record<string, unknown>;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

export function resolveTextTarget(el: SceneElement, px: number, py: number, elements: SceneElement[] = []): TextTarget | null {
  const target = resolveTextTargetInner(el, px, py, elements);
  if (!target) return null;
  // 编辑框随元素静态旋转(形状/便签等任意角度),连线无旋转
  return { ...target, rotate: el.kind === "connector" ? 0 : elementRotate(el) };
}

function resolveTextTargetInner(el: SceneElement, px: number, py: number, elements: SceneElement[]): TextTarget | null {
  switch (el.kind) {
    case "title":
    case "artText": {
      const fontSize = el.fontSize ?? (el.kind === "title" ? 64 : 120);
      return {
        field: "text", value: el.text, multiline: true, mono: false, fontSize,
        rect: box(el.x, el.y, el.w, el.h), lineHeight: fontSize * 1.5, padLeft: 0,
        bg: "#FFFFFF", color: el.color ?? "#111827", align: "center",
        patch: (v) => ({ text: v }),
      };
    }
    case "text": {
      const fontSize = el.fontSize ?? 40;
      return {
        field: "text", value: el.text, multiline: true, mono: false, fontSize,
        rect: box(el.x, el.y, el.w, el.h), lineHeight: fontSize * 1.5, padLeft: 0,
        bg: "#FFFFFF", color: el.color ?? "#1F2937", align: el.align ?? "left",
        patch: (v) => ({ text: v }),
      };
    }
    case "input": {
      const fontSize = el.fontSize ?? 36;
      return {
        field: "text", value: el.text, multiline: false, mono: false, fontSize,
        rect: box(el.x, el.y, el.w, el.h), lineHeight: el.h, padLeft: fontSize * 0.6,
        bg: "#FFFFFF", color: "#111827", align: "left",
        patch: (v) => ({ text: v }),
      };
    }
    case "badge": {
      const fontSize = el.fontSize ?? 34;
      return {
        field: "text", value: el.text, multiline: false, mono: false, fontSize,
        rect: box(el.x, el.y, el.w, el.h), lineHeight: el.h, padLeft: 0,
        bg: el.bg ?? "#1D4ED8", color: el.color ?? "#FFFFFF", align: "center",
        patch: (v) => ({ text: v }),
      };
    }
    case "note": {
      const fontSize = el.fontSize ?? 30;
      return {
        field: "text", value: el.text, multiline: true, mono: false, fontSize,
        rect: box(el.x, el.y, el.w, el.h), lineHeight: fontSize * 1.5, padLeft: 0,
        bg: el.bg ?? "#FDE68A", color: "#78350F", align: "center",
        patch: (v) => ({ text: v }),
      };
    }
    case "shape": {
      const fontSize = el.fontSize ?? 28;
      return {
        field: "text", value: el.text ?? "", multiline: false, mono: false, fontSize,
        rect: box(el.x, el.y, el.w, el.h), lineHeight: el.h, padLeft: 0,
        bg: el.fill ?? "#FFFFFF", color: el.color ?? readableOn(el.fill), align: "center",
        patch: (v) => ({ text: v }),
      };
    }
    case "code": {
      const fontSize = el.fontSize ?? 26;
      const headerH = fontSize * 2.1;
      const padX = fontSize * 0.9;
      return {
        field: "code", value: (el as CodeElement).code, multiline: true, mono: true, fontSize,
        rect: box(el.x + padX, el.y + headerH, el.w - padX * 2, el.h - headerH),
        lineHeight: fontSize * 1.6, padLeft: 0,
        bg: el.dark ? "#0F172A" : "#FFFFFF", color: el.dark ? "#E2E8F0" : "#334155", align: "left",
        patch: (v) => ({ code: v }),
      };
    }
    case "connector": {
      // 标签挂在实际路由中点(避让重排/直角时与曲线几何中点可能不同)
      const mid = connectorRoute(el as ConnectorElement, elements).mid;
      return {
        field: "label", value: (el as ConnectorElement).label ?? "", multiline: false, mono: false, fontSize: 26,
        rect: box(mid.x - 130, mid.y - 32, 260, 64), lineHeight: 64, padLeft: 0,
        bg: "#FFFFFF", color: "#334155", align: "center",
        patch: (v) => ({ label: v }),
      };
    }
    case "table":
      return tableTarget(el as TableElement, px, py);
    case "arrayCells":
      return cellsTarget(el as ArrayCellsElement, px, py);
    case "list":
      return listTarget(el as ListElement, px, py);
    case "stepCard":
      return stepCardTarget(el as StepCardElement, py);
    case "terminal": {
      const t = el as TerminalElement;
      const fontSize = t.fontSize ?? 24;
      const headerH = fontSize * 2.1;
      const padX = fontSize * 0.9;
      const dark = t.dark !== false;
      return {
        field: "code", value: t.code, multiline: true, mono: true, fontSize,
        rect: box(t.x + padX, t.y + headerH, t.w - padX * 2, t.h - headerH),
        lineHeight: fontSize * 1.6, padLeft: 0,
        bg: dark ? "#0F172A" : "#FFFFFF", color: dark ? "#E2E8F0" : "#334155", align: "left",
        patch: (v) => ({ code: v }),
      };
    }
    case "kbd": {
      const k = el as KbdElement;
      const fontSize = k.fontSize ?? 36;
      return {
        field: "text", value: k.text, multiline: false, mono: false, fontSize,
        rect: box(k.x, k.y, k.w, k.h), lineHeight: k.h, padLeft: 0,
        bg: "#FFFFFF", color: "#1E293B", align: "center",
        patch: (v) => ({ text: v }),
      };
    }
    case "browser": {
      const b = el as BrowserElement;
      const fontSize = b.fontSize ?? 26;
      const pillH = fontSize * 1.35;
      const pillX = b.x + fontSize * 3.15;
      const pillW = Math.max(b.w - fontSize * 3.15 - fontSize * 0.9, fontSize * 4);
      return {
        field: "text", value: b.url ?? "", multiline: false, mono: false, fontSize: fontSize * 0.82,
        rect: box(pillX, b.y + (fontSize * 2.2 - pillH) / 2, pillW, pillH), lineHeight: pillH, padLeft: fontSize * 0.6,
        bg: "#F1F5F9", color: "#64748B", align: "left",
        patch: (v) => ({ url: v }),
      };
    }
    default:
      return null;
  }
}

function listTarget(el: ListElement, px: number, py: number): TextTarget | null {
  const fontSize = el.fontSize ?? 36;
  const itemH = fontSize * 1.9;
  const markerW = fontSize * 1.7;
  const items = el.items ?? [];
  const totalH = items.length * itemH;
  const y0 = el.y + Math.max((el.h - totalH) / 2, 0);
  if (px < el.x || px > el.x + el.w || py < y0 || py > y0 + totalH) return null;
  const idx = Math.floor((py - y0) / itemH);
  if (idx < 0 || idx >= items.length) return null;
  return {
    field: "cell", value: items[idx], multiline: false, mono: false, fontSize,
    rect: box(el.x + markerW, y0 + idx * itemH, el.w - markerW, itemH), lineHeight: itemH, padLeft: 0,
    bg: "#FFFFFF", color: el.color ?? "#1F2937", align: "left",
    patch: (v) => ({ items: el.items.map((c, i) => (i === idx ? v.trim() : c)) }),
  };
}

function stepCardTarget(el: StepCardElement, py: number): TextTarget | null {
  const fontSize = el.fontSize ?? 34;
  const pad = fontSize * 0.9;
  const chip = fontSize * 1.7;
  const chipY = el.y + pad;
  const descY = chipY + chip + fontSize * 0.55;
  if (py < el.y || py > el.y + el.h) return null;
  if (py <= chipY + chip) {
    return {
      field: "text", value: el.title, multiline: false, mono: false, fontSize,
      rect: box(el.x + pad + chip + fontSize * 0.55, chipY, el.w - pad - chip - fontSize * 0.55 - pad, chip), lineHeight: chip, padLeft: 0,
      bg: "#FFFFFF", color: "#111827", align: "left",
      patch: (v) => ({ title: v }),
    };
  }
  return {
    field: "text", value: el.desc ?? "", multiline: true, mono: false, fontSize: fontSize * 0.82,
    rect: box(el.x + pad, descY, el.w - pad * 2, Math.max(el.h - (descY - el.y) - pad * 0.5, fontSize * 1.5)), lineHeight: fontSize * 0.82 * 1.5, padLeft: 0,
    bg: "#FFFFFF", color: "#475569", align: "left",
    patch: (v) => ({ desc: v }),
  };
}

function tableTarget(el: TableElement, px: number, py: number): TextTarget | null {
  const fontSize = el.fontSize ?? 30;
  const cols = Math.max(1, el.header.length);
  const colW = el.w / cols;
  const headerH = Math.min(el.h * 0.34, fontSize * 2.2);
  const col = Math.floor((px - el.x) / colW);
  if (col < 0 || col >= cols || px < el.x || px > el.x + el.w) return null;
  if (py >= el.y && py <= el.y + headerH) {
    return {
      field: "cell", value: el.header[col] ?? "", multiline: false, mono: false, fontSize: fontSize * 0.93,
      rect: box(el.x + col * colW, el.y, colW, headerH), lineHeight: headerH, padLeft: fontSize * 0.6,
      bg: el.headerBg ?? "#1E293B", color: "#FFFFFF", align: "left",
      patch: (v) => ({ header: el.header.map((c, i) => (i === col ? v : c)) }),
    };
  }
  const rows = el.rows.length;
  if (rows === 0) return null;
  const rowH = (el.h - headerH) / rows;
  const row = Math.floor((py - el.y - headerH) / rowH);
  if (row < 0 || row >= rows) return null;
  return {
    field: "cell", value: el.rows[row][col] ?? "", multiline: false, mono: false, fontSize: fontSize * 0.87,
    rect: box(el.x + col * colW, el.y + headerH + row * rowH, colW, rowH), lineHeight: rowH, padLeft: fontSize * 0.6,
    bg: row % 2 === 0 ? "#FFFFFF" : "#F8FAFC", color: "#334155", align: "left",
    patch: (v) => ({ rows: el.rows.map((r, i) => (i === row ? r.map((c, j) => (j === col ? v : c)) : r)) }),
  };
}

function cellsTarget(el: ArrayCellsElement, px: number, py: number): TextTarget | null {
  const size = el.cellSize ?? 88;
  const gap = el.gap ?? 14;
  const perRow = Math.max(1, el.perRow ?? el.cells.length);
  const idx = el.cells.findIndex((_, i) => {
    const cx = el.x + (i % perRow) * (size + gap);
    const cy = el.y + Math.floor(i / perRow) * (size + gap);
    return px >= cx && px <= cx + size && py >= cy && py <= cy + size;
  });
  if (idx < 0) return null;
  const cx = el.x + (idx % perRow) * (size + gap);
  const cy = el.y + Math.floor(idx / perRow) * (size + gap);
  return {
    field: "cell", value: el.cells[idx], multiline: false, mono: false, fontSize: el.fontSize ?? size * 0.5,
    rect: box(cx, cy, size, size), lineHeight: size, padLeft: 0,
    bg: el.colors?.[idx] ?? PALETTE[idx % PALETTE.length], color: "#1E293B", align: "center",
    patch: (v) => ({ cells: el.cells.map((c, i) => (i === idx ? v : c)) }),
  };
}
