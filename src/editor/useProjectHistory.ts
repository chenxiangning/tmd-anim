import { useCallback, useRef, useState } from "react";
import type { Project } from "../core/types";

/** 项目撤销与手势历史:commit 可按 key 合并,手势用 begin/end 包裹合并为一条记录。 */
export function useProjectHistory(initial: Project) {
  const [project, setProject] = useState(initial);
  const projectRef = useRef(project);
  projectRef.current = project;
  const pastRef = useRef<string[]>([]);
  const gestureSnapshot = useRef<string | null>(null);
  const coalesceRef = useRef({ key: "", at: 0 });

  const pushHistory = useCallback((snapshot: string) => {
    pastRef.current.push(snapshot);
    if (pastRef.current.length > 60) pastRef.current.shift();
  }, []);

  /** 带历史提交;coalesceKey 相同且间隔 <800ms 的连续变更合并为一条 undo */
  const commit = useCallback(
    (next: Project, coalesceKey?: string) => {
      const now = Date.now();
      const merged =
        coalesceKey !== undefined && coalesceRef.current.key === coalesceKey && now - coalesceRef.current.at < 800;
      if (!merged) pushHistory(JSON.stringify(projectRef.current));
      coalesceRef.current = { key: coalesceKey ?? "", at: now };
      setProject(next);
    },
    [pushHistory],
  );

  /** 拖拽等高频中间态:直接更新,不进历史(历史由手势 begin/end 包裹) */
  const liveUpdate = useCallback((next: Project) => setProject(next), []);

  const beginGesture = useCallback(() => {
    gestureSnapshot.current = JSON.stringify(projectRef.current);
  }, []);

  const endGesture = useCallback(() => {
    const snapshot = gestureSnapshot.current;
    gestureSnapshot.current = null;
    if (snapshot && snapshot !== JSON.stringify(projectRef.current)) pushHistory(snapshot);
  }, [pushHistory]);

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    coalesceRef.current = { key: "", at: 0 };
    setProject(JSON.parse(prev) as Project);
  }, []);

  return { project, projectRef, setProject, commit, liveUpdate, beginGesture, endGesture, undo };
}
