'use server';

import { getAttentionEntries } from '@/lib/attention/get-attention-entries';
import { requireActorContext } from '@/lib/auth/actor-context';

export async function getAttentionEntriesAction(orgSlug: string) {
  await requireActorContext(orgSlug);
  return getAttentionEntries(orgSlug);
}