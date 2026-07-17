"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  inputToOrganization,
  slugify,
  type Field,
} from "@/internal/domain/organization";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type FieldErrors = Partial<Record<Field, string>>;

// Dedicated "create organization" page, replacing the cramped inline form
// that used to live in the navbar dropdown.
export default function NewOrganizationForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // Once the user edits the slug directly, stop overwriting it from the name.
  const [slugEdited, setSlugEdited] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validation = inputToOrganization({ name, slug });
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      return;
    }
    setFieldErrors({});
    setPending(true);

    // better-auth's client is built on better-fetch, which resolves to
    // { data, error } rather than throwing on API errors.
    const { data, error } = await authClient.organization.create({
      name: validation.value.name,
      slug: validation.value.slug,
    });

    setPending(false);

    if (error) {
      if (error.code === "ORGANIZATION_ALREADY_EXISTS") {
        setFieldErrors({ slug: "That slug is already taken." });
      } else {
        toast.error(error.message ?? "Could not create the organization.");
      }
      return;
    }

    toast.success(`${data.name} created.`);
    router.push(`/org/${data.slug}`);
    router.refresh();
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>New organization</CardTitle>
        <CardDescription>
          Create a workspace to collaborate with teammates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-org-name">Name</Label>
            <Input
              id="new-org-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={
                fieldErrors.name ? "new-org-name-error" : undefined
              }
            />
            {fieldErrors.name && (
              <p
                id="new-org-name-error"
                role="alert"
                className="text-destructive text-sm"
              >
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-org-slug">Slug</Label>
            <Input
              id="new-org-slug"
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value);
              }}
              aria-invalid={!!fieldErrors.slug}
              aria-describedby={
                fieldErrors.slug ? "new-org-slug-error" : undefined
              }
            />
            {fieldErrors.slug && (
              <p
                id="new-org-slug-error"
                role="alert"
                className="text-destructive text-sm"
              >
                {fieldErrors.slug}
              </p>
            )}
          </div>

          <div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Creating…" : "Create organization"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
