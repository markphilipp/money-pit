import type { Metadata } from 'next';
import { RulesScreen } from '@/components/rules/RulesScreen';

export const metadata: Metadata = { title: 'Rules' };

export default function RulesPage() {
  return <RulesScreen />;
}
