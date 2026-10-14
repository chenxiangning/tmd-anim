import { useCallback, useEffect, useState } from "react";
import type { Project } from "../core/types";
import { createRepo, type ProjectRepo } from "../store/projects";
import { EditorView } from "../editor/EditorView";
import { HomeView } from "./home/HomeView";

type View = { name: "home" } | { name: "editor"; id: string; project: Project };

/** 应用入口:项目仓库初始化 + 主页/编辑器视图路由。 */
export function App() {
  const [repo, setRepo] = useState<ProjectRepo | null>(null);
  const [view, setView] = useState<View>({ name: "home" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void createRepo().then(setRepo).catch((e) => setError(String(e)));
  }, []);

  const openById = useCallback(
    (id: string) => {
      if (!repo) return;
      repo
        .load(id)
        .then((project: Project) => setView({ name: "editor", id, project }))
        .catch((e) => setError(String(e)));
    },
    [repo],
  );

  if (!repo) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-400">
        {error ? `初始化失败:${error}` : "tmd-anim 启动中…"}
      </div>
    );
  }

  if (view.name === "home") {
    return <HomeView repo={repo} onOpen={openById} />;
  }
  return (
    <EditorView
      key={view.id}
      repo={repo}
      projectId={view.id}
      initialProject={view.project}
      onExit={() => {
        setError(null);
        setView({ name: "home" });
      }}
    />
  );
}
