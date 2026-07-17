// Organization domain: the type and pure logic functions that operate on it.
// No framework or infrastructure imports — safe to use from a route handler,
// a server action, AND a "use client" form (shared single source of truth).
//
// Uniqueness (slug collisions) is NOT checked here — that's a DB-backed
// concern better-auth's organization plugin already enforces (it throws
// ORGANIZATION_ALREADY_EXISTS), surfaced as a form error at the boundary.
import { str } from "@/utils/str";

export type Field = "name" | "slug";

export type Organization = {
  name: string;
  slug: string;
};

export type ValidationResult =
  | { ok: true; value: Organization }
  | { ok: false; errors: Partial<Record<Field, string>> };

export type NameValidationResult =
  | { ok: true; value: { name: string } }
  | { ok: false; errors: Partial<Record<"name", string>> };

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateName(rawName: unknown): { name: string; error?: string } {
  const name = str(rawName);
  if (name.length === 0) {
    return { name, error: "Name is required." };
  }
  if (name.length > 100) {
    return { name, error: "Name must be 100 characters or fewer." };
  }
  return { name };
}

function validateSlug(rawSlug: unknown): { slug: string; error?: string } {
  const slug = str(rawSlug);
  if (slug.length === 0) {
    return { slug, error: "Slug is required." };
  }
  if (slug.length > 50) {
    return { slug, error: "Slug must be 50 characters or fewer." };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      slug,
      error:
        'Slug must be lowercase letters, numbers, and single hyphens only (e.g. "acme-inc").',
    };
  }
  return { slug };
}

// Validate raw input (from an HTTP body or a form) into a clean Organization
// (name + slug), or a map of per-field errors. Used for the "create
// organization" flow.
export function inputToOrganization(
  input: Record<string, unknown>,
): ValidationResult {
  const errors: Partial<Record<Field, string>> = {};

  const { name, error: nameError } = validateName(input.name);
  if (nameError) errors.name = nameError;

  const { slug, error: slugError } = validateSlug(input.slug);
  if (slugError) errors.slug = slugError;

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { name, slug } };
}

// Validate just the name — used for the "rename organization" flow, where the
// slug is immutable once created.
export function inputToOrganizationName(
  input: Record<string, unknown>,
): NameValidationResult {
  const { name, error } = validateName(input.name);
  if (error) {
    return { ok: false, errors: { name: error } };
  }
  return { ok: true, value: { name } };
}

// Derive a URL-safe slug suggestion from a display name (e.g. to prefill the
// slug field as the user types an org name). Pure and lossy — the caller
// still runs the result through validateSlug/inputToOrganization since a
// derived slug can still collide with an existing one or end up empty (e.g.
// a name with no ASCII alphanumerics).
export function slugify(name: string): string {
  return str(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
