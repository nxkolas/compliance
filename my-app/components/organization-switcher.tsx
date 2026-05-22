"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrganizationDto } from "@/src/server/organizations/types";
import { ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";

type OrganizationSwitcherProps = {
  organizations: Pick<OrganizationDto, "id" | "name">[];
  organizationId: string;
};

export function OrganizationSwitcher({
  organizations,
  organizationId,
}: OrganizationSwitcherProps) {
  const router = useRouter();

  if (organizations.length === 0) {
    return null;
  }

  return (
    <Select
      value={organizationId}
      onValueChange={(value) => router.push(`/organizations/${value}`)}
    >
      <SelectTrigger className="h-9 w-[220px]">
        <SelectValue placeholder="Organization" />
      </SelectTrigger>
      <SelectContent>
        {organizations.map((organization) => (
          <SelectItem key={organization.id} value={organization.id}>
            {organization.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function OrganizationSwitcherFallback({
  label,
}: {
  label: string;
}) {
  return (
    <Button variant="outline" className="max-w-[220px] justify-between" disabled>
      <span className="truncate">{label}</span>
      <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
    </Button>
  );
}
