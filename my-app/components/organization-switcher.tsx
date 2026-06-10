"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { OrganizationDto } from "@/src/server/organizations/types";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";

type OrganizationSwitcherProps = {
  organizations: Pick<OrganizationDto, "id" | "name">[];
  organizationId?: string;
  placeholder: string;
};

export function OrganizationSwitcher({
  organizations,
  organizationId,
  placeholder,
}: OrganizationSwitcherProps) {
  const router = useRouter();

  if (organizations.length === 0) {
    return null;
  }

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
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1 text-left leading-none">
                <span className="block truncate font-medium">
                  {selectedOrganization?.name ?? placeholder}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width)"
            align="start"
          >
            {organizations.map((organization) => (
              <DropdownMenuItem
                key={organization.id}
                onSelect={() =>
                  router.push(`/tool/organizations/${organization.id}`)
                }
              >
                <span className="truncate">{organization.name}</span>
                {organization.id === organizationId && (
                  <Check className="ml-auto" />
                )}
              </DropdownMenuItem>
            ))}
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
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="size-4" />
          </div>
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-auto" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
