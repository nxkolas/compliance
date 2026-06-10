import {
  OrganizationSwitcher,
  OrganizationSwitcherFallback,
} from "@/components/organization-switcher";
import { ProfileMenu, ProfileMenuFallback } from "@/components/profile-menu";
import { Button } from "@/components/ui/button";
import {
  getDefaultDictionary,
  getDictionary,
  getLocale,
  type Dictionary,
} from "@/lib/i18n";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/require-auth";
import { listOrganizationsForUser } from "@/src/server/organizations/service";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

type AppTopbarProps = {
  organizationId?: string;
  organizationName?: string;
  dictionary?: Dictionary;
};

export function AppTopbar(props: AppTopbarProps) {
  const dictionary = props.dictionary ?? getDefaultDictionary();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-6 md:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <Link href="/tool/organizations" className="text-sm font-semibold">
          {dictionary.common.complyx}
        </Link>
        {props.organizationId && (
          <Suspense
            fallback={
              <OrganizationSwitcherFallback
                label={props.organizationName ?? dictionary.sidebar.organizations}
              />
            }
          >
            <OrganizationSwitcherLoader
              organizationId={props.organizationId}
              placeholder={dictionary.sidebar.organizations}
            />
          </Suspense>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button asChild variant="outline">
          <Link href="/tool/organizations/inbox">
            <Inbox />
            {dictionary.common.inbox}
          </Link>
        </Button>
        {hasEnvVars ? (
          <Suspense
            fallback={
              <ProfileMenuFallback label={dictionary.common.loadingProfile} />
            }
          >
            <ProfileMenuLoader />
          </Suspense>
        ) : (
          <p className="text-sm text-muted-foreground">
            {dictionary.common.supabaseMissing}
          </p>
        )}
      </div>
    </header>
  );
}

async function OrganizationSwitcherLoader({
  organizationId,
  placeholder,
}: {
  organizationId: string;
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
      labels={{
        common: labels.common,
        languages: labels.languages,
        profile: labels.profile,
      }}
    />
  );
}
