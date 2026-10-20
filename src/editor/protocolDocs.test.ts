import { describe, expect, it } from "vitest";
import schemaMd from "../../docs/schema.md?raw";
import recipesMd from "../../docs/recipes.md?raw";
import { FALLBACK_PROTOCOL_PATHS } from "../app/agentPaths";
import { ELEMENT_KINDS } from "../core/normalize";
import { buildAiPrompt } from "./aiPrompt";
import { KIND_LABELS } from "./defaults";

/**
 * agent 读取的接口规范(schema.md 元素表 / 选型速查 / recipes 模板清单)与实现必须同步。
 * 加 kind 或改模板数时忘了改文档,这里直接红,不必等 agent 现场踩坑。
 */

const kinds = Object.keys(ELEMENT_KINDS);

describe("agent 协议文档与实现同步", () => {
  it("schema.md 元素表为每个 kind 给出字段行", () => {
    const missing = kinds.filter((k) => !new RegExp(`^\\| \`${k}\` \\|`, "m").test(schemaMd));
    expect(missing).toEqual([]);
  });

  it("schema.md 声称的元素类型种数等于实际 kind 数量", () => {
    const m = /## 元素类型\((\d+) 种\)/.exec(schemaMd);
    expect(m).not.toBeNull();
    expect(Number(m?.[1])).toBe(kinds.length);
  });

  it("属性面板 kind 标签表覆盖且不超出实际 kind", () => {
    expect(Object.keys(KIND_LABELS).sort()).toEqual([...kinds].sort());
  });

  it("元素选型速查逐 kind 点名(agent 不必读全表也能选对)", () => {
    const prompt = buildAiPrompt(null, FALLBACK_PROTOCOL_PATHS);
    const missing = kinds.filter((k) => !prompt.includes(k));
    expect(missing).toEqual([]);
  });

  it("recipes 模板数与 aiPrompt 声明的数量、名单一致", () => {
    const headings = recipesMd.match(/^## \d+\. /gm) ?? [];
    expect(headings.length).toBeGreaterThan(0);
    const prompt = buildAiPrompt(null, FALLBACK_PROTOCOL_PATHS);
    const m = /\((\d+) 个构图模板:([^)]+)\)/.exec(prompt);
    expect(m).not.toBeNull();
    expect(Number(m?.[1])).toBe(headings.length);
    expect((m?.[2] ?? "").split("/")).toHaveLength(headings.length);
  });
});
