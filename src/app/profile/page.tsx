import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getProfile } from "@/internal/use_case/profile";
import ProfileForm, { type ProfileFormInitial } from "./profile-form";

// Server Component: reads the session + profile directly so the form hydrates
// with the correct values on first paint (no self-fetch round-trip).
// getSession() calls headers() internally, which opts this route into dynamic
// rendering — no need for `export const dynamic = "force-dynamic"`.
export default async function ProfilePage() {
  const session = await getSession();

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

  // The navbar provides global navigation and the form's Card carries its own
  // title, so the page is just a centered container around the form.
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <ProfileForm initial={initial} email={email} />
    </div>
  );
}
