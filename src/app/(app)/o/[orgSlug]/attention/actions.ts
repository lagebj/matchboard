'use server';

import { getAttentionEntries } from '@/lib/attention/get-attention-entries';

export async function getAttentionEntriesAction() {
  return getAttentionEntries();
}