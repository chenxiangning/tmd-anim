import { useCallback, useEffect, useState } from "react";
import type { Project } from "../core/types";
import type { ProjectRepo } from "../store/projects";

/** 自动保存:600ms 防抖守卫写 + 卸载守卫落盘(防丢稿且绝不覆盖外部修改)。 */
export function useEditorSave(
  repo: ProjectRepo,
  projectId: string,
  project: Project,
  projectRef: { current: Project },
): {
  saveState: "saved" | "saving";
  /** true = 盘上文件被外部(如 coding agent)改过而编辑器尚未采纳,自动保存已拒写 */
  conflict: boolean;
  /** 立即守卫保存(Ctrl+S 用);返回是否因冲突拒写 */
  saveNow(): Promise<boolean>;
  /** 冲突抉择:用编辑器内存版本强制覆盖盘上(用户显式选择 last-writer-wins) */
  overwriteWithEditor(): void;
  /** 仅收起横幅;若盘上仍是外部版本,下一次自动保存会重新点亮 */
  dismissConflict(): void;
} {
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [conflict, setConflict] = useState(false);

  const guarded = useCallback(
    (p: Project) =>
      repo
        .saveIfUnchanged(projectId, p)
        .then((r) => {
          setConflict(r === "conflict");
          return r === "conflict";
        })
        .catch(() => false),
    [repo, projectId],
  );

  useEffect(() => {
    setSaveState("saving");
    const handle = setTimeout(() => {
      void guarded(project).then(
        () => setSaveState("saved"),
        () => setSaveState("saved"),
      );
    }, 600);
    return () => clearTimeout(handle);
  }, [project, projectId, guarded]);

  // 卸载 flush 同走守卫:冲突时放弃内存保盘上版本,外部修改不被退出动作覆盖
  useEffect(() => {
    return () => {
      void repo.saveIfUnchanged(projectId, projectRef.current).catch(() => undefined);
    };
  }, [repo, projectId, projectRef]);

  const saveNow = useCallback(() => guarded(projectRef.current), [guarded, projectRef]);

  const overwriteWithEditor = useCallback(() => {
    setConflict(false);
    void repo.save(projectId, projectRef.current).catch(() => undefined);
  }, [repo, projectId, projectRef]);

  const dismissConflict = useCallback(() => setConflict(false), []);

  return { saveState, conflict, saveNow, overwriteWithEditor, dismissConflict };
}
