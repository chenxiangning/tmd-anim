import { describe, expect, it, vi, afterEach } from "vitest";
import { dayLabelOf, fmtStamp } from "./timeGroups";

const DAY = 86_400_000;

afterEach(() => {
  vi.useRealTimers();
});

/** 固定「2026-10-14 周三 12:00」为当前时间,便于断言分组边界。 */
function now(): number {
  return new Date(2026, 9, 14, 12, 0, 0).getTime();
}

describe("dayLabelOf 按天分组", () => {
  it.each([
    [now() - 60_000, "今天"],
    [now() - 5 * 3_600_000, "今天"],
    [now() - DAY, "昨天"],
    [now() - 2 * DAY, "10月12日"], // 本周 earlier 天也按天,不再有本周桶
    [new Date(2026, 9, 5).getTime(), "10月5日"],
    [new Date(2026, 8, 20).getTime(), "9月20日"],
    [new Date(2025, 11, 3).getTime(), "2025年12月3日"],
    [0, "未知"],
  ])("%s → %s", (ts, label) => {
    vi.useFakeTimers();
    vi.setSystemTime(now());
    expect(dayLabelOf(ts)).toBe(label);
  });
});

describe("fmtStamp 生成时间戳", () => {
  it("同年 M月D日 HH:mm,跨年带年份,零值 —", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now());
    expect(fmtStamp(0)).toBe("—");
    expect(fmtStamp(new Date(2026, 9, 5, 9, 7).getTime())).toBe("10月5日 09:07");
    expect(fmtStamp(new Date(2025, 11, 3, 23, 5).getTime())).toBe("2025年12月3日 23:05");
  });
});
