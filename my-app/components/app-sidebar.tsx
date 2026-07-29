import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { AppSidebarContentSkeleton } from "@/components/navigation-loading";
import {
  OrganizationSwitcher,
  OrganizationSwitcherFallback,
} from "@/components/organization-switcher";
import {
  ProfileMenu,
  ProfileMenuFallback,
} from "@/components/profile-menu";
import { Sidebar } from "@/components/ui/sidebar";
import {
  getDictionary,
  getLocale,
  type Dictionary,
} from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import {
  getOrganizationForUser,
  listOrganizationsForUserPage,
} from "@/src/server/organizations/service";
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
      collapsible="offcanvas"
      mobileLabel={dictionary.sidebar.productName}
      mobileDescription={dictionary.sidebar.productTagline}
      className="
        h-svh
        max-h-svh
        min-h-0
        w-96
        shrink-0
        overflow-hidden
        border-r
        border-white/10
        bg-[rgba(255,255,255,0.10)]
        [&_[data-sidebar=sidebar]]:!bg-transparent
      "
    >
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[rgba(255,255,255,0.10)] max-xl:[&>div>div]:!px-5 max-xl:[&_.w-72]:!w-full xl:bg-transparent">
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
                  placeholder={
                    dictionary.organizations.switcherPlaceholder
                  }
                  createLabel={
                    dictionary.organizations.switcherCreate
                  }
                  manageLabel={
                    dictionary.organizations.switcherManage
                  }
                  searchLabel={dictionary.organizations.switcherSearchLabel}
                  searchPlaceholder={
                    dictionary.organizations.switcherSearchPlaceholder
                  }
                  loadingLabel={dictionary.organizations.switcherLoading}
                  noResultsLabel={dictionary.organizations.switcherNoResults}
                  loadErrorLabel={dictionary.organizations.switcherLoadError}
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
      </div>
    </Sidebar>
  );
}

async function OrganizationSwitcherLoader({
  organizationId,
  placeholder,
  createLabel,
  manageLabel,
  searchLabel,
  searchPlaceholder,
  loadingLabel,
  noResultsLabel,
  loadErrorLabel,
}: {
  organizationId?: string;
  placeholder: string;
  createLabel: string;
  manageLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  loadingLabel: string;
  noResultsLabel: string;
  loadErrorLabel: string;
}) {
  const user = await requireAuth();
  const [organizationPage, selectedOrganization] = await Promise.all([
    listOrganizationsForUserPage({
      userId: user.id,
      status: "active",
      limit: 25,
    }),
    organizationId
      ? getOrganizationForUser(user.id, organizationId)
      : Promise.resolve(null),
  ]);

  return (
    <OrganizationSwitcher
      organizations={organizationPage.organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
      }))}
      nextCursor={organizationPage.nextCursor}
      selectedOrganization={selectedOrganization
        ? { id: selectedOrganization.id, name: selectedOrganization.name }
        : undefined}
      organizationId={organizationId}
      placeholder={placeholder}
      createLabel={createLabel}
      manageLabel={manageLabel}
      searchLabel={searchLabel}
      searchPlaceholder={searchPlaceholder}
      loadingLabel={loadingLabel}
      noResultsLabel={noResultsLabel}
      loadErrorLabel={loadErrorLabel}
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

  const email =
    typeof user?.email === "string"
      ? user.email
      : null;

  const metadata =
    user?.user_metadata &&
    typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : undefined;

  const firstName =
    readMetadataString(metadata, "first_name") ??
    readMetadataString(metadata, "firstName") ??
    readMetadataString(metadata, "given_name");

  const lastName =
    readMetadataString(metadata, "last_name") ??
    readMetadataString(metadata, "lastName") ??
    readMetadataString(metadata, "family_name");

  const fullName =
    readMetadataString(metadata, "full_name") ??
    readMetadataString(metadata, "fullName") ??
    readMetadataString(metadata, "name");

  const combinedName = [firstName, lastName]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.length > 0,
    )
    .join(" ");

  const displayName =
    combinedName || fullName || null;

  return (
    <ProfileMenu
      email={email}
      displayName={displayName}
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

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
) {
  const value = metadata?.[key];

  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}
