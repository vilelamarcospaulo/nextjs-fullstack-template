"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "@/lib/auth-client";

type AuthUser = {
  name?: string | null;
  email?: string | null;
};

// Sign-in / sign-out controls. The `user` prop is read server-side in the page,
// so the correct state renders on first paint (no logged-out flash).
export default function AuthButtons({ user }: { user: AuthUser | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignIn() {
    setPending(true);
    // Redirects the browser to Google's consent screen, then back to "/".
    await signIn.social({ provider: "google", callbackURL: "/" });
  }

  async function handleSignOut() {
    setPending(true);
    try {
      await signOut();
      router.refresh(); // re-read the server session so the UI updates
    } finally {
      setPending(false);
    }
  }

  if (user) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          Signed in as{" "}
          <span className="font-medium">{user.name ?? user.email}</span>
          {user.email && <span className="opacity-60"> ({user.email})</span>}
        </p>
        <button
          onClick={handleSignOut}
          disabled={pending}
          className="w-fit rounded-md border border-black/15 px-4 py-2 text-sm transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      disabled={pending}
      className="bg-foreground text-background w-fit rounded-md px-4 py-2 text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      Sign in with Google
    </button>
  );
}
