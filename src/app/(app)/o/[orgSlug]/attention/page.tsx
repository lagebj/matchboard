import { requireCoachAccess } from '@/lib/auth';
import { getAttentionEntries } from '@/lib/attention/get-attention-entries';
import { AttentionPageClient } from './attention-client';

export default async function AttentionPage() {
  const entries = await getAttentionEntries();
  return <AttentionPageClient entries={entries} />;
}