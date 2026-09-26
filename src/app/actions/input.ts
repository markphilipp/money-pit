import { z } from 'zod';
import type {
  DateOperator,
  NumberOperator,
  PersonOperator,
  RuleGroup,
  TextOperator,
} from '@/lib/rules/types';
import type { ChartMode, SortKey } from '@/lib/types';

// A Record forces every member of the union to be listed, so a new operator can't be silently
// rejected here.
const oneOf = <T extends string>(members: Record<T, true>) =>
  z.enum(Object.keys(members) as [T, ...T[]]);

const condition = z.discriminatedUnion('field', [
  z.object({
    field: z.literal('description'),
    operator: oneOf<TextOperator>({
      contains: true,
      notContains: true,
      equals: true,
      beginsWith: true,
      endsWith: true,
      regex: true,
      glob: true,
    }),
    value: z.string(),
  }),
  z.object({
    field: z.literal('amount'),
    operator: oneOf<NumberOperator>({
      eq: true,
      neq: true,
      lt: true,
      lte: true,
      gt: true,
      gte: true,
      between: true,
    }),
    value: z.number(),
    value2: z.number().optional(),
  }),
  z.object({
    field: z.literal('person'),
    operator: oneOf<PersonOperator>({ is: true, isNot: true }),
    value: z.string(),
  }),
  z.object({
    field: z.literal('date'),
    operator: oneOf<DateOperator>({ on: true, before: true, after: true, between: true }),
    value: z.string(),
    value2: z.string().optional(),
  }),
]);

const ruleGroup: z.ZodType<RuleGroup> = z.lazy(() =>
  z.object({
    combinator: z.enum(['and', 'or']),
    rules: z.array(z.union([condition, ruleGroup])),
  }),
);

export const rulesInput = z.array(
  z.object({
    id: z.string().min(1),
    name: z.string(),
    color: z.string(),
    conditions: ruleGroup,
    builtin: z.boolean().optional(),
  }),
);

export const rowsInput = z.array(
  z.object({
    status: z.string(),
    dateStr: z.string(),
    description: z.string(),
    debit: z.string(),
    credit: z.string(),
    person: z.string(),
    ordinal: z.number().int().nonnegative(),
    categoryOverride: z.string().nullable(),
  }),
);

export const preferenceInput = z.object({
  chartMode: oneOf<ChartMode>({ donut: true, bar: true }),
  sortKey: oneOf<SortKey>({
    date: true,
    description: true,
    category: true,
    person: true,
    amount: true,
  }),
  sortDir: z.union([z.literal(1), z.literal(-1)]),
});
