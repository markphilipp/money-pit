export const PALETTE: readonly string[] = [
  '#E8641B',
  '#D94A3D',
  '#C2385F',
  '#A34A8E',
  '#7B5CB8',
  '#5A63C7',
  '#3A7CA5',
  '#1F6F8B',
  '#1E8E82',
  '#3E9B5F',
  '#5F9E62',
  '#8AA53A',
  '#B8992E',
  '#C97B23',
  '#8C6D5C',
  '#9D5B4D',
  '#527A9E',
  '#6E8B74',
  '#6B7280',
  '#4C5B70',
  '#F2A33A',
  '#E57C7C',
  '#E0709B',
  '#C86DD7',
  '#9A7FE0',
  '#7C8CF0',
  '#5BA8E0',
  '#3FB5C4',
  '#34B39A',
  '#5DBB7E',
  '#8FCB5A',
  '#D4C23A',
  '#B5651D',
  '#8A2F3C',
  '#6A3F8E',
  '#2F4F9E',
  '#1B5E5A',
  '#2F6B3A',
  '#7A7A2E',
  '#A0A8B8',
];

const GOLDEN_ANGLE = 137.508;

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
}

/** Past the fixed palette, spreads hues by the golden angle so new colors stay apart from each other. */
export function generatedColor(index: number): string {
  const hue = (index * GOLDEN_ANGLE) % 360;
  const lightness = [0.5, 0.42, 0.58][index % 3];
  return hslToHex(hue, 0.58, lightness);
}

export function nextPaletteColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()));
  const fixed = PALETTE.find((c) => !taken.has(c.toLowerCase()));
  if (fixed) return fixed;
  for (let i = 0; ; i++) {
    const color = generatedColor(i);
    if (!taken.has(color.toLowerCase())) return color;
  }
}
