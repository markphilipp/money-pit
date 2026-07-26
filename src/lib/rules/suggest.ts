import type { Condition, RuleGroup } from './types';
import { matchesGroup, transactionsToDraftGroup, type MatchTarget } from './engine';

export type SuggestionKind = 'token-core' | 'common-substring' | 'or-of-clusters' | 'exact-or';

export interface Suggestion {
  kind: SuggestionKind;
  group: RuleGroup;
  /** Short phrase for the suggestion card, e.g. `contains “HARRIS TEETER”`. */
  label: string;
  /** Category name to pre-fill; empty when nothing was induced. */
  name: string;
  selectedMatched: number;
  /** Matches elsewhere in the corpus. Assumes `selected` is a subset of `all`. */
  othersMatched: number;
}

type TokenKind = 'word' | 'marker' | 'numeric' | 'alnumId' | 'state' | 'noise';

interface Token {
  text: string;
  start: number;
  end: number;
  /** Position in the whole descriptor, so a run can inspect the tokens filtering dropped. */
  index: number;
  kind: TokenKind;
}

interface Example {
  description: string;
  tokens: Token[];
}

/** Wallet/processor/POS prefixes — only stripped at the head of a descriptor, never mid-string. */
const MARKERS = new Set([
  'SQ',
  'TST',
  'PAYPAL',
  'PP',
  'POS',
  'ACH',
  'ATM',
  'WD',
  'DEBIT',
  'CREDIT',
  'CHECKCARD',
  'PURCHASE',
  'AUTHORIZED',
  'RECURRING',
  'PYMT',
  'PMNT',
]);

const NOISE_WORDS = new Set(['US', 'USA', 'COM', 'WWW', 'INC', 'LLC', 'LTD', 'CO', 'THE']);

// prettier-ignore
const STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR',
  'PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]);

const TOKEN_RE = /[^\s*#\-_,;:|/\\()[\]]+/g;

const MARKER_HEAD = 2;
const MIN_VALUE_LENGTH = 4;
const CLUSTER_SIMILARITY = 0.5;
const MAX_CLUSTERS = 4;
const MAX_SUGGESTIONS = 3;

function kindOf(text: string, index: number, count: number): TokenKind {
  const up = text.toUpperCase();
  if (index < MARKER_HEAD && MARKERS.has(up)) return 'marker';
  if (/^[\d.]+$/.test(up)) return 'numeric';
  if (up.length >= 5 && /[A-Z]/.test(up) && /\d/.test(up)) return 'alnumId';
  if (up.length === 2 && STATES.has(up) && index >= count - 2) return 'state';
  if (NOISE_WORDS.has(up)) return 'noise';
  return 'word';
}

function tokenize(description: string): Token[] {
  const raw: Omit<Token, 'kind'>[] = [];
  for (const m of description.matchAll(TOKEN_RE)) {
    raw.push({ text: m[0], start: m.index, end: m.index + m[0].length, index: raw.length });
  }
  const tokens = raw.map((t, i) => ({ ...t, kind: kindOf(t.text, i, raw.length) }));

  // `HARRIS TEETER #0042 CHARLOTTE NC` — the word before a trailing state is almost always the city.
  const last = tokens.at(-1);
  const beforeLast = tokens.at(-2);
  if (last?.kind === 'state' && beforeLast?.kind === 'word') beforeLast.kind = 'noise';

  return tokens;
}

/** Maximal runs of tokens that survive filtering; a run is always contiguous in the raw string. */
function segmentsOf(tokens: Token[], contentOnly: boolean): Token[][] {
  if (!contentOnly) return tokens.length ? [tokens] : [];
  const out: Token[][] = [];
  let run: Token[] = [];
  for (const token of tokens) {
    if (token.kind === 'word') run.push(token);
    else if (run.length) {
      out.push(run);
      run = [];
    }
  }
  if (run.length) out.push(run);
  return out;
}

const textsOf = (segment: Token[]) => segment.map((t) => t.text.toUpperCase());

function runStarts(segment: Token[], run: string[]): number[] {
  const texts = textsOf(segment);
  const starts: number[] = [];
  for (let i = 0; i + run.length <= texts.length; i++) {
    if (run.every((r, k) => texts[i + k] === r)) starts.push(i);
  }
  return starts;
}

/** Every token run of the first example that also appears in all the others, longest first. */
function commonRuns(perExample: Token[][][]): string[][] {
  const [first, ...rest] = perExample;
  if (!first) return [];
  const runs: string[][] = [];
  for (const segment of first) {
    const texts = textsOf(segment);
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j <= texts.length; j++) runs.push(texts.slice(i, j));
    }
  }
  runs.sort((a, b) => b.length - a.length);
  return runs.filter((run) =>
    rest.every((segments) => segments.some((s) => runStarts(s, run).length > 0)),
  );
}

interface Candidate {
  value: string;
  tokens: Token[];
}

/**
 * A run flanked by another content word has cut a phrase in half (`ONLINE PAYMENT, THANK` out of
 * `ONLINE PAYMENT, THANK YOU`). Only runs that stop at dropped noise or at the ends of the
 * descriptor are real merchant cores.
 */
function isWordBounded(example: Example, tokens: Token[]): boolean {
  const before = example.tokens[tokens[0].index - 1];
  const after = example.tokens[tokens.at(-1)!.index + 1];
  return before?.kind !== 'word' && after?.kind !== 'word';
}

function slicesFor(example: Example, segments: Token[][], run: string[]): Candidate[] {
  const out: Candidate[] = [];
  for (const segment of segments) {
    for (const start of runStarts(segment, run)) {
      const tokens = segment.slice(start, start + run.length);
      if (!isWordBounded(example, tokens)) continue;
      out.push({ value: example.description.slice(tokens[0].start, tokens.at(-1)!.end), tokens });
    }
  }
  return out;
}

function isUsable(candidate: Candidate, examples: Example[]): boolean {
  const value = candidate.value.trim();
  if (value.length < MIN_VALUE_LENGTH) return false;
  if (!candidate.tokens.some((t) => t.kind === 'word')) return false;
  if (/\d$/.test(value)) return false;
  const letters = value.match(/[A-Za-z]/g)?.length ?? 0;
  if (letters * 2 < value.length) return false;

  const upper = value.toUpperCase();
  // Reproducing a whole descriptor verbatim generalizes nothing — that is what `exact-or` is for.
  if (examples.some((e) => e.description.toUpperCase() === upper)) return false;
  return examples.every((e) => e.description.toUpperCase().includes(upper));
}

/** The most specific literal every example shares; `contentOnly` drops ids, cities and markers. */
function coreValue(examples: Example[], contentOnly: boolean): string | null {
  const perExample = examples.map((e) => segmentsOf(e.tokens, contentOnly));
  for (const run of commonRuns(perExample)) {
    const perExampleSlices = examples.map((e, i) => slicesFor(e, perExample[i], run));
    if (perExampleSlices.some((slices) => !slices.length)) continue;
    const usable = perExampleSlices.flat().filter((c) => isUsable(c, examples));
    if (usable.length) {
      return usable.sort((a, b) => a.value.length - b.value.length)[0].value;
    }
  }
  return null;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const value of a) if (b.has(value)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Single-linkage over content-token overlap; selections are small, so O(n²) is free. */
function clusterExamples(examples: Example[]): Example[][] {
  const parent = examples.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const sets = examples.map(
    (e) => new Set(e.tokens.filter((t) => t.kind === 'word').map((t) => t.text.toUpperCase())),
  );
  for (let i = 0; i < examples.length; i++) {
    for (let j = i + 1; j < examples.length; j++) {
      if (jaccard(sets[i], sets[j]) >= CLUSTER_SIMILARITY) parent[find(i)] = find(j);
    }
  }
  const byRoot = new Map<number, Example[]>();
  examples.forEach((example, i) => {
    const root = find(i);
    const bucket = byRoot.get(root);
    if (bucket) bucket.push(example);
    else byRoot.set(root, [example]);
  });
  return [...byRoot.values()];
}

const containsCondition = (value: string): Condition => ({
  field: 'description',
  operator: 'contains',
  value,
});

function orGroup(values: string[]): RuleGroup {
  const seen: string[] = [];
  for (const value of values) {
    if (!seen.some((v) => v.toUpperCase() === value.toUpperCase())) seen.push(value);
  }
  return { combinator: 'or', rules: seen.map(containsCondition) };
}

function conditionValues(group: RuleGroup): string[] {
  return group.rules.flatMap((node) =>
    'combinator' in node || node.field !== 'description' ? [] : [node.value],
  );
}

function labelFor(kind: SuggestionKind, group: RuleGroup): string {
  const values = conditionValues(group);
  if (kind === 'exact-or') {
    return values.length === 1
      ? 'the exact description'
      : `one condition per description (${values.length})`;
  }
  return `contains ${values.map((v) => `“${v}”`).join(' or ')}`;
}

/** Bank descriptors shout; title-case them, but leave anything already mixed-case alone. */
function nameFor(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) =>
      word === word.toUpperCase() ? word.charAt(0) + word.slice(1).toLowerCase() : word,
    )
    .join(' ');
}

const groupKey = (group: RuleGroup) =>
  conditionValues(group)
    .map((v) => v.toUpperCase())
    .join(' ');

function toSuggestion(
  kind: SuggestionKind,
  group: RuleGroup,
  name: string,
  selected: MatchTarget[],
  all: MatchTarget[],
): Suggestion | null {
  const selectedMatched = selected.filter((t) => matchesGroup(t, group)).length;
  if (!group.rules.length || selectedMatched < selected.length) return null;
  const totalMatched = all.filter((t) => matchesGroup(t, group)).length;
  return {
    kind,
    group,
    label: labelFor(kind, group),
    name,
    selectedMatched,
    othersMatched: Math.max(0, totalMatched - selectedMatched),
  };
}

/**
 * Rank 1–3 induced description rules for a selection, always followed by the literal
 * one-condition-per-description fallback. Candidates must match every selected transaction.
 */
export function suggestRuleGroups(selected: MatchTarget[], all: MatchTarget[]): Suggestion[] {
  const examples: Example[] = selected
    .map((t) => t.description.trim())
    .filter(Boolean)
    .map((description) => ({ description, tokens: tokenize(description) }));

  const induced: Suggestion[] = [];
  const push = (kind: SuggestionKind, values: string[], name: string) => {
    const suggestion = toSuggestion(kind, orGroup(values), name, selected, all);
    if (suggestion) induced.push(suggestion);
  };

  if (examples.length) {
    const core = coreValue(examples, true);
    if (core) push('token-core', [core], nameFor(core));

    const span = coreValue(examples, false);
    if (span && span.toUpperCase() !== core?.toUpperCase()) {
      push('common-substring', [span], nameFor(span));
    }

    const clusters = clusterExamples(examples);
    if (clusters.length > 1 && clusters.length <= MAX_CLUSTERS) {
      const perCluster = clusters.map((cluster) => ({
        value: coreValue(cluster, true) ?? coreValue(cluster, false),
        cluster,
      }));
      if (perCluster.some((c) => c.value)) {
        const values = perCluster.flatMap(({ value, cluster }) =>
          value ? [value] : cluster.map((e) => e.description),
        );
        push('or-of-clusters', values, nameFor(perCluster.find((c) => c.value)!.value!));
      }
    }
  }

  const ranked: Suggestion[] = [];
  const seen = new Set<string>();
  for (const suggestion of induced) {
    const key = groupKey(suggestion.group);
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push(suggestion);
    if (ranked.length === MAX_SUGGESTIONS) break;
  }

  const exact = toSuggestion('exact-or', transactionsToDraftGroup(selected), '', selected, all);
  if (exact && !seen.has(groupKey(exact.group))) ranked.push(exact);

  return ranked;
}
