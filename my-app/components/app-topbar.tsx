import { AuthButton } from "@/components/auth-button";
import {
  OrganizationSwitcher,
  OrganizationSwitcherFallback,
} from "@/components/organization-switcher";
import { Button } from "@/components/ui/button";
import { hasEnvVars } from "@/lib/utils";
import { requireAuth } from "@/lib/supabase/require-auth";
import { listOrganizationsForUser } from "@/src/server/organizations/service";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

type AppTopbarProps = {
  organizationId?: string;
  organizationName?: string;
};

export function AppTopbar(props: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background px-6 md:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <Link href="/tool/organizations" className="text-sm font-semibold">
          complyx
        </Link>
        {props.organizationId && (
          <Suspense
            fallback={
              <OrganizationSwitcherFallback
                label={props.organizationName ?? "Organization"}
              />
            }
          >
            <OrganizationSwitcherLoader
              organizationId={props.organizationId}
            />
          </Suspense>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button asChild variant="outline">
          <Link href="/tool/organizations/inbox">
            <Inbox />
            Inbox
          </Link>
        </Button>
        {hasEnvVars ? (
          <Suspense>
            <AuthButton />
          </Suspense>
        ) : (
          <p className="text-sm text-muted-foreground">
            Supabase environment variables missing.
          </p>
        )}
      </div>
    </header>
  );
}

async function OrganizationSwitcherLoader({
  organizationId,
}: {
  organizationId: string;
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
    />
  );
}
