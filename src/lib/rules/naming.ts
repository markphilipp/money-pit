export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'category'
  );
}

/** Ids become URL segments under /rules/, where `new` is already the create route. */
const RESERVED = ['new'];

export function uniqueRuleId(name: string, taken: string[]): string {
  const base = slugify(name);
  let id = base;
  for (let n = 2; taken.includes(id) || RESERVED.includes(id); n++) id = `${base}-${n}`;
  return id;
}
