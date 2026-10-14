import { useEffect, useState } from "react";
import type { Project } from "../core/types";
import type { ProjectRepo } from "../store/projects";

/** 自动保存:600ms 防抖 + 卸载强制落盘(防丢稿);返回保存状态供顶栏显示。 */
export function useEditorSave(
  repo: ProjectRepo,
  projectId: string,
  project: Project,
  projectRef: { current: Project },
): "saved" | "saving" {
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  useEffect(() => {
    setSaveState("saving");
    const handle = setTimeout(() => {
      void repo
        .save(projectId, project)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("saved"));
    }, 600);
    return () => clearTimeout(handle);
  }, [project, projectId, repo]);
  useEffect(() => {
    return () => {
      void repo.save(projectId, projectRef.current).catch(() => undefined);
    };
  }, [repo, projectId, projectRef]);
  return saveState;
}
