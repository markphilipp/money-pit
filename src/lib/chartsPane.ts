export interface ChartsPaneState {
  height: number;
  minimized: boolean;
}

export const MIN_PANE_HEIGHT = 160;
export const KEY_STEP = 20;

const MAX_VIEWPORT_FRACTION = 0.6;
const DEFAULT_VIEWPORT_FRACTION = 0.4;
const DEFAULT_MAX = 360;

export function maxPaneHeight(viewportHeight: number): number {
  return Math.max(MIN_PANE_HEIGHT, Math.round(viewportHeight * MAX_VIEWPORT_FRACTION));
}

export function clampPaneHeight(height: number, viewportHeight: number): number {
  return Math.min(maxPaneHeight(viewportHeight), Math.max(MIN_PANE_HEIGHT, Math.round(height)));
}

export function defaultPaneState(viewportHeight: number): ChartsPaneState {
  return {
    height: clampPaneHeight(
      Math.min(DEFAULT_MAX, viewportHeight * DEFAULT_VIEWPORT_FRACTION),
      viewportHeight,
    ),
    minimized: false,
  };
}

export function parsePaneState(raw: string | null, viewportHeight: number): ChartsPaneState {
  const fallback = defaultPaneState(viewportHeight);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const { height, minimized } = parsed as Record<string, unknown>;
    return {
      height:
        typeof height === 'number' && Number.isFinite(height)
          ? clampPaneHeight(height, viewportHeight)
          : fallback.height,
      minimized: minimized === true,
    };
  } catch {
    return fallback;
  }
}
