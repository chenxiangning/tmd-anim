/** 首页时间线:更新时间 → 展示分组(今天/昨天/本周/本月/更早)与相对时间文案。 */

export const TIME_GROUPS = ["今天", "昨天", "本周", "本月", "更早"] as const;
export type TimeGroup = (typeof TIME_GROUPS)[number];

const DAY_MS = 86_400_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function timeGroupOf(ts: number): TimeGroup {
  if (!ts) return "更早";
  const now = Date.now();
  const today = startOfDay(now);
  const day = startOfDay(ts);
  if (day >= today) return "今天";
  if (day >= today - DAY_MS) return "昨天";
  const monday = today - ((new Date(now).getDay() + 6) % 7) * DAY_MS;
  if (day >= monday) return "本周";
  const d = new Date(ts);
  const n = new Date(now);
  if (d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()) return "本月";
  return "更早";
}

export function fmtTime(ts: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}
