"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

export default function ApiHelloDemo() {
  const [apiResult, setApiResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function callApi() {
    setPending(true);
    setError(null);
    try {
      // apiFetch propagates network rejections and throws ApiError on non-ok —
      // for this demo both cases collapse to the same "failed to reach" message.
      const data = await apiFetch<unknown>("/api/hello");
      setApiResult(JSON.stringify(data, null, 2));
    } catch {
      setApiResult(null);
      setError("Failed to reach /api/hello.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={callApi} disabled={pending} variant="outline">
        {pending ? "Fetching…" : "Call /api/hello"}
      </Button>

      {apiResult && (
        <pre className="bg-muted text-muted-foreground overflow-x-auto rounded-md p-3 font-mono text-sm">
          {apiResult}
        </pre>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
