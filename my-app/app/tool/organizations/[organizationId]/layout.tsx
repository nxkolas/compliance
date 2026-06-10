import { AppShell } from "@/components/app-shell";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationForUser } from "@/src/server/organizations/service";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

type OrganizationLayoutProps = {
  children: ReactNode;
  params: Promise<{
    organizationId: string;
  }>;
};

export default function OrganizationLayout(props: OrganizationLayoutProps) {
  return (
    <Suspense fallback={<AppShell>{props.children}</AppShell>}>
      <OrganizationLayoutContent {...props} />
    </Suspense>
  );
}

async function OrganizationLayoutContent({
  children,
  params,
}: OrganizationLayoutProps) {
  await connection();
  const user = await requireAuth();
  const { organizationId } = await params;
  const dictionary = await getDictionary();
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  return (
    <AppShell
      organizationId={organization.id}
      dictionary={dictionary}
    >
      {children}
    </AppShell>
  );
}
