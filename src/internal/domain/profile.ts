// Profile domain: the type and the pure logic functions that operate on it.
// No framework or infrastructure imports — safe to use from the route handler,
// the server page, AND the "use client" form (shared single source of truth).

export type Field = "name" | "image" | "birthdate" | "bio" | "location";

export type Profile = {
  name: string;
  image: string | null;
  birthdate: Date | null;
  bio: string | null;
  location: string | null;
};

export type ValidationResult =
  | { ok: true; value: Profile }
  | { ok: false; errors: Partial<Record<Field, string>> };

// Serialise a Date to its YYYY-MM-DD portion using local components. Avoids the
// timezone drift that toISOString().slice(0,10) introduces (the stored value is
// local midnight, so UTC conversion can roll it back a day).
export function formatDateOnly(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Validate raw input (from an HTTP body or a form) into a clean Profile, or a
// map of per-field errors. Optional fields coerce empty/absent to null.
export function validateProfile(input: Record<string, unknown>): ValidationResult {
  const errors: Partial<Record<Field, string>> = {};

  // name — required, 1–80 chars.
  const name = str(input.name);
  if (name.length === 0) {
    errors.name = "Name is required.";
  } else if (name.length > 80) {
    errors.name = "Name must be 80 characters or fewer.";
  }

  // image — optional; if present, must be an http(s) URL up to 2048 chars.
  let image: string | null = null;
  const rawImage = str(input.image);
  if (rawImage.length > 0) {
    if (rawImage.length > 2048 || !isHttpUrl(rawImage)) {
      errors.image = "Image must be a valid http(s) URL.";
    } else {
      image = rawImage;
    }
  }

  // birthdate — optional; expect YYYY-MM-DD, a real calendar date in the past.
  let birthdate: Date | null = null;
  const rawBirthdate = str(input.birthdate);
  if (rawBirthdate.length > 0) {
    const parsed = parsePastDate(rawBirthdate);
    if (!parsed) {
      errors.birthdate = "Birthdate must be a real date in the past.";
    } else {
      birthdate = parsed;
    }
  }

  // bio — optional, up to 280 chars.
  let bio: string | null = null;
  const rawBio = str(input.bio);
  if (rawBio.length > 280) {
    errors.bio = "Bio must be 280 characters or fewer.";
  } else if (rawBio.length > 0) {
    bio = rawBio;
  }

  // location — optional, up to 120 chars.
  let location: string | null = null;
  const rawLocation = str(input.location);
  if (rawLocation.length > 120) {
    errors.location = "Location must be 120 characters or fewer.";
  } else if (rawLocation.length > 0) {
    location = rawLocation;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { name, image, birthdate, bio, location } };
}

// --- internal helpers -------------------------------------------------------

function str(value: unknown): string {
  return value !== undefined && value !== null ? String(value).trim() : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// Parse YYYY-MM-DD as a local date, rejecting non-real dates (e.g. Feb 30),
// future dates, and years before 1900. Returns null on any failure.
function parsePastDate(value: string): Date | null {
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;
  const year = parseInt(parts[1], 10);
  const month = parseInt(parts[2], 10) - 1; // 0-indexed
  const day = parseInt(parts[3], 10);
  const d = new Date(year, month, day);
  const isReal =
    d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  if (!isReal || year < 1900 || d > new Date()) return null;
  return d;
}
