import { useCallback, useState } from "react";

/** 面板开合与 localStorage 持久化,从 EditorView 抽出以控行数。 */

export type PanelsState = { left: boolean; right: boolean; bottom: boolean };
const PANELS_KEY = "tmd-anim:panels";

function loadPanels(): PanelsState {
  try {
    const raw = localStorage.getItem(PANELS_KEY);
    if (raw) return { left: true, right: true, bottom: true, ...(JSON.parse(raw) as Partial<PanelsState>) };
  } catch { /* 忽略坏数据,回落全开 */ }
  return { left: true, right: true, bottom: true };
}

export function usePanels(): { panels: PanelsState; togglePanel(key: keyof PanelsState): void } {
  const [panels, setPanels] = useState<PanelsState>(loadPanels);
  const togglePanel = useCallback((key: keyof PanelsState) => {
    setPanels((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(PANELS_KEY, JSON.stringify(next));
      } catch { /* 忽略存储失败 */ }
      return next;
    });
  }, []);
  return { panels, togglePanel };
}
