/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // 1431:避开 tmd-cli 开发服务(1421),允许两个项目同时 dev
  server: { port: 1431, strictPort: true },
  clearScreen: false,
  plugins: [react(), tailwindcss()],
  test: { environment: "node" },
});
