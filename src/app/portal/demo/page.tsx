import type { Metadata } from 'next';
import DemoPortal from '@/components/portal/DemoPortal';

export const metadata: Metadata = {
  title: 'Demo Portal | DeltaX College Consulting',
  description: 'Explore the DeltaX student portal with fictional sample data.',
};

export default async function DemoPortalPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <DemoPortal initialRole={params.as === 'counselor' ? 'counselor' : 'student'} />;
}
