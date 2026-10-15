#!/usr/bin/env node
/**
 * 本地打包:tauri build 后把安装产物收集到根目录 re-local/,与 CI 发布产物互不干扰。
 * 额外参数透传给 tauri build(如 pnpm tauri:build -- --debug)。
 * 本地无私钥时自动关掉 updater 产物(.app.tar.gz/.sig),签名件由 CI 发布时产出。
 */

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauriArgs = process.argv.slice(2);

const conf = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const wantUpdater = Boolean(conf.bundle?.createUpdaterArtifacts) && Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY);

const args = ["tauri", "build", ...tauriArgs];
if (conf.bundle?.createUpdaterArtifacts && !wantUpdater) {
  console.log("未检测到 TAURI_SIGNING_PRIVATE_KEY,本次跳过 updater 产物(签名件由 CI 产出)");
  args.push("--config", JSON.stringify({ bundle: { createUpdaterArtifacts: false } }));
}

const result = spawnSync("pnpm", args, { cwd: root, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);

const profile = tauriArgs.includes("--debug") ? "debug" : "release";
const bundleDir = join(root, "src-tauri", "target", profile, "bundle");
const outDir = join(root, "re-local");

const basePatterns = [/\.dmg$/, /\.app$/, /^latest\.json$/];
const updaterPatterns = [/\.app\.tar\.gz$/, /\.app\.tar\.gz\.sig$/];
const artifactPatterns = wantUpdater ? [...basePatterns, ...updaterPatterns] : basePatterns;

function collect(dir) {
  const picked = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (artifactPatterns.some((pattern) => pattern.test(name))) {
      picked.push({ name, path });
    } else if (statSync(path).isDirectory() && !name.endsWith(".app")) {
      picked.push(...collect(path));
    }
  }
  return picked;
}

function sizeOf(path) {
  const stat = statSync(path);
  if (!stat.isDirectory()) return `${(stat.size / 1024 / 1024).toFixed(1)} MB`;
  let bytes = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const inner = join(dir, name);
      const innerStat = statSync(inner);
      if (innerStat.isDirectory()) walk(inner);
      else bytes += innerStat.size;
    }
  };
  walk(path);
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const artifacts = collect(bundleDir);
if (artifacts.length === 0) {
  console.warn(`未在 ${bundleDir} 找到产物`);
  process.exit(1);
}
for (const { name, path } of artifacts) {
  cpSync(path, join(outDir, name), { recursive: true });
  console.log(`  ${name}  ${sizeOf(path)}`);
}
console.log(`共 ${artifacts.length} 件产物 -> re-local/`);
