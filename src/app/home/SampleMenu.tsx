import { useEffect, useRef, useState } from "react";
import benchSample from "../../samples/bench-chart.json";
import debugSample from "../../samples/debug-story.json";
import explainerSample from "../../samples/explainer.json";
import gitSample from "../../samples/git-tutorial.json";
import harnessSample from "../../samples/harness-loop.json";
import httpSample from "../../samples/http.json";
import refactorSample from "../../samples/refactor-diff.json";
import vitalsSample from "../../samples/web-vitals.json";
import flowSample from "../../samples/request-flow.json";
import xiaoheiSample from "../../samples/xiaohei.json";

interface SampleMenuProps {
  /** 传入示例 JSON 文本,由调用方统一走 parseProjectText 建副本 */
  onCreate(text: string): void;
}

/** 首页「从示例新建」下拉:内置示例(协议全家福 / 拟人科普 / 六个叙事 demo / 信息图 / 小黑插画风格)。 */
export function SampleMenu({ onCreate }: SampleMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const samples = [
    { key: "http", label: "HTTP 请求的一生", hint: "协议元素全家福,改它起步最快", json: httpSample },
    { key: "explainer", label: "拟人科普示例", hint: "吉祥物+纸屑+旁白字幕,配 recipes #11", json: explainerSample },
    { key: "git", label: "三步教程:Git 保存进度", hint: "终端打字机+步骤卡,配 recipes #2", json: gitSample },
    { key: "refactor", label: "前后对比:一次重构", hint: "代码对比+指标柱图,配 recipes #3", json: refactorSample },
    { key: "flow", label: "架构数据流:一次下单", hint: "组件节点+流动连线,配 recipes #4", json: flowSample },
    { key: "bench", label: "性能对比:方案对决", hint: "柱图+折线趋势,配 recipes #5", json: benchSample },
    { key: "debug", label: "报错排查侦探记", hint: "告警→排查→修复,配 recipes #8", json: debugSample },
    { key: "vitals", label: "概念三分图解:性能指标", hint: "聚焦+公式排版,配 recipes #7/#9", json: vitalsSample },
    { key: "harness", label: "信息图:递归 Harness", hint: "分组柱图+胶囊组+叠纸K+回环箭头,配 recipes #12", json: harnessSample },
    { key: "xiaohei", label: "小黑插画示例", hint: "手绘怪诞风,配 docs/xiaohei-style.md", json: xiaoheiSample },
  ];

  return (
    <div className="relative" ref={ref}>
      <button className={"btn btn-secondary"} onClick={() => setOpen((v) => !v)}>
        从示例新建
      </button>
      {open && (
        <div className="absolute top-full right-0 z-20 mt-1 w-64 rounded-lg border border-neutral-200 bg-white py-1 shadow-md">
          {samples.map((s) => (
            <button
              key={s.key}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-neutral-50"
              onClick={() => {
                setOpen(false);
                onCreate(JSON.stringify(s.json));
              }}
            >
              <span className="text-xs font-medium text-neutral-800">{s.label}</span>
              <span className="text-[11px] text-neutral-400">{s.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
