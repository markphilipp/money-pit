import type { CategoryRule, RawStatementRow, Transaction } from './types';
import { OTHER_ID } from './types';
import { rowKey, txnId } from './hash';

export function matchRule(description: string, rules: CategoryRule[]): string {
  const upper = description.toUpperCase();
  for (const rule of rules) {
    if (rule.keywords.some((k) => k && upper.includes(k.toUpperCase()))) return rule.id;
  }
  return OTHER_ID;
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
  rules: CategoryRule[],
  overrides: Record<string, string>,
): Transaction[] {
  const ordinals = new Map<string, number>();
  const ruleIds = new Set(rules.map((r) => r.id));

  return rows.map((row) => {
    const key = rowKey(row);
    const ordinal = ordinals.get(key) ?? 0;
    ordinals.set(key, ordinal + 1);

    const id = txnId(row, ordinal);
    const amount = parseAmount(row);
    const override = overrides[id];
    const categoryId = override
      ? ruleIds.has(override)
        ? override
        : OTHER_ID
      : matchRule(row.description, rules);

    return {
      id,
      status: row.status,
      date: parseDate(row.dateStr),
      dateStr: row.dateStr,
      description: row.description,
      amount,
      isCredit: amount < 0,
      person: row.person,
      categoryId,
    };
  });
}
