import { getAttentionEntries } from '@/lib/attention/get-attention-entries';
import { AttentionPageClient } from './attention-client';

export default async function AttentionPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const entries = await getAttentionEntries(orgSlug);
  return <AttentionPageClient entries={entries} />;
}