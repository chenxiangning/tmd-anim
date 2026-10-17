import type { ReactNode } from "react";

/** 元素库「组件 → 开发」页签的图标:与画布 devNode 渲染同一套语义(数据库/缓存/桶/云/机架/代码/队列/立方体)。 */

function devIcon(paths: ReactNode): ReactNode {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {paths}
    </svg>
  );
}

export const DEV_ICONS: Record<string, ReactNode> = {
  "devNode:database": devIcon(<><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>),
  "devNode:redis": devIcon(<path d="M12 3l8 4.5-8 4.5-8-4.5zM4 12l8 4.5 8-4.5M4 16.5L12 21l8-4.5" />),
  "devNode:obs": devIcon(<path d="M5 7h14l-1.6 11a2 2 0 0 1-2 1.7H8.6a2 2 0 0 1-2-1.7zM8.5 7a3.5 3.5 0 0 1 7 0" />),
  "devNode:cloud": devIcon(<path d="M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.7 1.5A3.5 3.5 0 0 1 17.5 18z" />),
  "devNode:server": devIcon(<><rect x="4" y="4" width="16" height="7" rx="2" /><rect x="4" y="13" width="16" height="7" rx="2" /><path d="M8 7.5h.01M8 16.5h.01" /></>),
  "devNode:api": devIcon(<path d="M8 6l-4 6 4 6M16 6l4 6-4 6M13.5 4l-3 16" />),
  "devNode:queue": devIcon(<><path d="M4 6h16M4 12h16M4 18h16" /><path d="M7 6h.01M7 12h.01M7 18h.01" /></>),
  "devNode:container": devIcon(<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12L4 7.5M12 12v9" />),
};
