import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { UNDO_TOAST_MS, UndoToast } from './UndoToast';

const setup = () => {
  const onUndo = vi.fn();
  const onDismiss = vi.fn();
  const view = render(
    <UndoToast
      message="Categorized 2 transactions as Pets"
      onUndo={onUndo}
      onDismiss={onDismiss}
    />,
  );
  return { onUndo, onDismiss, view };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('UndoToast', () => {
  it('announces the message politely', () => {
    setup();
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Categorized 2 transactions as Pets');
  });

  it('undoes on click without dismissing by itself', () => {
    const { onUndo, onDismiss } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses from the dismiss button', () => {
    const { onDismiss } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('dismisses itself after the timeout', () => {
    const { onDismiss } = setup();
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS - 1));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('holds the timer while hovered and restarts it on leave', () => {
    const { onDismiss } = setup();
    const toast = screen.getByRole('status');
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS * 2));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('holds the timer while focus is inside', () => {
    const { onDismiss } = setup();
    fireEvent.focus(screen.getByRole('button', { name: 'Undo' }));
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS * 2));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('keeps its timer across parent re-renders with a new callback', () => {
    const { view, onDismiss } = setup();
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS - 1000));
    const next = vi.fn();
    view.rerender(
      <UndoToast message="Categorized 2 transactions as Pets" onUndo={vi.fn()} onDismiss={next} />,
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });
});
