import { describe, expect, it } from "vitest";
import { normalizeProject } from "../core/normalize";
import { buildStandaloneHtml } from "./htmlExport";

describe("buildStandaloneHtml", () => {
  const project = normalizeProject({
    version: 1,
    name: "演示</script>项目",
    canvas: { width: 960, height: 540 },
    scenes: [{ elements: [{ kind: "badge", text: "hi" }] }],
  });

  it("包含播放器骨架:画布/进度条/项目数据/内嵌播放器", () => {
    const html = buildStandaloneHtml(project);
    expect(html).toContain('id="tmd-stage"');
    expect(html).toContain('id="tmd-project-data"');
    expect(html).toContain('id="tmd-progress-bar"');
    expect(html).toContain("drawFrame");
    expect(html).toContain("<!doctype html>");
  });

  it("项目 JSON 与播放器代码均防 </script> 提前闭合", () => {
    const html = buildStandaloneHtml(project);
    const dataStart = html.indexOf('id="tmd-project-data">') + 'id="tmd-project-data">'.length;
    const dataEnd = html.indexOf("</script>", dataStart);
    const data = html.slice(dataStart, dataEnd);
    // JSON 内的 </script> 早已被转义为 \u003c 形式
    expect(data).not.toContain("</script>");
    expect(data).toContain("\\u003c/script");
    // script 标签数量恰好为 2(json + player)
    expect(html.match(/<script/g)?.length).toBe(2);
  });

  it("标题中的路径非法字符被清理", () => {
    const html = buildStandaloneHtml(project);
    expect(html).toContain("<title>演示__script_项目 · tmd-anim</title>");
  });
});
