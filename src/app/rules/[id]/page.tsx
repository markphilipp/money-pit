import type { Metadata } from 'next';
import { RuleForm } from '@/components/rules/RuleForm';

export const metadata: Metadata = { title: 'Edit rule' };

/**
 * Rule ids are minted in the browser, so there is no set of params to pre-render — this segment
 * is server-rendered on demand and the rule itself is resolved after hydration.
 */
export default async function EditRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RuleForm ruleId={decodeURIComponent(id)} />;
}
