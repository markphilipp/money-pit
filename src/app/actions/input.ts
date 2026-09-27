import { z } from 'zod';
import type {
  DateOperator,
  NumberOperator,
  PersonOperator,
  RuleGroup,
  TextOperator,
} from '@/lib/rules/types';
import { OTHER_ID, PAYMENTS_ID } from '@/lib/types';
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

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Color must be a 6-digit hex value.');

export const categorizationInput = z
  .object({
    categories: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string(),
          color: hexColor,
          builtin: z.boolean().optional(),
        }),
      )
      .min(1, 'At least one category is required.'),
    rules: z.array(
      z.object({
        id: z.string().min(1),
        categoryId: z.string().min(1),
        conditions: ruleGroup,
        builtin: z.boolean().optional(),
      }),
    ),
  })
  .refine(
    ({ categories }) => new Set(categories.map((c) => c.id)).size === categories.length,
    'Category ids must be unique.',
  )
  .refine(
    ({ categories }) =>
      categories.some((c) => c.id === PAYMENTS_ID && c.builtin) &&
      categories.some((c) => c.id === OTHER_ID && c.builtin),
    'The builtin Payments and Other categories are required.',
  )
  .refine(({ categories, rules }) => {
    const ids = new Set(categories.map((c) => c.id));
    return rules.every((r) => ids.has(r.categoryId));
  }, 'Every rule must file into a known category.');

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
  personChartMode: oneOf<ChartMode>({ donut: true, bar: true }),
  sortKey: oneOf<SortKey>({
    date: true,
    description: true,
    category: true,
    person: true,
    amount: true,
  }),
  sortDir: z.union([z.literal(1), z.literal(-1)]),
});
