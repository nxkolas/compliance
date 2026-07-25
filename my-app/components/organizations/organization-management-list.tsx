"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Loader2, MoreHorizontal, Pencil, RotateCcw, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CountrySelector, localizedCountries } from "./country-selector";
import { OrganizationAvatar } from "./organization-avatar";
import { organizationsClient } from "@/src/client/organizations";
import type { Locale } from "@/lib/i18n-config";
import type { Dictionary } from "@/lib/i18n";
import type { OrganizationListItem } from "@/src/server/organizations/types";
import { localizeUiError } from "@/lib/i18n/errors";

type SerializedItem = Omit<OrganizationListItem, "archivedAt"> & {
  archivedAt: string | null;
};
type Stream = {
  items: SerializedItem[];
  cursor?: string;
  loading: boolean;
  error: string | null;
};

export function OrganizationManagementList({
  initialActive,
  initialArchived,
  locale,
  labels,
}: {
  initialActive: { items: SerializedItem[]; cursor?: string };
  initialArchived: { items: SerializedItem[]; cursor?: string };
  locale: Locale;
  labels: Dictionary["organizationManagement"];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Stream>({ ...initialActive, loading: false, error: null });
  const [archived, setArchived] = useState<Stream>({ ...initialArchived, loading: false, error: null });
  const [editing, setEditing] = useState<SerializedItem | null>(null);
  const [confirming, setConfirming] = useState<SerializedItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const activeSentinel = useRef<HTMLDivElement>(null);
  const archivedSentinel = useRef<HTMLDivElement>(null);
  const requestGeneration = useRef(0);
  const controllers = useRef<Partial<Record<"active" | "archived", AbortController>>>({});

  const load = useCallback(async (
    status: "active" | "archived",
    reset: boolean,
  ) => {
    if (reset) controllers.current[status]?.abort();
    else if (controllers.current[status]) return;
    const controller = new AbortController();
    controllers.current[status] = controller;
    const setter = status === "active" ? setActive : setArchived;
    let cursor: string | undefined;
    setter((current) => {
      cursor = reset ? undefined : current.cursor;
      return { ...current, loading: true, error: null };
    });
    const generation = requestGeneration.current;
    try {
      const result = await organizationsClient.list({ status, query: query || undefined, cursor, limit: 25 }, controller.signal);
      if (generation !== requestGeneration.current || controller.signal.aborted) return;
      const page = result.data.organizations as SerializedItem[];
      setter((current) => ({
        items: reset ? page : deduplicate([...current.items, ...page]),
        cursor: result.meta.nextCursor,
        loading: false,
        error: null,
      }));
    } catch (error) {
      if (generation !== requestGeneration.current || controller.signal.aborted) return;
      setter((current) => ({
        ...current,
        loading: false,
        error: localizeUiError(error, { fallback: labels.loadError }),
      }));
    } finally {
      if (controllers.current[status] === controller) delete controllers.current[status];
    }
  }, [labels.loadError, query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    requestGeneration.current += 1;
    void load("active", true);
    void load("archived", true);
  }, [query, load]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target === activeSentinel.current && active.cursor && !active.loading) void load("active", false);
        if (entry.target === archivedSentinel.current && archived.cursor && !archived.loading) void load("archived", false);
      }
    }, { rootMargin: "240px" });
    if (activeSentinel.current) observer.observe(activeSentinel.current);
    if (archivedSentinel.current) observer.observe(archivedSentinel.current);
    return () => observer.disconnect();
  }, [active.cursor, active.loading, archived.cursor, archived.loading, load]);

  function mutateItem(item: SerializedItem, target: "active" | "archived") {
    setActive((stream) => ({ ...stream, items: stream.items.filter((candidate) => candidate.id !== item.id) }));
    setArchived((stream) => ({ ...stream, items: stream.items.filter((candidate) => candidate.id !== item.id) }));
    (target === "active" ? setActive : setArchived)((stream) => ({
      ...stream,
      items: deduplicate([...stream.items, item]).sort((a, b) => a.name.localeCompare(b.name, locale)),
    }));
  }

  async function archiveOrRestore() {
    if (!confirming) return;
    const restoring = Boolean(confirming.archivedAt);
    try {
      const result = restoring
        ? await organizationsClient.restore(confirming.id, confirming.version)
        : await organizationsClient.archive(confirming.id, confirming.version);
      const updated = {
        ...confirming,
        ...result.data.organization,
        archivedAt: result.data.organization.archivedAt,
        allowedActions: {
          ...confirming.allowedActions,
          edit: restoring && confirming.allowedActions.restore,
          archive: restoring && confirming.allowedActions.restore,
          restore: !restoring && confirming.allowedActions.archive,
        },
      };
      mutateItem(updated, restoring ? "active" : "archived");
      setNotice(restoring ? labels.restoreSuccess : labels.archiveSuccess);
      setConfirming(null);
      router.refresh();
    } catch (error) {
      setNotice(localizeUiError(error, { fallback: labels.mutationError }));
    }
  }

  return (
    <div className="grid gap-8">
      {notice && <div role="status" className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">{notice}</div>}
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.searchPlaceholder} aria-label={labels.searchLabel} className="pl-9" />
      </div>

      <OrganizationSection
        title={labels.activeTitle}
        empty={query ? labels.noActiveResults : labels.noActive}
        stream={active}
        sentinel={activeSentinel}
        labels={labels}
        locale={locale}
        onEdit={setEditing}
        onArchive={setConfirming}
        onMore={() => load("active", false)}
      />
      <OrganizationSection
        title={labels.archivedTitle}
        empty={query ? labels.noArchivedResults : labels.noArchived}
        stream={archived}
        sentinel={archivedSentinel}
        labels={labels}
        locale={locale}
        onEdit={setEditing}
        onArchive={setConfirming}
        onMore={() => load("archived", false)}
      />

      <OrganizationEditDialog
        item={editing}
        locale={locale}
        labels={labels}
        onClose={() => setEditing(null)}
        onSaved={(item) => {
          mutateItem(item, "active");
          setEditing(null);
          setNotice(labels.saveSuccess);
          router.refresh();
        }}
      />

      <Dialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent closeLabel={labels.close}>
          <DialogHeader>
            <DialogTitle>{confirming?.archivedAt ? labels.restoreTitle : labels.archiveTitle}</DialogTitle>
            <DialogDescription>
              {confirming?.archivedAt
                ? labels.restoreDescription.replace("{name}", confirming?.name ?? "")
                : labels.archiveDescription.replace("{name}", confirming?.name ?? "")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton closeLabel={labels.cancel}>
            <Button variant={confirming?.archivedAt ? "default" : "destructive"} onClick={archiveOrRestore}>
              {confirming?.archivedAt ? labels.restore : labels.archive}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrganizationSection({
  title, empty, stream, sentinel, labels, locale, onEdit, onArchive, onMore,
}: {
  title: string;
  empty: string;
  stream: Stream;
  sentinel: React.RefObject<HTMLDivElement | null>;
  labels: Dictionary["organizationManagement"];
  locale: Locale;
  onEdit: (item: SerializedItem) => void;
  onArchive: (item: SerializedItem) => void;
  onMore: () => void;
}) {
  return (
    <section aria-labelledby={`${title}-heading`} className="grid gap-3">
      <h2 id={`${title}-heading`} className="text-lg font-semibold">{title}</h2>
      <div className="overflow-hidden rounded-xl border bg-card">
        {stream.items.length === 0 && !stream.loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{empty}</p>
        ) : stream.items.map((item) => (
          <OrganizationRow key={item.id} item={item} labels={labels} locale={locale} onEdit={onEdit} onArchive={onArchive} />
        ))}
        {stream.loading && <div role="status" className="flex items-center gap-2 border-t px-5 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{labels.loading}</div>}
        {stream.error && <div className="flex items-center justify-between gap-3 border-t px-5 py-4 text-sm text-destructive"><span>{stream.error}</span><Button size="sm" variant="outline" onClick={onMore}>{labels.retry}</Button></div>}
        {stream.cursor && !stream.loading && <div className="border-t p-3 text-center"><Button variant="ghost" size="sm" onClick={onMore}>{labels.loadMore}</Button></div>}
        <div ref={sentinel} className="h-px" aria-hidden />
      </div>
    </section>
  );
}

function OrganizationRow({
  item, labels, locale, onEdit, onArchive,
}: {
  item: SerializedItem;
  labels: Dictionary["organizationManagement"];
  locale: Locale;
  onEdit: (item: SerializedItem) => void;
  onArchive: (item: SerializedItem) => void;
}) {
  const country = localizedCountries(locale).find((candidate) => candidate.code === item.country)?.name ?? item.country;
  const contents = (
    <>
      <OrganizationAvatar id={item.id} name={item.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.name}</span>
        <span className="block truncate text-sm text-muted-foreground">{item.legalName || labels.noLegalName} · {country}</span>
      </span>
      <span className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex"><Users className="size-4" />{item.activeMemberCount}</span>
    </>
  );
  return (
    <div className="flex items-center border-b p-3 last:border-b-0">
      {item.archivedAt ? (
        <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1 opacity-75">{contents}</div>
      ) : (
        <Link href={`/tool/organizations/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">{contents}</Link>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${labels.actions}: ${item.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {item.allowedActions.edit && <DropdownMenuItem onSelect={() => onEdit(item)}><Pencil />{labels.edit}</DropdownMenuItem>}
          {!item.archivedAt && <DropdownMenuItem asChild><Link href={`/tool/organizations/${item.id}/settings/team`}><Users />{item.allowedActions.manageMembers ? labels.manageMembers : labels.viewMembers}</Link></DropdownMenuItem>}
          {(item.allowedActions.archive || item.allowedActions.restore) && (
            <DropdownMenuItem variant={item.allowedActions.archive ? "destructive" : "default"} onSelect={() => onArchive(item)}>
              {item.allowedActions.restore ? <RotateCcw /> : <Trash2 />}
              {item.allowedActions.restore ? labels.restore : labels.archive}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function OrganizationEditDialog({
  item, locale, labels, onClose, onSaved,
}: {
  item: SerializedItem | null;
  locale: Locale;
  labels: Dictionary["organizationManagement"];
  onClose: () => void;
  onSaved: (item: SerializedItem) => void;
}) {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof organizationsClient.getSettings>>["data"]["settings"] | null>(null);
  const [form, setForm] = useState({ name: "", legalName: "", country: "DE", approved: false, reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!item) return;
    const controller = new AbortController();
    setSettings(null);
    setError(null);
    organizationsClient.getSettings(item.id, controller.signal).then(({ data }) => {
      setSettings(data.settings);
      setForm({
        name: data.settings.organization.name,
        legalName: data.settings.organization.legalName ?? "",
        country: data.settings.organization.country,
        approved: data.settings.policy.externalDisclosureAllowed,
        reason: "",
      });
    }).catch((caught) => {
      if (!controller.signal.aborted) setError(localizeUiError(caught, { fallback: labels.loadError }));
    });
    return () => controller.abort();
  }, [item, labels.loadError]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!item || !settings) return;
    setSaving(true);
    setError(null);
    try {
      const result = await organizationsClient.updateSettings(item.id, {
        organization: { name: form.name, legalName: form.legalName || null, country: form.country },
        policy: { openAiDisclosureApproved: form.approved, reason: form.reason },
      }, settings.concurrencyToken);
      onSaved({
        ...item,
        name: result.data.settings.organization.name,
        legalName: result.data.settings.organization.legalName,
        country: result.data.settings.organization.country,
        version: result.data.settings.organization.version,
      });
    } catch (caught) {
      setError(localizeUiError(caught, { fallback: labels.mutationError }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={labels.close} className="max-h-svh overflow-y-auto rounded-none sm:max-w-2xl sm:rounded-xl">
        <DialogHeader><DialogTitle>{labels.editTitle}</DialogTitle><DialogDescription>{labels.editDescription}</DialogDescription></DialogHeader>
        {!settings && !error && <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="animate-spin" />{labels.loading}</div>}
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {settings && (
          <form onSubmit={save} className="grid gap-5">
            <div className="grid gap-2"><Label htmlFor="edit-name">{labels.organizationName}</Label><Input id="edit-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
            <div className="grid gap-2"><Label htmlFor="edit-legal-name">{labels.legalName}</Label><Input id="edit-legal-name" value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="edit-country">{labels.country}</Label><CountrySelector id="edit-country" value={form.country} onChange={(country) => setForm({ ...form, country })} locale={locale} /></div>
            <div className="grid gap-3 rounded-lg border p-4">
              <label className="flex items-start gap-3"><Checkbox checked={form.approved} onCheckedChange={(value) => setForm({ ...form, approved: value === true })} /><span><span className="block font-medium">{labels.aiPolicy}</span><span className="block text-sm text-muted-foreground">{labels.aiPolicyDescription}</span></span></label>
              {form.approved !== settings.policy.externalDisclosureAllowed && <div className="grid gap-2"><Label htmlFor="edit-reason">{labels.reason}</Label><Input id="edit-reason" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required /></div>}
            </div>
            <DialogFooter className="sticky bottom-0 bg-background py-2" showCloseButton closeLabel={labels.cancel}><Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}{labels.save}</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function deduplicate(items: SerializedItem[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}
