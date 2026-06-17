import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import AuthButtons from "./auth-buttons";
import Greeter from "./greeter";

// Render on every request (not prerendered at build time), so the server
// timestamp below is genuinely per-request and proves SSR is live.
export const dynamic = "force-dynamic";

// Server Component: rendered on the server for every request. The timestamp
// below is computed server-side, so a full-page reload proves SSR is live.
export default async function Home() {
  const renderedAt = new Date().toISOString();

  // Read the auth session on the server so the signed-in state is correct on
  // first paint (and so this is the real source of truth, not the client).
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col items-start justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          content-generator
        </h1>
        <p className="text-base opacity-70">
          A Next.js fullstack service — SSR frontend, route handlers, and server
          actions in one app.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <AuthButtons user={session?.user ?? null} />
        {/* Show "Edit profile" only when signed in — same secondary-button style
            used throughout the app (see auth-buttons.tsx). */}
        {session?.user && (
          <Link
            href="/profile"
            className="w-fit rounded-md border border-black/15 px-4 py-2 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Edit profile
          </Link>
        )}
      </div>

      <p className="text-sm opacity-60">
        <span className="font-mono">Server-rendered at:</span> {renderedAt}
        <br />
        Reload the page to see this timestamp change.
      </p>

      <Greeter />
    </main>
  );
}
