"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FilePlus2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { reportsClient } from "@/src/client/reports";
import { jobsClient } from "@/src/client/jobs";
import type { listReports } from "@/src/server/reports/service";
import { pollJob } from "@/src/client/job-polling";

export function ReportWorkflow({ organizationId, locale, reports, canCreate }: { organizationId: string; locale: "de" | "en"; reports: Awaited<ReturnType<typeof listReports>>; canCreate: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const de = locale === "de";
  const activeJobIds = useMemo(() => reports.filter((report) => report.jobId && ["queued", "rendering"].includes(report.state)).map((report) => report.jobId!), [reports]);
  useEffect(() => {
    if (!activeJobIds.length) return;
    const controller = new AbortController();
    for (const jobId of activeJobIds) void pollJob({ jobId, signal: controller.signal, finalRefresh: () => router.refresh() }).catch((caught) => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Error"); });
    return () => controller.abort();
  }, [activeJobIds, router]);
  async function act(key: string, action: () => Promise<unknown>) { setBusy(key); setError(null); try { await action(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Error"); } finally { setBusy(null); } }
  return <div className="grid gap-6">
    {error ? <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p> : null}
    {canCreate ? <Button className="justify-self-start" disabled={busy !== null} onClick={() => act("create", () => reportsClient.create(organizationId, { kind: "compliance_summary", locale }))}>{busy === "create" ? <Loader2 className="animate-spin" /> : <FilePlus2 />}{de ? "Bericht erstellen" : "Create report"}</Button> : null}
    {reports.map((report) => <Card key={report.id}><CardHeader><CardTitle>{de ? "Compliance-Bericht" : "Compliance report"}</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm"><p>{new Date(report.createdAt).toLocaleString(locale)}</p><p className="text-muted-foreground">{report.state} · {report.inputHash.slice(0, 12)}</p></div><div className="flex gap-2">{report.state === "ready" ? <Button variant="outline" onClick={() => act(`download-${report.id}`, async () => { const result = await reportsClient.download(organizationId, report.id); window.location.assign(result.data.download.url); })}><Download />{de ? "Herunterladen" : "Download"}</Button> : null}{report.jobId && ["queued", "rendering"].includes(report.state) && canCreate ? <Button variant="outline" onClick={() => act(`cancel-${report.id}`, () => jobsClient.cancel(report.jobId!))}><XCircle />{de ? "Abbrechen" : "Cancel"}</Button> : null}</div></CardContent></Card>)}
    {!reports.length ? <p className="text-sm text-muted-foreground">{de ? "Noch keine Berichte." : "No reports yet."}</p> : null}
  </div>;
}
