/**
 * 颜色工具:把 #RRGGBB / #RGB 追加 alpha 后缀。
 * 非 hex(命名色 / rgb() / 变量)原样返回——拼错后缀会产出非法颜色,Canvas 会静默沿用上一色。
 */
export function withAlpha(color: string, alphaHex: string): string {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(color.trim());
  if (!m) return color;
  const h = m[1];
  if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}${alphaHex}`;
  return `#${h}${alphaHex}`;
}
