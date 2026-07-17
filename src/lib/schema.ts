// Drizzle schema — direct translation of the former prisma/schema.prisma.
// See git history for that file if you need the original Prisma source.
//
// ─────────────────────────────────────────────────────────────────────────────
// AUTH-OWNED TABLES (user / session / account / verification / organization /
// member / invitation)
//
// These tables are owned by better-auth. Their column set, unique constraints,
// and indexes MUST match what better-auth expects in
// @better-auth/core/dist/db/get-tables.mjs (getAuthTables) — for the
// organization plugin specifically, node_modules/better-auth/dist/plugins/
// organization/schema.mjs (runtime field defs) and .d.mts (field metadata,
// e.g. which are indexed/unique). Verified facts:
//
//   user.email          unique: true            -> unique() (kept)
//   session.token       unique: true            -> unique() (kept)
//   session.userId      index: true             -> index() (kept)
//   account.userId      index: true             -> index() (kept)
//   verification.id'fier index: true            -> index() (kept)
//   organization.slug   unique: true            -> unique() (kept)
//
// NOT added (would DIVERGE from better-auth's expected schema):
//   - index on expiresAt for session / verification: better-auth defines NO
//     index on expiresAt. It cleans up expired rows by querying, but does not
//     declare the index, so adding one drifts from `@better-auth/cli generate`.
//   - unique(providerId, accountId) on account: better-auth marks neither
//     field unique and declares no composite unique. The OAuth lookup is keyed
//     by (providerId, accountId, userId) at the app layer, not enforced in DB.
//   - unique(organizationId, userId) on member: better-auth's
//     MemberDefaultFields declares no composite unique either — "is this user
//     already a member" is enforced at the app layer (adapter.findMemberByEmail
//     in organization/routes/crud-members.mjs), not a DB constraint.
//   These are "left to better-auth".
//
// Safe & additive: defaultNow() on updatedAt. better-auth always supplies
// createdAt/updatedAt at the application layer (defaultValue/onUpdate in
// getAuthTables), so a DB-level default never conflicts with better-auth — it
// only protects raw/seed/backfill writes that bypass the ORM's onUpdate hook
// from violating NOT NULL. organization.updatedAt follows the same reasoning
// even though the plugin's field metadata marks it optional — same divergence
// already accepted for user/session/account above.
//
// organization.metadata is opaque here: the plugin stores an arbitrary JSON
// object as a serialized string column and (de)serializes it at the
// application layer (see the z.record(...).or(z.string().transform(JSON.parse))
// shape in organization/schema.mjs) — hence `text`, not a jsonb column.
//
// session.activeOrganizationId has no `references` in the plugin's
// SessionDefaultFields (unlike organizationId elsewhere), so it's a plain
// nullable column, not a foreign key — a stale/deleted org just leaves it
// dangling until the app sets a new active org.
//
// All FKs carry onDelete: "cascade" AND onUpdate: "cascade" — Prisma's
// generated SQL added ON UPDATE CASCADE by default for every required
// relation on Postgres, so this schema replicates both actions to keep the
// DDL identical (see prisma/migrations/*/migration.sql in git history).
// ─────────────────────────────────────────────────────────────────────────────
import {
  pgTable,
  text,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("user_email_key").on(table.email)],
);

// APP-OWNED table — full latitude here.
//
// id: generated with @paralleldrive/cuid2's createId() at the application
// layer (not a DB default) — cuid2 ids are time-ordered and monotonic, so
// primary-key inserts append to the end of the B-tree index instead of
// landing at random positions. Random uuid v4 fragments the index and bloats
// it under churn — this matters most for derived Postgres projects (see
// prisma/POSTGRES.md history), where a randomly-ordered PK is a known
// write-amplification footgun.
//
// updatedAt carries defaultNow() so non-ORM writers (the seed script uses
// Drizzle and honors $onUpdate, but raw SQL backfills do not) cannot violate
// NOT NULL.
//
// birthdate modeling note: a birthdate is a calendar day with no meaningful
// time-of-day component. date() maps it to Postgres's native `date` column
// (no time-of-day, no timezone math) instead of a full timestamp.
export const profile = pgTable(
  "profile",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    birthdate: date("birthdate", { mode: "date" }),
    bio: text("bio"),
    location: text("location"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("profile_userId_key").on(table.userId)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { precision: 3 }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    activeOrganizationId: text("activeOrganizationId"),
  },
  (table) => [
    uniqueIndex("session_token_key").on(table.token),
    index("session_userId_idx").on(table.userId),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { precision: 3 }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", {
      precision: 3,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { precision: 3 }).notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("organization_slug_key").on(table.slug)],
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    email: text("email").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expiresAt", { precision: 3 }).notNull(),
    inviterId: text("inviterId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [index("invitation_organizationId_idx").on(table.organizationId)],
);
