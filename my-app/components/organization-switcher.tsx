"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { OrganizationDto } from "@/src/server/organizations/types";
import { Check, ChevronsUpDown, List, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { OrganizationAvatar } from "@/components/organizations/organization-avatar";

type OrganizationSwitcherProps = {
  organizations: Pick<OrganizationDto, "id" | "name">[];
  organizationId?: string;
  placeholder: string;
  createLabel: string;
  manageLabel: string;
};

export function OrganizationSwitcher({
  organizations,
  organizationId,
  placeholder,
  createLabel,
  manageLabel,
}: OrganizationSwitcherProps) {
  const router = useRouter();

  const selectedOrganization = organizations.find(
    (organization) => organization.id === organizationId,
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {selectedOrganization ? (
                <OrganizationAvatar id={selectedOrganization.id} name={selectedOrganization.name} className="size-8" />
              ) : (
                <span className="size-8 rounded-lg border border-dashed bg-sidebar-accent" aria-hidden />
              )}
              <div className="min-w-0 flex-1 text-left leading-none">
                <span className="block truncate font-medium">
                  {selectedOrganization?.name ?? placeholder}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)]"
            align="start"
          >
            {organizations.map((organization) => (
              <DropdownMenuItem
                key={organization.id}
                onClick={() =>
                  router.push(`/tool/organizations/${organization.id}`)
                }
              >
                <OrganizationAvatar id={organization.id} name={organization.name} className="size-7 rounded-md text-[10px]" />
                <span className="truncate">{organization.name}</span>
                {organization.id === organizationId && (
                  <Check className="ml-auto" />
                )}
              </DropdownMenuItem>
            ))}
            {organizations.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={() => router.push("/tool/organizations/new")}>
              <Plus /> {createLabel}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/tool/organizations")}>
              <List /> {manageLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function OrganizationSwitcherFallback({
  label,
}: {
  label: string;
}) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" disabled>
          <span className="size-8 rounded-lg border border-dashed bg-sidebar-accent" aria-hidden />
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-auto" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
