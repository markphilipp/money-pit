import type { Metadata } from 'next';
import { CategoriesScreen } from '@/components/categories/CategoriesScreen';

export const metadata: Metadata = { title: 'Categories' };

export default function CategoriesPage() {
  return <CategoriesScreen />;
}
