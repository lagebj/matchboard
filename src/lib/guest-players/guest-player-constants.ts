// ADR-0106: Field-length bounds shared between the GuestPlayer domain module (server-only, pulls
// in @/lib/db) and client components (e.g. GuestPlayersPanel) that must not bundle server-only
// code. Kept in this tiny, dependency-free file so a client component can import the bounds
// without transitively importing the database driver.

export const GUEST_PLAYER_NAME_MAX_LENGTH = 100;
export const GUEST_PLAYER_SOURCE_LABEL_MAX_LENGTH = 50;
export const GUEST_PLAYER_NOTE_MAX_LENGTH = 500;
