import { AppSidebarNav } from "@/components/app-sidebar-nav";
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
      className="min-h-svh w-[401px] shrink-0 border-r bg-[rgba(255,255,255,0.10)]"
    >
      <Suspense fallback={null}>
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
                placeholder={dictionary.sidebar.organizations}
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
}: {
  organizationId?: string;
  placeholder: string;
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
    />
  );
}

async function ProfileMenuLoader() {
  const locale = await getLocale();
  const labels = await getDictionary();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;

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
