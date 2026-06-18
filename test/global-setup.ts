import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

// Vitest global setup (runs once, in the main process). Provisions a throwaway
// SQLite database for the integration tests: a fresh file with all Prisma
// migrations applied. The file is gitignored (*.db) and torn down after the run.
//
// Workers receive DATABASE_URL via `test.env` in vitest.config.ts so the Prisma
// client they construct points at this same file. Keep the two URLs in sync.
const TEST_DB_URL = "file:./prisma/test.db";
const SIDECARS = [
  "prisma/test.db",
  "prisma/test.db-journal",
  "prisma/test.db-shm",
  "prisma/test.db-wal",
];

function removeDbFiles() {
  for (const f of SIDECARS) {
    rmSync(join(process.cwd(), f), { force: true });
  }
}

export default function setup() {
  // Start from a clean slate so `migrate deploy` recreates the full schema.
  removeDbFiles();

  try {
    execSync("npx prisma migrate deploy", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: "pipe",
    });
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    const out = e.stdout?.toString() ?? "";
    const errOut = e.stderr?.toString() ?? "";
    throw new Error(`prisma migrate deploy failed:\n${out}\n${errOut}`);
  }

  // Teardown: delete the temp DB once the whole run finishes.
  return () => {
    removeDbFiles();
  };
}
