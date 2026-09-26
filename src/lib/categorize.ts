import type { CategoryRule, RawStatementRow, Transaction } from './types';
import { OTHER_ID } from './types';
import { matchesGroup, type MatchTarget } from './rules/engine';
import { txnId, withOrdinals } from './hash';

export function matchCategory(txn: MatchTarget, rules: CategoryRule[]): string {
  return rules.find((rule) => matchesGroup(txn, rule.conditions))?.id ?? OTHER_ID;
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
  const ruleIds = new Set(rules.map((r) => r.id));

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

    const override = overrides[id];
    return {
      ...base,
      categoryId: override
        ? ruleIds.has(override)
          ? override
          : OTHER_ID
        : matchCategory(base, rules),
    };
  });
}
