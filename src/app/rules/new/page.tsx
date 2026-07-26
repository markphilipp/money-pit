import type { Metadata } from 'next';
import { RuleEditorScreen } from '@/components/rules/RuleEditorScreen';

export const metadata: Metadata = { title: 'New rule' };

export default function NewRulePage() {
  return <RuleEditorScreen />;
}
