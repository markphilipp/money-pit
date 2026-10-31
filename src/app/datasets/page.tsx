import type { Metadata } from 'next';
import { DatasetsScreen } from '@/components/datasets/DatasetsScreen';

export const metadata: Metadata = { title: 'Uploaded files' };

export default function DatasetsPage() {
  return <DatasetsScreen />;
}
