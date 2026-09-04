import { AppShell } from "@/components/app-shell";
import { getDictionary } from "@/src/i18n";
import { requireAuth } from "@/src/supabase/require-auth";
import { listOrganizationsForUserPage } from "@/src/server/modules/organizations";
import { connection } from "next/server";
import type { ReactNode } from "react";

export default async function OrganizationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  const user = await requireAuth();
  const [dictionary, organizations] = await Promise.all([
    getDictionary(),
    listOrganizationsForUserPage({
      userId: user.id,
      status: "active",
      limit: 25,
    }),
  ]);

  return (
    <AppShell
      dictionary={dictionary}
      organizationId={organizations.organizations[0]?.id}
    >
      {children}
    </AppShell>
  );
}
