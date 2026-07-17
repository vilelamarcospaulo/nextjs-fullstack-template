// Generic YYYY-MM-DD ⇄ Date conversion. Pure, dependency-free, carries no
// business rules — callers layer their own (past-only, ranges, etc.) on top.
//
// Both functions operate on UTC components, not local ones. birthdate is
// persisted via Drizzle's `date()` column (Postgres native DATE), which is
// timezone-less: node-postgres always reads it back as a Date at UTC
// midnight, regardless of the server's local TZ. Building/reading with local
// components here would round-trip correctly on the server that wrote the
// value but drift by a day when read back on a host with a different TZ
// offset (or even the same host, once the DATE is round-tripped through
// Postgres — local getters saw UTC midnight, which is "yesterday evening" in
// any negative-offset TZ). Anchoring both directions to UTC keeps every
// caller (form input, domain validation, Postgres storage, display) agreeing
// on the same calendar day independent of process TZ.

// Parse a YYYY-MM-DD string into a UTC-midnight Date, or null if it isn't a
// well-formed real calendar date (rejects bad formats and impossible dates
// like Feb 30).
export function strToDate(value: string): Date | null {
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;
  const year = parseInt(parts[1], 10);
  const month = parseInt(parts[2], 10) - 1; // 0-indexed
  const day = parseInt(parts[3], 10);
  const d = new Date(Date.UTC(year, month, day));
  const isReal =
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month &&
    d.getUTCDate() === day;
  return isReal ? d : null;
}

// Serialise a Date to its YYYY-MM-DD portion using UTC components — the
// inverse of strToDate, and what matches a `date()` column value read back
// from Postgres.
export function dateToStr(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
