import { RouteTabs } from "@/components/route-tabs";
import { getDictionary } from "@/lib/i18n";
import type { ReactNode } from "react";

type OrganizationSettingsLayoutProps = {
  children: ReactNode;
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function OrganizationSettingsLayout({
  children,
  params,
}: OrganizationSettingsLayoutProps) {
  const dictionary = await getDictionary();
  const { organizationId } = await params;

  return (
    <div className="flex w-full flex-col gap-8">
      <RouteTabs
        tabs={[
          {
            href: `/tool/organizations/${organizationId}/settings`,
            label: dictionary.sidebar.general,
          },
          {
            href: `/tool/organizations/${organizationId}/settings/team`,
            label: dictionary.sidebar.team,
          },
        ]}
      />
      {children}
    </div>
  );
}
