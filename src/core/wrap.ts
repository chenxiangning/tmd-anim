import type { Atom } from "./highlight";

/** 贪心折行。measure 按原子计宽(芯片类原子把内边距算进去),与具体绘制解耦,便于单测。 */

export type AtomMeasure = (atom: Atom) => number;

export interface Line {
  atoms: Atom[];
  width: number;
}

export function wrapAtoms(atoms: readonly Atom[], maxWidth: number, measure: AtomMeasure): Line[] {
  const lines: Line[] = [];
  let current: Atom[] = [];
  let width = 0;
  const push = () => {
    if (current.length === 0) return;
    lines.push({ atoms: current, width });
    current = [];
    width = 0;
  };
  for (const atom of atoms) {
    const w = measure(atom);
    if (current.length > 0 && width + w > maxWidth) {
      // 行尾空白丢弃;引发换行的空白也不带入下一行
      if (current[current.length - 1].text === " ") {
        width -= measure(current[current.length - 1]);
        current.pop();
      }
      push();
      if (atom.text === " ") continue;
    }
    current.push(atom);
    width += w;
  }
  push();
  return lines;
}
