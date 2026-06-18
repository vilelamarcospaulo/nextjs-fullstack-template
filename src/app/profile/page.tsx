import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getProfile } from "@/internal/use_case/profile";
import ProfileForm, { type ProfileFormInitial } from "./profile-form";

// Render on every request so the form always shows the freshest DB values
// (same pattern as the home page).
export const dynamic = "force-dynamic";

// Server Component: reads the session + profile directly so the form hydrates
// with the correct values on first paint (no self-fetch round-trip).
export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Guard: unauthenticated visitors land back on the home page.
  if (!session) {
    redirect("/");
  }

  const view = await getProfile(session.user.id);

  // Flatten the serialised view into the shape ProfileForm expects (null → "").
  // birthdate already arrives as YYYY-MM-DD (or null) — assign it directly.
  const initial: ProfileFormInitial = {
    name: view?.name ?? "",
    image: view?.image ?? "",
    birthdate: view?.birthdate ?? "",
    bio: view?.bio ?? "",
    location: view?.location ?? "",
  };

  const email = view?.email ?? session.user.email ?? "";

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col items-start justify-center gap-8 px-6 py-16">
      <div className="flex w-full flex-col gap-3">
        {/* Back link — minimal, matches the secondary-button style from page.tsx */}
        <Link
          href="/"
          className="text-sm opacity-60 transition-opacity hover:opacity-100"
        >
          ← Back
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Edit profile
        </h1>
        <p className="text-base opacity-70">
          Update your display name, avatar, and personal details.
        </p>
      </div>

      <ProfileForm initial={initial} email={email} />
    </main>
  );
}
