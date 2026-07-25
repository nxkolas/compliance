"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Archive, FilePlus2, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n";
import type { getOrganizationDocumentLibrary } from "@/src/server/documents/service";
import { documentsClient } from "@/src/client/documents";

type Library = Awaited<ReturnType<typeof getOrganizationDocumentLibrary>>;
type Labels = Dictionary["modules"]["documents"]["workflow"];

const ACCEPTED_FILES =
  ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

export function OrganizationDocumentManager({
  organizationId,
  library,
  labels,
}: {
  organizationId: string;
  library: Library;
  labels: Labels;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return library.documents.filter((entry) => {
      if (!showArchived && entry.document.status === "archived") return false;
      if (!normalized) return true;
      return (
        entry.document.title.toLocaleLowerCase().includes(normalized) ||
        entry.versions.some((item) =>
          item.version.fileName.toLocaleLowerCase().includes(normalized),
        )
      );
    });
  }, [library.documents, query, showArchived]);

  async function mutate(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      const body = await action();
      router.refresh();
      return body;
    } catch {
      setError(labels.error);
      return null;
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{labels.newDocument}</CardTitle>
            <CardDescription>{labels.search}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error ? (
          <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </p>
        ) : null}
        {library.canContribute ? (
          <form
            className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
            onSubmit={(event) =>
              void submitNewDocument(event, organizationId, mutate)
            }
          >
            <Input name="title" required placeholder={labels.documentTitle} />
            <Input
              name="file"
              type="file"
              required
              accept={ACCEPTED_FILES}
              aria-label={labels.documentFile}
            />
            <Button type="submit" disabled={busy !== null}>
              {busy === "upload" ? <Loader2 className="animate-spin" /> : <Upload />}
              {labels.upload}
            </Button>
          </form>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.searchPlaceholder}
              aria-label={labels.search}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              {labels.showArchived}
            </label>
        </div>
        <div className="grid gap-3">
          {visibleDocuments.length ? (
            visibleDocuments.map((entry) => {
              const current = entry.versions.find(
                (item) => item.version.id === entry.document.currentVersionId,
              );
              return (
                <article key={entry.document.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <FileText className="mt-1 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium">{entry.document.title}</p>
                        {current ? (
                          <p className="text-xs text-muted-foreground">
                            {current.version.fileName} · {labels.version} {current.version.versionNumber}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {library.canContribute && entry.document.status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() =>
                            void mutate(`archive-${entry.document.id}`, () =>
                              documentsClient.archive(organizationId, entry.document.id, entry.document.version))
                          }
                        >
                          <Archive /> {labels.archive}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {current ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ProcessingBadge item={current} labels={labels} />
                    </div>
                  ) : null}
                  <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium">
                        {labels.version} ({entry.versions.length})
                      </summary>
                      <div className="mt-3 grid gap-2">
                        {entry.versions.map((item) => (
                          <div key={item.version.id} className="rounded-md bg-muted/40 p-3 text-sm">
                            <div className="flex flex-wrap justify-between gap-2">
                              <span>
                                {labels.version} {item.version.versionNumber} · {item.version.fileName}
                              </span>
                              {item.version.id === entry.document.currentVersionId ? (
                                <span className="font-medium">{labels.current}</span>
                              ) : null}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <ProcessingBadge item={item} labels={labels} />
                            </div>
                          </div>
                        ))}
                        {library.canContribute && entry.document.status === "active" ? (
                          <form
                            className="flex flex-wrap items-center gap-2"
                            onSubmit={(event) =>
                              void submitVersion(
                                event,
                                organizationId,
                                entry.document.id,
                                mutate,
                              )
                            }
                          >
                            <Input
                              className="max-w-sm"
                              name="file"
                              type="file"
                              required
                              accept={ACCEPTED_FILES}
                              aria-label={labels.documentFile}
                            />
                            <Button type="submit" variant="outline" disabled={busy !== null}>
                              <FilePlus2 /> {labels.uploadVersion}
                            </Button>
                          </form>
                        ) : null}
                      </div>
                  </details>
                </article>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">{labels.noDocuments}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProcessingBadge({
  item,
  labels,
}: {
  item: Library["documents"][number]["versions"][number];
  labels: Labels;
}) {
  const text =
    item.embedding?.status === "succeeded"
      ? labels.indexed
      : item.embedding?.status === "failed" || item.extraction?.status === "failed"
        ? labels.failed
        : labels.processing;
  return <span className="rounded-full bg-muted px-2 py-1 text-xs">{text}</span>;
}

async function submitNewDocument(
  event: FormEvent<HTMLFormElement>,
  organizationId: string,
  mutate: (key: string, action: () => Promise<unknown>) => Promise<unknown>,
) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const file = form.get("file");
  const title = form.get("title");
  if (!(file instanceof File) || typeof title !== "string") return;
  await mutate("upload", () => documentsClient.uploadNew(organizationId, title, file));
}

async function submitVersion(
  event: FormEvent<HTMLFormElement>,
  organizationId: string,
  documentId: string,
  mutate: (key: string, action: () => Promise<unknown>) => Promise<unknown>,
) {
  event.preventDefault();
  const file = new FormData(event.currentTarget).get("file");
  if (!(file instanceof File)) return;
  await mutate(`version-${documentId}`, () => documentsClient.uploadVersion(organizationId, documentId, file));
}
