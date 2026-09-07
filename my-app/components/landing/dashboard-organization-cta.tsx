"use client";

import { OrganizationAvatar } from "@/components/organizations/organization-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { organizationsClient } from "@/src/client/organizations";
import { ArrowRight, List, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type OrganizationOption = {
  id: string;
  name: string;
};

type Labels = {
  button: string;
  title: string;
  description: string;
  searchLabel: string;
  searchPlaceholder: string;
  loading: string;
  noResults: string;
  loadError: string;
  manage: string;
  close: string;
};

const ctaClassName =
  "h-12 min-w-64 rounded-lg bg-[#002BFF] px-7 text-base transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#002BFF] hover:shadow-[0px_7px_16px_0px_rgba(0,43,255,0.55)] active:translate-y-0";

export function DashboardOrganizationCta({
  organizations,
  nextCursor,
  fallbackHref,
  labels,
}: {
  organizations: OrganizationOption[];
  nextCursor?: string;
  fallbackHref: string;
  labels: Labels;
}) {
  const hasMultipleOrganizations = organizations.length > 1 || Boolean(nextCursor);

  if (!hasMultipleOrganizations) {
    const organization = organizations[0];
    const href = organization
      ? `/tool/organizations/${encodeURIComponent(organization.id)}`
      : fallbackHref;

    return (
      <Button asChild size="lg" className={ctaClassName}>
        <Link href={href}>
          <LandingDashboardIcon />
          {labels.button}
        </Link>
      </Button>
    );
  }

  return (
    <OrganizationDashboardDialog
      organizations={organizations}
      nextCursor={nextCursor}
      labels={labels}
    />
  );
}

function OrganizationDashboardDialog({
  organizations,
  nextCursor,
  labels,
}: {
  organizations: OrganizationOption[];
  nextCursor?: string;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(organizations);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    generationRef.current += 1;
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
      requestRef.current?.abort();
      generationRef.current += 1;
    } else if (requestRef.current) {
      return;
    }

    const controller = new AbortController();
    const generation = generationRef.current;
    requestRef.current = controller;
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
      if (controller.signal.aborted || generation !== generationRef.current) return;

      const page = result.data.organizations.map(({ id, name }) => ({ id, name }));
      setItems((current) => replace ? page : deduplicate([...current, ...page]));
      setCursor(result.meta.nextCursor);
    } catch {
      if (!controller.signal.aborted && generation === generationRef.current) {
        setError(true);
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        if (generation === generationRef.current) setLoading(false);
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
      reset();
      return;
    }
    void loadPage(undefined, true);
  }, [loadPage, open, query, reset]);

  useEffect(() => {
    if (!open || !cursor || loading || error || search.trim() !== query) return;
    const root = listRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadPage(cursor, false);
    }, { root, rootMargin: "100px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, error, loadPage, loading, open, query, search]);

  useEffect(() => () => requestRef.current?.abort(), []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) return;
    setSearch("");
    setQuery("");
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" className={ctaClassName}>
          <LandingDashboardIcon />
          {labels.button}
        </Button>
      </DialogTrigger>
      <DialogContent
        closeLabel={labels.close}
        className="dark max-h-[min(42rem,calc(100svh-2rem))] gap-0 overflow-hidden border-white/15 bg-[#111522] p-0 text-white shadow-2xl sm:max-w-xl"
      >
        <DialogHeader className="gap-2 border-b border-white/10 px-6 pb-5 pt-6 pr-14 text-left">
          <DialogTitle className="text-xl leading-7 text-white">{labels.title}</DialogTitle>
          <DialogDescription className="leading-6 text-white/65">
            {labels.description}
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-white/10 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45" aria-hidden="true" />
            <Input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={labels.searchPlaceholder}
              aria-label={labels.searchLabel}
              maxLength={255}
              className="h-11 border-white/15 bg-white/[0.04] pl-9 text-white placeholder:text-white/40"
            />
          </div>
        </div>

        <div ref={listRef} className="min-h-40 max-h-72 overflow-y-auto p-2" aria-live="polite">
          {items.map((organization) => (
            <Link
              key={organization.id}
              href={`/tool/organizations/${encodeURIComponent(organization.id)}`}
              className="group flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-white outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[#5270ff]"
            >
              <OrganizationAvatar id={organization.id} name={organization.name} />
              <span className="min-w-0 flex-1 truncate text-left font-medium">{organization.name}</span>
              <ArrowRight className="size-4 text-white/45 transition-transform group-hover:translate-x-0.5 group-hover:text-white" aria-hidden="true" />
            </Link>
          ))}
          {loading && (
            <div role="status" className="flex items-center justify-center gap-2 px-3 py-5 text-sm text-white/60">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {labels.loading}
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-white/60">{labels.noResults}</p>
          )}
          {error && (
            <p role="alert" className="px-3 py-5 text-center text-sm text-red-300">{labels.loadError}</p>
          )}
          <div ref={sentinelRef} className="h-px" aria-hidden="true" />
        </div>

        <div className="border-t border-white/10 p-3">
          <Button asChild variant="ghost" className="w-full justify-start text-white/75 hover:bg-white/[0.08] hover:text-white">
            <Link href="/tool/organizations">
              <List className="size-4" aria-hidden="true" />
              {labels.manage}
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function deduplicate(organizations: OrganizationOption[]) {
  return Array.from(new Map(organizations.map((organization) => [organization.id, organization])).values());
}

function LandingDashboardIcon() {
  return (
    <svg
      viewBox="0 0 17 17"
      fill="none"
      className="size-5 shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0.666992 0C1.03518 0 1.33398 0.298802 1.33398 0.666992V14C1.33398 14.2652 1.43942 14.5195 1.62695 14.707C1.81449 14.8946 2.06877 15 2.33398 15H15.667C16.0352 15 16.334 15.2988 16.334 15.667C16.334 16.0352 16.0352 16.334 15.667 16.334H2.33398C1.71515 16.334 1.12118 16.088 0.683594 15.6504C0.246009 15.2128 0 14.6188 0 14V0.666992C0 0.298802 0.298802 0 0.666992 0ZM4.83398 9.16699C5.20201 9.16719 5.50098 9.46592 5.50098 9.83398V12.334C5.50071 12.7018 5.20184 13.0008 4.83398 13.001C4.46596 13.001 4.16726 12.702 4.16699 12.334V9.83398C4.16699 9.46579 4.46579 9.16699 4.83398 9.16699ZM9 1.66699C9.36819 1.66699 9.66699 1.96579 9.66699 2.33398V12.334C9.66673 12.702 9.36803 13.001 9 13.001C8.63214 13.0008 8.33327 12.7018 8.33301 12.334V2.33398C8.33301 1.96592 8.63198 1.66719 9 1.66699ZM13.167 5C13.5352 5 13.834 5.2988 13.834 5.66699V12.334C13.8338 12.702 13.5351 13 13.167 13C12.7989 13 12.5002 12.702 12.5 12.334V5.66699C12.5 5.2988 12.7988 5 13.167 5Z"
        fill="currentColor"
      />
    </svg>
  );
}
