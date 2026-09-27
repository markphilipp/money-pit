import { keywordsToGroup } from './rules/engine';
import type { Categorization, Category, Rule } from './types';
import { OTHER_ID } from './types';

interface Seed extends Category {
  keywords: string[];
}

const seeds: Seed[] = [
  {
    id: 'home',
    name: 'Home Improvement',
    color: '#E8641B',
    keywords: ['LOWE', 'LOWES', 'HOME DEPOT', 'ACE HARDWARE'],
  },
  {
    id: 'grocery',
    name: 'Groceries',
    color: '#2E7D5B',
    keywords: ['WALMART.COM', 'WALMART ', 'WALMART+ INHOME', 'HARRIS TEETER', 'KROGER', 'ALDI'],
  },
  {
    id: 'dining',
    name: 'Dining & Fast Food',
    color: '#C94F3D',
    keywords: [
      'MCDONALD',
      'TACO BELL',
      'ARBYS',
      'KFC',
      'JERSEY MIKE',
      'CHICK-FIL-A',
      'STARBUCKS',
      'TST*',
      'FIREHOUSE RESTAURA',
      'INSOMNIA COOKIES',
      'CANTEEN VENDING',
    ],
  },
  {
    id: 'amazon',
    name: 'Amazon',
    color: '#D9A036',
    keywords: ['AMAZON', 'AMZN'],
  },
  {
    id: 'pets',
    name: 'Pets',
    color: '#7B5CB8',
    keywords: ['CHEWY', 'PETSMART', 'PETCO'],
  },
  {
    id: 'subs',
    name: 'Subscriptions & Software',
    color: '#3A7CA5',
    keywords: [
      'APPLE.COM/BILL',
      'PEACOCK',
      'HULU',
      'NETFLIX',
      'FOX ONE',
      'SPOTIFY',
      'NETLIFY',
      'CURSOR',
      'ANTHROPIC',
      'GITHUB',
      'WALMART+ MEMBER',
    ],
  },
  {
    id: 'auto',
    name: 'Auto & Fuel',
    color: '#4A4E57',
    keywords: ['TESLA', 'ADVANCE AUTO', 'QT ', 'EXXON', 'SHELL OIL', "LOVE'S", 'STATE FARM', 'DMV'],
  },
  {
    id: 'util',
    name: 'Utilities & Phone',
    color: '#1F6F8B',
    keywords: ['DUKE-ENERGY', 'AT&T', 'ATT*', 'SPECTRUM', 'VERIZON', 'COMCAST'],
  },
  {
    id: 'health',
    name: 'Health & Wellness',
    color: '#5F9E62',
    keywords: ['CVS/PHARMACY', 'WALGREENS', 'RITE AID'],
  },
  {
    id: 'care',
    name: 'Personal Care & Clothing',
    color: '#B85C8A',
    keywords: ['FABLETICS', 'ULTA', 'SEPHORA', 'OLD NAVY'],
  },
  {
    id: 'payments',
    name: 'Payments',
    color: '#9AA39C',
    keywords: ['ONLINE PAYMENT', 'PAYMENT THANK YOU', 'AUTOPAY'],
    builtin: true,
  },
  {
    id: 'other',
    name: 'Other',
    color: '#8A8F98',
    keywords: [],
    builtin: true,
  },
];

export const defaultCategories: Category[] = seeds.map(({ keywords: _, ...category }) => category);

// Other is the fallback for anything no rule claims, so it has no rule of its own.
export const defaultRules: Rule[] = seeds
  .filter((seed) => seed.id !== OTHER_ID)
  .map(({ id, keywords, builtin }) => ({
    id,
    categoryId: id,
    conditions: keywordsToGroup(keywords),
    ...(builtin && { builtin }),
  }));

export const defaultCategorization: Categorization = {
  categories: defaultCategories,
  rules: defaultRules,
};
