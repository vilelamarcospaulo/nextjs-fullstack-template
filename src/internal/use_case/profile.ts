// Profile use cases: orchestration between the HTTP/UI boundary (app/) and the
// data store (Drizzle). No framework imports — the boundary resolves the
// session and passes a userId in; these functions never touch headers or
// Response.
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { user, profile } from "@/lib/schema";
import { inputToProfile, type Field } from "@/internal/domain/profile";
import { dateToStr } from "@/utils/date";

// The serialised shape returned to the boundary: a user's display fields merged
// with their optional 1-1 profile. birthdate is a YYYY-MM-DD string (or null).
export type ProfileView = {
  name: string;
  email: string;
  image: string | null;
  birthdate: string | null;
  bio: string | null;
  location: string | null;
};

export type UpdateProfileResult =
  | { ok: true; value: ProfileView }
  | { ok: false; errors: Partial<Record<Field, string>> };

// Flatten a user (+ optional profile) into the serialised view. birthdate is
// stored as a Date but emitted as YYYY-MM-DD (a presentation concern, hence the
// dateToStr util and not the domain).
function toView(user: {
  name: string;
  email: string;
  image: string | null;
  profile: {
    birthdate: Date | null;
    bio: string | null;
    location: string | null;
  } | null;
}): ProfileView {
  return {
    name: user.name,
    email: user.email,
    image: user.image,
    birthdate: user.profile?.birthdate
      ? dateToStr(user.profile.birthdate)
      : null,
    bio: user.profile?.bio ?? null,
    location: user.profile?.location ?? null,
  };
}

// Read a user's own profile. Returns null when the user row is missing.
export async function getProfile(userId: string): Promise<ProfileView | null> {
  const rows = await db
    .select({
      name: user.name,
      email: user.email,
      image: user.image,
      birthdate: profile.birthdate,
      bio: profile.bio,
      location: profile.location,
    })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // The leftJoin returns birthdate/bio/location as null when there's no
  // profile row at all — indistinguishable here from a profile row whose
  // fields happen to all be null, but toView() flattens both cases to the
  // same ProfileView output via `?.`/`??`, so no branching is needed.
  return toView({
    name: row.name,
    email: row.email,
    image: row.image,
    profile: { birthdate: row.birthdate, bio: row.bio, location: row.location },
  });
}

// Validate raw input (never trust the caller) and persist it. user.{name,image}
// and the profile fields are written atomically in one transaction.
export async function updateProfile(
  userId: string,
  input: Record<string, unknown>,
): Promise<UpdateProfileResult> {
  const result = inputToProfile(input);
  if (!result.ok) return { ok: false, errors: result.errors };

  const { name, image, birthdate, bio, location } = result.value;

  const value = await db.transaction(async (tx) => {
    const [updatedUser] = await tx
      .update(user)
      .set({ name, image })
      .where(eq(user.id, userId))
      .returning({ name: user.name, email: user.email, image: user.image });

    const [updatedProfile] = await tx
      .insert(profile)
      .values({ id: createId(), userId, birthdate, bio, location })
      .onConflictDoUpdate({
        target: profile.userId,
        set: { birthdate, bio, location },
      })
      .returning({
        birthdate: profile.birthdate,
        bio: profile.bio,
        location: profile.location,
      });

    return toView({ ...updatedUser, profile: updatedProfile });
  });

  return { ok: true, value };
}
