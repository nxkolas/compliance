"use client";

import Image from "next/image";
import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { documentTypeLabel } from "@/lib/documents/format";
import { documentsClient } from "@/src/client/documents";
import type { GapLabels, GapWorkflow } from "./types";

const ACCEPTED_FILES =
  ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

export function GapDocumentStep({
  organizationId,
  workflow,
  labels,
  selected,
  busy,
  onToggle,
  onContinue,
}: {
  organizationId: string;
  workflow: GapWorkflow;
  labels: GapLabels;
  selected: string[];
  busy: boolean;
  onToggle: (documentId: string, checked: boolean) => void;
  onContinue: () => void;
}) {
  const documents = workflow.documentLibrary.documents;

  return (
    <section
      aria-labelledby="gap-step-heading"
      className="grid w-full max-w-[1274px] gap-7 pt-3"
    >
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,870px)_minmax(190px,1fr)] lg:gap-8">
        <div
          data-gap-document-speech-bubble
          className="relative min-h-[219px] overflow-visible"
        >
          <DocumentSpeechBubble />
          <div className="relative z-10 px-7 py-8 pr-12 sm:px-10 sm:py-9 sm:pr-16">
            <h2
              id="gap-step-heading"
              tabIndex={-1}
              className="text-2xl leading-8 font-bold text-white outline-none"
            >
              {labels.documentsTitle}
            </h2>
            <p className="mt-2 max-w-[790px] whitespace-pre-line text-base leading-7 text-white/90">
              {labels.documentsDescription}
            </p>
          </div>
        </div>

        <div className="flex min-h-[219px] items-center justify-center">
          <Image
            aria-hidden="true"
            alt=""
            className="h-auto w-full max-w-[300px] object-contain lg:max-w-[330px]"
            src="/images/Maskottchen_ohneLogo.svg"
            width={932}
            height={628}
            unoptimized
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
        <GapDocumentUploadDialog
          organizationId={organizationId}
          labels={labels}
        />

        {workflow.canContribute ? (
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-lg border-[1.5px] border-border-strong bg-transparent px-5 text-base text-foreground shadow-[0_4px_4px_rgba(255,255,255,0.15)] hover:bg-foreground/5 hover:text-foreground sm:w-64"
            disabled={busy}
            onClick={onContinue}
          >
            {busy ? <Loader2 className="animate-spin" /> : null}
            {labels.continueWithoutDocuments}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{labels.readOnly}</p>
        )}
      </div>

      <div className="grid gap-4">
        <h3 className="text-2xl leading-8 font-bold text-foreground">
          {labels.documentLibraryTitle}
        </h3>

        <Card className="w-full min-w-0 gap-0 overflow-hidden rounded-xl border-0 bg-card py-px shadow-none outline-[1.2px] outline-offset-[-1.2px] outline-border-strong">
          <div
            className="touch-scroll-x overflow-x-auto"
            role="region"
            aria-label={labels.documentLibraryTitle}
            tabIndex={0}
          >
            <table
              aria-label={labels.documentLibraryTitle}
              className="w-full min-w-[1190px] table-fixed border-collapse text-left font-['Space_Grotesk']"
            >
              <colgroup>
                <col className="w-[6.3%]" />
                <col className="w-[38.57%]" />
                <col className="w-[16.97%]" />
                <col className="w-[10.76%]" />
                <col className="w-[12.86%]" />
                <col className="w-[14.54%]" />
              </colgroup>
              <thead>
                <tr className="h-12 border-b border-foreground/10 text-base leading-4 font-normal tracking-wide text-foreground uppercase">
                  <th scope="col">
                    <span className="sr-only">{labels.selectDocument}</span>
                  </th>
                  <th scope="col" className="pl-[38px] font-normal">
                    {labels.documentTitleColumn}
                  </th>
                  <th scope="col" className="pl-1.5 font-normal">
                    {labels.documentTypeColumn}
                  </th>
                  <th scope="col" className="pl-1.5 font-normal">
                    {labels.documentSizeColumn}
                  </th>
                  <th scope="col" className="pl-1.5 font-normal">
                    {labels.documentDateColumn}
                  </th>
                  <th scope="col" className="text-center font-normal">
                    {labels.documentStatusColumn}
                  </th>
                </tr>
              </thead>

              <tbody>
                {documents.length ? (
                  documents.map((document) => {
                    const eligible = document.eligibleForAnalysis;
                    const datatype = getDocumentType(document.mimeType);
                    const checked = selected.includes(document.id);

                    return (
                      <tr
                        key={document.id}
                        data-document-selected={checked || undefined}
                        className={`h-20 border-b border-foreground/5 align-middle last:border-b-0 ${
                          eligible
                            ? "transition-colors hover:bg-foreground/[0.025]"
                            : "opacity-60"
                        }`}
                      >
                        <td className="py-3 pl-[47px]">
                          <Checkbox
                            aria-label={`${labels.selectDocument}: ${document.title}`}
                            checked={checked}
                            disabled={!workflow.canContribute || !eligible}
                            onCheckedChange={(nextChecked) =>
                              onToggle(document.id, nextChecked === true)
                            }
                            className="size-4 rounded-[5px] border-zinc-200 bg-transparent data-[state=checked]:border-[#46A95A] data-[state=checked]:bg-[#46A95A] dark:bg-transparent dark:data-[state=checked]:bg-[#46A95A]"
                          />
                        </td>

                        <td className="py-[14px] pl-[38px]">
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

                        <td className="py-3 pl-1.5 text-base leading-5 text-foreground/40">
                          <div className="w-52 truncate" title={document.mimeType}>
                            {datatype}
                          </div>
                        </td>

                        <td className="py-3 pl-1.5 text-base leading-5 text-foreground/30">
                          <span aria-label={labels.documentMetadataUnavailable}>
                            —
                          </span>
                        </td>

                        <td className="py-3 pl-1.5 text-base leading-5 text-foreground/30">
                          <span aria-label={labels.documentMetadataUnavailable}>
                            —
                          </span>
                        </td>

                        <td className="py-3">
                          <div className="flex w-full justify-center">
                            <DocumentEligibilityBadge
                              archived={Boolean(document.archivedAt)}
                              eligible={eligible}
                              labels={labels}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-5">
                      <p
                        data-gap-empty-documents
                        className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border-strong px-6 py-6 text-center text-sm text-muted-foreground"
                      >
                        {labels.noDocumentsAvailable}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}

function GapDocumentUploadDialog({
  organizationId,
  labels,
}: {
  organizationId: string;
  labels: GapLabels;
}) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function resetUpload() {
    setUploadTitle("");
    setUploadFile(null);
    setUploadError(null);
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = uploadTitle.trim();
    const file = uploadFile;
    if (!title || !file || uploading) return;

    setUploading(true);
    setUploadError(null);
    try {
      await documentsClient.uploadNew(organizationId, title, file);
      setUploadOpen(false);
      resetUpload();
      router.refresh();
    } catch {
      setUploadError(labels.documentUploadError);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={uploadOpen}
      onOpenChange={(open) => {
        setUploadOpen(open);
        if (!open && !uploading) resetUpload();
      }}
    >
      <Button
        type="button"
        data-gap-document-upload-trigger
        className="h-12 w-full rounded-lg bg-[#002BFF] px-5 text-base text-white hover:brightness-90 sm:w-64"
        style={{ backgroundColor: "#002BFF" }}
        onClick={() => setUploadOpen(true)}
      >
        <Upload aria-hidden="true" className="size-5" />
        {labels.openLibrary}
      </Button>

      <DialogContent
        data-gap-document-upload-dialog
        closeLabel={labels.documentUploadCancel}
        overlayClassName="bg-scrim/75 backdrop-blur-[3px]"
        className="h-[464px] max-h-[calc(100svh-32px)] w-[min(687px,calc(100vw-32px))] max-w-none gap-0 overflow-hidden rounded-xl border-0 bg-card p-0 font-['Space_Grotesk'] text-card-foreground shadow-2xl outline-[1.5px] outline-offset-[-1.5px] outline-foreground/10 sm:max-w-none [&>[data-slot=dialog-close]]:top-4 [&>[data-slot=dialog-close]]:right-6 [&>[data-slot=dialog-close]]:flex [&>[data-slot=dialog-close]]:size-8 [&>[data-slot=dialog-close]]:items-center [&>[data-slot=dialog-close]]:justify-center [&>[data-slot=dialog-close]]:rounded-[10px] [&>[data-slot=dialog-close]]:text-foreground-subtle [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]]:ring-offset-0 [&>[data-slot=dialog-close]]:hover:bg-foreground/5 [&>[data-slot=dialog-close]]:focus:ring-0 [&>[data-slot=dialog-close]]:data-[state=open]:!bg-transparent"
      >
        <form className="relative h-full w-full" onSubmit={submitUpload}>
          <div className="flex h-16 w-full items-center border-b border-foreground/5 px-6 py-4">
            <DialogTitle className="text-base leading-6 font-semibold text-foreground">
              {labels.documentUploadDialogTitle}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {labels.documentUploadDescription}
            </DialogDescription>
          </div>

          <div className="px-6 py-5">
            <div className="text-base leading-5 font-medium text-foreground/80">
              {labels.documentUploadTitleField}
              <span className="text-sm"> *</span>
            </div>

            <label className="mt-4 grid gap-1.5 font-['Space_Grotesk'] text-sm leading-5 font-medium text-foreground/80">
              {labels.documentUploadTitle}
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
              <span>{labels.documentUploadFile}</span>
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
                  {uploadFile?.name ?? labels.documentUploadDropzone}
                </span>
                <span className="text-xs leading-4 font-normal text-foreground">
                  {labels.documentUploadDescription}
                </span>
              </label>
            </div>
          </div>

          {uploadError ? (
            <p
              role="alert"
              className="absolute bottom-8 left-6 max-w-[320px] text-sm text-destructive"
            >
              {uploadError}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={uploading || !uploadTitle.trim() || uploadFile === null}
            className="absolute right-6 bottom-5 h-12 w-36 overflow-hidden rounded-lg bg-primary px-5 text-base font-medium text-primary-foreground shadow-none hover:bg-primary disabled:bg-primary/50 disabled:text-primary-foreground/50 disabled:opacity-100"
          >
            {uploading ? <Loader2 className="animate-spin" /> : null}
            {labels.documentUploadSubmit}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DocumentSpeechBubble() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 881 219"
      fill="none"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      className="pointer-events-none absolute inset-0 size-full"
    >
      <g filter="url(#gap-document-speech-shadow)">
        <path
          d="M4.75028 17.227L5.80278 198.231C5.84132 204.858 11.2451 210.202 17.8724 210.167L846.299 205.752C852.881 205.717 858.204 200.387 858.229 193.805L858.769 54.7814C858.787 50.1051 861.52 45.8667 865.772 43.9214L874.717 39.8285L864.906 36.3635C860.09 34.6629 856.877 30.1021 856.897 24.9964L856.944 12.8024C856.97 6.12962 851.547 0.714715 844.875 0.75027L16.6803 5.16325C10.053 5.19856 4.71174 10.5997 4.75028 17.227Z"
          fill="url(#gap-document-speech-gradient)"
          stroke="#3D4049"
          strokeWidth="1.5"
        />
      </g>
      <defs>
        <filter
          id="gap-document-speech-shadow"
          x="0"
          y="0"
          width="880.715"
          height="218.917"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="4" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow"
            result="shape"
          />
        </filter>
        <linearGradient
          id="gap-document-speech-gradient"
          x1="5.87256"
          y1="210.23"
          x2="95.4511"
          y2="-178.589"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#111825" />
          <stop offset="1" stopColor="#1A2540" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function getDocumentType(mimeType: string) {
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "XLSX";
  }

  return documentTypeLabel(mimeType);
}

function DocumentFileIcon({ datatype }: { datatype: string }) {
  const normalized = datatype.toUpperCase();
  const iconLabel = normalized === "MARKDOWN" ? "MD" : normalized.slice(0, 4);
  const tone =
    normalized === "PDF"
      ? "bg-red-500/10 text-red-500 outline-red-500/20"
      : normalized === "DOCX"
        ? "bg-blue-500/10 text-blue-500 outline-blue-500/20"
        : normalized === "XLSX"
          ? "bg-green-500/10 text-green-500 outline-green-500/20"
          : "bg-zinc-500/10 text-zinc-400 outline-zinc-500/20";

  return (
    <span
      aria-hidden="true"
      className={`relative flex h-11 w-9 shrink-0 items-end justify-center rounded-[10px] pb-1.5 outline outline-1 outline-offset-[-1px] ${tone}`}
    >
      <span className="text-[9px] leading-3 font-bold uppercase">
        {iconLabel}
      </span>
      <span className="absolute top-px right-px size-3 rounded-bl-lg border-b border-l border-current opacity-20" />
    </span>
  );
}

function DocumentEligibilityBadge({
  archived,
  eligible,
  labels,
}: {
  archived: boolean;
  eligible: boolean;
  labels: GapLabels;
}) {
  if (archived) {
    return (
      <span className="inline-flex h-8 w-32 items-center justify-center rounded-full bg-warning/10 px-2 py-0.5 text-base leading-4 font-medium text-warning-foreground">
        {labels.documentArchived}
      </span>
    );
  }

  if (!eligible) {
    return (
      <span className="inline-flex h-8 w-32 items-center justify-center rounded-full bg-foreground/5 px-2 py-0.5 text-base leading-4 font-medium text-muted-foreground">
        {labels.documentNotReady}
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 w-32 items-center justify-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-base leading-4 font-medium text-success">
      <span aria-hidden="true" className="size-2 rounded-full border border-current" />
      {labels.documentActive}
    </span>
  );
}
