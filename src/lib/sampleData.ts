import { EXPECTED_HEADER } from './csv';

const PEOPLE = ['ALEX SAMPLE', 'JAMIE SAMPLE'] as const;

interface Merchant {
  description: string;
  min: number;
  max: number;
  /** Charges per month. */
  perMonth: number;
}

const MERCHANTS: Merchant[] = [
  { description: 'HARRIS TEETER #0042 CHARLOTTE NC', min: 45, max: 190, perMonth: 5 },
  { description: 'WALMART.COM WALMART.COM AR', min: 20, max: 140, perMonth: 2 },
  { description: 'TACO BELL 00002 CHARLOTTE NC', min: 7, max: 22, perMonth: 4 },
  { description: 'McDonalds 00001 CHARLOTTE NC', min: 6, max: 24, perMonth: 4 },
  { description: 'STARBUCKS STORE 12345 CHARLOTTE NC', min: 4, max: 15, perMonth: 5 },
  { description: 'CHICK-FIL-A #01234 BELMONT NC', min: 9, max: 38, perMonth: 3 },
  { description: 'AMAZON MKTPL*DEMO5678 SEATTLE WA', min: 8, max: 120, perMonth: 4 },
  { description: 'LOWES #01111 BELMONT NC', min: 12, max: 260, perMonth: 2 },
  { description: 'QT 1234 CHARLOTTE NC', min: 28, max: 62, perMonth: 3 },
  { description: 'CHEWY.COM 800-672-4399 FL', min: 25, max: 95, perMonth: 1 },
  { description: 'CVS/PHARMACY #05678 BELMONT NC', min: 6, max: 48, perMonth: 1 },
  { description: 'OLD NAVY US 1234 CHARLOTTE NC', min: 24, max: 110, perMonth: 1 },
  { description: 'LOCAL HARDWARE & GARDEN BELMONT NC', min: 10, max: 75, perMonth: 1 },
];

const FIXED: { description: string; day: number; amount: number; person: number }[] = [
  { description: 'SPOTIFY USA NEW YORK NY', day: 3, amount: 13.93, person: 1 },
  { description: 'HULU 123-456-7890 CA', day: 9, amount: 17.99, person: 1 },
  { description: 'APPLE.COM/BILL CUPERTINO CA', day: 12, amount: 4.99, person: 0 },
  { description: 'DUKE-ENERGY PAYMENT NC', day: 18, amount: 142.55, person: 0 },
  { description: 'SPECTRUM 855-555-0100 CT', day: 21, amount: 89.99, person: 0 },
];

// Months are 1-based. The fixture dates are synthetic, anchored before the current date.
const MONTHS = [
  { year: 2026, month: 8 },
  { year: 2026, month: 9 },
  { year: 2026, month: 10 },
];

function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const money = (n: number) => n.toFixed(2);
const pad = (n: number) => String(n).padStart(2, '0');
const csvField = (s: string) => (/[",]/.test(s) ? `"${s}"` : s);

interface Line {
  day: number;
  description: string;
  debit?: number;
  credit?: number;
  person: string;
}

function statementLines(rand: () => number): Line[] {
  const lines: Line[] = [];
  const pick = () => PEOPLE[Math.floor(rand() * PEOPLE.length)];

  for (const m of MERCHANTS) {
    for (let i = 0; i < m.perMonth; i++) {
      lines.push({
        day: 1 + Math.floor(rand() * 28),
        description: m.description,
        debit: Number((m.min + rand() * (m.max - m.min)).toFixed(2)),
        person: pick(),
      });
    }
  }
  for (const f of FIXED) {
    lines.push({
      day: f.day,
      description: f.description,
      debit: f.amount,
      person: PEOPLE[f.person],
    });
  }
  lines.push({
    day: 28,
    description: 'ONLINE PAYMENT, THANK YOU',
    credit: -1500,
    person: PEOPLE[0],
  });
  lines.push({
    day: 15,
    description: 'AMAZON MKTPL*DEMO9012 SEATTLE WA',
    credit: -Number((10 + rand() * 40).toFixed(2)),
    person: PEOPLE[1],
  });
  return lines.sort((a, b) => b.day - a.day);
}

function toCsv(year: number, month: number, lines: Line[]): string {
  const rows = lines.map((l) =>
    [
      'Cleared',
      `${pad(month)}/${pad(l.day)}/${year}`,
      csvField(l.description),
      l.debit === undefined ? '' : money(l.debit),
      l.credit === undefined ? '' : money(l.credit),
      l.person,
    ].join(','),
  );
  return [EXPECTED_HEADER.join(','), ...rows].join('\n');
}

/** Synthetic statements, deterministic so every preview shows the same numbers. */
export function sampleStatements(): { name: string; text: string }[] {
  return MONTHS.map(({ year, month }) => ({
    name: `sample-${year}-${pad(month)}.csv`,
    text: toCsv(year, month, statementLines(prng(year * 100 + month))),
  }));
}
