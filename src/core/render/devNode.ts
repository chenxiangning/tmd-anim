import type { DevNodeElement, DevNodeVariant } from "../types";

/**
 * 开发组件节点:架构图常用资源(数据库/缓存/对象存储/云/服务器/API/消息队列/容器)。
 * 布局 = 左侧图标色块(h×h) + 右侧主名称/副标题;图标按变体程序化绘制,全部为 (project,t) 纯函数。
 */

export const DEV_META: Record<DevNodeVariant, { color: string; name: string }> = {
  database: { color: "#0284C7", name: "数据库" },
  redis: { color: "#DC382D", name: "Redis" },
  obs: { color: "#EA580C", name: "对象存储" },
  cloud: { color: "#0EA5E9", name: "云" },
  server: { color: "#475569", name: "服务器" },
  api: { color: "#16A34A", name: "API" },
  queue: { color: "#D97706", name: "消息队列" },
  container: { color: "#2563EB", name: "容器" },
};

type Ctx = CanvasRenderingContext2D;

const SANS = 'ui-sans-serif, system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';

/** 变体图标:在 (ox,oy) 边长 s 的方盒内以主色描边绘制,线宽按盒尺寸等比 */
function drawGlyph(ctx: Ctx, dev: DevNodeVariant, ox: number, oy: number, s: number, color: string): void {
  const lw = Math.max(2, s * 0.05);
  const cx = ox + s / 2;
  const cy = oy + s / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  switch (dev) {
    case "database": {
      const rx = s * 0.26;
      const ry = s * 0.11;
      ctx.moveTo(cx - rx, cy - ry);
      ctx.lineTo(cx - rx, cy + s * 0.2 - ry);
      ctx.ellipse(cx, cy + s * 0.2 - ry, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(cx + rx, cy - ry);
      ctx.ellipse(cx, cy - ry, rx, ry, 0, 0, Math.PI, true);
      ctx.closePath();
      ctx.moveTo(cx - rx, cy + s * 0.1 - ry);
      ctx.ellipse(cx, cy + s * 0.1 - ry, rx, ry, 0, 0, Math.PI, false);
      break;
    }
    case "redis": {
      // 两片叠放的菱形(redis 标记的示意)
      const r = s * 0.28;
      for (const dy of [-s * 0.09, s * 0.09]) {
        ctx.moveTo(cx, cy - r * 0.62 + dy);
        ctx.lineTo(cx + r, cy + dy);
        ctx.lineTo(cx, cy + r * 0.62 + dy);
        ctx.lineTo(cx - r, cy + dy);
        ctx.closePath();
      }
      break;
    }
    case "obs": {
      // 桶:梯形身 + 椭圆口
      const rw = s * 0.27;
      const top = cy - s * 0.18;
      ctx.moveTo(cx - rw, top);
      ctx.lineTo(cx - rw * 0.72, cy + s * 0.22);
      ctx.lineTo(cx + rw * 0.72, cy + s * 0.22);
      ctx.lineTo(cx + rw, top);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, top, rw, s * 0.1, 0, 0, Math.PI * 2);
      break;
    }
    case "cloud": {
      // 三圆弧云团
      ctx.arc(cx - s * 0.14, cy + s * 0.06, s * 0.13, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(cx - s * 0.02, cy - s * 0.1, s * 0.15, Math.PI * 0.9, Math.PI * 2.05);
      ctx.arc(cx + s * 0.16, cy + s * 0.02, s * 0.12, Math.PI * 1.5, Math.PI * 0.5);
      break;
    }
    case "server": {
      // 机架:两格 + 指示点
      const rw = s * 0.3;
      const rh = s * 0.13;
      for (const dy of [-s * 0.16, s * 0.03]) {
        ctx.moveTo(cx - rw, cy + dy);
        ctx.lineTo(cx + rw, cy + dy);
        ctx.lineTo(cx + rw, cy + dy + rh);
        ctx.lineTo(cx - rw, cy + dy + rh);
        ctx.closePath();
        ctx.moveTo(cx - rw * 0.6, cy + dy + rh / 2);
        ctx.arc(cx - rw * 0.6, cy + dy + rh / 2, lw * 0.7, 0, Math.PI * 2);
      }
      break;
    }
    case "api": {
      ctx.font = `700 ${Math.round(s * 0.4)}px ${SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText("</>", cx, cy + s * 0.02);
      return;
    }
    case "queue": {
      // 三条横档 + 左端点(消息队列)
      const rw = s * 0.26;
      for (const dy of [-s * 0.16, 0, s * 0.16]) {
        ctx.moveTo(cx - rw, cy + dy);
        ctx.lineTo(cx + rw, cy + dy);
        ctx.moveTo(cx - rw * 0.55, cy + dy);
        ctx.arc(cx - rw * 0.55, cy + dy, lw * 0.7, 0, Math.PI * 2);
      }
      break;
    }
    case "container": {
      // 立方体:六边形 + Y 棱线
      const r = s * 0.27;
      const hex: Array<[number, number]> = [];
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        hex.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      ctx.moveTo(hex[0][0], hex[0][1]);
      for (let i = 1; i < 6; i++) ctx.lineTo(hex[i][0], hex[i][1]);
      ctx.closePath();
      ctx.moveTo(hex[0][0], hex[0][1]);
      ctx.lineTo(cx, cy);
      ctx.lineTo(hex[2][0], hex[2][1]);
      ctx.moveTo(cx, cy);
      ctx.lineTo(hex[4][0], hex[4][1]);
      break;
    }
  }
  ctx.stroke();
}

export function drawDevNode(ctx: Ctx, el: DevNodeElement): void {
  const meta = DEV_META[el.dev] ?? DEV_META.server;
  const { x, y, w, h } = el;
  ctx.save();
  // 节点体:白底圆角 + 主色描边
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(12, h / 4));
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = meta.color;
  ctx.lineWidth = Math.max(2, h * 0.025);
  ctx.stroke();
  // 左侧图标色块:主色浅底 + 主色图标
  const inset = Math.max(6, h * 0.06);
  ctx.beginPath();
  ctx.roundRect(x + inset, y + inset, h - inset * 2, h - inset * 2, Math.min(10, h / 5));
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = meta.color;
  ctx.fill();
  ctx.globalAlpha = 1;
  drawGlyph(ctx, el.dev, x + inset, y + inset, h - inset * 2, meta.color);
  // 右侧文字:主名称 + 可选副标题,垂直居中
  const fs = el.fontSize ?? 26;
  const tx = x + h + 14;
  const tw = w - h - 14 - 12;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const label = el.label ?? meta.name;
  if (el.sub) {
    ctx.font = `600 ${fs}px ${SANS}`;
    ctx.fillStyle = "#1F2937";
    ctx.fillText(label, tx, y + h / 2 - fs * 0.36, tw);
    ctx.font = `400 ${Math.round(fs * 0.72)}px ${SANS}`;
    ctx.fillStyle = "#64748B";
    ctx.fillText(el.sub, tx, y + h / 2 + fs * 0.52, tw);
  } else {
    ctx.font = `600 ${fs}px ${SANS}`;
    ctx.fillStyle = "#1F2937";
    ctx.fillText(label, tx, y + h / 2 + 1, tw);
  }
  ctx.restore();
}
