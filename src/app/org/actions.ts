"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Discriminated-union result type, matching the convention in src/app/actions.ts.
export type AddMemberResult = { ok: true } | { ok: false; error: string };

// Server Action: adds an existing user (looked up by email) to an organization
// as "admin" or "member". Deliberately self-contained — inline validation
// rather than importing src/internal/domain/organization.ts (built in
// parallel, for org name/slug validation, a different concern) — and lives at
// this sibling path rather than under src/app/org/[slug]/ (also being built
// in parallel) to avoid colliding with that work.
//
// Auth gate order mirrors src/app/actions.ts: session first, then input
// validation, then the permission check, then the business logic.
export async function addMemberByEmail(
  organizationId: string,
  email: string,
  role: "admin" | "member",
): Promise<AddMemberResult> {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: "unauthenticated" };
  }

  // ── 2. Input validation ─────────────────────────────────────────────────────
  if (typeof email !== "string" || !email.includes("@")) {
    return { ok: false, error: "invalid_email" };
  }
  if (role !== "admin" && role !== "member") {
    return { ok: false, error: "invalid_role" };
  }

  // ── 3. Permission check ──────────────────────────────────────────────────────
  // auth.api.addMember (below) is server-only and enforces NO permission check
  // of its own (see node_modules/better-auth/dist/plugins/organization/routes/crud-members.mjs)
  // — it trusts the caller completely, so this action must gate it itself.
  // hasPermission resolves { error: string | null; success: boolean } (verified
  // in node_modules/better-auth/dist/plugins/organization/organization.mjs,
  // the `/organization/has-permission` endpoint's `ctx.json({ error: null,
  // success: result })`), not a plain boolean.
  const permissionCheck = await auth.api.hasPermission({
    headers: await headers(),
    body: { organizationId, permissions: { member: ["create"] } },
  });
  if (!permissionCheck.success) {
    return { ok: false, error: "forbidden" };
  }

  // ── 4. Business logic ────────────────────────────────────────────────────────
  const targetUser = await prisma.user.findUnique({ where: { email } });
  if (!targetUser) {
    return { ok: false, error: "no_account_with_that_email" };
  }

  try {
    await auth.api.addMember({
      body: { organizationId, userId: targetUser.id, role },
    });
  } catch {
    // e.g. USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION from the plugin.
    return { ok: false, error: "already_a_member" };
  }

  return { ok: true };
}
