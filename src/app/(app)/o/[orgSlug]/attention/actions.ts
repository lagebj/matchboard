'use server';

import { getAttentionEntries } from '@/lib/attention/get-attention-entries';
import { requirePageActorContext } from '@/lib/auth/actor-context';

export async function getAttentionEntriesAction(orgSlug: string) {
  await requirePageActorContext(orgSlug);
  return getAttentionEntries(orgSlug);
}