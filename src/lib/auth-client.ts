import { createAuthClient } from "better-auth/react";

// Browser-side client. baseURL is omitted because the client lives on the same
// origin as the server (Better Auth defaults to the current origin).
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
