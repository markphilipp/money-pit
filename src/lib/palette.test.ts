import { describe, expect, it } from 'vitest';
import { PALETTE, nextPaletteColor } from './palette';

describe('palette', () => {
  it('has no duplicate swatches', () => {
    expect(new Set(PALETTE.map((c) => c.toLowerCase())).size).toBe(PALETTE.length);
  });

  it('picks the first unused swatch', () => {
    expect(nextPaletteColor([])).toBe(PALETTE[0]);
    expect(nextPaletteColor([PALETTE[0].toLowerCase()])).toBe(PALETTE[1]);
  });

  it('never repeats a color once the palette is exhausted', () => {
    const used: string[] = [];
    for (let i = 0; i < PALETTE.length + 60; i++) used.push(nextPaletteColor(used));
    expect(new Set(used.map((c) => c.toLowerCase())).size).toBe(used.length);
    expect(used.at(-1)).toMatch(/^#[0-9A-F]{6}$/);
  });
});
