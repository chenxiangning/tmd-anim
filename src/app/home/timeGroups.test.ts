import { describe, expect, it, vi, afterEach } from "vitest";
import { fmtTime, timeGroupOf } from "./timeGroups";

const DAY = 86_400_000;

afterEach(() => {
  vi.useRealTimers();
});

/** 固定「2026-10-14 周三 12:00」为当前时间,便于断言分组边界。 */
function now(): number {
  return new Date(2026, 9, 14, 12, 0, 0).getTime();
}

describe("timeGroupOf", () => {
  vi.setSystemTime(now());

  it.each([
    [now() - 60_000, "今天"],
    [now() - 5 * 3_600_000, "今天"],
    [now() - DAY, "昨天"],
    [now() - 2 * DAY, "本周"], // 10-12 周一,在本周内
    [new Date(2026, 9, 5).getTime(), "本月"], // 10-05 上周日,本月但不在本周
    [new Date(2026, 8, 20).getTime(), "更早"], // 九月
    [0, "更早"],
  ])("%s → %s", (ts, group) => {
    vi.useFakeTimers();
    vi.setSystemTime(now());
    expect(timeGroupOf(ts)).toBe(group);
  });

  it("上周日不属于本周", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now());
    expect(new Date(2026, 9, 11).getDay()).toBe(0); // 10-11 是周日,属上周
    expect(timeGroupOf(new Date(2026, 9, 11, 23, 59).getTime())).toBe("本月");
  });
});

describe("fmtTime", () => {
  it("相对时间阶梯", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now());
    expect(fmtTime(0)).toBe("—");
    expect(fmtTime(now() - 30_000)).toBe("刚刚");
    expect(fmtTime(now() - 5 * 60_000)).toBe("5 分钟前");
    expect(fmtTime(now() - 3 * 3_600_000)).toBe("3 小时前");
    expect(fmtTime(now() - 2 * DAY)).toBe("2 天前");
    expect(fmtTime(new Date(2026, 8, 1).getTime())).toBe("2026/9/1");
  });
});
