// Profile use cases: orchestration between the HTTP/UI boundary (app/) and the
// data store (Prisma). No framework imports — the boundary resolves the session
// and passes a userId in; these functions never touch headers or Response.
import { prisma } from "@/lib/prisma";
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

// Selects the user row plus its optional 1-1 profile in one query.
const userWithProfile = {
  name: true,
  email: true,
  image: true,
  profile: { select: { birthdate: true, bio: true, location: true } },
} as const;

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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userWithProfile,
  });
  return user ? toView(user) : null;
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

  const [user, profile] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { name, image },
      select: { name: true, email: true, image: true },
    }),
    prisma.profile.upsert({
      where: { userId },
      create: { userId, birthdate, bio, location },
      update: { birthdate, bio, location },
      select: { birthdate: true, bio: true, location: true },
    }),
  ]);

  return { ok: true, value: toView({ ...user, profile }) };
}
