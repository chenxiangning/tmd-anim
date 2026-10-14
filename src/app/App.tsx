import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "../core/types";
import { createRepo, type ProjectRepo } from "../store/projects";
import { EditorView } from "../editor/EditorView";
import { HomeView } from "./home/HomeView";
import { SettingsView } from "./settings/SettingsView";
import { syncProtocol } from "./protocolSync";

type View = { name: "home" } | { name: "editor"; id: string; project: Project } | { name: "settings" };

/** 应用入口:项目仓库初始化 + 主页/编辑器/设置视图路由。 */
export function App() {
  const [repo, setRepo] = useState<ProjectRepo | null>(null);
  const [view, setView] = useState<View>({ name: "home" });
  const [error, setError] = useState<string | null>(null);
  // 设置页返回时的落点(主页或当时的编辑器项目)
  const returnTo = useRef<View>({ name: "home" });

  useEffect(() => {
    void createRepo().then(setRepo).catch((e) => setError(String(e)));
    // 协议材料投递不阻塞渲染,失败静默
    void syncProtocol();
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

  if (view.name === "settings") {
    return (
      <SettingsView
        backend={repo.backend}
        onExit={() => {
          const to = returnTo.current;
          // 编辑器走 openById 重载:旧 project 快照可能落后于自动保存
          if (to.name === "editor") openById(to.id);
          else setView(to);
        }}
      />
    );
  }

  const openSettings = () => {
    returnTo.current = view;
    setView({ name: "settings" });
  };

  if (view.name === "home") {
    return <HomeView repo={repo} onOpen={openById} onOpenSettings={openSettings} />;
  }
  return (
    <EditorView
      key={view.id}
      repo={repo}
      projectId={view.id}
      initialProject={view.project}
      onOpenSettings={openSettings}
      onExit={() => {
        setError(null);
        setView({ name: "home" });
      }}
    />
  );
}
