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
import { Input } from "@/components/ui/input";
import type { OrganizationDto } from "@/src/server/organizations/types";
import { organizationsClient } from "@/src/client/organizations";
import { Check, ChevronDown, List, Loader2, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { OrganizationAvatar } from "@/components/organizations/organization-avatar";

type SwitcherOrganization = Pick<OrganizationDto, "id" | "name">;

type OrganizationSwitcherProps = {
  organizations: SwitcherOrganization[];
  nextCursor?: string;
  selectedOrganization?: SwitcherOrganization;
  organizationId?: string;
  placeholder: string;
  createLabel: string;
  manageLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  loadingLabel: string;
  noResultsLabel: string;
  loadErrorLabel: string;
};

export function OrganizationSwitcher({
  organizations,
  nextCursor,
  selectedOrganization,
  organizationId,
  placeholder,
  createLabel,
  manageLabel,
  searchLabel,
  searchPlaceholder,
  loadingLabel,
  noResultsLabel,
  loadErrorLabel,
}: OrganizationSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(organizations);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);

  const resetToInitialPage = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    requestGenerationRef.current += 1;
    setItems(organizations);
    setCursor(nextCursor);
    setLoading(false);
    setError(false);
  }, [nextCursor, organizations]);

  const loadPage = useCallback(async (
    pageCursor: string | undefined,
    replace: boolean,
  ) => {
    if (replace) {
      controllerRef.current?.abort();
      requestGenerationRef.current += 1;
    } else if (controllerRef.current) {
      return;
    }

    const controller = new AbortController();
    const generation = requestGenerationRef.current;
    controllerRef.current = controller;
    setLoading(true);
    setError(false);
    if (replace) setItems([]);

    try {
      const result = await organizationsClient.list({
        status: "active",
        query: query || undefined,
        cursor: pageCursor,
        limit: 25,
      }, controller.signal);
      if (
        controller.signal.aborted ||
        generation !== requestGenerationRef.current
      ) {
        return;
      }

      const page = result.data.organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
      }));
      setItems((current) => replace
        ? page
        : deduplicateOrganizations([...current, ...page]));
      setCursor(result.meta.nextCursor);
    } catch {
      if (
        controller.signal.aborted ||
        generation !== requestGenerationRef.current
      ) {
        return;
      }
      setError(true);
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        if (generation === requestGenerationRef.current) setLoading(false);
      }
    }
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [open, search]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!query) {
      resetToInitialPage();
      return;
    }
    void loadPage(undefined, true);
  }, [loadPage, open, query, resetToInitialPage]);

  const searchPending = search.trim() !== query;

  useEffect(() => {
    if (
      !open ||
      !cursor ||
      loading ||
      error ||
      searchPending ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadPage(cursor, false);
      }
    }, { root, rootMargin: "120px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, error, loadPage, loading, open, searchPending]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) return;
    setSearch("");
    setQuery("");
    resetToInitialPage();
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={handleOpenChange}>
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
              <ChevronDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="flex max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-[var(--radix-dropdown-menu-trigger-width)] flex-col overflow-hidden p-0"
            align="start"
          >
            <div className="relative shrink-0 border-b p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") event.stopPropagation();
                }}
                placeholder={searchPlaceholder}
                aria-label={searchLabel}
                maxLength={255}
                className="pl-9"
              />
            </div>

            <div
              ref={listRef}
              className="min-h-0 flex-1 overflow-y-auto p-1"
              aria-live="polite"
            >
              {items.map((organization) => (
                <DropdownMenuItem
                  key={organization.id}
                  onSelect={() =>
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
              {loading && (
                <div role="status" className="flex items-center justify-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {loadingLabel}
                </div>
              )}
              {!loading && !error && items.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  {noResultsLabel}
                </p>
              )}
              {error && (
                <p role="alert" className="px-2 py-4 text-center text-xs text-destructive">
                  {loadErrorLabel}
                </p>
              )}
              <div ref={sentinelRef} className="h-px" aria-hidden />
            </div>

            <div className="shrink-0 border-t p-1">
              <DropdownMenuItem onSelect={() => router.push("/tool/organizations/new")}>
                <Plus /> {createLabel}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/tool/organizations")}>
                <List /> {manageLabel}
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function deduplicateOrganizations(organizations: SwitcherOrganization[]) {
  return Array.from(
    new Map(organizations.map((organization) => [organization.id, organization])).values(),
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
          <ChevronDown className="ml-auto" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
