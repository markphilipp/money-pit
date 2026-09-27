import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import type { RuleGroup } from '@/lib/rules/types';
import type { ChartMode, SortKey } from '@/lib/types';
import { user } from './auth';

const userId = () =>
  text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' });

// No txnId column: it's a hash of these fields plus `ordinal`, and a stored copy would orphan every
// override the day the hash changes. `ORDER BY id` reproduces the client's rawRows order.
export const statementRow = pgTable(
  'statement_row',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: userId(),
    status: text('status').notNull(),
    dateStr: text('date_str').notNull(),
    description: text('description').notNull(),
    debit: text('debit').notNull(),
    credit: text('credit').notNull(),
    person: text('person').notNull(),
    ordinal: integer('ordinal').notNull(),
    // No FK to category_rule: categorization already falls back to Other for a deleted rule.
    categoryOverride: text('category_override'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    unique('statement_row_identity').on(
      t.userId,
      t.dateStr,
      t.description,
      t.debit,
      t.credit,
      t.person,
      t.ordinal,
    ),
  ],
);

export const categoryRule = pgTable(
  'category_rule',
  {
    userId: userId(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    conditions: jsonb('conditions').$type<RuleGroup>().notNull(),
    builtin: boolean('builtin').default(false).notNull(),
    position: integer('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    unique('category_rule_position').on(t.userId, t.position),
  ],
);

export const preference = pgTable('preference', {
  userId: userId().primaryKey(),
  chartMode: text('chart_mode').$type<ChartMode>().default('donut').notNull(),
  personChartMode: text('person_chart_mode').$type<ChartMode>().default('donut').notNull(),
  sortKey: text('sort_key').$type<SortKey>().default('date').notNull(),
  sortDir: smallint('sort_dir').$type<1 | -1>().default(-1).notNull(),
});
