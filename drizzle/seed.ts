import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createId } from "@paralleldrive/cuid2";
import { user, profile } from "../src/lib/schema.ts";

// DATABASE_URL is read directly here (not via src/lib/env.ts) because this
// script runs as a standalone CLI (`node drizzle/seed.ts`) outside the
// Next.js process — see drizzle.config.ts for the same reasoning.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill it in " +
      '(e.g. DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app").',
  );
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle({ client: pool, schema: { user, profile } });

const DEMO_USER_ID = "seed-demo-user";
const DEMO_EMAIL = "demo@example.com";

async function main() {
  const [seededUser] = await db
    .insert(user)
    .values({
      id: DEMO_USER_ID,
      name: "Demo User",
      email: DEMO_EMAIL,
      emailVerified: true,
    })
    .onConflictDoUpdate({
      target: user.id,
      set: { name: "Demo User", email: DEMO_EMAIL, emailVerified: true },
    })
    .returning();

  const [seededProfile] = await db
    .insert(profile)
    .values({
      id: createId(),
      userId: seededUser.id,
      bio: "Demo account seeded for local development.",
      location: "San Francisco, CA",
      birthdate: new Date("1990-01-01T00:00:00.000Z"),
    })
    .onConflictDoUpdate({
      target: profile.userId,
      set: {
        bio: "Demo account seeded for local development.",
        location: "San Francisco, CA",
        birthdate: new Date("1990-01-01T00:00:00.000Z"),
      },
    })
    .returning();

  console.log(
    `Seed complete: user ${seededUser.email} (${seededUser.id}), profile ${seededProfile.id}`,
  );
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await pool.end();
    process.exit(1);
  });
