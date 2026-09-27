import { describe, expect, it } from 'vitest';
import {
  MIN_PANE_HEIGHT,
  clampPaneHeight,
  defaultPaneState,
  maxPaneHeight,
  parsePaneState,
} from './chartsPane';

describe('chartsPane', () => {
  it('clamps between the minimum and a fraction of the viewport', () => {
    expect(clampPaneHeight(10, 800)).toBe(MIN_PANE_HEIGHT);
    expect(clampPaneHeight(9999, 800)).toBe(maxPaneHeight(800));
    expect(clampPaneHeight(300, 800)).toBe(300);
  });

  it('defaults smaller on short viewports', () => {
    expect(defaultPaneState(720).height).toBeLessThan(defaultPaneState(1400).height);
    expect(defaultPaneState(1400).height).toBe(360);
  });

  it('parses stored state and falls back on junk', () => {
    expect(parsePaneState('{"height":250,"minimized":true}', 800)).toEqual({
      height: 250,
      minimized: true,
    });
    expect(parsePaneState('nope', 800)).toEqual(defaultPaneState(800));
    expect(parsePaneState('{"height":"x"}', 800).height).toBe(defaultPaneState(800).height);
    expect(parsePaneState(null, 800)).toEqual(defaultPaneState(800));
  });
});
