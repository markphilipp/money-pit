export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'category'
  );
}

/** Ids can become URL segments under /rules/, where `new` is already the create route. */
const RESERVED = ['new'];

export function uniqueId(name: string, taken: string[]): string {
  const base = slugify(name);
  let id = base;
  for (let n = 2; taken.includes(id) || RESERVED.includes(id); n++) id = `${base}-${n}`;
  return id;
}

/**
 * Random rather than a slug, since several rules can file into one category, and a slug would
 * collide with another session's rule of the same name when a session is claimed into an account.
 */
export function newRuleId(taken: string[]): string {
  let id: string;
  do id = crypto.randomUUID().slice(0, 8);
  while (taken.includes(id));
  return id;
}
