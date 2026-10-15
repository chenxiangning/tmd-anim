import { useCallback, useRef, useState } from "react";
import type { Project, Scene, SceneElement } from "../core/types";
import { locate, projectDuration, sceneStartTime } from "../core/timeline";
import type { ProjectRepo } from "../store/projects";
import { addElement, findElement, removeElements, updateScene } from "./editOps";
import { createElement } from "./defaults";
import { AUDIO_SEL, useBackfillAudioDuration, useSceneAudio } from "./sceneAudio";
import { usePlaybackClock } from "./usePlaybackClock";
import { ExportOverlay, useExport } from "./useExport";
import { useEditorKeyboard } from "./useEditorKeyboard";
import { useEditorSave } from "./useEditorSave";
import { useFileWatch } from "./useFileWatch";
import { exportFrame } from "./exportFrame";
import { useProjectHistory } from "./useProjectHistory";
import { useSceneOps } from "./useSceneOps";
import { PanelRail } from "./PanelRail";
import { CanvasStage } from "./CanvasStage";
import { EditorHeader } from "./EditorHeader";
import { ElementLibrary } from "./ElementLibrary";
import { PreviewMode } from "./PreviewMode";
import { PropertyPanel } from "./PropertyPanel";
import { TimelinePanel } from "./TimelinePanel";

interface EditorViewProps {
  repo: ProjectRepo;
  projectId: string;
  initialProject: Project;
  onOpenSettings(): void;
  onExit(): void;
}

type PanelsState = { left: boolean; right: boolean; bottom: boolean };
const PANELS_KEY = "tmd-anim:panels";

function loadPanels(): PanelsState {
  try {
    const raw = localStorage.getItem(PANELS_KEY);
    if (raw) return { left: true, right: true, bottom: true, ...(JSON.parse(raw) as Partial<PanelsState>) };
  } catch { /* 忽略坏数据,回落全开 */ }
  return { left: true, right: true, bottom: true };
}

/** 编辑器组装:状态中枢(撤销/自动保存/键盘/预览) + 四区布局(元素库/画布/属性/时间轴)。 */
export function EditorView({ repo, projectId, initialProject, onOpenSettings, onExit }: EditorViewProps) {
  const { project, projectRef, setProject, commit, liveUpdate, beginGesture: beginHistory, endGesture, undo } =
    useProjectHistory(initialProject);
  const [t, setT] = useState(0);
  const [selIds, setSelIds] = useState<string[]>([]);
  const [playing, setPlaying] = useState(true); // 打开即循环预览,元素随动画出现;拖拽手势自动暂停
  const [previewing, setPreviewing] = useState(false);
  const [panels, setPanels] = useState<PanelsState>(loadPanels);
  const saveState = useEditorSave(repo, projectId, project, projectRef);
  // agent 改盘上项目文件后自动热重载(reloadOp 同款替换语义,不进撤销栈);返回项目文件绝对路径
  const projectPath = useFileWatch(repo, projectId, projectRef, setProject);

  const togglePanel = useCallback((key: keyof PanelsState) => {
    setPanels((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(PANELS_KEY, JSON.stringify(next));
      } catch { /* 忽略存储失败 */ }
      return next;
    });
  }, []);

  const tRef = useRef(t);
  tRef.current = t;
  const selRef = useRef(selIds);
  selRef.current = selIds;
  const idxRef = useRef(0);
  idxRef.current = locate(project, t).index;

  const sceneIdx = idxRef.current;
  const scene = project.scenes[sceneIdx];
  const localT = Math.max(0, t - sceneStartTime(project, sceneIdx));
  const selected: SceneElement | null =
    selIds.length === 1 ? scene?.elements.find((el) => el.id === selIds[0]) ?? null : null;

  const beginGesture = useCallback(() => {
    beginHistory();
    setPlaying(false);
  }, [beginHistory]);

  // 播放循环:预览/播放共用,播完循环(函数式累计,渲染掉帧不拖慢播放头;切后台自动暂停)
  usePlaybackClock(playing, projectRef, setT, setPlaying);

  // 场景配音随播放头同步;存量配音缺 duration 时探测回填(场景时长据此把配音算进去)
  useSceneAudio(project, tRef, playing);
  useBackfillAudioDuration(project, commit);
  const exportState = useExport(projectRef, { pausePlayback: () => setPlaying(false) });

  // 自动保存与卸载 flush 在 useEditorSave 内

  // 键盘交互集中在一个 hook(删除/复制剪切粘贴/撤销/保存/播放/方向键)
  useEditorKeyboard({
    repo,
    projectId,
    getProject: () => projectRef.current,
    getSelIds: () => selRef.current,
    getIdx: () => idxRef.current,
    setT,
    setSel: setSelIds,
    clearSel: () => setSelIds([]),
    setPlaying,
    setPreviewing,
    commit,
    undo,
    onRemoveAudio: () =>
      commit(updateScene(projectRef.current, audioSceneIdxRef.current, { audio: undefined }), "sceneAudio"),
  });

  function clampT(v: number): number {
    return Math.min(Math.max(0, v), Math.max(0, projectDuration(projectRef.current) - 0.01));
  }

  const addElementAt = useCallback(
    (kind: SceneElement["kind"], x?: number, y?: number, variant?: string) => {
      const el = createElement(kind, 0, 0, variant);
      const cx = (x ?? (projectRef.current.canvas?.width ?? 1920) / 2) - el.w / 2 + (x === undefined ? Math.random() * 48 - 24 : 0);
      const cy = (y ?? (projectRef.current.canvas?.height ?? 1080) / 2) - el.h / 2 + (y === undefined ? Math.random() * 48 - 24 : 0);
      const placed = { ...el, x: Math.round(cx), y: Math.round(cy) };
      if (placed.kind === "connector") {
        // 连线的几何在端点坐标里,x/y 仅占位;落点时端点同步平移
        const ox = placed.x - el.x;
        const oy = placed.y - el.y;
        placed.from = [placed.from[0] + ox, placed.from[1] + oy];
        placed.to = [placed.to[0] + ox, placed.to[1] + oy];
      }
      commit(addElement(projectRef.current, idxRef.current, placed));
      setSelIds([placed.id]);
      // 播放头若在新元素动画终点之前,元素处于透明入场态看不见;挪到终点保证立即可见
      const endT = sceneStartTime(projectRef.current, idxRef.current) + placed.anim.start + placed.anim.duration;
      if (tRef.current < endT) setT(endT);
    },
    [commit],
  );

  /** 画布拖放落点:"kind" 或 "kind:variant"(形状变体) */
  const dropCreate = useCallback(
    (data: string, x: number, y: number) => {
      const sep = data.indexOf(":");
      const kind = (sep < 0 ? data : data.slice(0, sep)) as SceneElement["kind"];
      const variant = sep < 0 ? undefined : data.slice(sep + 1);
      addElementAt(kind, x, y, variant);
    },
    [addElementAt],
  );

  const sceneOps = useSceneOps(projectRef, idxRef, commit, (id) => setSelIds(id ? [id] : []), setT);

  // 配音选中锚定「选择时」的场景:播放头随后跨幕,面板显示与编辑的仍是选中那幕的配音
  const audioSceneIdxRef = useRef(idxRef.current);
  const selectOne = useCallback((id: string) => {
    if (id === AUDIO_SEL) audioSceneIdxRef.current = idxRef.current;
    setSelIds([id]);
  }, []);
  const audioSelected = selIds.includes(AUDIO_SEL);

  /** 场景配音补丁:undefined = 移除;缺省作用于播放头所在场景(操作台),选中态由调用方显式传 idx */
  const patchAudio = useCallback(
    (next: Scene["audio"], key?: string, sceneIdx = idxRef.current) =>
      commit(updateScene(projectRef.current, sceneIdx, { audio: next }), key ?? "sceneAudio"),
    [commit],
  );

  const deleteSelected = useCallback(() => {
    const ids = selRef.current;
    if (ids.length === 0) return;
    commit(removeElements(projectRef.current, idxRef.current, ids));
    setSelIds([]);
  }, [commit]);

  /** 重播选中元素的入场动画:播放头挪到其起点稍前并开始播放 */
  const replaySelection = useCallback(() => {
    const ids = selRef.current;
    if (ids.length !== 1) return;
    const el = findElement(projectRef.current, idxRef.current, ids[0]);
    if (!el) return;
    setPlaying(true);
    setT(sceneStartTime(projectRef.current, idxRef.current) + Math.max(0, el.anim.start - 0.05));
  }, []);

  const togglePreview = useCallback(() => {
    setPreviewing((prev) => {
      if (!prev) {
        setT(0);
        setPlaying(true);
      } else {
        setPlaying(false);
      }
      return !prev;
    });
  }, []);

  const reloadOp = useCallback(() => {
    void repo
      .load(projectId)
      .then((fresh) => {
        setProject(fresh);
        setT(0);
        setSelIds([]);
      })
      .catch(() => undefined);
  }, [repo, projectId]);

  if (previewing) {
    return (
      <PreviewMode project={project} t={t} liveUpdate={liveUpdate} onGestureBegin={beginGesture}
        onGestureEnd={endGesture} onDropCreate={dropCreate} onExit={togglePreview} />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorHeader
        project={project}
        saveState={saveState}
        backend={repo.backend}
        previewing={false}
        onRename={(name) => commit({ ...projectRef.current, name }, "projectName")}
        onExit={onExit}
        onTogglePreview={togglePreview}
        onReload={reloadOp}
        onExport={exportState.runJson}
        onExportHtml={exportState.runHtml}
        onExportVideo={exportState.beginVideo}
        onExportFrame={() => exportFrame(project, t, scene?.name ?? `场景${sceneIdx + 1}`, projectId)}
        aiPromptPath={projectPath}
        onOpenSettings={onOpenSettings}
      />
      <div className="flex min-h-0 flex-1">
        {panels.left ? (
          <ElementLibrary onAdd={(kind, variant) => addElementAt(kind, undefined, undefined, variant)} onCollapse={() => togglePanel("left")} />
        ) : (
          <PanelRail side="left" label="元素" onExpand={() => togglePanel("left")} />
        )}
        <CanvasStage
          project={project}
          t={t}
          selIds={selIds}
          previewing={false}
          onSelectIds={setSelIds}
          onLivePatch={liveUpdate}
          onGestureBegin={beginGesture}
          onGestureEnd={endGesture}
          onDropCreate={dropCreate}
        />
        {panels.right ? (
          <PropertyPanel
            project={project}
            sceneIdx={audioSelected ? audioSceneIdxRef.current : sceneIdx}
            selected={selected}
            selCount={selIds.length}
            audio={audioSelected ? project.scenes[audioSceneIdxRef.current]?.audio : undefined}
            audioSelected={audioSelected}
            onPatch={commit}
            onPatchAudio={(next, key) => patchAudio(next, key, audioSceneIdxRef.current)}
            onDelete={deleteSelected}
            onReplay={replaySelection}
            onCollapse={() => togglePanel("right")}
          />
        ) : (
          <PanelRail side="right" label="属性" onExpand={() => togglePanel("right")} />
        )}
      </div>
      {panels.bottom ? (
        <TimelinePanel
          project={project}
          sceneIdx={sceneIdx}
          t={t}
          localT={localT}
          selIds={selIds}
          playing={playing}
          onSelect={selectOne}
          onSeekLocal={(local) => setT(clampT(sceneStartTime(projectRef.current, sceneIdx) + local))}
          onLivePatch={liveUpdate}
          onGestureBegin={beginGesture}
          onGestureEnd={endGesture}
          onTogglePlay={() => setPlaying((p) => !p)}
          onPrevScene={() => sceneOps.selectScene(Math.max(0, sceneIdx - 1))}
          onNextScene={() => sceneOps.selectScene(Math.min(project.scenes.length - 1, sceneIdx + 1))}
          onToggleCollapse={() => togglePanel("bottom")}
          onSelectScene={sceneOps.selectScene}
          onAddScene={sceneOps.addScene}
          onDuplicateScene={sceneOps.duplicate}
          onRemoveScene={sceneOps.remove}
          onMoveScene={sceneOps.move}
          onRenameScene={sceneOps.rename}
          onDwell={sceneOps.setDwell}
          onSetAudio={patchAudio}
        />
      ) : (
        <PanelRail side="bottom" label="动画操作台" onExpand={() => togglePanel("bottom")} />
      )}
      <ExportOverlay state={exportState} />
    </div>
  );
}
