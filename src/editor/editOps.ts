import type { Project, Scene, SceneElement } from "../core/types";

/** 不可变项目变更操作:所有编辑经这里产出新 Project,保证 undo/autosave 简单可靠。 */

function patchScene(project: Project, sceneIdx: number, fn: (scene: Scene) => Scene): Project {
  return {
    ...project,
    scenes: project.scenes.map((scene, i) => (i === sceneIdx ? fn(scene) : scene)),
  };
}

export function findElement(project: Project, sceneIdx: number, elId: string): SceneElement | null {
  return project.scenes[sceneIdx]?.elements.find((el) => el.id === elId) ?? null;
}

export function addElement(project: Project, sceneIdx: number, element: SceneElement): Project {
  return patchScene(project, sceneIdx, (scene) => ({
    ...scene,
    elements: [...scene.elements, element],
  }));
}

export function addElements(project: Project, sceneIdx: number, elements: SceneElement[]): Project {
  return patchScene(project, sceneIdx, (scene) => ({
    ...scene,
    elements: [...scene.elements, ...elements],
  }));
}

export function updateElement(
  project: Project,
  sceneIdx: number,
  elId: string,
  patch: Record<string, unknown>,
): Project {
  return patchScene(project, sceneIdx, (scene) => ({
    ...scene,
    elements: scene.elements.map((el) => (el.id === elId ? ({ ...el, ...patch } as SceneElement) : el)),
  }));
}

export function removeElement(project: Project, sceneIdx: number, elId: string): Project {
  return patchScene(project, sceneIdx, (scene) => ({
    ...scene,
    elements: scene.elements.filter((el) => el.id !== elId),
  }));
}

export function removeElements(project: Project, sceneIdx: number, elIds: string[]): Project {
  const ids = new Set(elIds);
  return patchScene(project, sceneIdx, (scene) => ({
    ...scene,
    elements: scene.elements.filter((el) => !ids.has(el.id)),
  }));
}

/** 层级调整:up/down 相邻交换,front/back 置顶/置底(数组序 = 绘制序,后者在上) */
export function moveElement(
  project: Project,
  sceneIdx: number,
  elId: string,
  dir: "front" | "back" | "up" | "down",
): Project {
  return patchScene(project, sceneIdx, (scene) => {
    const index = scene.elements.findIndex((el) => el.id === elId);
    if (index < 0) return scene;
    const elements = [...scene.elements];
    const [el] = elements.splice(index, 1);
    const target =
      dir === "front" ? elements.length : dir === "back" ? 0 : dir === "up" ? Math.min(elements.length, index + 1) : Math.max(0, index - 1);
    elements.splice(target, 0, el);
    return { ...scene, elements };
  });
}

export function addScene(project: Project, afterIdx: number, scene: Scene): Project {
  const scenes = [...project.scenes];
  scenes.splice(afterIdx + 1, 0, scene);
  return { ...project, scenes };
}

export function duplicateScene(project: Project, idx: number): Project {
  const source = project.scenes[idx];
  if (!source) return project;
  const copy: Scene = {
    ...source,
    id: `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: `${source.name} 副本`,
    elements: source.elements.map((el) => ({ ...el, id: `${el.id}_${Math.random().toString(36).slice(2, 5)}` })),
  };
  return addScene(project, idx, copy);
}

export function removeScene(project: Project, idx: number): Project {
  if (project.scenes.length <= 1) return project;
  return { ...project, scenes: project.scenes.filter((_, i) => i !== idx) };
}

export function moveScene(project: Project, idx: number, delta: -1 | 1): Project {
  const target = idx + delta;
  if (target < 0 || target >= project.scenes.length) return project;
  const scenes = [...project.scenes];
  [scenes[idx], scenes[target]] = [scenes[target], scenes[idx]];
  return { ...project, scenes };
}

export function updateScene(project: Project, idx: number, patch: Partial<Scene>): Project {
  return patchScene(project, idx, (scene) => ({ ...scene, ...patch }));
}

export type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom" | "distH" | "distV";

/** 多选对齐/分布:按选中集包围盒对齐;分布需 ≥3 个可对齐元素(连线不参与,按包围盒),不足时原样返回。
 *  ponytail: 包围盒用未旋转几何,旋转元素的视觉边线有偏差(同 snapMove) */
export function alignElements(project: Project, sceneIdx: number, ids: string[], mode: AlignMode): Project {
  const scene = project.scenes[sceneIdx];
  if (!scene) return project;
  const targets = scene.elements.filter((el) => ids.includes(el.id) && el.kind !== "connector");
  if (targets.length < (mode === "distH" || mode === "distV" ? 3 : 2)) return project;
  const bb = targets.reduce(
    (acc, el) => ({
      x1: Math.min(acc.x1, el.x), y1: Math.min(acc.y1, el.y),
      x2: Math.max(acc.x2, el.x + el.w), y2: Math.max(acc.y2, el.y + el.h),
    }),
    { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity },
  );
  let next = project;
  if (mode === "distH" || mode === "distV") {
    const horizontal = mode === "distH";
    const sorted = [...targets].sort((a, b) => (horizontal ? a.x + a.w / 2 - (b.x + b.w / 2) : a.y + a.h / 2 - (b.y + b.h / 2)));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const firstC = horizontal ? first.x + first.w / 2 : first.y + first.h / 2;
    const lastC = horizontal ? last.x + last.w / 2 : last.y + last.h / 2;
    const step = (lastC - firstC) / (sorted.length - 1);
    sorted.forEach((el, i) => {
      const center = firstC + step * i;
      next = updateElement(next, sceneIdx, el.id, horizontal ? { x: Math.round(center - el.w / 2) } : { y: Math.round(center - el.h / 2) });
    });
    return next;
  }
  const anchor =
    mode === "left" ? bb.x1 : mode === "right" ? bb.x2 : mode === "hcenter" ? (bb.x1 + bb.x2) / 2 :
    mode === "top" ? bb.y1 : mode === "bottom" ? bb.y2 : (bb.y1 + bb.y2) / 2;
  for (const el of targets) {
    const patch =
      mode === "left" || mode === "right" || mode === "hcenter"
        ? { x: Math.round(mode === "left" ? anchor : mode === "right" ? anchor - el.w : anchor - el.w / 2) }
        : { y: Math.round(mode === "top" ? anchor : mode === "bottom" ? anchor - el.h : anchor - el.h / 2) };
    next = updateElement(next, sceneIdx, el.id, patch);
  }
  return next;
}
