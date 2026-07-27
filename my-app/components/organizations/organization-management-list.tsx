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
import { Loader2, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { OrganizationAvatar, organizationInitials } from "./organization-avatar";
import { OrganizationInvitePanel } from "./organization-invite-panel";
import { OrganizationMemberRoster } from "./organization-member-roster";
import { organizationsClient } from "@/src/client/organizations";
import type { Locale } from "@/lib/i18n-config";
import type { Dictionary } from "@/lib/i18n";
import type {
  OrganizationInvitationDto,
  OrganizationListItem,
  OrganizationMemberDto,
} from "@/src/server/organizations/types";
import { localizeUiError } from "@/lib/i18n/errors";

type SerializedItem = Omit<OrganizationListItem, "archivedAt"> & {
  archivedAt: string | null;
};
type SerializedMember = Omit<OrganizationMemberDto, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};
type SerializedInvitation = Omit<
  OrganizationInvitationDto,
  "expiresAt" | "acceptedAt" | "createdAt" | "updatedAt"
> & {
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  teamLabels,
  inviteLabels,
  createHref,
  createLabel,
  loadArchivedOnMount = false,
}: {
  initialActive: { items: SerializedItem[]; cursor?: string };
  initialArchived: { items: SerializedItem[]; cursor?: string };
  locale: Locale;
  labels: Dictionary["organizationManagement"];
  teamLabels: Dictionary["teamManagement"];
  inviteLabels: Dictionary["invite"];
  createHref?: string;
  createLabel?: string;
  loadArchivedOnMount?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Stream>({ ...initialActive, loading: false, error: null });
  const [archived, setArchived] = useState<Stream>({ ...initialArchived, loading: false, error: null });
  const [editing, setEditing] = useState<SerializedItem | null>(null);
  const [managingMembers, setManagingMembers] = useState<SerializedItem | null>(null);
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
    if (loadArchivedOnMount || query) void load("archived", true);
  }, [loadArchivedOnMount, query, load]);

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

  const showArchived =
    archived.items.length > 0 || Boolean(archived.error) || Boolean(archived.cursor);

  return (
    <div className="grid gap-10">
      {notice && <div role="status" className="rounded-lg border border-zinc-700 bg-gray-900 px-4 py-3 text-sm text-zinc-100">{notice}</div>}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-[539px] rounded-lg bg-[#292C34] outline outline-[1.5px] outline-offset-[-1.5px] outline-[#3D4049]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/50" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.searchLabel}
            className="h-12 rounded-lg border-0 bg-transparent py-3 pl-10 pr-3 font-['Space_Grotesk'] text-base font-normal text-neutral-50 shadow-none placeholder:text-neutral-50/60 focus-visible:border-0 focus-visible:ring-blue-700/40"
          />
        </div>
        {createHref && createLabel && (
          <Button
            asChild
            className="h-12 w-full justify-start gap-2 rounded-lg bg-[#002BFF] py-2.5 pl-5 pr-4 text-sm font-semibold leading-5 text-white shadow-none hover:bg-[#002BFF]/90 sm:w-64"
          >
            <Link href={createHref}>
              <Plus className="size-4 shrink-0" />
              <span className="leading-5">{createLabel}</span>
            </Link>
          </Button>
        )}
      </div>

      <OrganizationSection
        title={labels.activeTitle}
        empty={query ? labels.noActiveResults : labels.noActive}
        stream={active}
        sentinel={activeSentinel}
        labels={labels}
        locale={locale}
        onEdit={setEditing}
        onManageMembers={setManagingMembers}
        onArchive={setConfirming}
        onMore={() => load("active", false)}
      />
      {showArchived && (
        <OrganizationSection
          title={labels.archivedTitle}
          empty={query ? labels.noArchivedResults : labels.noArchived}
          stream={archived}
          sentinel={archivedSentinel}
          labels={labels}
          locale={locale}
          onEdit={setEditing}
          onManageMembers={setManagingMembers}
          onArchive={setConfirming}
          onMore={() => load("archived", false)}
        />
      )}

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

      <OrganizationMembersDialog
        item={managingMembers}
        locale={locale}
        teamLabels={teamLabels}
        inviteLabels={inviteLabels}
        closeLabel={labels.close}
        onClose={() => setManagingMembers(null)}
      />

      <Dialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent
          closeLabel={labels.close}
          closeIcon={
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              className="size-8"
              aria-hidden="true"
            >
              <path d="M21 11L12 20" stroke="#9F9FA9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 11L21 20" stroke="#9F9FA9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          overlayClassName="bg-black/75 backdrop-blur-[3px]"
          className="h-[380px] w-[min(649px,calc(100vw-32px))] max-w-none rounded-xl border-[1.5px] border-[#3D4149] bg-[#1B1E27] p-0 font-['Space_Grotesk'] text-white shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10)] sm:h-72 sm:max-w-none [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-[15px] [&_[data-slot=dialog-close]]:flex [&_[data-slot=dialog-close]]:size-8 [&_[data-slot=dialog-close]]:items-center [&_[data-slot=dialog-close]]:justify-center [&_[data-slot=dialog-close]]:rounded-[10px] [&_[data-slot=dialog-close]]:opacity-100 [&_[data-slot=dialog-close]]:ring-offset-0 [&_[data-slot=dialog-close]]:focus:ring-0"
        >
          <DialogTitle className="absolute left-6 right-14 top-[38px] h-10 text-xl font-semibold sm:left-[49px] sm:right-auto sm:inline-flex sm:w-[480px] sm:items-start sm:whitespace-nowrap">
            <span className="leading-8">
              {confirming?.archivedAt ? labels.restoreTitle : labels.archiveTitle}
            </span>
          </DialogTitle>
          <DialogDescription className="absolute left-6 right-6 top-20 text-base font-normal leading-7 text-gray-400 sm:left-[49px] sm:right-auto sm:h-24 sm:w-[515px] sm:text-lg sm:leading-8">
            {confirming?.archivedAt
              ? labels.restoreDescription.replace("{name}", confirming?.name ?? "")
              : labels.archiveDescription.replace("{name}", confirming?.name ?? "")}
          </DialogDescription>
          <div className="absolute bottom-6 left-6 right-6 flex flex-col-reverse items-stretch gap-3 sm:bottom-8 sm:left-auto sm:flex-row sm:items-center">
            <Button
              variant={confirming?.archivedAt ? "default" : "destructive"}
              onClick={archiveOrRestore}
              className={
                confirming?.archivedAt
                  ? "h-12 w-full rounded-lg text-base font-medium sm:w-56"
                  : "inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-lg border-0 bg-red-900 font-['Space_Grotesk'] text-base font-medium text-white shadow-none outline-none hover:bg-red-900/90 focus-visible:border-0 focus-visible:ring-0 sm:w-56"
              }
            >
              {!confirming?.archivedAt && <Trash2 className="size-5" />}
              {confirming?.archivedAt ? labels.restore : labels.archive}
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirming(null)}
              className="h-12 w-full overflow-hidden rounded-lg border-[1.5px] border-[#3D4049] bg-[#3F3F47]/0 font-['Space_Grotesk'] text-base font-medium text-[#D9D9D9] hover:bg-[#3F3F47]/0 hover:text-[#D9D9D9] sm:w-28"
            >
              {labels.cancel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrganizationSection({
  title, empty, stream, sentinel, labels, locale, onEdit, onManageMembers, onArchive, onMore,
}: {
  title: string;
  empty: string;
  stream: Stream;
  sentinel: React.RefObject<HTMLDivElement | null>;
  labels: Dictionary["organizationManagement"];
  locale: Locale;
  onEdit: (item: SerializedItem) => void;
  onManageMembers: (item: SerializedItem) => void;
  onArchive: (item: SerializedItem) => void;
  onMore: () => void;
}) {
  return (
    <section aria-labelledby={`${title}-heading`} className="grid gap-4">
      <h2 id={`${title}-heading`} className="sr-only">{title}</h2>
      <Card className="relative rounded-xl border-[1.5px] border-[#3D4149] !bg-[#1B1E27] p-0 py-0 shadow-none">
        <CardContent className="grid gap-5 p-5 md:px-8 md:py-5">
          {stream.items.length === 0 && !stream.loading ? (
            <p className="rounded-xl border-[1.5px] border-zinc-700 bg-gray-800 p-8 text-center text-sm text-neutral-50/60">{empty}</p>
          ) : stream.items.map((item) => (
            <OrganizationRow key={item.id} item={item} labels={labels} locale={locale} onEdit={onEdit} onManageMembers={onManageMembers} onArchive={onArchive} />
          ))}
          {stream.loading && <div role="status" className="flex items-center gap-2 rounded-xl border-[1.5px] border-zinc-700 bg-gray-800 px-5 py-4 text-sm text-neutral-50/60"><Loader2 className="size-4 animate-spin" />{labels.loading}</div>}
          {stream.error && <div className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-zinc-700 bg-gray-800 px-5 py-4 text-sm text-red-400"><span>{stream.error}</span><Button size="sm" variant="outline" className="border-zinc-700 bg-gray-900 text-zinc-100 hover:bg-blue-950" onClick={onMore}>{labels.retry}</Button></div>}
          {stream.cursor && !stream.loading && <div className="text-center"><Button variant="ghost" size="sm" className="text-zinc-200 hover:bg-blue-950 hover:text-white" onClick={onMore}>{labels.loadMore}</Button></div>}
          <div ref={sentinel} className="absolute bottom-0 h-px w-px" aria-hidden />
        </CardContent>
      </Card>
    </section>
  );
}

function OrganizationRow({
  item, labels, locale, onEdit, onManageMembers, onArchive,
}: {
  item: SerializedItem;
  labels: Dictionary["organizationManagement"];
  locale: Locale;
  onEdit: (item: SerializedItem) => void;
  onManageMembers: (item: SerializedItem) => void;
  onArchive: (item: SerializedItem) => void;
}) {
  const country = localizedCountries(locale).find((candidate) => candidate.code === item.country)?.name ?? item.country;
  const contents = (
    <>
      <OrganizationAvatar id={item.id} name={item.name} className="size-10 rounded-full text-sm leading-5" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold leading-5 text-zinc-100">{item.name}</span>
        <span className="mt-2 block truncate text-sm font-normal leading-4 text-white">{item.legalName || labels.noLegalName} | {country}</span>
      </span>
      <span className="hidden min-w-16 items-center gap-1.5 text-base font-normal leading-5 text-neutral-50 sm:flex"><Users className="size-5 text-zinc-400" />{item.activeMemberCount}</span>
    </>
  );
  return (
    <div className="flex h-20 items-center gap-3 rounded-xl border-[1.5px] border-[#3D4149] bg-[#292C34] px-4 py-0 transition-colors hover:border-[#4A4F59] hover:bg-[#292C34]/90 md:px-5">
      {item.archivedAt ? (
        <div className="flex h-full min-w-0 flex-1 items-center gap-4 opacity-75">{contents}</div>
      ) : (
        <Link href={`/tool/organizations/${item.id}`} className="flex h-full min-w-0 flex-1 items-center gap-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-700">{contents}</Link>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${labels.actions}: ${item.name}`}
            className="rounded-[10px] text-zinc-400 hover:bg-[#18275D] hover:text-zinc-100 data-[state=open]:bg-[#18275D] data-[state=open]:text-zinc-100"
          >
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-2xl border border-[#3D4149] bg-[#1B1E27] p-0 font-['Space_Grotesk'] text-zinc-200 shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.60)]">
          {item.allowedActions.edit && (
            <DropdownMenuItem className="h-12 rounded-none px-4 py-3 text-sm font-medium text-zinc-200 focus:bg-[#18275D] focus:text-zinc-200" onSelect={() => onEdit(item)}>
              <Pencil className="size-3.5 text-zinc-400" />
              {labels.edit}
            </DropdownMenuItem>
          )}
          {!item.archivedAt && (
            <DropdownMenuItem
              className="h-12 rounded-lg border-x-[5px] border-y-[3px] border-[#1B1E27] px-4 py-3 text-sm font-medium text-zinc-200 focus:bg-[#18275D] focus:text-zinc-200"
              onSelect={() => onManageMembers(item)}
            >
              <Users className="size-3.5 text-zinc-400" />
              {item.allowedActions.manageMembers ? labels.manageMembers : labels.viewMembers}
            </DropdownMenuItem>
          )}
          {(item.allowedActions.archive || item.allowedActions.restore) && (
            <>
              <DropdownMenuSeparator className="mx-3 my-1 h-px bg-zinc-700/60" />
              <DropdownMenuItem className="h-12 rounded-none px-4 py-3 text-sm font-medium text-red-400 focus:bg-[#18275D] focus:text-red-400 [&_svg]:text-red-400" variant={item.allowedActions.archive ? "destructive" : "default"} onSelect={() => onArchive(item)}>
                {item.allowedActions.restore ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
                {item.allowedActions.restore ? labels.restore : labels.archive}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function OrganizationMembersDialog({
  item,
  locale,
  teamLabels,
  inviteLabels,
  closeLabel,
  onClose,
}: {
  item: SerializedItem | null;
  locale: Locale;
  teamLabels: Dictionary["teamManagement"];
  inviteLabels: Dictionary["invite"];
  closeLabel: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<SerializedMember[]>([]);
  const [invitations, setInvitations] = useState<SerializedInvitation[]>([]);
  const [controls, setControls] = useState<{
    actorUserId: string;
    canManage: boolean;
    canManageOwners: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setMembers([]);
    setInvitations([]);
    setControls(null);

    void Promise.all([
      organizationsClient.listMembers(item.id, controller.signal),
      item.allowedActions.manageMembers
        ? organizationsClient.listInvitations(item.id, controller.signal)
        : Promise.resolve(null),
    ])
      .then(([memberResult, invitationResult]) => {
        if (controller.signal.aborted) return;
        setMembers(memberResult.data.members as SerializedMember[]);
        setControls(memberResult.data.controls);
        setInvitations(
          (invitationResult?.data.invitations ?? []) as SerializedInvitation[],
        );
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(
          localizeUiError(loadError, { fallback: teamLabels.updateError }),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [item, teamLabels.updateError]);

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        closeLabel={closeLabel}
        className="max-h-[88svh] w-[min(960px,calc(100vw-32px))] max-w-none overflow-y-auto border-[1.5px] border-[#3D4149] bg-[#1B1E27] font-['Space_Grotesk'] text-white"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {item?.name} · {teamLabels.title}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {item?.allowedActions.manageMembers
              ? teamLabels.manageDescription
              : teamLabels.readOnlyDescription}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div
            role="status"
            className="flex min-h-48 items-center justify-center gap-3 text-sm text-gray-400"
          >
            <Loader2 className="size-5 animate-spin" />
            {labelsForLoading(teamLabels)}
          </div>
        )}

        {error && !loading && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {item && controls && !loading && !error && (
          <div className="grid gap-8">
            <OrganizationMemberRoster
              key={`members-${item.id}`}
              organizationId={item.id}
              initialMembers={members}
              controls={controls}
              labels={teamLabels}
            />
            <OrganizationInvitePanel
              key={`invites-${item.id}`}
              organizationId={item.id}
              initialInvitations={invitations}
              labels={inviteLabels}
              locale={locale}
              canManage={controls.canManage}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function labelsForLoading(labels: Dictionary["teamManagement"]) {
  return `${labels.title} werden geladen …`;
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
  const [form, setForm] = useState({ name: "", legalName: "", country: "DE" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fieldDescriptions =
    locale === "de"
      ? {
          organizationName: "Interner Anzeigename für deinen Workspace.",
          legalName: "Offizieller Firmenname laut Handelsregister.",
          country: "Land, in dem die Organisation registriert ist.",
        }
      : {
          organizationName: "Internal display name for your workspace.",
          legalName: "Official company name as registered.",
          country: "Country where the organization is registered.",
        };
  const inputClassName =
    "h-12 rounded-lg border-[1.5px] border-[#3D4049] !bg-white/[0.06] px-5 text-base font-normal leading-5 text-white shadow-sm placeholder:text-zinc-500 focus-visible:border-blue-700 focus-visible:ring-blue-700/40";
  const fieldBlockClassName = "grid w-full max-w-[737px] gap-0";
  const fieldLabelClassName =
    "flex h-8 w-56 items-center text-base font-semibold leading-5 text-white";
  const fieldDescriptionClassName =
    "flex h-8 w-96 items-start text-xs font-normal leading-5 text-gray-400";
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
        policy: {
          openAiDisclosureApproved: settings.policy.externalDisclosureAllowed,
          reason: "",
        },
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
      <DialogContent
        data-organization-edit-dialog
        closeLabel={labels.close}
        closeIcon={
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="size-8"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M21 11L12 20"
              stroke="#9F9FA9"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 11L21 20"
              stroke="#9F9FA9"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        className="
          max-h-[calc(100svh-32px)]
          !w-[810px]
          !max-w-[calc(100vw-24px)]
          gap-0
          overflow-hidden
          rounded-xl
          border-[1.5px]
          border-[#3D4049]
          bg-[#1B1E27]
          p-0
          font-['Space_Grotesk']
          text-white
          shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10),0px_24px_80px_-24px_rgba(0,0,0,0.75)]
          sm:!max-w-[810px]
          [&_[data-slot=dialog-close]]:flex
          [&_[data-slot=dialog-close]]:size-8
          [&_[data-slot=dialog-close]]:items-center
          [&_[data-slot=dialog-close]]:justify-center
          [&_[data-slot=dialog-close]]:right-[30px]
          [&_[data-slot=dialog-close]]:top-[30px]
          [&_[data-slot=dialog-close]]:border-0
          [&_[data-slot=dialog-close]]:rounded-[10px]
          [&_[data-slot=dialog-close]]:bg-transparent
          [&_[data-slot=dialog-close]]:p-0
          [&_[data-slot=dialog-close]]:shadow-none
          [&_[data-slot=dialog-close]]:text-zinc-400
          [&_[data-slot=dialog-close]]:opacity-100
          [&_[data-slot=dialog-close]]:hover:bg-white/5
          [&_[data-slot=dialog-close]]:hover:text-white
          [&_[data-slot=dialog-close]]:focus:ring-0
          [&_[data-slot=dialog-close]]:focus:ring-offset-0
          [&_[data-slot=dialog-close]]:focus:outline-none
        "
      >
        <DialogHeader className="relative h-[88px] min-h-[88px] gap-0 px-0 text-left">
          <div className="absolute left-[38px] top-[38px] flex items-center gap-[15px]">
            {item && (
              <span
                aria-hidden="true"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-600 text-sm font-semibold leading-5 text-neutral-50"
              >
                {organizationInitials(item.name)}
              </span>
            )}
            <DialogTitle className="flex h-8 w-56 items-center text-base font-semibold leading-5 text-white">
              {labels.editTitle}
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            {labels.editDescription}
          </DialogDescription>
          <div aria-hidden="true" className="absolute bottom-0 left-[37px] right-[38px] border-t-[1.5px] border-[#3D4049] opacity-50" />
        </DialogHeader>

        <div className="max-h-[calc(100svh-120px)] overflow-y-auto pb-[30px] pl-[38px] pr-[23px] pt-[35px]">
        {!settings && !error && <div className="flex items-center gap-2 py-10 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" />{labels.loading}</div>}
        {error && <p role="alert" className="mb-5 rounded-lg border border-red-400/30 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}
        {settings && (
          <form onSubmit={save} className="w-full max-w-[737px]">
            <div className="grid gap-[31px]">
              <div className={fieldBlockClassName}>
                <Label htmlFor="edit-name" className={fieldLabelClassName}>{labels.organizationName}</Label>
                <p className={fieldDescriptionClassName}>{fieldDescriptions.organizationName}</p>
                <Input id="edit-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required className={`${inputClassName} w-full`} />
              </div>
              <div className={fieldBlockClassName}>
                <Label htmlFor="edit-legal-name" className={fieldLabelClassName}>{labels.legalName}</Label>
                <p className={fieldDescriptionClassName}>{fieldDescriptions.legalName}</p>
                <Input id="edit-legal-name" value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} className={`${inputClassName} w-full`} />
              </div>
              <div className={fieldBlockClassName}>
                <Label htmlFor="edit-country" className={fieldLabelClassName}>{labels.country}</Label>
                <p className={fieldDescriptionClassName}>{fieldDescriptions.country}</p>
                <div
                  className="
                    w-full
                    sm:w-72
                    [&_[data-slot=select-trigger]]:h-12
                    [&_[data-slot=select-trigger]]:rounded-lg
                    [&_[data-slot=select-trigger]]:border-[1.5px]
                    [&_[data-slot=select-trigger]]:border-[#3D4049]
                    [&_[data-slot=select-trigger]]:!bg-white/[0.06]
                    [&_[data-slot=select-trigger]]:pl-5
                    [&_[data-slot=select-trigger]]:pr-5
                    [&_[data-slot=select-trigger]]:py-0
                    [&_[data-slot=select-trigger]]:font-['Space_Grotesk']
                    [&_[data-slot=select-trigger]]:text-base
                    [&_[data-slot=select-trigger]]:font-normal
                    [&_[data-slot=select-trigger]]:leading-6
                    [&_[data-slot=select-trigger]]:text-white
                    [&_[data-slot=select-trigger]]:shadow-sm
                    [&_[data-slot=select-trigger]]:focus-visible:border-blue-700
                    [&_[data-slot=select-trigger]]:focus-visible:ring-blue-700/40
                  "
                >
                  <CountrySelector
                    id="edit-country"
                    value={form.country}
                    onChange={(country) => setForm({ ...form, country })}
                    locale={locale}
                    openDownward
                  />
                </div>
              </div>
            </div>

            <DialogFooter
              className="
                mt-[18px]
                bg-transparent
                pt-0
                justify-end
                sm:flex-row
                [&_button]:h-12
                [&_button]:rounded-lg
                [&_button]:font-['Space_Grotesk']
                [&_button]:text-base
                [&_button]:font-medium
                [&_button]:shadow-none
                [&_button[data-variant=outline]]:border-zinc-700
                [&_button[data-variant=outline]]:bg-transparent
                [&_button[data-variant=outline]]:text-zinc-200
                [&_button[data-variant=outline]]:hover:bg-white/5
                [&_button[data-variant=outline]]:hover:text-white
              "
            >
              <Button
                type="submit"
                disabled={saving}
                className="h-12 w-full rounded-lg bg-[#002BFF] text-base font-medium text-white shadow-none hover:bg-[#002BFF]/90 sm:w-64"
              >
                {saving ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-5"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      d="M9.99831 12.665V7.99837C9.99831 7.82156 9.92807 7.65199 9.80305 7.52697C9.67803 7.40194 9.50846 7.33171 9.33164 7.33171H3.99831C3.8215 7.33171 3.65193 7.40194 3.52691 7.52697C3.40188 7.65199 3.33164 7.82156 3.33164 7.99837V12.665M3.33164 0.665039V3.33171C3.33164 3.50852 3.40188 3.67809 3.52691 3.80311C3.65193 3.92813 3.8215 3.99837 3.99831 3.99837H8.66498M8.79831 0.665039C9.15 0.670048 9.48547 0.81382 9.73165 1.06504L12.265 3.59837C12.5162 3.84455 12.66 4.18001 12.665 4.53171V11.3317C12.665 11.6853 12.5245 12.0245 12.2745 12.2745C12.0244 12.5246 11.6853 12.665 11.3316 12.665H1.99831C1.64469 12.665 1.30555 12.5246 1.0555 12.2745C0.805454 12.0245 0.664978 11.6853 0.664978 11.3317V1.99837C0.664978 1.64475 0.805454 1.30561 1.0555 1.05556C1.30555 0.805515 1.64469 0.665039 1.99831 0.665039H8.79831Z"
                      stroke="white"
                      strokeWidth="1.33"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {labels.save}
              </Button>
            </DialogFooter>
          </form>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function deduplicate(items: SerializedItem[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}
