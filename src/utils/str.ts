// Coerce an unknown value to a trimmed string; null/undefined become "".
// Generic input sanitiser for raw form/HTTP values — carries no domain meaning.
export function str(value: unknown): string {
  return value !== undefined && value !== null ? String(value).trim() : "";
}
