"use client";

import { useState } from "react";
import type { GreetingResult } from "./actions";
import { generateGreeting } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Greeter() {
  const [name, setName] = useState("");
  const [result, setResult] = useState<GreetingResult | null>(null);
  const [pending, setPending] = useState(false);

  async function runServerAction() {
    setPending(true);
    try {
      setResult(await generateGreeting(name));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter a name"
      />

      <Button onClick={runServerAction} disabled={pending}>
        {pending ? "Running…" : "Run Server Action"}
      </Button>

      {/* Render nothing until the action has been called at least once. */}
      {result !== null && (
        <>
          {result.ok ? (
            <pre className="bg-muted text-muted-foreground overflow-x-auto rounded-md p-3 font-mono text-sm">
              {result.data}
            </pre>
          ) : result.error === "unauthenticated" ? (
            // Friendly degraded state for logged-out visitors — shown instead
            // of an error boundary so the page stays usable.
            <p className="text-muted-foreground text-sm">
              Please{" "}
              {/* OAuth API endpoint, not a Next page — full-page navigation is
                  intended (it issues a redirect), so a plain <a> is correct. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/api/auth/signin" className="underline">
                sign in
              </a>{" "}
              to try this feature.
            </p>
          ) : (
            <p className="text-destructive text-sm">
              Something went wrong. Please try again.
            </p>
          )}
        </>
      )}
    </div>
  );
}
