"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateProfile, type Field } from "@/internal/domain/profile";

type FieldErrors = Partial<Record<Field, string>>;

export type ProfileFormInitial = {
  name: string;
  image: string;
  birthdate: string; // YYYY-MM-DD or ""
  bio: string;
  location: string;
};

type Props = {
  initial: ProfileFormInitial;
  email: string;
};

// Shared input class — matches the token used in greeter.tsx / auth-buttons.tsx.
const inputBase =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

// Red border override applied when a field has a validation error.
const inputError =
  "border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400";

// ProfileForm handles the complete edit-profile flow:
//   1. Client-side validation via shared validateProfile (instant UX feedback).
//   2. PUT /api/profile — server is source of truth; its errors win on 400.
//   3. router.refresh() after success so the home page re-reads name/image.
export default function ProfileForm({ initial, email }: Props) {
  const router = useRouter();

  // Controlled state for every editable field.
  const [name, setName] = useState(initial.name);
  const [image, setImage] = useState(initial.image);
  const [birthdate, setBirthdate] = useState(initial.birthdate);
  const [bio, setBio] = useState(initial.bio);
  const [location, setLocation] = useState(initial.location);

  // Avatar falls back to an initial-letter circle when the URL fails to load.
  const [avatarBroken, setAvatarBroken] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Reset avatar broken state whenever the URL changes so the img re-attempts.
  function handleImageChange(value: string) {
    setImage(value);
    setAvatarBroken(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    setSuccessMessage(null);

    const payload = { name, image, birthdate, bio, location };

    // Client-side validation: gives instant feedback without a round-trip.
    const validation = validateProfile(payload);
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      return;
    }
    setFieldErrors({});

    setPending(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        // Re-sync local state from what the server persisted (canonical values).
        // birthdate already arrives as a YYYY-MM-DD string — assign it directly.
        // Re-parsing through new Date(...).toISOString() would shift it a day in
        // UTC+ timezones, so don't.
        setName(json.name ?? "");
        setImage(json.image ?? "");
        setBirthdate(json.birthdate ?? "");
        setBio(json.bio ?? "");
        setLocation(json.location ?? "");
        setAvatarBroken(false);
        setSuccessMessage("Profile saved successfully.");
        // Refresh server components (home page header re-reads name/image).
        router.refresh();
      } else if (res.status === 400) {
        // Server errors are the source of truth — render them inline.
        const serverErrors: FieldErrors = {};
        let bodyError: string | null = null;

        for (const [key, msg] of Object.entries(
          json.errors as Record<string, string>,
        )) {
          if (key === "_body" || key === "_auth") {
            // Non-field errors go to the top-level banner.
            bodyError = msg;
          } else {
            serverErrors[key as Field] = msg;
          }
        }

        setFieldErrors(serverErrors);
        if (bodyError) setTopError(bodyError);
      } else if (res.status === 401) {
        // Session expired between page load and submit — retrying won't help;
        // send them back to the home page to sign in again.
        router.push("/");
      } else {
        setTopError("Something went wrong. Please try again.");
      }
    } catch {
      setTopError("Network error. Please check your connection.");
    } finally {
      setPending(false);
    }
  }

  // Returns the combined class string for a given field's input element.
  function inputClass(field: Field) {
    return fieldErrors[field] ? `${inputBase} ${inputError}` : inputBase;
  }

  // The first letter of name (or email) as a fallback avatar character.
  const fallbackLetter = (name || email || "?")[0]?.toUpperCase() ?? "?";

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6" noValidate>
      {/* Non-field error (malformed body, auth failure, network) */}
      {topError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {topError}
        </p>
      )}

      {/* Success banner — role="status" so screen readers announce it. */}
      {successMessage && (
        <p
          role="status"
          className="rounded-md border border-black/15 bg-black/5 px-4 py-3 text-sm dark:border-white/20 dark:bg-white/10"
        >
          {successMessage}
        </p>
      )}

      {/* Read-only email — shown as context so users know which account this is. */}
      <p className="text-sm opacity-60">
        Account email:{" "}
        <span className="font-medium not-italic">{email}</span>
      </p>

      {/* Avatar preview + Name on one row */}
      <div className="flex items-center gap-4">
        {/* Avatar: shows the image URL live; falls back to initial-letter circle. */}
        {image && !avatarBroken ? (
          <img
            src={image}
            alt="Avatar preview"
            onError={() => setAvatarBroken(true)}
            className="h-[72px] w-[72px] shrink-0 rounded-full object-cover border border-black/10 dark:border-white/10"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-black/10 text-2xl font-semibold dark:bg-white/10"
          >
            {fallbackLetter}
          </div>
        )}

        {/* Name field */}
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Name <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
            className={inputClass("name")}
          />
          {fieldErrors.name && (
            <p id="name-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
              {fieldErrors.name}
            </p>
          )}
        </div>
      </div>

      {/* Image URL — updates the avatar preview above in real time */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="image" className="text-sm font-medium">
          Avatar URL
        </label>
        <input
          id="image"
          type="url"
          value={image}
          onChange={(e) => handleImageChange(e.target.value)}
          placeholder="https://example.com/photo.jpg"
          aria-invalid={!!fieldErrors.image}
          aria-describedby={fieldErrors.image ? "image-error" : undefined}
          className={inputClass("image")}
        />
        {fieldErrors.image && (
          <p id="image-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
            {fieldErrors.image}
          </p>
        )}
      </div>

      {/* Birthdate */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="birthdate" className="text-sm font-medium">
          Birthdate
        </label>
        <input
          id="birthdate"
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          aria-invalid={!!fieldErrors.birthdate}
          aria-describedby={fieldErrors.birthdate ? "birthdate-error" : undefined}
          className={inputClass("birthdate")}
        />
        {fieldErrors.birthdate && (
          <p id="birthdate-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
            {fieldErrors.birthdate}
          </p>
        )}
      </div>

      {/* Bio — textarea with live character counter */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="bio" className="text-sm font-medium">
            Bio
          </label>
          {/* Counter turns red when the user hits the 280-char limit. */}
          <span
            className={`text-xs tabular-nums ${
              bio.length >= 280
                ? "text-red-600 dark:text-red-400"
                : "opacity-50"
            }`}
            aria-live="polite"
          >
            {bio.length}/280
          </span>
        </div>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          maxLength={280}
          aria-invalid={!!fieldErrors.bio}
          aria-describedby={fieldErrors.bio ? "bio-error" : undefined}
          className={`${inputClass("bio")} resize-none`}
        />
        {fieldErrors.bio && (
          <p id="bio-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
            {fieldErrors.bio}
          </p>
        )}
      </div>

      {/* Location */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="location" className="text-sm font-medium">
          Location
        </label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, Country"
          aria-invalid={!!fieldErrors.location}
          aria-describedby={fieldErrors.location ? "location-error" : undefined}
          className={inputClass("location")}
        />
        {fieldErrors.location && (
          <p id="location-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
            {fieldErrors.location}
          </p>
        )}
      </div>

      {/* Submit — disabled while the PUT is in flight */}
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background w-fit rounded-md px-4 py-2 text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
