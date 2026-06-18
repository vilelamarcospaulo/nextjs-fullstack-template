// not-found.tsx is a Server Component by default.
// It renders when notFound() is called inside a route segment, or when a URL
// doesn't match any route in the app (root app/not-found.tsx covers both).
// No props are accepted — see Next.js docs for the not-found file convention.
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-24 text-center">
      <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
        404
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/" className={cn(buttonVariants())}>
        Return home
      </Link>
    </div>
  );
}
