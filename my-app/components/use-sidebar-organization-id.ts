"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function useSidebarOrganizationId(fallbackOrganizationId?: string) {
  const pathname = usePathname();
  const pathnameOrganizationId = getOrganizationIdFromPathname(pathname);
  const [rememberedOrganizationId, setRememberedOrganizationId] = useState(
    pathnameOrganizationId ?? fallbackOrganizationId,
  );

  useEffect(() => {
    if (pathnameOrganizationId) {
      setRememberedOrganizationId(pathnameOrganizationId);
    }
  }, [pathnameOrganizationId]);

  return (
    pathnameOrganizationId ??
    rememberedOrganizationId ??
    fallbackOrganizationId
  );
}

export function getOrganizationIdFromPathname(pathname: string) {
  const organizationId = /^\/tool\/organizations\/([^/]+)/.exec(pathname)?.[1];

  return organizationId && organizationId !== "new"
    ? decodeURIComponent(organizationId)
    : undefined;
}
