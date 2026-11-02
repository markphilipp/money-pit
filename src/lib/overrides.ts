export type OverrideSnapshot = Record<string, string | undefined>;

/** What each id's override was, with `undefined` for an id that had none. */
export function snapshotOverrides(
  overrides: Record<string, string>,
  ids: string[],
): OverrideSnapshot {
  return Object.fromEntries(ids.map((id) => [id, overrides[id]]));
}

/** Puts every snapshotted id back to its prior override, deleting those that had none. */
export function applyOverrideSnapshot(
  overrides: Record<string, string>,
  snapshot: OverrideSnapshot,
): Record<string, string> {
  const next = { ...overrides };
  for (const [id, categoryId] of Object.entries(snapshot)) {
    if (categoryId === undefined) delete next[id];
    else next[id] = categoryId;
  }
  return next;
}
