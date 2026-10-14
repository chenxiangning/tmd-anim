// 生成 tmd-anim 图标(纯 Node,零依赖):slate-900 圆角底 + 白色播放三角,2x2 超采样抗锯齿。
// 完整平台集(icns/ico)由 `pnpm tauri icon src-tauri/icons/icon.png` 从 512 母版派生。
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// 圆角矩形内含判定:点 clamp 到内缩矩形后的距离不超过圆角半径
function insideRounded(px, py, s, r) {
  const cx = Math.min(Math.max(px, r), s - 1 - r);
  const cy = Math.min(Math.max(py, r), s - 1 - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function edgeSign(ax, ay, bx, by, px, py) {
  return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
}

function insideTriangle(px, py, tri) {
  const [a, b, c] = tri;
  const d1 = edgeSign(a[0], a[1], b[0], b[1], px, py);
  const d2 = edgeSign(b[0], b[1], c[0], c[1], px, py);
  const d3 = edgeSign(c[0], c[1], a[0], a[1], px, py);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const r = size * 0.225;
  const tri = [
    [0.4 * size, 0.31 * size],
    [0.4 * size, 0.69 * size],
    [0.74 * size, 0.5 * size],
  ];
  const BG = [15, 23, 42]; // slate-900
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0;
      let triHit = 0;
      for (const [sx, sy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const px = x + sx;
        const py = y + sy;
        if (insideRounded(px, py, size, r)) {
          cover++;
          if (insideTriangle(px, py, tri)) triHit++;
        }
      }
      const i = (y * size + x) * 4;
      if (cover === 0) continue; // 全透明
      const t = triHit / cover;
      rgba[i] = Math.round(15 + (255 - 15) * t);
      rgba[i + 1] = Math.round(23 + (255 - 23) * t);
      rgba[i + 2] = Math.round(42 + (255 - 42) * t);
      rgba[i + 3] = Math.round((cover / 4) * 255);
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(join(root, "src-tauri/icons"), { recursive: true });
mkdirSync(join(root, "public"), { recursive: true });
const master = render(512);
writeFileSync(join(root, "src-tauri/icons/icon.png"), master);
writeFileSync(join(root, "public/icon.png"), master);
for (const [size, name] of [
  [32, "32x32.png"],
  [128, "128x128.png"],
  [256, "128x128@2x.png"],
]) {
  writeFileSync(join(root, "src-tauri/icons", name), render(size));
}
console.log("icons written: src-tauri/icons/{32x32,128x128,128x128@2x,icon}.png + public/icon.png");
