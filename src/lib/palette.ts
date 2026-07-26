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
];

export function nextPaletteColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()));
  return PALETTE.find((c) => !taken.has(c.toLowerCase())) ?? PALETTE[used.length % PALETTE.length];
}
