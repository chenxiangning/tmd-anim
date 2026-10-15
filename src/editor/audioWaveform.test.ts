import { describe, expect, it } from "vitest";
import { computePeaks, resamplePeaks } from "./audioWaveform";

describe("computePeaks", () => {
  it("等距分桶取绝对峰值并归一化", () => {
    // 8 个样本分 4 桶:峰值 0.1/0.5/0.2/1.0 → 归一化后最大桶为 1
    const samples = Float32Array.from([0.1, -0.1, 0.5, -0.3, 0.2, -0.2, 1.0, 0.9]);
    const peaks = computePeaks(samples, 4);
    expect([...peaks]).toHaveLength(4);
    peaks.forEach((p, i) => expect(p).toBeCloseTo([0.1, 0.5, 0.2, 1.0][i], 5));
  });

  it("全静音波形保持 0,不做除零", () => {
    const peaks = computePeaks(new Float32Array(16), 4);
    expect([...peaks]).toEqual([0, 0, 0, 0]);
  });

  it("桶数多于样本数时每桶至少覆盖一个样本", () => {
    const peaks = computePeaks(Float32Array.from([0.5, -1]), 4);
    expect(peaks.length).toBe(4);
    expect(Math.max(...peaks)).toBe(1);
  });
});

describe("resamplePeaks", () => {
  it("窄列取覆盖区间最大峰,不漏尖峰", () => {
    const peaks = Float32Array.from([0.1, 0.2, 1.0, 0.2]);
    // 2 列:第一列覆盖 0-1,第二列覆盖 2-3
    const cols = resamplePeaks(peaks, 2);
    expect(cols[0]).toBeCloseTo(0.2, 5);
    expect(cols[1]).toBeCloseTo(1.0, 5);
  });

  it("列数等于桶数时原样返回,非法列数返回空", () => {
    const peaks = Float32Array.from([0.1, 0.9, 0.5]);
    const cols = resamplePeaks(peaks, 3);
    expect(cols).toHaveLength(3);
    cols.forEach((p, i) => expect(p).toBeCloseTo(peaks[i], 5));
    expect(resamplePeaks(peaks, 0)).toEqual([]);
  });
});
