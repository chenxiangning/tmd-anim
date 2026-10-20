import type { ReactNode } from "react";
import { DEV_ICONS } from "./devIcons";

/** 元素库图标:键 = kind 或 kind:variant,形状对应画布上的真实外观;纯 SVG 数据与库布局分离。 */
function icon(paths: ReactNode, opts?: { stroke?: boolean }): ReactNode {
  const st = opts?.stroke;
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill={st ? "none" : "currentColor"} stroke={st ? "currentColor" : "none"} strokeWidth={st ? 2 : undefined} strokeLinecap={st ? "round" : undefined} strokeLinejoin={st ? "round" : undefined}>
      {paths}
    </svg>
  );
}


export const ICONS: Record<string, ReactNode> = {
  title: icon(<path d="M5 4h14v3h-5.5v13h-3V7H5z" />),
  artText: icon(<path d="M12 4l7 16M12 4L5 20M7.8 14.5h8.4" />, { stroke: true }),
  text: icon(<path d="M4 6h16M4 11.5h12M4 17h16" />, { stroke: true }),
  "shape:rect": icon(<rect x="4" y="6" width="16" height="12" rx="3" />, { stroke: true }),
  "shape:ellipse": icon(<circle cx="12" cy="12" r="8.5" />, { stroke: true }),
  "shape:triangle": icon(<path d="M12 4.5L20.5 19h-17z" />, { stroke: true }),
  "shape:diamond": icon(<path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z" />, { stroke: true }),
  "shape:hexagon": icon(<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" />, { stroke: true }),
  "shape:star": icon(<path d="M12 3.2l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.6l-5.6 3 1.1-6.3L2.9 9.9l6.3-.9z" />),
  "shape:cylinder": icon(
    <>
      <ellipse cx="12" cy="6.3" rx="8" ry="2.8" strokeWidth="1.8" />
      <path d="M4 6.3v11.4c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8V6.3" strokeWidth="1.8" />
    </>,
    { stroke: true },
  ),
  "shape:blockArrow": icon(<path d="M4 9.2h8.5V4.5L20.5 12l-8 7.5v-4.7H4z" />),
  "shape:speechBubble": icon(<path d="M4.5 4h15A2.5 2.5 0 0122 6.5v7a2.5 2.5 0 01-2.5 2.5H11l-5.5 4.2V16H4.5A2.5 2.5 0 012 13.5v-7A2.5 2.5 0 014.5 4z" />),
  badge: icon(<rect x="3" y="8" width="18" height="8" rx="4" />),
  note: icon(
    <>
      <path d="M5 4h14v11l-5 5H5z" opacity="0.25" />
      <path d="M5 4h14v11l-5 5H5zM19 15l-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>,
  ),
  input: icon(
    <>
      <rect x="3" y="7" width="18" height="10" rx="2" strokeWidth="1.8" />
      <path d="M7 10.5v3" strokeWidth="1.8" />
    </>,
    { stroke: true },
  ),
  kbd: icon(
    <>
      <rect x="3" y="6.5" width="18" height="11.5" rx="2" strokeWidth="1.8" />
      <path d="M7 10.5h.01M11 10.5h.01M15 10.5h.01M17 10.5h.01M8 14.5h8" strokeWidth="1.8" />
    </>,
    { stroke: true },
  ),
  browser: icon(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth="1.8" />
      <path d="M3 9.5h18" strokeWidth="1.5" />
      <circle cx="6" cy="6.8" r="0.9" />
      <circle cx="9" cy="6.8" r="0.9" />
      <rect x="5.5" y="12" width="13" height="5" rx="2.5" opacity="0.45" />
    </>,
    { stroke: true },
  ),
  code: icon(<path d="M9 6L3 12l6 6M15 6l6 6-6 6" />, { stroke: true }),
  terminal: icon(
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" strokeWidth="1.8" />
      <path d="M7 9.5l3 3-3 3M12.5 15.5H17" strokeWidth="1.8" />
    </>,
    { stroke: true },
  ),
  table: icon(
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" strokeWidth="1.8" />
      <path d="M3 9.5h18M3 14.5h18M9.5 4v16" strokeWidth="1.5" />
    </>,
    { stroke: true },
  ),
  list: icon(
    <>
      <circle cx="5" cy="6" r="1.7" />
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="5" cy="18" r="1.7" />
      <path d="M9.5 6H20M9.5 12H20M9.5 18H20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>,
  ),
  stepCard: icon(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="1.8" />
      <rect x="6" y="8.5" width="4" height="4" rx="1" />
      <path d="M12.5 9.5H18M12.5 12h4M6 15.5h12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>,
    { stroke: true },
  ),
  cardFlow: icon(
    <>
      <rect x="2.5" y="6" width="6.5" height="12" rx="1.6" strokeWidth="1.7" />
      <rect x="15" y="6" width="6.5" height="12" rx="1.6" strokeWidth="1.7" />
      <path d="M9.5 12h5m0 0-1.6-1.4M14.5 12l-1.6 1.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>,
    { stroke: true },
  ),
  specRow: icon(
    <>
      <rect x="3" y="7" width="18" height="10" rx="2" strokeWidth="1.7" />
      <rect x="5.4" y="9.4" width="3" height="5.2" rx="0.8" />
      <path d="M10.4 10.5h6M10.4 13.5h4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>,
    { stroke: true },
  ),
  docStack: icon(
    <>
      <path d="M7 8.5h9M7 12h9M7 15.5h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.5 5.5h11v14h-11z" strokeWidth="1.7" />
      <path d="M9 3.5h11v14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>,
    { stroke: true },
  ),
  chipRow: icon(
    <>
      <rect x="2.5" y="8.5" width="7" height="7" rx="3.5" strokeWidth="1.7" />
      <rect x="11.5" y="8.5" width="7" height="7" rx="3.5" strokeWidth="1.7" />
      <path d="M19.5 12h2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>,
    { stroke: true },
  ),
  ringNode: icon(
    <>
      <circle cx="12" cy="12" r="8.5" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="5" strokeWidth="1.2" opacity="0.55" strokeDasharray="2 2" />
    </>,
    { stroke: true },
  ),
  stackList: icon(
    <>
      <path d="M3.5 9.5h8v9h-8z" strokeWidth="1.5" />
      <path d="M6 6.5h8v9" fill="none" strokeWidth="1.3" opacity="0.6" />
      <path d="M16 10.5h1.5M16.8 13h1.5M17.5 15.5h1.5" fill="none" strokeWidth="1.6" strokeLinecap="round" />
    </>,
    { stroke: true },
  ),
  loopArrow: icon(
    <>
      <path d="M5 8v7a3 3 0 0 0 3 3h9" fill="none" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14 15.2l3 2.8-3 2.8" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8l0-0.5" fill="none" strokeWidth="1.6" />
    </>,
    { stroke: true },
  ),
  progress: icon(
    <>
      <rect x="3" y="9" width="18" height="6" rx="3" opacity="0.3" />
      <rect x="3" y="9" width="11.5" height="6" rx="3" />
    </>,
  ),
  arrayCells: icon(
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" opacity="0.65" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" opacity="0.65" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" opacity="0.4" />
    </>,
  ),
  connector: icon(<path d="M4 18L17 7M12 6h6v6" />, { stroke: true }),
  "connector:line": icon(<path d="M5 19L19 5" />, { stroke: true }),
  image: icon(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="1.8" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M5 17l5-5 3.5 3.5L16 13l3 3" strokeWidth="1.8" />
    </>,
    { stroke: true },
  ),
  barChart: icon(
    <>
      <path d="M4 4v15a1 1 0 001 1h15" fill="none" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="7" y="11" width="3.4" height="7" rx="1" />
      <rect x="12" y="7" width="3.4" height="11" rx="1" />
      <rect x="17" y="13" width="3.4" height="5" rx="1" />
    </>,
    { stroke: true },
  ),
  lineChart: icon(
    <>
      <path d="M4 4v15a1 1 0 001 1h15" fill="none" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 16l4-5 3.5 3 5.5-7" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10.5" cy="11" r="1.3" />
      <circle cx="14" cy="14" r="1.3" />
      <circle cx="19.5" cy="7" r="1.3" />
    </>,
    { stroke: true },
  ),
  pieChart: icon(
    <>
      <path d="M12 3.5a8.5 8.5 0 108.5 8.5H12z" />
      <path d="M14 2.6a8.5 8.5 0 017.4 7.4H14z" opacity="0.55" />
    </>,
  ),
  cursor: icon(<path d="M6 3.5l12.5 8.6-5.6 1.4 3 5.5-2.6 1.4-3-5.6-4.3 3.7z" />),
  folderTree: icon(
    <>
      <rect x="3" y="4" width="8" height="6" rx="1.5" strokeWidth="1.8" />
      <path d="M7 10v4h3" fill="none" strokeWidth="1.8" />
      <rect x="13" y="13" width="8" height="6" rx="1.5" strokeWidth="1.8" />
      <circle cx="16.5" cy="16" r="0.6" />
    </>,
    { stroke: true },
  ),
  codeDiff: icon(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth="1.8" />
      <path d="M9 9l-2.5 3L9 15M15 9l2.5 3L15 15" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.8 8.5l-1.6 7" strokeWidth="1.6" opacity="0.45" />
    </>,
    { stroke: true },
  ),
  spotlight: icon(
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="none" strokeWidth="1.8" strokeDasharray="3 2.2" opacity="0.6" />
      <circle cx="12" cy="12" r="4.2" />
    </>,
    { stroke: true },
  ),
  gridBg: icon(<path d="M4 4v16M9.5 4v16M15 4v16M20 4v16M4 4h16M4 9.5h16M4 15h16M4 20.5h16" fill="none" strokeWidth="1.4" strokeLinecap="round" />),
  groupPanel: icon(
    <>
      <rect x="3" y="6.5" width="18" height="14" rx="2.5" strokeWidth="1.8" />
      <rect x="6" y="3.5" width="7" height="6" rx="2" />
      <path d="M6.5 13h11M6.5 16.5h7" fill="none" strokeWidth="1.6" strokeLinecap="round" />
    </>,
    { stroke: true },
  ),
  lane: icon(
    <>
      <rect x="3" y="4" width="18" height="4.6" rx="1.2" opacity="0.9" />
      <rect x="3" y="9.8" width="18" height="4.6" rx="1.2" opacity="0.55" />
      <rect x="3" y="15.6" width="18" height="4.6" rx="1.2" opacity="0.3" />
    </>,
  ),
  quote: icon(<path d="M5 16c-1 0-2-1.2-2-3 0-3.2 2.2-6.4 5.5-7.5l.7 1.4C7.2 7.8 6.3 9.4 6.2 11H9v5zm10 0c-1 0-2-1.2-2-3 0-3.2 2.2-6.4 5.5-7.5l.7 1.4c-2 1.9-2.9 3.5-3 5.1H19v5z" />),
  formula: icon(<path d="M17 5.5H10l3.4 6.6-3.4 6.6h7" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />),
  avatar: icon(
    <>
      <circle cx="12" cy="8.6" r="3.6" strokeWidth="1.8" />
      <path d="M4.8 20c.9-3.4 3.8-5.2 7.2-5.2s6.3 1.8 7.2 5.2" fill="none" strokeWidth="1.8" strokeLinecap="round" />
    </>,
    { stroke: true },
  ),
  person: icon(
    <>
      <circle cx="12" cy="5.6" r="2.6" />
      <rect x="9" y="9" width="6" height="6.4" rx="2" />
      <rect x="9.9" y="15.8" width="1.9" height="4.8" rx="0.95" />
      <rect x="12.9" y="15.8" width="1.9" height="4.8" rx="0.95" />
      <rect x="6.7" y="9.6" width="1.8" height="5" rx="0.9" />
    </>,
  ),
  mascot: icon(
    <>
      <path d="M6 4.5h9.5L19 8v11a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 19V6a1.5 1.5 0 011-1.5z" strokeWidth="1.8" />
      <path d="M15.5 4.5V8H19" fill="none" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="9.6" cy="11.4" r="0.9" />
      <circle cx="14.4" cy="11.4" r="0.9" />
      <path d="M9.8 14.2c.6.9 3.8.9 4.4 0" fill="none" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="7.4" y="6" width="4.4" height="2.4" rx="0.8" opacity="0.7" />
    </>,
    { stroke: true },
  ),
  confetti: icon(
    <>
      <rect x="4" y="4.5" width="3.4" height="2.6" rx="0.6" transform="rotate(18 5.7 5.8)" />
      <rect x="16.5" y="4" width="3.4" height="2.6" rx="0.6" transform="rotate(-24 18.2 5.3)" opacity="0.7" />
      <rect x="10.2" y="9.5" width="3.6" height="2.7" rx="0.6" transform="rotate(40 12 10.8)" opacity="0.85" />
      <rect x="5" y="14.5" width="3.4" height="2.6" rx="0.6" transform="rotate(-30 6.7 15.8)" opacity="0.55" />
      <rect x="15.5" y="16" width="3.6" height="2.7" rx="0.6" transform="rotate(22 17.3 17.3)" opacity="0.7" />
    </>,
  ),
  ...DEV_ICONS,
};
