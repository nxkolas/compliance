"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Archive, Loader2, Pencil, Plus, RotateCcw, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { organizationsClient } from "@/src/client/organizations";
import type { Locale } from "@/lib/i18n-config";
import type { Dictionary } from "@/lib/i18n";
import type { OrganizationListItem } from "@/src/server/organizations/types";
import { localizeUiError } from "@/lib/i18n/errors";
import { OrganizationAvatar } from "./organization-avatar";

type Serialized<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
type SerializedItem = Serialized<OrganizationListItem>;

export function OrganizationManagementList({
  initialActive,
  initialArchived,
  labels,
  createHref = "/tool/organizations/new",
  createLabel,
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
  const [active, setActive] = useState(initialActive.items);
  const [archived, setArchived] = useState(initialArchived.items);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<SerializedItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const [activeResult, archivedResult] = await Promise.all([
        organizationsClient.list({ status: "active", query, limit: 100 }),
        organizationsClient.list({ status: "archived", query, limit: 100 }),
      ]);
      setActive(activeResult.data.organizations as SerializedItem[]);
      setArchived(archivedResult.data.organizations as SerializedItem[]);
    } catch (error) {
      setNotice(localizeUiError(error, { fallback: labels.loadError }));
    } finally {
      setLoading(false);
    }
  }

  async function toggleArchive(item: SerializedItem) {
    setLoading(true);
    setNotice(null);
    try {
      const result = item.archivedAt
        ? await organizationsClient.restore(item.id)
        : await organizationsClient.archive(item.id);
      const updatedOrganization = result.data.organization;
      const updated: SerializedItem = {
        ...item,
        ...updatedOrganization,
        allowedActions: {
          ...item.allowedActions,
          edit: !updatedOrganization.archivedAt && item.allowedActions.edit,
          archive: !updatedOrganization.archivedAt && (item.allowedActions.archive || item.allowedActions.restore),
          restore: Boolean(updatedOrganization.archivedAt) && (item.allowedActions.archive || item.allowedActions.restore),
        },
      };
      setActive((current) => current.filter((candidate) => candidate.id !== item.id));
      setArchived((current) => current.filter((candidate) => candidate.id !== item.id));
      if (updated.archivedAt) setArchived((current) => [updated, ...current]);
      else setActive((current) => [updated, ...current]);
      setNotice(item.archivedAt ? labels.restoreSuccess : labels.archiveSuccess);
    } catch (error) {
      setNotice(localizeUiError(error, { fallback: labels.mutationError }));
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(values: SerializedItem) {
    setLoading(true);
    try {
      const result = await organizationsClient.update(values.id, {
        name: values.name,
        legalName: values.legalName,
        countryCode: values.countryCode,
        aiProviderMode: values.aiProviderMode,
      });
      const updated = result.data.organization as SerializedItem;
      setActive((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setArchived((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setEditing(null);
      setNotice(labels.saveSuccess);
    } catch (error) {
      setNotice(localizeUiError(error, { fallback: labels.mutationError }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form className="flex max-w-xl flex-1 gap-2" onSubmit={search}>
          <Input aria-label={labels.searchLabel} placeholder={labels.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} />
          <Button variant="outline" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <Search />}</Button>
        </form>
        <Button asChild><Link href={createHref}><Plus />{createLabel}</Link></Button>
      </div>
      {notice ? <p role="status" className="rounded-md border p-3 text-sm text-muted-foreground">{notice}</p> : null}
      <OrganizationSection
        title={labels.activeTitle}
        empty={query ? labels.noActiveResults : labels.noActive}
        items={active}
        labels={labels}
        loading={loading}
        onEdit={setEditing}
        onToggleArchive={toggleArchive}
      />
      <OrganizationSection
        title={labels.archivedTitle}
        empty={query ? labels.noArchivedResults : labels.noArchived}
        items={archived}
        labels={labels}
        loading={loading}
        onEdit={setEditing}
        onToggleArchive={toggleArchive}
      />
      {editing ? (
        <EditOrganizationDialog
          item={editing}
          labels={labels}
          saving={loading}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      ) : null}
    </div>
  );
}

function OrganizationSection({
  title,
  empty,
  items,
  labels,
  loading,
  onEdit,
  onToggleArchive,
}: {
  title: string;
  empty: string;
  items: SerializedItem[];
  labels: Dictionary["organizationManagement"];
  loading: boolean;
  onEdit: (item: SerializedItem) => void;
  onToggleArchive: (item: SerializedItem) => void;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {items.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-muted-foreground">{empty}</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <Link href={`/tool/organizations/${item.id}`} className="flex min-w-0 items-center gap-3">
                  <OrganizationAvatar id={item.id} name={item.name} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{item.legalName || labels.noLegalName} · {item.countryCode}</p>
                  </div>
                </Link>
                <div className="flex gap-1">
                  <Button asChild variant="ghost" size="icon" aria-label={labels.manageMembers}><Link href={`/tool/organizations/${item.id}/settings/team`}><Users /></Link></Button>
                  {item.allowedActions.edit ? <Button variant="ghost" size="icon" aria-label={labels.edit} onClick={() => onEdit(item)}><Pencil /></Button> : null}
                  {item.allowedActions.archive || item.allowedActions.restore ? (
                    <Button variant="ghost" size="icon" disabled={loading} aria-label={item.archivedAt ? labels.restore : labels.archive} onClick={() => void onToggleArchive(item)}>
                      {item.archivedAt ? <RotateCcw /> : <Archive />}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function EditOrganizationDialog({
  item,
  labels,
  saving,
  onClose,
  onSave,
}: {
  item: SerializedItem;
  labels: Dictionary["organizationManagement"];
  saving: boolean;
  onClose: () => void;
  onSave: (item: SerializedItem) => void;
}) {
  const [form, setForm] = useState(item);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{labels.editTitle}</DialogTitle><DialogDescription>{labels.editDescription}</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label>{labels.organizationName}</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
          <div className="grid gap-2"><Label>{labels.legalName}</Label><Input value={form.legalName ?? ""} onChange={(event) => setForm({ ...form, legalName: event.target.value || null })} /></div>
          <div className="grid gap-2"><Label>{labels.country}</Label><Input maxLength={2} value={form.countryCode} onChange={(event) => setForm({ ...form, countryCode: event.target.value.toUpperCase() })} /></div>
          <div className="grid gap-2"><Label>{labels.aiPolicy}</Label><Select value={form.aiProviderMode} onValueChange={(value) => setForm({ ...form, aiProviderMode: value as SerializedItem["aiProviderMode"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="company_hosted">Company hosted</SelectItem><SelectItem value="openai">OpenAI</SelectItem><SelectItem value="self_hosted">Self-hosted</SelectItem></SelectContent></Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{labels.cancel}</Button><Button disabled={saving} onClick={() => void onSave(form)}>{saving ? <Loader2 className="animate-spin" /> : null}{labels.save}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
