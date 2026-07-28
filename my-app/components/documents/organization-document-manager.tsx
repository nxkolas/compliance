"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  documentTypeLabel,
  formatDocumentBytes,
} from "@/lib/documents/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import type {
  DocumentDto,
  DocumentListQuery,
} from "@/src/contracts/documents";
import { documentsClient } from "@/src/client/documents";

type Labels = Dictionary["modules"]["documents"]["workflow"];
type Permissions = {
  canUpload: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canRetryIndexing: boolean;
};
type Counts = { all: number; active: number; archived: number };

const ACCEPTED_FILES =
  ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

export function OrganizationDocumentManager({
  organizationId,
  initialDocuments,
  initialPermissions,
  initialCounts,
  initialNextCursor,
  status,
  search,
  locale,
  labels,
}: {
  organizationId: string;
  initialDocuments: DocumentDto[];
  initialPermissions: Permissions;
  initialCounts: Counts;
  initialNextCursor?: string;
  status: DocumentListQuery["status"];
  search: string;
  locale: Locale;
  labels: Labels;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [documents, setDocuments] = useState(initialDocuments);
  const [permissions, setPermissions] = useState(initialPermissions);
  const [counts, setCounts] = useState(initialCounts);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [searchInput, setSearchInput] = useState(search);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const searchIsEditing = useRef(false);
  const listScope = useRef(`${status}|${search}`);
  const navigate = useCallback(
    (
      nextStatus: DocumentListQuery["status"],
      nextSearch: string,
    ) => {
      const params = new URLSearchParams();
      params.set("status", nextStatus);
      if (nextSearch) params.set("search", nextSearch);
      router.replace(`${pathname}?${params.toString()}`, {
        scroll: false,
      });
    },
    [pathname, router],
  );

  useEffect(() => {
    setDocuments(initialDocuments);
    setPermissions(initialPermissions);
    setCounts(initialCounts);
    setNextCursor(initialNextCursor);
    setSearchInput(search);
    searchIsEditing.current = false;
    listScope.current = `${status}|${search}`;
  }, [
    initialCounts,
    initialDocuments,
    initialNextCursor,
    initialPermissions,
    search,
    status,
  ]);

  useEffect(() => {
    if (!searchIsEditing.current) return;
    const timer = window.setTimeout(() => {
      const normalized = searchInput.trim();
      if (normalized === search) return;
      navigate(status, normalized);
      searchIsEditing.current = false;
    }, 300);
    return () => window.clearTimeout(timer);
  }, [navigate, search, searchInput, status]);

  async function runAction(
    key: string,
    action: () => Promise<{ data: { document: DocumentDto } }>,
    onSuccess: (document: DocumentDto) => void,
    successMessage: string,
  ) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      onSuccess(result.data.document);
      setNotice(successMessage);
    } catch {
      setError(labels.error);
    } finally {
      setBusy(null);
    }
  }

  function replaceOrRemove(document: DocumentDto) {
    setDocuments((current) => {
      const belongs =
        status === "all" || status === document.status;
      if (!belongs) {
        return current.filter((item) => item.id !== document.id);
      }
      return current.map((item) =>
        item.id === document.id ? document : item,
      );
    });
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    const title = form.get("title");
    if (!(file instanceof File) || typeof title !== "string") return;

    setBusy("upload");
    setError(null);
    setNotice(null);
    try {
      const result = await documentsClient.uploadNew(
        organizationId,
        title,
        file,
      );
      const document = result.data.document;
      setCounts((current) => ({
        all: current.all + 1,
        active: current.active + 1,
        archived: current.archived,
      }));
      if (status === "active" || status === "all") {
        setDocuments((current) => [
          document,
          ...current.filter((item) => item.id !== document.id),
        ]);
      }
      setNotice(labels.uploadSuccess);
      setUploadOpen(false);
      formElement.reset();
    } catch {
      setError(labels.error);
      setUploadOpen(false);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    const requestedScope = `${status}|${search}`;
    setBusy("load-more");
    setError(null);
    try {
      const result = await documentsClient.list(organizationId, {
        status,
        search: search || undefined,
        limit: 25,
        cursor: nextCursor,
      });
      if (listScope.current !== requestedScope) return;
      setDocuments((current) => {
        const ids = new Set(current.map((document) => document.id));
        return [
          ...current,
          ...result.data.documents.filter((document) => !ids.has(document.id)),
        ];
      });
      setPermissions(result.data.permissions);
      setCounts(result.data.counts);
      setNextCursor(result.meta.nextCursor);
    } catch {
      setError(labels.error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={status}
            onValueChange={(value) =>
              navigate(value as DocumentListQuery["status"], searchInput.trim())
            }
          >
            <TabsList aria-label={labels.statusColumn}>
              <TabsTrigger value="active">
                {labels.activeTab} ({counts.active})
              </TabsTrigger>
              <TabsTrigger value="all">
                {labels.allTab} ({counts.all})
              </TabsTrigger>
              <TabsTrigger value="archived">
                {labels.archivedTab} ({counts.archived})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {permissions.canUpload ? (
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload />
                  {labels.uploadDocument}
                </Button>
              </DialogTrigger>
              <DialogContent closeLabel={labels.cancel}>
                <form className="grid gap-5" onSubmit={submitUpload}>
                  <DialogHeader>
                    <DialogTitle>{labels.uploadDocument}</DialogTitle>
                    <DialogDescription>
                      {labels.uploadDescription}
                    </DialogDescription>
                  </DialogHeader>
                  <label className="grid gap-2 text-sm font-medium">
                    {labels.documentTitle}
                    <Input name="title" required maxLength={255} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    {labels.documentFile}
                    <Input
                      name="file"
                      type="file"
                      required
                      accept={ACCEPTED_FILES}
                    />
                  </label>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setUploadOpen(false)}
                      disabled={busy === "upload"}
                    >
                      {labels.cancel}
                    </Button>
                    <Button type="submit" disabled={busy === "upload"}>
                      {busy === "upload" ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Upload />
                      )}
                      {labels.upload}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
        <Input
          className="max-w-md"
          value={searchInput}
          onChange={(event) => {
            searchIsEditing.current = true;
            setSearchInput(event.target.value);
          }}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.search}
          maxLength={200}
        />
      </CardHeader>
      <CardContent className="grid gap-4">
        <div aria-live="polite">
          {error ? (
            <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </p>
          ) : notice ? (
            <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900">
              {notice}
            </p>
          ) : null}
        </div>
        {documents.length ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    {labels.titleColumn}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {labels.datatypeColumn}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {labels.sizeColumn}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {labels.uploadedAtColumn}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {labels.statusColumn}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {labels.actionsColumn}
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr
                    key={document.id}
                    className="border-t align-top"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{document.title}</p>
                      <IndexStatusBadge
                        status={document.indexStatus}
                        labels={labels}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {documentTypeLabel(document.mimeType)}
                    </td>
                    <td className="px-4 py-3">
                      {formatDocumentBytes(document.byteSize, locale)}
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(document.uploadedAt, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">
                        {document.status === "active"
                          ? labels.active
                          : labels.archived}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={documentsClient.downloadUrl(
                              organizationId,
                              document.id,
                            )}
                            aria-label={`${labels.download}: ${document.title}`}
                          >
                            <Download />
                            {labels.download}
                          </a>
                        </Button>
                        {document.status === "active" &&
                        document.indexStatus === "failed" &&
                        permissions.canRetryIndexing ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy === `retry-${document.id}`}
                            onClick={() =>
                              void runAction(
                                `retry-${document.id}`,
                                () =>
                                  documentsClient.retryIndexing(
                                    organizationId,
                                    document.id,
                                  ),
                                replaceOrRemove,
                                labels.retrySuccess,
                              )
                            }
                          >
                            {busy === `retry-${document.id}` ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <RefreshCw />
                            )}
                            {labels.retry}
                          </Button>
                        ) : null}
                        {document.status === "active" &&
                        permissions.canArchive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy === `archive-${document.id}`}
                            onClick={() => {
                              if (!window.confirm(labels.archiveConfirm)) return;
                              void runAction(
                                `archive-${document.id}`,
                                () =>
                                  documentsClient.archive(
                                    organizationId,
                                    document.id,
                                  ),
                                (updated) => {
                                  replaceOrRemove(updated);
                                  setCounts((current) => ({
                                    all: current.all,
                                    active: Math.max(0, current.active - 1),
                                    archived: current.archived + 1,
                                  }));
                                },
                                labels.archiveSuccess,
                              );
                            }}
                          >
                            {busy === `archive-${document.id}` ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Archive />
                            )}
                            {labels.archive}
                          </Button>
                        ) : null}
                        {document.status === "archived" &&
                        permissions.canRestore ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy === `restore-${document.id}`}
                            onClick={() =>
                              void runAction(
                                `restore-${document.id}`,
                                () =>
                                  documentsClient.restore(
                                    organizationId,
                                    document.id,
                                  ),
                                (updated) => {
                                  replaceOrRemove(updated);
                                  setCounts((current) => ({
                                    all: current.all,
                                    active: current.active + 1,
                                    archived: Math.max(
                                      0,
                                      current.archived - 1,
                                    ),
                                  }));
                                },
                                labels.restoreSuccess,
                              )
                            }
                          >
                            {busy === `restore-${document.id}` ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <RotateCcw />
                            )}
                            {labels.restore}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? labels.noMatches : labels.noDocuments}
          </p>
        )}
        {nextCursor ? (
          <div className="flex justify-center">
            <Button
              variant="outline"
              disabled={busy === "load-more"}
              onClick={() => void loadMore()}
            >
              {busy === "load-more" ? (
                <>
                  <Loader2 className="animate-spin" />
                  {labels.loadingMore}
                </>
              ) : (
                labels.loadMore
              )}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function IndexStatusBadge({
  status,
  labels,
}: {
  status: DocumentDto["indexStatus"];
  labels: Labels;
}) {
  const text =
    status === "indexed"
      ? labels.indexed
      : status === "failed"
        ? labels.failed
        : labels.processing;
  return (
    <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {text}
    </span>
  );
}
