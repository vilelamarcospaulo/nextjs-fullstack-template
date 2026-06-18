// Generic YYYY-MM-DD ⇄ Date conversion. Pure, dependency-free, carries no
// business rules — callers layer their own (past-only, ranges, etc.) on top.

// Parse a YYYY-MM-DD string into a local Date, or null if it isn't a
// well-formed real calendar date (rejects bad formats and impossible dates
// like Feb 30). Uses local components so it round-trips with dateToStr.
export function strToDate(value: string): Date | null {
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;
  const year = parseInt(parts[1], 10);
  const month = parseInt(parts[2], 10) - 1; // 0-indexed
  const day = parseInt(parts[3], 10);
  const d = new Date(year, month, day);
  const isReal =
    d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  return isReal ? d : null;
}

// Serialise a Date to its YYYY-MM-DD portion using local components. Avoids the
// timezone drift toISOString().slice(0,10) introduces: a value stored as local
// midnight can roll back a day under UTC conversion.
export function dateToStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
