'use client';

import { useMemo } from 'react';
import type { Transaction } from '@/lib/types';
import { useAppStore } from './useAppStore';
import {
  selectFiltered,
  selectPersonColors,
  selectPersons,
  selectTransactions,
  sortTransactions,
  type FilterOpts,
} from './selectors';

/**
 * The whole store drives every view here, so components subscribe to all of it and memoize
 * the derivations instead of returning freshly-allocated arrays from zustand selectors
 * (which would break the store's snapshot equality check).
 */
export function useAppState() {
  return useAppStore();
}

export function useTransactions(): Transaction[] {
  const state = useAppState();
  return selectTransactions(state);
}

export function useFiltered(opts: FilterOpts = {}): Transaction[] {
  const state = useAppState();
  const { ignoreCategory, ignorePerson } = opts;
  return useMemo(
    () => selectFiltered(state, { ignoreCategory, ignorePerson }),
    [state, ignoreCategory, ignorePerson],
  );
}

export function useSortedFiltered(): Transaction[] {
  const state = useAppState();
  const filtered = useFiltered();
  return useMemo(
    () => sortTransactions(filtered, state.sort, state.rules),
    [filtered, state.sort, state.rules],
  );
}

export function usePersons() {
  const state = useAppState();
  return useMemo(() => selectPersons(state), [state]);
}

export function usePersonColors() {
  const state = useAppState();
  return useMemo(() => selectPersonColors(state), [state]);
}
