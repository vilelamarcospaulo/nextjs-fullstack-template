// Idempotent database seed.
//
// Run with:  npm run db:seed   (see package.json contract)
// or directly:  node --env-file=.env prisma/seed.ts
//
// Prisma 7 invokes this via `migrations.seed` in prisma.config.ts after
// `prisma migrate dev` / `prisma migrate reset`.
//
// Idempotency: every write is an upsert keyed on a STABLE identifier, so
// re-running the seed never duplicates rows and never collides with real
// better-auth (Google OAuth) users — those carry random ids, while the demo
// user uses the fixed id below. All writes go through Prisma so the @updatedAt
// (and @default(now())) behavior on the models is honored.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill it in " +
      '(e.g. DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app").',
  );
}

// Mirror the production adapter (src/lib/prisma.ts) so the seed talks to the
// same Postgres database the app uses.
const adapter = new PrismaPg(DATABASE_URL);
const prisma = new PrismaClient({ adapter });

// Stable, recognizable demo identity. NOT a random id, so the upsert is a
// true no-op on re-run.
const DEMO_USER_ID = "seed-demo-user";
const DEMO_EMAIL = "demo@example.com";

async function main() {
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {
      // Keep the demo user's mutable fields in sync on re-seed. @updatedAt
      // bumps automatically because this write goes through Prisma.
      name: "Demo User",
      email: DEMO_EMAIL,
      emailVerified: true,
    },
    create: {
      id: DEMO_USER_ID,
      name: "Demo User",
      email: DEMO_EMAIL,
      emailVerified: true,
    },
  });

  // Profile is app-owned. Upsert on the unique userId so the relation is 1:1
  // and idempotent. The profile id is left to the schema's @default(cuid()).
  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      bio: "Demo account seeded for local development.",
      location: "San Francisco, CA",
      birthdate: new Date("1990-01-01T00:00:00.000Z"),
    },
    create: {
      userId: user.id,
      bio: "Demo account seeded for local development.",
      location: "San Francisco, CA",
      birthdate: new Date("1990-01-01T00:00:00.000Z"),
    },
  });

  console.log(
    `Seed complete: user ${user.email} (${user.id}), profile ${profile.id}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
