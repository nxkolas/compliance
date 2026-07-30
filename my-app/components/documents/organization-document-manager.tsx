"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  CircleCheck,
  Download,
  Loader2,
  MoreVertical,
  RefreshCw,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DocumentDto | null>(null);
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
    const title = uploadTitle.trim();
    const file = uploadFile;
    if (!file || !title) return;

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
      setUploadTitle("");
      setUploadFile(null);
    } catch {
      setError(labels.error);
      setUploadOpen(false);
      setUploadTitle("");
      setUploadFile(null);
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

  function retryDocument(document: DocumentDto) {
    void runAction(
      `retry-${document.id}`,
      () => documentsClient.retryIndexing(organizationId, document.id),
      replaceOrRemove,
      labels.retrySuccess,
    );
  }

  function archiveDocument(document: DocumentDto) {
    return runAction(
      `archive-${document.id}`,
      () => documentsClient.archive(organizationId, document.id),
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
  }

  function restoreDocument(document: DocumentDto) {
    void runAction(
      `restore-${document.id}`,
      () => documentsClient.restore(organizationId, document.id),
      (updated) => {
        replaceOrRemove(updated);
        setCounts((current) => ({
          all: current.all,
          active: current.active + 1,
          archived: Math.max(0, current.archived - 1),
        }));
      },
      labels.restoreSuccess,
    );
  }

  return (
    <div className="@container/document-library grid min-w-0 gap-7 font-['Space_Grotesk']">
      <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div
          role="tablist"
          aria-label={labels.statusColumn}
          className="flex min-w-0 gap-5 overflow-x-auto"
        >
          <FolderFilter
            count={counts.all}
            label={labels.allTab}
            tone="all"
            selected={status === "all"}
            onSelect={() => navigate("all", searchInput.trim())}
          />
          <FolderFilter
            count={counts.active}
            label={labels.activeTab}
            tone="active"
            selected={status === "active"}
            onSelect={() => navigate("active", searchInput.trim())}
          />
          <FolderFilter
            count={counts.archived}
            label={labels.archivedTab}
            tone="archived"
            selected={status === "archived"}
            onSelect={() => navigate("archived", searchInput.trim())}
          />
        </div>

        {permissions.canUpload ? (
          <Dialog
            open={uploadOpen}
            onOpenChange={(open) => {
              setUploadOpen(open);
              if (!open && busy !== "upload") {
                setUploadTitle("");
                setUploadFile(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="h-12 w-64 cursor-pointer gap-2 overflow-hidden rounded-lg bg-primary px-5 font-['Space_Grotesk'] text-base font-medium text-primary-foreground shadow-none hover:bg-primary">
                <Upload className="size-5" strokeWidth={1.5} />
                {labels.uploadDocument}
              </Button>
            </DialogTrigger>
            <DialogContent
              closeLabel={labels.cancel}
              overlayClassName="bg-scrim/75 backdrop-blur-[3px]"
              className="h-[464px] max-h-[calc(100svh-32px)] w-[min(687px,calc(100vw-32px))] max-w-none gap-0 overflow-hidden rounded-xl border-0 bg-card p-0 font-['Space_Grotesk'] text-card-foreground shadow-2xl outline-[1.5px] outline-offset-[-1.5px] outline-foreground/10 sm:max-w-none [&>[data-slot=dialog-close]]:top-4 [&>[data-slot=dialog-close]]:right-6 [&>[data-slot=dialog-close]]:flex [&>[data-slot=dialog-close]]:size-8 [&>[data-slot=dialog-close]]:items-center [&>[data-slot=dialog-close]]:justify-center [&>[data-slot=dialog-close]]:rounded-[10px] [&>[data-slot=dialog-close]]:text-foreground-subtle [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]]:ring-offset-0 [&>[data-slot=dialog-close]]:hover:bg-foreground/5 [&>[data-slot=dialog-close]]:focus:ring-0 [&>[data-slot=dialog-close]]:data-[state=open]:!bg-transparent"
            >
              <form
                className="relative h-full w-full"
                onSubmit={submitUpload}
              >
                <div className="flex h-16 w-full items-center border-b border-foreground/5 px-6 py-4">
                  <DialogTitle className="text-base leading-6 font-semibold text-foreground">
                    {labels.uploadDialogTitle}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    {labels.uploadDescription}
                  </DialogDescription>
                </div>

                <div className="px-6 py-5">
                  <div className="text-base leading-5 font-medium text-foreground/80">
                    {labels.titleFieldLabel}
                    <span className="text-sm"> *</span>
                  </div>

                  <label className="mt-4 grid gap-1.5 font-['Space_Grotesk'] text-sm leading-5 font-medium text-foreground/80">
                    {labels.documentTitle}
                    <Input
                      name="title"
                      value={uploadTitle}
                      onChange={(event) => setUploadTitle(event.target.value)}
                      required
                      maxLength={255}
                      className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-base text-foreground shadow-none focus-visible:border-muted-foreground focus-visible:ring-1 focus-visible:ring-ring/20 dark:bg-surface"
                    />
                  </label>

                  <div className="mt-8 grid gap-1.5 font-['Space_Grotesk'] text-sm leading-5 font-medium text-foreground/80">
                    <span>{labels.documentFile}</span>
                    <label
                      className="flex min-h-[108px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg bg-surface px-4 py-6 text-center outline-[1.5px] outline-offset-[-1.5px] outline-border-strong transition-colors hover:bg-surface-hover focus-within:outline-primary"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const file = event.dataTransfer.files.item(0);
                        if (file) setUploadFile(file);
                      }}
                    >
                      <input
                        name="file"
                        type="file"
                        accept={ACCEPTED_FILES}
                        className="sr-only"
                        onChange={(event) =>
                          setUploadFile(event.target.files?.item(0) ?? null)
                        }
                      />
                      <Upload
                        aria-hidden="true"
                        className="size-6 text-foreground"
                        strokeWidth={1.3}
                      />
                      <span className="max-w-full truncate text-sm leading-5 font-normal text-foreground">
                        {uploadFile?.name ?? labels.uploadDropzone}
                      </span>
                      <span className="text-xs leading-4 font-normal text-foreground">
                        {labels.uploadDescription}
                      </span>
                    </label>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={
                    busy === "upload" ||
                    !uploadTitle.trim() ||
                    uploadFile === null
                  }
                  className="absolute right-6 bottom-5 h-12 w-36 overflow-hidden rounded-lg bg-primary px-5 text-base font-medium text-primary-foreground shadow-none hover:bg-primary disabled:bg-primary/50 disabled:text-primary-foreground/50 disabled:opacity-100"
                >
                  {busy === "upload" ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  {labels.upload}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <div className="w-full border-b border-foreground/[0.04] pt-3.5 pb-1.5">
        <div className="relative h-12 w-full max-w-[539px]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground/55"
            strokeWidth={1.5}
          />
          <Input
            className="h-12 rounded-md border border-border-strong bg-surface py-3 pr-4 pl-10 font-['Space_Grotesk'] text-base font-normal text-foreground shadow-none caret-foreground selection:bg-foreground/55 selection:text-surface placeholder:text-foreground/55 focus-visible:border-border-strong focus-visible:ring-1 focus-visible:ring-ring/20 dark:bg-surface"
            value={searchInput}
            onChange={(event) => {
              searchIsEditing.current = true;
              setSearchInput(event.target.value);
            }}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.search}
            maxLength={200}
          />
        </div>
      </div>

      <div
        aria-live="polite"
        className={error || notice ? undefined : "hidden"}
      >
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-muted-foreground">
            {error}
          </p>
        ) : notice ? (
          <p className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success-foreground">
            {notice}
          </p>
        ) : null}
      </div>

      <Card className="w-full min-w-0 gap-0 overflow-hidden rounded-xl border-0 bg-card py-px shadow-none outline-[1.2px] outline-offset-[-1.2px] outline-border-strong">
        <div className="overflow-x-auto">
            <div
              aria-hidden="true"
              className="relative h-12 min-w-[1190px] border-b border-foreground/10 font-['Space_Grotesk']"
            >
              <div className="absolute top-[17px] left-8 h-7 w-44 text-base leading-4 font-semibold tracking-wide text-foreground uppercase">
                {labels.titleColumn}
              </div>
              <div className="absolute top-[17px] left-[38.57%] h-7 w-48 text-base leading-4 font-semibold tracking-wide text-foreground uppercase">
                {labels.datatypeColumn}
              </div>
              <div className="absolute top-[18px] left-[55.29%] h-7 w-24 text-base leading-4 font-semibold tracking-wide text-foreground uppercase">
                {labels.sizeColumn}
              </div>
              <div className="absolute top-[18px] left-[66.22%] h-7 w-20 text-base leading-4 font-semibold tracking-wide text-foreground uppercase">
                {labels.uploadedAtColumn}
              </div>
              <div className="absolute top-[16.8px] left-[79.16%] h-7 w-[14.54%] text-center text-base leading-4 font-semibold tracking-wide text-foreground uppercase">
                {labels.statusColumn}
              </div>
            </div>
            <table className="w-full min-w-[1190px] table-fixed border-collapse text-left font-['Space_Grotesk']">
              <colgroup>
                <col className="w-[38.57%]" />
                <col className="w-[16.97%]" />
                <col className="w-[10.76%]" />
                <col className="w-[12.86%]" />
                <col className="w-[14.54%]" />
                <col className="w-[6.3%]" />
              </colgroup>
              <thead className="sr-only">
                <tr>
                  <th>
                    {labels.titleColumn}
                  </th>
                  <th>
                    {labels.datatypeColumn}
                  </th>
                  <th>
                    {labels.sizeColumn}
                  </th>
                  <th>
                    {labels.uploadedAtColumn}
                  </th>
                  <th>
                    {labels.statusColumn}
                  </th>
                  <th>
                    <span className="sr-only">{labels.actionsColumn}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => {
                  const datatype = documentTypeLabel(document.mimeType);
                  return (
                    <tr
                      key={document.id}
                      className="h-20 border-b border-foreground/5 align-middle last:border-b-0"
                    >
                      <td className="px-8 py-[14px]">
                        <div className="flex min-w-0 items-center gap-4">
                          <DocumentFileIcon datatype={datatype} />
                          <div className="w-72 min-w-0">
                            <p
                              className="h-5 truncate text-base leading-5 font-semibold text-foreground/90"
                              title={document.title}
                            >
                              {document.title}
                            </p>
                            <div className="flex h-4 w-full items-start pt-0.5 text-sm leading-4 font-normal uppercase">
                              <span className="truncate text-foreground/30">
                                {datatype}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-0 py-3 text-base leading-5 text-foreground/40">
                        <div className="w-52 truncate">{datatype}</div>
                      </td>
                      <td className="px-0 py-3 text-base leading-5 text-foreground/30">
                        {formatDocumentBytes(document.byteSize, locale)}
                      </td>
                      <td className="px-0 py-3 text-base leading-5 text-foreground/30">
                        {formatDate(document.uploadedAt, locale)}
                      </td>
                      <td className="px-0 py-3">
                        <div className="flex w-full justify-center">
                          <DocumentStatusBadge
                            archivedLabel={labels.archived}
                            activeLabel={labels.active}
                            status={document.status}
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-[43px] text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`${labels.actionsColumn}: ${document.title}`}
                              className="size-8 rounded-[10px] text-foreground-subtle hover:bg-foreground/5 hover:text-foreground data-[state=open]:bg-foreground/5 data-[state=open]:text-foreground"
                            >
                              <MoreVertical className="size-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-44 overflow-hidden rounded-2xl border border-border-strong bg-card p-1 font-['Space_Grotesk'] text-muted-foreground shadow-menu"
                          >
                            <DropdownMenuItem
                              asChild
                              className="h-12 gap-2 rounded-lg px-3 py-3 text-sm leading-5 font-medium text-muted-foreground focus:bg-accent focus:text-muted-foreground [&_svg]:text-foreground-subtle"
                            >
                              <a
                                href={documentsClient.downloadUrl(
                                  organizationId,
                                  document.id,
                                )}
                                aria-label={`${labels.download}: ${document.title}`}
                              >
                                <Download className="size-3.5" />
                                {labels.download}
                              </a>
                            </DropdownMenuItem>

                            {document.status === "active" &&
                            document.indexStatus === "failed" &&
                            permissions.canRetryIndexing ? (
                              <>
                                <DropdownMenuSeparator className="mx-3 my-1 h-px bg-border-strong/60" />
                                <DropdownMenuItem
                                  disabled={busy === `retry-${document.id}`}
                                  onSelect={() => retryDocument(document)}
                                  className="h-12 gap-2 rounded-lg px-3 py-3 text-sm leading-5 font-medium text-muted-foreground focus:bg-accent focus:text-muted-foreground [&_svg]:text-foreground-subtle"
                                >
                                  {busy === `retry-${document.id}` ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <RefreshCw className="size-3.5" />
                                  )}
                                  {labels.retry}
                                </DropdownMenuItem>
                              </>
                            ) : null}

                            {document.status === "active" &&
                            permissions.canArchive ? (
                              <>
                                <DropdownMenuSeparator className="mx-3 my-1 h-px bg-border-strong/60" />
                                <DropdownMenuItem
                                  disabled={busy === `archive-${document.id}`}
                                  onSelect={() => setArchiveTarget(document)}
                                  className="h-12 gap-2 rounded-lg bg-transparent px-3 py-3 text-sm leading-5 font-medium text-muted-foreground hover:bg-warning/10 focus:bg-warning/10 focus:text-muted-foreground data-[highlighted]:bg-warning/10 data-[highlighted]:text-muted-foreground [&_svg]:text-foreground-subtle [&:hover_svg]:text-warning [&[data-highlighted]_svg]:text-warning"
                                >
                                  {busy === `archive-${document.id}` ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Archive className="size-3.5" />
                                  )}
                                  {labels.archive}
                                </DropdownMenuItem>
                              </>
                            ) : null}

                            {document.status === "archived" &&
                            permissions.canRestore ? (
                              <>
                                <DropdownMenuSeparator className="mx-3 my-1 h-px bg-border-strong/60" />
                                <DropdownMenuItem
                                  disabled={busy === `restore-${document.id}`}
                                  onSelect={() => restoreDocument(document)}
                                  className="h-12 gap-2 rounded-lg px-3 py-3 text-sm leading-5 font-medium text-muted-foreground focus:bg-accent focus:text-muted-foreground [&_svg]:text-foreground-subtle"
                                >
                                  {busy === `restore-${document.id}` ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="size-3.5" />
                                  )}
                                  {labels.restore}
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {!documents.length ? (
                  <tr className="h-20">
                    <td
                      colSpan={6}
                      className="px-8 text-center text-sm text-foreground-subtle"
                    >
                      {search ? labels.noMatches : labels.noDocuments}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
      </Card>

      <Dialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (
            !open &&
            (!archiveTarget ||
              busy !== `archive-${archiveTarget.id}`)
          ) {
            setArchiveTarget(null);
          }
        }}
      >
        <DialogContent
          closeLabel={labels.cancel}
          overlayClassName="border border-scrim bg-scrim/75 backdrop-blur-[3px]"
          className="block h-72 w-[min(649px,calc(100vw-32px))] max-w-none overflow-hidden rounded-xl border-0 bg-card p-0 font-['Space_Grotesk'] text-card-foreground shadow-control outline-[1.5px] outline-offset-[-1.5px] outline-border-strong sm:max-w-none [&>[data-slot=dialog-close]]:top-[15px] [&>[data-slot=dialog-close]]:right-4 [&>[data-slot=dialog-close]]:flex [&>[data-slot=dialog-close]]:size-8 [&>[data-slot=dialog-close]]:items-center [&>[data-slot=dialog-close]]:justify-center [&>[data-slot=dialog-close]]:rounded-[10px] [&>[data-slot=dialog-close]]:text-foreground-subtle [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]]:ring-offset-0 [&>[data-slot=dialog-close]]:hover:bg-foreground/5 [&>[data-slot=dialog-close]]:focus:ring-0 [&>[data-slot=dialog-close]]:data-[state=open]:!bg-transparent"
        >
          <DialogTitle className="absolute top-[38px] left-[49px] h-10 w-80 text-lg leading-5 font-normal text-foreground">
            {labels.archiveDialogTitle}
          </DialogTitle>
          <DialogDescription className="absolute top-20 left-[49px] h-24 w-[min(564px,calc(100%-98px))] text-lg leading-8 font-normal text-foreground-subtle">
            {labels.archiveDialogDescription}
          </DialogDescription>

          <div className="absolute right-[27px] bottom-[34px] flex items-center gap-3">
            <Button
              type="button"
              disabled={
                !archiveTarget ||
                busy === `archive-${archiveTarget.id}`
              }
              onClick={() => {
                if (!archiveTarget) return;
                const document = archiveTarget;
                void archiveDocument(document).finally(() =>
                  setArchiveTarget(null),
                );
              }}
              className="h-12 w-32 cursor-pointer gap-1.5 overflow-hidden rounded-lg bg-warning/75 px-4 text-base font-medium text-foreground shadow-none hover:bg-warning/85 disabled:cursor-not-allowed disabled:bg-warning/50 disabled:text-foreground/50 disabled:opacity-100"
            >
              {archiveTarget &&
              busy === `archive-${archiveTarget.id}` ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Archive className="size-3.5" />
              )}
              {labels.archive}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                !!archiveTarget &&
                busy === `archive-${archiveTarget.id}`
              }
              onClick={() => setArchiveTarget(null)}
              className="h-12 w-28 cursor-pointer overflow-hidden rounded-lg border-[1.5px] border-border-strong bg-transparent px-4 text-base font-medium text-muted-foreground shadow-none hover:bg-foreground/5 hover:text-muted-foreground disabled:cursor-not-allowed"
            >
              {labels.cancel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {nextCursor ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={busy === "load-more"}
            onClick={() => void loadMore()}
            className="h-12 rounded-lg border-border-strong bg-card px-5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
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
    </div>
  );
}

function FolderFilter({
  count,
  label,
  onSelect,
  selected,
  tone,
}: {
  count: number;
  label: string;
  onSelect: () => void;
  selected: boolean;
  tone: "active" | "all" | "archived";
}) {
  const artwork = {
    all: "/document-folder-all.svg",
    active: "/document-folder-active.svg",
    archived: "/document-folder-archived.svg",
  }[tone];

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`relative h-[114px] w-[145px] flex-none cursor-pointer overflow-hidden border-0 bg-transparent p-0 text-left text-foreground shadow-none transition-opacity focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        selected ? "opacity-100" : "opacity-20 hover:opacity-70"
      }`}
    >
      <Image
        aria-hidden="true"
        alt=""
        className="pointer-events-none absolute inset-0 h-[114px] w-[145px] max-w-none"
        src={artwork}
        width="145"
        height="114"
        unoptimized
      />
      <span className="absolute top-[57.06px] left-[17.79px] size-5 text-3xl leading-4 font-bold text-foreground">
        {count}
      </span>
      <span className="absolute top-[82.26px] left-[17.79px] h-5 w-[112px] truncate pt-0.5 text-base leading-4 font-medium text-foreground drop-shadow-[0_2px_4.4px_rgba(0,0,0,0.37)]">
        {label}
      </span>
    </button>
  );
}

function DocumentFileIcon({ datatype }: { datatype: string }) {
  const normalized = datatype.toUpperCase();
  const tone =
    normalized === "PDF"
      ? "bg-red-500/10 text-red-500 outline-red-500/20"
      : normalized === "DOCX"
        ? "bg-blue-500/10 text-blue-500 outline-blue-500/20"
        : normalized === "XLSX"
          ? "bg-green-500/10 text-green-500 outline-green-500/20"
        : normalized === "MARKDOWN"
          ? "bg-violet-500/10 text-violet-400 outline-violet-500/20"
          : "bg-zinc-500/10 text-zinc-400 outline-zinc-500/20";

  return (
    <span
      aria-hidden="true"
      className={`relative flex h-11 w-9 shrink-0 items-end justify-center rounded-[10px] pb-1.5 outline outline-1 outline-offset-[-1px] ${tone}`}
    >
      <span className="text-[9px] leading-3 font-bold uppercase">
        {normalized === "MARKDOWN" ? "MD" : normalized}
      </span>
      <span className="absolute top-px right-px size-3 rounded-bl-lg border-b border-l border-current opacity-20" />
    </span>
  );
}

function DocumentStatusBadge({
  activeLabel,
  archivedLabel,
  status,
}: {
  activeLabel: string;
  archivedLabel: string;
  status: DocumentDto["status"];
}) {
  if (status === "archived") {
    return (
      <span className="inline-flex h-8 w-32 items-center justify-center rounded-full bg-warning/10 px-2 py-0.5 text-base leading-4 font-medium text-warning-foreground">
        {archivedLabel}
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 w-32 items-center justify-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-base leading-4 font-medium text-success">
      <CircleCheck className="size-3" strokeWidth={1.5} />
      {activeLabel}
    </span>
  );
}
