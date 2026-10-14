/** 富文本切分:把「文本 + 高亮短语」解析为可折行、可打字机的原子序列。 */

export interface TextRun {
  text: string;
  hl: boolean;
}

export interface Atom {
  text: string;
  hl: boolean;
}

/** 按高亮短语切分文本;多个短语互不重叠,游标从左往右,同位置取最长命中 */
export function splitRuns(text: string, highlights?: readonly string[]): TextRun[] {
  if (!text) return [];
  if (!highlights || highlights.length === 0) return [{ text, hl: false }];
  const ranges: Array<[number, number]> = [];
  let cursor = 0;
  while (cursor < text.length) {
    let best: [number, number] | null = null;
    for (const h of highlights) {
      if (!h) continue;
      const at = text.indexOf(h, cursor);
      if (at < 0) continue;
      if (!best || at < best[0] || (at === best[0] && h.length > best[1] - best[0])) {
        best = [at, at + h.length];
      }
    }
    if (!best) break;
    ranges.push(best);
    cursor = best[1];
  }
  const runs: TextRun[] = [];
  let pos = 0;
  for (const [start, end] of ranges) {
    if (start > pos) runs.push({ text: text.slice(pos, start), hl: false });
    runs.push({ text: text.slice(start, end), hl: true });
    pos = end;
  }
  if (pos < text.length) runs.push({ text: text.slice(pos), hl: false });
  return runs.filter((run) => run.text.length > 0);
}

function isWideChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code > 0x2e7f; // CJK 及之后的字面,逐字成原子
}

/** 原子化:CJK 单字成原子、连续字母数字成词、空白与其余符号各自成原子;保留高亮标记 */
export function atomsOf(text: string, highlights?: readonly string[]): Atom[] {
  const atoms: Atom[] = [];
  for (const run of splitRuns(text, highlights)) {
    let buf = "";
    const flush = () => {
      if (buf) {
        atoms.push({ text: buf, hl: run.hl });
        buf = "";
      }
    };
    for (const ch of run.text) {
      if (isWideChar(ch)) {
        flush();
        atoms.push({ text: ch, hl: run.hl });
      } else if (/[A-Za-z0-9]/.test(ch)) {
        buf += ch;
      } else {
        flush();
        atoms.push({ text: ch, hl: run.hl });
      }
    }
    flush();
  }
  return atoms;
}
