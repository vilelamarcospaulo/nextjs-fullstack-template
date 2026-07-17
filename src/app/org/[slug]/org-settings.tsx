"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { addMemberByEmail } from "@/app/org/actions";
import { inputToOrganizationName } from "@/internal/domain/organization";
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
import { Separator } from "@/components/ui/separator";

type Member = {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null | undefined;
  };
};

type Props = {
  organization: { id: string; name: string; slug: string };
  viewerRole: string;
  viewerUserId: string;
  members: Member[];
};

// Assignable roles via this UI. "owner" is intentionally excluded — ownership
// transfer isn't part of this feature; the auto-created personal org's
// creator keeps that role for the org's lifetime here.
const ASSIGNABLE_ROLES = ["admin", "member"] as const;

// Native <select>, styled to loosely match Input — there's no shadcn Select
// component in src/components/ui/ yet, and one dropdown doesn't warrant
// introducing the dependency.
const selectClassName =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3";

export default function OrgSettings({
  organization,
  viewerRole,
  viewerUserId,
  members,
}: Props) {
  const router = useRouter();
  const canManage = viewerRole === "owner" || viewerRole === "admin";

  // ── Rename ────────────────────────────────────────────────────────────────
  const [name, setName] = useState(organization.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [renamePending, setRenamePending] = useState(false);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const validation = inputToOrganizationName({ name });
    if (!validation.ok) {
      setNameError(validation.errors.name);
      return;
    }
    setNameError(undefined);
    setRenamePending(true);
    try {
      await authClient.organization.update({
        organizationId: organization.id,
        data: { name: validation.value.name },
      });
      toast.success("Organization renamed.");
      router.refresh();
    } catch {
      toast.error("Could not rename the organization. Please try again.");
    } finally {
      setRenamePending(false);
    }
  }

  // ── Add member by email ─────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ASSIGNABLE_ROLES)[number]>("member");
  const [addError, setAddError] = useState<string | undefined>();
  const [addPending, setAddPending] = useState(false);

  const ADD_MEMBER_ERROR_MESSAGES: Record<string, string> = {
    unauthenticated: "Your session expired. Please sign in again.",
    forbidden: "You don't have permission to add members.",
    invalid_email: "Enter a valid email address.",
    invalid_role: "Choose a valid role.",
    no_account_with_that_email:
      "No account exists with that email yet — they need to sign up first.",
    already_a_member: "That person is already a member of this organization.",
  };

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setAddPending(true);
    setAddError(undefined);
    try {
      const result = await addMemberByEmail(organization.id, email, role);
      if (!result.ok) {
        setAddError(ADD_MEMBER_ERROR_MESSAGES[result.error] ?? result.error);
        return;
      }
      toast.success(`${email} added to the organization.`);
      setEmail("");
      router.refresh();
    } finally {
      setAddPending(false);
    }
  }

  // ── Member row actions ──────────────────────────────────────────────────
  async function handleRoleChange(memberId: string, newRole: string) {
    try {
      await authClient.organization.updateMemberRole({
        organizationId: organization.id,
        memberId,
        role: newRole,
      });
      toast.success("Role updated.");
      router.refresh();
    } catch {
      toast.error("Could not update that member's role.");
    }
  }

  async function handleRemove(memberId: string) {
    try {
      await authClient.organization.removeMember({
        organizationId: organization.id,
        memberIdOrEmail: memberId,
      });
      toast.success("Member removed.");
      router.refresh();
    } catch {
      toast.error("Could not remove that member (they may be the only owner).");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            {organization.slug} · your role: {viewerRole}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleRename}
            className="flex flex-col gap-3"
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canManage}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? "org-name-error" : undefined}
              />
              {nameError && (
                <p
                  id="org-name-error"
                  role="alert"
                  className="text-destructive text-sm"
                >
                  {nameError}
                </p>
              )}
            </div>
            {canManage && (
              <div>
                <Button type="submit" size="sm" disabled={renamePending}>
                  {renamePending ? "Saving…" : "Save name"}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>{members.length} member(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {member.user.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {member.user.email}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {canManage && member.userId !== viewerUserId ? (
                    <select
                      className={selectClassName}
                      value={member.role}
                      onChange={(e) =>
                        handleRoleChange(member.id, e.target.value)
                      }
                      aria-label={`Role for ${member.user.name}`}
                    >
                      {/* Include the member's current role even if it's
                          "owner" (not otherwise assignable) so the <select>
                          always has a matching option. */}
                      {!ASSIGNABLE_ROLES.includes(
                        member.role as (typeof ASSIGNABLE_ROLES)[number],
                      ) && <option value={member.role}>{member.role}</option>}
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      {member.role}
                    </span>
                  )}

                  {canManage && member.userId !== viewerUserId && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemove(member.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {canManage && (
            <>
              <Separator className="my-4" />
              <form
                onSubmit={handleAddMember}
                className="flex flex-col gap-3"
                noValidate
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-member-email">
                    Add an existing member by email
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="add-member-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="teammate@example.com"
                      aria-invalid={!!addError}
                      aria-describedby={
                        addError ? "add-member-error" : undefined
                      }
                    />
                    <select
                      className={selectClassName}
                      value={role}
                      onChange={(e) =>
                        setRole(
                          e.target.value as (typeof ASSIGNABLE_ROLES)[number],
                        )
                      }
                      aria-label="Role for new member"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" disabled={addPending}>
                      {addPending ? "Adding…" : "Add"}
                    </Button>
                  </div>
                  {addError && (
                    <p
                      id="add-member-error"
                      role="alert"
                      className="text-destructive text-sm"
                    >
                      {addError}
                    </p>
                  )}
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
