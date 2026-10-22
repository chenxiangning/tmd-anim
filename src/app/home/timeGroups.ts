/** 首页时间线:更新时间 → 按天分组(今天/昨天/具体日期,不再有更早桶)与生成时间戳文案。 */

const DAY_MS = 86_400_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 按天分组标签:今天 / 昨天 / M月D日(跨年带年份);无时间戳归「未知」。 */
export function dayLabelOf(ts: number): string {
  if (!ts) return "未知";
  const today = startOfDay(Date.now());
  const day = startOfDay(ts);
  if (day === today) return "今天";
  if (day === today - DAY_MS) return "昨天";
  const d = new Date(ts);
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}年${md}`;
}

/** 卡片生成时间戳:M月D日 HH:mm(跨年带年份);无时间戳显示 —。 */
export function fmtStamp(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const md = `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}年${md}`;
}
