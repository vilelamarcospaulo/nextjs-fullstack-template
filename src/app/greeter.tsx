"use client";

import { useState } from "react";
import { generateGreeting } from "./actions";

// Client Component: drives the two backend paths so the front<->back boundary
// is visible in the browser.
export default function Greeter() {
  const [name, setName] = useState("");
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function runServerAction() {
    setPending(true);
    try {
      // Direct Server Action invocation — no manual endpoint needed.
      setActionResult(await generateGreeting(name));
    } finally {
      setPending(false);
    }
  }

  async function callApi() {
    setPending(true);
    try {
      // Route Handler invocation over HTTP (relative URL works in the browser).
      const res = await fetch("/api/hello");
      setApiResult(JSON.stringify(await res.json(), null, 2));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter a name"
        className="rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />

      <div className="flex flex-wrap gap-3">
        <button
          onClick={runServerAction}
          disabled={pending}
          className="bg-foreground text-background rounded-md px-4 py-2 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Run Server Action
        </button>
        <button
          onClick={callApi}
          disabled={pending}
          className="rounded-md border border-black/15 px-4 py-2 transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          Call /api/hello
        </button>
      </div>

      {actionResult && (
        <p className="text-sm">
          <span className="font-mono opacity-60">action →</span> {actionResult}
        </p>
      )}
      {apiResult && (
        <pre className="overflow-x-auto rounded-md bg-black/5 p-3 font-mono text-xs dark:bg-white/10">
          {apiResult}
        </pre>
      )}
    </div>
  );
}
