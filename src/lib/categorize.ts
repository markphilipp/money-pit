import type { Categorization, RawStatementRow, Rule, Transaction } from './types';
import { OTHER_ID } from './types';
import { matchesGroup, type MatchTarget } from './rules/engine';
import { txnId, withOrdinals } from './hash';

/** First match wins, so rule order is precedence. */
export function matchRule(txn: MatchTarget, rules: Rule[]): Rule | undefined {
  return rules.find((rule) => matchesGroup(txn, rule.conditions));
}

export function matchCategory(txn: MatchTarget, rules: Rule[]): string {
  return matchRule(txn, rules)?.categoryId ?? OTHER_ID;
}

export function parseAmount(row: RawStatementRow): number {
  const debit = Number.parseFloat(row.debit) || 0;
  const credit = Number.parseFloat(row.credit) || 0;
  return debit !== 0 ? debit : credit;
}

export function parseDate(dateStr: string): Date {
  const [m, d, y] = dateStr.split('/').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toTransactions(
  rows: RawStatementRow[],
  { categories, rules }: Categorization,
  overrides: Record<string, string>,
): Transaction[] {
  const categoryIds = new Set(categories.map((c) => c.id));

  return withOrdinals(rows).map((row) => {
    const id = txnId(row, row.ordinal);
    const amount = parseAmount(row);
    const base = {
      id,
      status: row.status,
      date: parseDate(row.dateStr),
      dateStr: row.dateStr,
      description: row.description,
      amount,
      isCredit: amount < 0,
      person: row.person,
    };

    const categoryId = overrides[id] ?? matchCategory(base, rules);
    // A stale override or rule can point at a deleted category; its row shouldn't vanish from totals.
    return { ...base, categoryId: categoryIds.has(categoryId) ? categoryId : OTHER_ID };
  });
}
