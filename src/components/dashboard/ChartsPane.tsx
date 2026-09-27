'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useHeightVar } from '@/hooks/useHeightVar';
import {
  KEY_STEP,
  MIN_PANE_HEIGHT,
  clampPaneHeight,
  defaultPaneState,
  maxPaneHeight,
  parsePaneState,
  type ChartsPaneState,
} from '@/lib/chartsPane';
import styles from './ChartsPane.module.css';

const STORAGE_KEY = 'money-pit:charts-pane';

function readStored(): ChartsPaneState {
  const vh = window.innerHeight;
  try {
    return parsePaneState(window.localStorage.getItem(STORAGE_KEY), vh);
  } catch {
    return defaultPaneState(vh);
  }
}

export function ChartsPane({ children }: { children: ReactNode }) {
  const wrapperRef = useHeightVar('--charts-h');
  const [state, setState] = useState<ChartsPaneState>(readStored);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const setHeight = useCallback((height: number) => {
    setState({ height: clampPaneHeight(height, window.innerHeight), minimized: false });
  }, []);

  const height = clampPaneHeight(state.height, viewportHeight);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (state.minimized) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startHeight: height };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setHeight(drag.current.startHeight + e.clientY - drag.current.startY);
  };
  const endDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? KEY_STEP * 3 : KEY_STEP;
    const next =
      e.key === 'ArrowDown'
        ? height + step
        : e.key === 'ArrowUp'
          ? height - step
          : e.key === 'Home'
            ? MIN_PANE_HEIGHT
            : e.key === 'End'
              ? maxPaneHeight(viewportHeight)
              : null;
    if (next === null) return;
    e.preventDefault();
    setHeight(next);
  };

  const toggle = () => setState((s) => ({ ...s, minimized: !s.minimized }));

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <div
        id="charts-pane"
        className={styles.pane}
        style={
          { '--charts-pane-h': state.minimized ? '0px' : `${height}px` } as React.CSSProperties
        }
        aria-hidden={state.minimized}
        inert={state.minimized}
      >
        {children}
      </div>
      <div className={styles.bar}>
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize charts"
          aria-controls="charts-pane"
          aria-valuemin={MIN_PANE_HEIGHT}
          aria-valuemax={maxPaneHeight(viewportHeight)}
          aria-valuenow={state.minimized ? 0 : height}
          tabIndex={state.minimized ? -1 : 0}
          className={styles.handle}
          data-minimized={state.minimized}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
        >
          <span className={styles.grip} />
        </div>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={!state.minimized}
          aria-controls="charts-pane"
          onClick={toggle}
        >
          {state.minimized ? 'Show charts' : 'Hide charts'}
        </button>
      </div>
    </div>
  );
}
