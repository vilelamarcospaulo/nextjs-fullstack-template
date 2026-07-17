import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import NewOrganizationForm from "./new-organization-form";

// Server Component: just an auth guard, same pattern as src/app/profile/page.tsx.
// The form itself needs no server-fetched data (there's nothing to prefill).
export default async function NewOrganizationPage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <NewOrganizationForm />
    </div>
  );
}
