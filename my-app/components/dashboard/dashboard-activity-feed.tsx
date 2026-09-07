"use client";

import type { DashboardActivityItem } from "@/src/contracts/dashboard";
import { dashboardClient } from "@/src/client/dashboard";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Labels = {
  empty: string;
  loading: string;
  loadError: string;
  activityText: Record<DashboardActivityItem["code"], string>;
};

export function DashboardActivityFeed({
  organizationId,
  initialItems,
  initialCursor,
  locale,
  labels,
}: {
  organizationId: string;
  initialItems: DashboardActivityItem[];
  initialCursor: string | null;
  locale: "de" | "en";
  labels: Labels;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(false);
    try {
      const result = await dashboardClient.listActivity(organizationId, {
        limit: 20,
        cursor,
      });
      setItems((current) => [...current, ...result.data.activity]);
      setCursor(result.meta.nextCursor ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, organizationId]);

  const loadTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = loadTriggerRef.current;
    const scrollContainer = trigger?.parentElement;
    if (!trigger || !scrollContainer || !cursor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { root: scrollContainer, rootMargin: "0px 0px 80px" },
    );
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  if (!items.length) return <p className="flex h-full min-h-24 items-center justify-center py-6 text-center text-sm text-muted-foreground">{labels.empty}</p>;

  return <>
    <ul className="space-y-4">{items.map((item) => <li key={item.id}>{activityLink(item, labels.activityText[item.code], relative)}</li>)}</ul>
    {cursor && <div ref={loadTriggerRef} aria-hidden="true" className="h-px" data-activity-load-trigger />}
    {loading && <p className="mt-3 text-center text-xs text-muted-foreground">{labels.loading}</p>}
    {error && <p role="alert" className="mt-3 text-xs text-destructive">{labels.loadError}</p>}
  </>;
}

function activityLink(item: DashboardActivityItem, label: string, relative: Intl.RelativeTimeFormat) {
  const detail = typeof item.params.documentTitle === "string" ? item.params.documentTitle : typeof item.params.itemTitle === "string" ? item.params.itemTitle : typeof item.params.questionPosition === "number" ? `#${item.params.questionPosition + 1}` : "";
  const content = <span className="group flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-xs text-purple-500">{item.actor.initials}</span><span><span className="text-sm group-hover:underline"><strong>{item.actor.displayName}</strong> · {label}{detail ? ` ${detail}` : ""}</span><time dateTime={item.occurredAt} suppressHydrationWarning className="mt-1 block text-xs text-muted-foreground">{relativeTime(item.occurredAt, relative)}</time></span></span>;
  return item.href ? <Link href={item.href}>{content}</Link> : content;
}

function relativeTime(value: string, formatter: Intl.RelativeTimeFormat) {
  const seconds = Math.round((Date.parse(value) - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}
