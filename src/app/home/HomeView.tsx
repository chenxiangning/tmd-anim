import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../../core/types";
import { describeError, parseProjectText } from "../openProject";
import sampleJson from "../../samples/bpe.json";
import { newProjectId, type ProjectRepo } from "../../store/projects";
import { ProjectCard, type Entry } from "./ProjectCard";
import { GearButton } from "../GearButton";
import { TIME_GROUPS, timeGroupOf, type TimeGroup } from "./timeGroups";

interface HomeViewProps {
  repo: ProjectRepo;
  onOpen(id: string): void;
  onOpenSettings(): void;
}

/** 按更新时间倒序 + 名称过滤,再折叠成时间线分组(组内保持倒序)。 */
function useTimeline(entries: Entry[] | null, query: string) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = (entries ?? []).filter((e) => !q || e.project.name.toLowerCase().includes(q));
    matched.sort((a, b) => b.meta.updatedAt - a.meta.updatedAt);
    const buckets = new Map<TimeGroup, Entry[]>();
    for (const e of matched) {
      const g = timeGroupOf(e.meta.updatedAt);
      const list = buckets.get(g);
      if (list) list.push(e);
      else buckets.set(g, [e]);
    }
    return {
      groups: TIME_GROUPS.filter((g) => buckets.has(g)).map((g) => ({ label: g, items: buckets.get(g)! })),
      total: matched.length,
    };
  }, [entries, query]);
}

function SearchBox({ query, onChange }: { query: string; onChange(q: string): void }) {
  return (
    <label className="relative block">
      <svg
        className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索动画名称"
        className="w-44 rounded-lg border border-neutral-200 bg-neutral-50 py-1.5 pr-7 pl-8 text-xs text-neutral-700 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white"
      />
      {query && (
        <button
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
          onClick={() => onChange("")}
          title="清空搜索"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </label>
  );
}

/** 项目主页:新建(空白/示例)/导入 JSON/名称搜索 + 时间线分组的项目卡片列表。 */
export function HomeView({ repo, onOpen, onOpenSettings }: HomeViewProps) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { groups, total } = useTimeline(entries, query);

  const refresh = useCallback(async () => {
    try {
      const metas = await repo.list();
      const loaded = await Promise.all(metas.map(async (meta) => ({ meta, project: await repo.load(meta.id) })));
      setEntries(loaded);
      setError(null);
    } catch (e) {
      setError(describeError(e));
      setEntries([]);
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAndOpen = useCallback(
    async (project: Project): Promise<void> => {
      const id = newProjectId();
      await repo.save(id, project);
      onOpen(id);
    },
    [repo, onOpen],
  );

  const duplicate = useCallback(
    (entry: Entry): void => {
      void repo
        .save(newProjectId(), { ...entry.project, name: `${entry.project.name} 副本` })
        .then(() => refresh());
    },
    [repo, refresh],
  );

  const remove = useCallback(
    (id: string): void => {
      void repo.remove(id).then(() => {
        setConfirmId(null);
        return refresh();
      });
    },
    [repo, refresh],
  );

  const exportOne = useCallback((entry: Entry): void => {
    const blob = new Blob([JSON.stringify(entry.project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entry.project.name || "project"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-6 py-4">
        <img src="/icon.png" alt="tmd-anim" className="h-9 w-9" />
        <div>
          <div className="text-[15px] font-semibold text-neutral-900">tmd-anim 技术动画制作</div>
          <div className="text-xs text-neutral-400">
            场景 JSON 进,视频出 ·{" "}
            {repo.backend === "tauri" ? "文件存储 ~/.tmd-anim/projects/(agent 可直接读写)" : "浏览器存储"}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {error && (
            <span className="max-w-80 truncate text-xs text-red-500" title={error}>
              {error}
            </span>
          )}
          <SearchBox query={query} onChange={setQuery} />
          <button className={"btn btn-secondary"} onClick={() => fileRef.current?.click()}>
            导入 JSON
          </button>
          <button
            className={"btn btn-secondary"}
            onClick={() => void createAndOpen(parseProjectText(JSON.stringify(sampleJson)))}
            title="用 BPE 分词示例建一份可编辑副本"
          >
            从示例新建
          </button>
          <button
            className={"btn btn-primary"}
            onClick={() =>
              void createAndOpen({
                version: 1,
                name: `未命名动画 ${Date.now() % 1000}`,
                canvas: { width: 1920, height: 1080, bg: "#F4F4F1" },
                scenes: [{ id: "sc_1", name: "场景 1", dwell: 1.5, elements: [] }],
              })
            }
          >
            新建项目
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void file.text().then((text) => createAndOpen(parseProjectText(text))).catch((err) => setError(describeError(err)));
              }
              e.target.value = "";
            }}
          />
          <GearButton onClick={onOpenSettings} />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto bg-neutral-50">
        <div className="mx-auto w-full max-w-6xl p-6">
        {entries === null && <div className="mt-32 text-center text-sm text-neutral-400">载入中…</div>}
        {entries !== null && entries.length === 0 && (
          <div className="mt-28 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-slate-900" fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </div>
            <div className="mt-4 text-sm font-medium text-neutral-700">还没有项目</div>
            <div className="mt-1 text-xs text-neutral-400">从一份可编辑的 BPE 分词示例开始,或新建空白动画</div>
            <div className="mt-5 flex items-center gap-2">
              <button
                className={"btn btn-secondary"}
                onClick={() => void createAndOpen(parseProjectText(JSON.stringify(sampleJson)))}
              >
                从示例新建
              </button>
              <button
                className={"btn btn-primary"}
                onClick={() =>
                  void createAndOpen({
                    version: 1,
                    name: `未命名动画 ${Date.now() % 1000}`,
                    canvas: { width: 1920, height: 1080, bg: "#F4F4F1" },
                    scenes: [{ id: "sc_1", name: "场景 1", dwell: 1.5, elements: [] }],
                  })
                }
              >
                新建项目
              </button>
            </div>
          </div>
        )}
        {entries !== null && entries.length > 0 && total === 0 && (
          <div className="mt-32 text-center text-sm text-neutral-400">没有匹配「{query.trim()}」的项目</div>
        )}
        {groups.map(({ label, items }) => (
          <section key={label} className="mt-6 first:mt-0">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
              <span className="text-xs font-semibold text-neutral-700">{label}</span>
              <span className="text-[11px] text-neutral-400">{items.length}</span>
              <span className="h-px flex-1 bg-neutral-200" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
              {items.map((entry) => (
                <ProjectCard
                  key={entry.meta.id}
                  repo={repo}
                  entry={entry}
                  onOpen={onOpen}
                  onExport={exportOne}
                  onDuplicate={duplicate}
                  onRemove={remove}
                  confirm={confirmId === entry.meta.id}
                  onConfirmChange={setConfirmId}
                />
              ))}
            </div>
          </section>
        ))}
        </div>
      </main>
    </div>
  );
}
