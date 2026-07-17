"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { signOut, authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignInButton } from "@/app/auth-buttons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Lowercase/hyphenate a name into a URL-safe slug. Deliberately simple/inline
// per the org actions convention (src/app/org/actions.ts) — not imported from
// src/internal/domain/organization.ts, which someone else is building for a
// different concern (validating org name/slug on the settings page).
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type NavUser = {
  name: string;
  email: string;
  image?: string | null | undefined;
};

function initials(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed) {
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  const localPart = email.split("@")[0];
  if (localPart) {
    return localPart[0].toUpperCase();
  }
  return "?";
}

export function Navbar({ user }: { user: NavUser | null }) {
  const router = useRouter();
  const { data: organizations } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const [newOrgName, setNewOrgName] = useState("");

  async function handleSwitchOrganization(organizationId: string) {
    await authClient.organization.setActive({ organizationId });
    router.refresh();
  }

  async function handleCreateOrganization() {
    const name = newOrgName.trim();
    if (!name) return;
    await authClient.organization.create({ name, slug: slugify(name) });
    setNewOrgName("");
    router.refresh();
  }

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-semibold">
          Content Generator
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {user === null ? (
            <SignInButton />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="User menu"
                className="focus-visible:ring-ring hover:bg-accent/50 flex items-center gap-2 rounded-lg py-1 pr-1 pl-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {/* Name + active-org indicator, visible in the bar itself
                    (not just after opening the menu). Hidden below `sm` so it
                    doesn't crowd out the rest of the header on narrow
                    viewports — the avatar alone still opens the same menu.
                    Width is FIXED (not max-w): a max-width lets the box grow
                    to fit whichever line is longer (the org name is often the
                    longer one), which both widens the header and — since
                    `items-end` sizes flex children to their own content
                    rather than stretching them — left the shorter name line
                    sized independently of the org line below it, looking
                    uncentered/misaligned. A fixed width plus the default
                    flex `stretch` (no `items-end`) makes both lines the same
                    box width, and `text-right` on the container keeps both
                    right-aligned and lets `truncate` clip the org name
                    (never the reverse) to that shared width. */}
                <span className="hidden w-32 flex-col text-right leading-tight sm:flex">
                  <span className="truncate text-sm font-medium">
                    {user.name}
                  </span>
                  {activeOrganization && (
                    <span className="text-muted-foreground truncate text-xs">
                      {activeOrganization.name}
                    </span>
                  )}
                </span>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={user.image ?? undefined} alt={user.name} />
                  <AvatarFallback>
                    {initials(user.name, user.email)}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {/* Identity header — display only, not a Menu.GroupLabel (base-ui
                    requires those to live inside a Menu.Group). */}
                <div className="flex flex-col gap-0.5 px-1.5 py-1.5">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {user.email}
                  </span>
                </div>
                <DropdownMenuSeparator />
                {/* Org switcher. Additive section between the identity header
                    and the existing Profile/Sign out items. Plain div label —
                    not a DropdownMenuLabel/Menu.GroupLabel, which base-ui
                    requires to live inside a <Menu.Group> (same reasoning as
                    the identity header above). */}
                <div className="text-muted-foreground px-1.5 py-1 text-xs font-medium">
                  Organizations
                </div>
                {organizations?.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => handleSwitchOrganization(org.id)}
                  >
                    <span className="flex-1 truncate">{org.name}</span>
                    {activeOrganization?.id === org.id && (
                      <CheckIcon className="text-muted-foreground size-4" />
                    )}
                  </DropdownMenuItem>
                ))}
                {/* Plain div (not a DropdownMenuItem) so the text input can
                    receive keystrokes without base-ui's menu typeahead/keyboard
                    navigation intercepting them — same "display only, not a
                    Menu item" reasoning as the identity header above. */}
                <div className="flex items-center gap-1.5 px-1.5 py-1">
                  <Input
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="New organization"
                    aria-label="New organization name"
                    className="h-7 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleCreateOrganization}
                    className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-medium"
                  >
                    Create
                  </button>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link href="/profile" className="w-full">
                    Profile
                  </Link>
                </DropdownMenuItem>
                {activeOrganization && (
                  <DropdownMenuItem>
                    <Link
                      href={`/org/${activeOrganization.slug}`}
                      className="w-full"
                    >
                      Organization settings
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={async () => {
                    await signOut();
                    router.refresh();
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
