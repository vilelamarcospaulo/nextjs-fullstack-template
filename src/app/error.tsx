"use client";

// Error boundaries must be Client Components (React requirement).
// The `unstable_retry` prop (introduced in Next.js 16.2) re-fetches and
// re-renders the error boundary's children. Use `reset` only when you
// want to clear the error state without re-fetching server data.
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Log to an error reporting service in production.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-24 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h2>
      <p className="text-muted-foreground text-sm">
        {/* In production, Server Component errors surface only a digest to avoid
            leaking sensitive details. Client Component errors show the full message. */}
        {error.digest
          ? `An unexpected error occurred. (ref: ${error.digest})`
          : (error.message ?? "An unexpected error occurred.")}
      </p>
      <Button onClick={() => unstable_retry()}>Try again</Button>
    </div>
  );
}
