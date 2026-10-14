import { describe, expect, it } from "vitest";
import { wrapAtoms } from "./wrap";

const m = (atom: { text: string }) => atom.text.length;

describe("wrapAtoms", () => {
  it("放不下的原子换行", () => {
    const atoms = ["今", "天", "好"].map((text) => ({ text, hl: false }));
    const lines = wrapAtoms(atoms, 2, m);
    expect(lines.map((l) => l.atoms.map((a) => a.text).join(""))).toEqual(["今天", "好"]);
  });

  it("行尾空白丢弃,行首空白不带入下一行", () => {
    const atoms = ["a", " ", "b"].map((text) => ({ text, hl: false }));
    const lines = wrapAtoms(atoms, 2, m);
    expect(lines.map((l) => l.atoms.map((a) => a.text).join(""))).toEqual(["a", "b"]);
  });

  it("宽度为各原子宽度和", () => {
    const atoms = [{ text: "ab", hl: true }, { text: "c", hl: false }];
    const lines = wrapAtoms(atoms, 10, m);
    expect(lines).toEqual([{ atoms, width: 3 }]);
  });

  it("空序列返回空行集", () => {
    expect(wrapAtoms([], 10, m)).toEqual([]);
  });
});
