"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { inputToProfile, type Field } from "@/internal/domain/profile";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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

// ProfileForm handles the complete edit-profile flow:
//   1. Client-side validation via shared inputToProfile (instant UX feedback).
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

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = { name, image, birthdate, bio, location };

    // Client-side validation: gives instant feedback without a round-trip.
    const validation = inputToProfile(payload);
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
        toast.success("Profile saved.");
        // Refresh server components (home page header re-reads name/image).
        router.refresh();
      } else if (res.status === 400) {
        // Server errors are the source of truth — render them inline.
        const serverErrors: FieldErrors = {};

        for (const [key, msg] of Object.entries(
          json.errors as Record<string, string>,
        )) {
          if (key === "_body" || key === "_auth") {
            // Non-field errors go to a toast.
            toast.error(msg as string);
          } else {
            serverErrors[key as Field] = msg;
          }
        }

        setFieldErrors(serverErrors);
      } else if (res.status === 401) {
        // Session expired between page load and submit — retrying won't help;
        // send them back to the home page to sign in again.
        router.push("/");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } catch {
      toast.error("Network error. Please check your connection.");
    } finally {
      setPending(false);
    }
  }

  // The first letter of name (or email) as a fallback avatar character.
  const fallbackLetter = (name || email || "?")[0]?.toUpperCase() ?? "?";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Manage your public profile information.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-6"
          noValidate
        >
          {/* Identity row: live avatar preview + name + email */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {/* AvatarImage falls back to AvatarFallback automatically on load error */}
              <AvatarImage src={image || undefined} alt="Avatar preview" />
              <AvatarFallback>{fallbackLetter}</AvatarFallback>
            </Avatar>

            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">{name || email}</p>
              <p className="text-muted-foreground text-xs">{email}</p>
            </div>
          </div>

          <Separator />

          {/* Name field */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">
              Name{" "}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? "name-error" : undefined}
            />
            {fieldErrors.name && (
              <p
                id="name-error"
                role="alert"
                className="text-destructive text-sm"
              >
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Image URL — updates the avatar preview above in real time */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="image">Avatar URL</Label>
            <Input
              id="image"
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              aria-invalid={!!fieldErrors.image}
              aria-describedby={fieldErrors.image ? "image-error" : undefined}
            />
            {fieldErrors.image && (
              <p
                id="image-error"
                role="alert"
                className="text-destructive text-sm"
              >
                {fieldErrors.image}
              </p>
            )}
          </div>

          {/* Birthdate */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="birthdate">Birthdate</Label>
            <Input
              id="birthdate"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              aria-invalid={!!fieldErrors.birthdate}
              aria-describedby={
                fieldErrors.birthdate ? "birthdate-error" : undefined
              }
            />
            {fieldErrors.birthdate && (
              <p
                id="birthdate-error"
                role="alert"
                className="text-destructive text-sm"
              >
                {fieldErrors.birthdate}
              </p>
            )}
          </div>

          {/* Bio — textarea with live character counter */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="bio">Bio</Label>
              {/* Counter turns destructive when the user hits the 280-char limit. */}
              <span
                className={`text-xs tabular-nums ${
                  bio.length >= 280
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
                aria-live="polite"
              >
                {bio.length}/280
              </span>
            </div>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={280}
              aria-invalid={!!fieldErrors.bio}
              aria-describedby={fieldErrors.bio ? "bio-error" : undefined}
              className="resize-none"
            />
            {fieldErrors.bio && (
              <p
                id="bio-error"
                role="alert"
                className="text-destructive text-sm"
              >
                {fieldErrors.bio}
              </p>
            )}
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Country"
              aria-invalid={!!fieldErrors.location}
              aria-describedby={
                fieldErrors.location ? "location-error" : undefined
              }
            />
            {fieldErrors.location && (
              <p
                id="location-error"
                role="alert"
                className="text-destructive text-sm"
              >
                {fieldErrors.location}
              </p>
            )}
          </div>

          {/* Submit — disabled while the PUT is in flight */}
          <div>
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
