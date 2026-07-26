import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { AppSidebarContentSkeleton } from "@/components/navigation-loading";
import {
  OrganizationSwitcher,
  OrganizationSwitcherFallback,
} from "@/components/organization-switcher";
import { ProfileMenu, ProfileMenuFallback } from "@/components/profile-menu";
import { Sidebar } from "@/components/ui/sidebar";
import {
  getDictionary,
  getLocale,
  type Dictionary,
} from "@/lib/i18n";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/require-auth";
import { listOrganizationsForUser } from "@/src/server/organizations/service";
import { Suspense } from "react";

type AppSidebarProps = {
  organizationId?: string;
  dictionary: Dictionary;
};

export function AppSidebar({
  organizationId,
  dictionary,
}: AppSidebarProps) {
  return (
    <Sidebar
  collapsible="none"
  className="
    sticky
    top-0
    h-svh
    max-h-svh
    w-96
    shrink-0
    overflow-hidden
    border-r
    border-white/10
    bg-[rgba(255,255,255,0.10)]
    [&_[data-sidebar=sidebar]]:!bg-transparent
  "
>
      <Suspense fallback={<AppSidebarContentSkeleton />}>
        <AppSidebarNav
          organizationId={organizationId}
          labels={dictionary.sidebar}
          organizationSwitcher={
            <Suspense
              fallback={
                <OrganizationSwitcherFallback
                  label={dictionary.sidebar.organizations}
                />
              }
            >
              <OrganizationSwitcherLoader
                organizationId={organizationId}
                placeholder={dictionary.organizations.switcherPlaceholder}
                createLabel={dictionary.organizations.switcherCreate}
                manageLabel={dictionary.organizations.switcherManage}
              />
            </Suspense>
          }
          profileMenu={
            hasEnvVars ? (
              <Suspense
                fallback={
                  <ProfileMenuFallback
                    label={dictionary.common.loadingProfile}
                    variant="sidebar"
                  />
                }
              >
                <ProfileMenuLoader />
              </Suspense>
            ) : (
              <p className="text-xs text-muted-foreground">
                {dictionary.common.supabaseMissing}
              </p>
            )
          }
        />
      </Suspense>
    </Sidebar>
  );
}

async function OrganizationSwitcherLoader({
  organizationId,
  placeholder,
  createLabel,
  manageLabel,
}: {
  organizationId?: string;
  placeholder: string;
  createLabel: string;
  manageLabel: string;
}) {
  const user = await requireAuth();
  const organizations = await listOrganizationsForUser(user.id);

  return (
    <OrganizationSwitcher
      organizations={organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
      }))}
      organizationId={organizationId}
      placeholder={placeholder}
      createLabel={createLabel}
      manageLabel={manageLabel}
    />
  );
}

async function ProfileMenuLoader() {
  const locale = await getLocale();
  const labels = await getDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email;

  return (
    <ProfileMenu
      email={typeof email === "string" ? email : null}
      locale={locale}
      variant="sidebar"
      labels={{
        common: labels.common,
        languages: labels.languages,
        profile: labels.profile,
        sidebar: labels.sidebar,
      }}
    />
  );
}
