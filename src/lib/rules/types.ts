export type TextOperator =
  'contains' | 'notContains' | 'equals' | 'beginsWith' | 'endsWith' | 'regex' | 'glob';
export type NumberOperator = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'between';
export type DateOperator = 'on' | 'before' | 'after' | 'between';
export type PersonOperator = 'is' | 'isNot';

export type Condition =
  | { field: 'description'; operator: TextOperator; value: string }
  | { field: 'amount'; operator: NumberOperator; value: number; value2?: number }
  | { field: 'person'; operator: PersonOperator; value: string }
  | { field: 'date'; operator: DateOperator; value: string; value2?: string }; // yyyy-mm-dd

export interface RuleGroup {
  combinator: 'and' | 'or';
  rules: (Condition | RuleGroup)[];
}

export type ColumnId = 'date' | 'description' | 'category' | 'person' | 'amount';

export type ColumnFilter =
  | { column: 'description'; operator: TextOperator; value: string }
  | { column: 'amount'; operator: NumberOperator; value: number; value2?: number }
  | { column: 'date'; operator: DateOperator; value: string; value2?: string }
  | { column: 'person'; values: string[] }
  | { column: 'category'; values: string[] };
