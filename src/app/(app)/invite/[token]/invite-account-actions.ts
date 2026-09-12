'use server';

import { signIn, signOut } from '@/auth';

/**
 * "Use another account" (Touchline Design Atlas, ADR-0136 Phase 7 §H:
 * `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md`). An invitation is addressed to a specific
 * email, but a coach's browser may be signed into Matchboard with a different Google account.
 * Signs the current session out and re-initiates Google sign-in with the account chooser forced
 * open (`prompt: "select_account"`), returning to this exact invite link afterward -- so the
 * coach never has to leave the invite flow and dig the email link back out to try a different
 * account.
 */
export async function useAnotherAccountAction(token: string) {
  await signOut({ redirect: false });
  await signIn('google', { redirectTo: `/invite/${encodeURIComponent(token)}` }, { prompt: 'select_account' });
}
