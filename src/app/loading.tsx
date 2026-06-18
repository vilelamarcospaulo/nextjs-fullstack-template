// loading.tsx is a Server Component by default (no "use client" needed).
// Next.js automatically wraps page.tsx in a <Suspense> using this file as
// the fallback whenever the page is streaming.
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-16 sm:px-6">
      {/* Hero section skeleton */}
      <div className="flex flex-col items-center gap-4 py-8">
        <Skeleton className="h-10 w-64 sm:w-80" />
        <Skeleton className="h-5 w-72 sm:w-96" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      {/* Card grid skeleton */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border p-6 flex flex-col gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
        <div className="rounded-xl border p-6 flex flex-col gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
