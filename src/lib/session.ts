/**
 * Deduplicated session getter for React Server Components.
 *
 * React.cache memoises the result for the lifetime of a single server render
 * pass, so multiple RSCs (e.g. layout + page) that call getSession() in the
 * same request share one getAuth().api.getSession() round-trip instead of
 * making separate calls.
 *
 * Route Handlers should NOT use this helper — they are not rendered in the RSC
 * tree, so React.cache deduplication does not apply there. Call
 * getAuth().api.getSession({ headers: await headers() }) directly instead.
 */
import { cache } from "react";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export const getSession = cache(async () => {
  return getAuth().api.getSession({ headers: await headers() });
});
