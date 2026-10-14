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
