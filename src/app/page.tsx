import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignInButton } from "./auth-buttons";
import Greeter from "./greeter";
import ApiHelloDemo from "./api-hello-demo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16 sm:px-6">
      <section className="flex flex-col items-center gap-6 py-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Content Generator
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg">
          Generate personalised content with server actions and live API routes
          — all in one fullstack Next.js app.
        </p>
        {session?.user ? (
          <Link href="/profile" className={cn(buttonVariants({ size: "lg" }))}>
            Edit your profile
          </Link>
        ) : (
          <SignInButton />
        )}
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
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
      </div>
    </div>
  );
}
