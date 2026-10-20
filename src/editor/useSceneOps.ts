import { useCallback } from "react";
import type { Project, Scene } from "../core/types";
import { sceneDuration, sceneStartTime } from "../core/timeline";
import { addScene as insertScene, duplicateScene, moveScene, removeScene, updateScene } from "./editOps";
import { newId } from "./defaults";

export interface SceneOps {
  selectScene(index: number): void;
  addScene(): void;
  duplicate(): void;
  remove(): void;
  move(delta: -1 | 1): void;
  rename(name: string): void;
  setDwell(seconds: number): void;
  setCaption(caption: string): void;
}

/** 场景级操作:统一走播放头定位(场景切换 = 移动 t),选中元素随切换清空。 */
export function useSceneOps(
  projectRef: { current: Project },
  idxRef: { current: number },
  commit: (next: Project, coalesceKey?: string) => void,
  setSelId: (id: string | null) => void,
  setT: (v: number) => void,
): SceneOps {
  const selectScene = useCallback(
    (index: number) => {
      setSelId(null);
      setT(sceneStartTime(projectRef.current, index));
    },
    [projectRef, setSelId, setT],
  );
  const addScene = useCallback(() => {
    const idx = idxRef.current;
    const next: Scene = { id: newId("sc"), name: `场景 ${projectRef.current.scenes.length + 1}`, dwell: 1.5, elements: [] };
    commit(insertScene(projectRef.current, idx, next));
    setSelId(null);
    setT(sceneStartTime(projectRef.current, idx) + sceneDuration(projectRef.current.scenes[idx]));
  }, [projectRef, idxRef, commit, setSelId, setT]);
  const duplicate = useCallback(() => {
    const idx = idxRef.current;
    const next = duplicateScene(projectRef.current, idx);
    commit(next);
    setSelId(null);
    setT(sceneStartTime(next, idx + 1));
  }, [projectRef, idxRef, commit, setSelId, setT]);
  const remove = useCallback(() => {
    const idx = idxRef.current;
    const next = removeScene(projectRef.current, idx);
    if (next === projectRef.current) return;
    commit(next);
    setSelId(null);
    setT(sceneStartTime(next, Math.min(idx, next.scenes.length - 1)));
  }, [projectRef, idxRef, commit, setSelId, setT]);
  const move = useCallback(
    (delta: -1 | 1) => {
      const idx = idxRef.current;
      const next = moveScene(projectRef.current, idx, delta);
      if (next === projectRef.current) return;
      commit(next);
      setSelId(null);
      setT(sceneStartTime(next, idx + delta));
    },
    [projectRef, idxRef, commit, setSelId, setT],
  );
  const rename = useCallback(
    (name: string) => {
      commit(updateScene(projectRef.current, idxRef.current, { name }), "sceneName");
    },
    [projectRef, idxRef, commit],
  );
  const setDwell = useCallback(
    (seconds: number) => {
      commit(updateScene(projectRef.current, idxRef.current, { dwell: seconds }), "sceneDwell");
    },
    [projectRef, idxRef, commit],
  );
  const setCaption = useCallback(
    (caption: string) => {
      commit(updateScene(projectRef.current, idxRef.current, { caption: caption.trim() || undefined }), "sceneCaption");
    },
    [projectRef, idxRef, commit],
  );
  return { selectScene, addScene, duplicate, remove, move, rename, setDwell, setCaption };
}
