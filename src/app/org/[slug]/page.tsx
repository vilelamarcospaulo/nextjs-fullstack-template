import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAuth } from "@/lib/auth";
import OrgSettings from "./org-settings";

// Server Component: resolves the org by slug server-side (via better-auth's
// own get-full-organization endpoint, which already enforces "viewer must be
// a member" — see organization/routes/crud-org.mjs) so the page hydrates with
// correct data on first paint, same pattern as src/app/profile/page.tsx.
export default async function OrgPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  // auth.api.getFullOrganization throws (FORBIDDEN/BAD_REQUEST) when the slug
  // doesn't exist or the viewer isn't a member — both cases just bounce home
  // rather than showing a dedicated error page, matching this app's existing
  // "redirect on guard failure" convention.
  let organization;
  try {
    organization = await getAuth().api.getFullOrganization({
      headers: await headers(),
      query: { organizationSlug: slug },
    });
  } catch {
    redirect("/");
  }
  if (!organization) {
    redirect("/");
  }

  const viewerMember = organization.members.find(
    (member) => member.userId === session.user.id,
  );
  if (!viewerMember) {
    redirect("/");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <OrgSettings
        organization={{
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        }}
        viewerRole={viewerMember.role}
        viewerUserId={session.user.id}
        members={organization.members}
      />
    </div>
  );
}
