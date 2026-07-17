import Link from "next/link";
import { getSession } from "@/lib/session";
import { SignInButton } from "./auth-buttons";
import Greeter from "./greeter";
import ApiHelloDemo from "./api-hello-demo";
import JobDemo from "./job-demo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// NOTE: `export const dynamic = "force-dynamic"` is NOT needed here.
// This page calls getSession() which invokes headers(), making it a
// request-time API — Next.js automatically opts the route into dynamic
// rendering. Only add force-dynamic explicitly when you need to bypass
// the static pre-render for a route that would otherwise be statically
// optimised (e.g. no request-time APIs but you still want per-request
// freshness). Blanket-applying it disables caching unnecessarily.

export default async function Home() {
  const session = await getSession();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16 sm:px-6">
      <section className="flex flex-col items-center gap-6 py-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Starter Kit
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg">
          A batteries-included Next.js fullstack template — a playground to see
          how server actions, API routes, and background jobs fit together
          before you build on top of it.
        </p>
        {session?.user ? (
          <Link href="/profile" className={cn(buttonVariants({ size: "lg" }))}>
            Edit your profile
          </Link>
        ) : (
          <SignInButton />
        )}
      </section>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Greeter</CardTitle>
            <CardDescription>
              Invoke a server action directly from the client — no HTTP endpoint
              required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Greeter />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Hello</CardTitle>
            <CardDescription>
              Call the <code className="font-mono text-xs">/api/hello</code>{" "}
              route handler and inspect the JSON response.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiHelloDemo />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Async Job</CardTitle>
            <CardDescription>
              Enqueue a background job onto a Postgres-backed queue (pg-boss),
              processed asynchronously by a separate worker process.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JobDemo />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
