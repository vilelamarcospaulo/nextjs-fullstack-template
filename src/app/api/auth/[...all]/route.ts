import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Mounts every Better Auth endpoint under /api/auth/* — including the Google
// callback at /api/auth/callback/google and the session endpoint.
export const { POST, GET } = toNextJsHandler(auth);
