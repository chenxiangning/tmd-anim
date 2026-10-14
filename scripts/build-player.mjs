#!/usr/bin/env node
/**
 * 预构建 HTML 导出用独立播放器:src/core/playerEntry.ts -> src/generated/player.iife.js(IIFE,零外部依赖)。
 * 产物经 ?raw 内联进导出的单文件 HTML;core 渲染路径变更后由 pnpm check / pnpm build 自动重跑本脚本。
 */

import { build } from "vite";

await build({
  configFile: false,
  logLevel: "warn",
  esbuild: { legalComments: "none" },
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    outDir: "src/generated",
    emptyOutDir: true,
    minify: false,
    target: "es2020",
    lib: {
      entry: "src/core/playerEntry.ts",
      formats: ["iife"],
      name: "__tmdPlayer",
      fileName: () => "player.iife.js",
    },
  },
});
console.log("player.iife.js 构建完成 -> src/generated/");
