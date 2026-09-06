import { dashboardWorkflowMessages } from "@/src/i18n/dashboard-workflow";
import Link from "next/link";
import { DashboardStepIcon } from "./dashboard-step-icon";
import { DashboardActionLink } from "./dashboard-action-link";
import { Activity, ChartNoAxesCombined, ClipboardCheck, FileText, FolderOpen, LockKeyhole, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { z } from "zod";
import type { dashboardSchema } from "@/src/contracts/dashboard";
import type { Dictionary, Locale } from "@/src/i18n";
import { PageHeader } from "@/components/page-header";

type Dashboard = z.infer<typeof dashboardSchema>;


function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="h-full min-w-0 rounded-2xl border border-border-strong bg-card p-5 shadow-sm dark:bg-[#1e2029] sm:p-6"><h2 className="mb-5 flex items-start gap-2 break-words text-base font-semibold [&>svg]:shrink-0">{icon}{title}</h2>{children}</section>;
}

export function ComplianceDashboard({ dashboard: d, organizationId, labels, locale }: { dashboard: Dashboard; organizationId: string; labels: Dictionary["modules"]["dashboard"]; locale: Locale }) {
  const t = dashboardWorkflowMessages[locale];
  const base = `/tool/organizations/${encodeURIComponent(organizationId)}`;
  const routes = ["applicability-check", "gap-analysis", "action-plan"];
  const icons = [ShieldCheck, ChartNoAxesCombined, ClipboardCheck];
  const phase = d.gap.revisionId || d.plan.id ? 2 : d.applicability.revisionId ? 1 : 0;
  const completed = [Boolean(d.applicability.revisionId), Boolean(d.gap.revisionId), Boolean(d.plan.id && d.plan.totalItems > 0 && d.plan.openItems === 0)];
  const implemented = d.plan.totalItems ? Math.round((d.plan.totalItems - d.plan.openItems) / d.plan.totalItems * 100) : 0;
  const progress = Math.round(completed.filter(Boolean).length / 3 * 100);
  const sources = [d.applicability, d.gap, d.plan];
  const dates = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const activity = [...sources.map((source, i) => ({ title: t.steps[i], date: source.sourceUpdatedAt, route: routes[i] })), { title: t.documents, date: d.evidence.sourceUpdatedAt, route: "documents" }, { title: t.report, date: d.report.sourceUpdatedAt, route: "pdf-export" }].filter((item) => item.date).sort((a, b) => Date.parse(b.date!) - Date.parse(a.date!));
  const actionLink = (route: string) => {
    const unfinishedCheck = route === "applicability-check" && !d.applicability.revisionId;
    return <DashboardActionLink href={`${base}/${route}${unfinishedCheck ? "/new" : ""}`} label={t.open} draftKey={unfinishedCheck ? `/api/organizations/${organizationId}/applicability-check/submissions` : undefined} startLabel={t.start} continueLabel={t.continue} />;
  };
  function stageCard(index: number, next = false) {
    const report = index === 3;
    const Icon = report ? FileText : icons[index];
    const locked = !report && index > 0 && !completed[index - 1];
    const stale = !report && (sources[index].stale || sources[index].outdated);
    return <Panel title={report ? t.report : t.steps[index]} icon={<Icon size={18} />}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{next ? t.next : t.current}</span><span className={`rounded-full border px-2.5 py-1 text-xs ${locked ? "text-muted-foreground" : !report && completed[index] && !stale ? "border-green-500/40 text-success-foreground" : "border-amber-500/40 text-warning-foreground"}`}>{locked ? t.locked : stale ? t.stale : !report && completed[index] ? t.done : report || (index === 2 && !d.plan.id) ? t.pending : t.active}</span></div>
      {locked ? <div className="flex min-h-24 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground"><LockKeyhole size={28} />{t.lockHint}</div> : index === 2 ? <div className="flex flex-wrap items-center gap-6"><div role="img" aria-label={`${implemented}% ${t.implemented}`} className="relative flex size-32 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#002bff ${implemented}%, #f87171 ${implemented}% 100%)` }}><div className="absolute inset-3 rounded-full bg-card dark:bg-[#1e2029]" /><div className="relative text-center"><strong className="text-2xl">{implemented}%</strong><p className="text-xs text-muted-foreground">{t.implemented}</p></div></div><div className="space-y-3 text-sm"><p><span className="mr-2 inline-block size-2 rounded-full bg-[#002bff]" />{t.doneItems}: {d.plan.totalItems - d.plan.openItems}</p><p><span className="mr-2 inline-block size-2 rounded-full bg-red-400" />{t.openItems}: {d.plan.openItems}</p></div></div> : <><p className="min-h-12 text-sm leading-6 text-muted-foreground">{report ? t.reportHint : t.hints[index]}</p>{index === 0 && d.applicability.outcome && <p className="mt-3 text-sm font-medium">{labels.overview.outcomes[d.applicability.outcome as keyof typeof labels.overview.outcomes] ?? labels.overview.pending}</p>}{index === 1 && d.gap.revisionId && <p className="mt-3 text-sm">{d.gap.findingCount} {t.findings} · {d.gap.criticalCount} {t.critical}</p>}</>}
      {!locked && actionLink(report ? "pdf-export" : routes[index])}
    </Panel>;
  }
  return <section className="@container flex w-full min-w-0 flex-col gap-8">
    <PageHeader className="w-full [&>p]:w-full [&>p]:max-w-none" title={labels.title} subtitle={labels.description} />
    <ol aria-label={labels.title} className="grid w-full min-w-0 grid-cols-3 gap-2 py-5 sm:gap-6 sm:py-8">
      {t.steps.map((title, index) => {
        const locked = index > phase;
        return (
          <li key={title} aria-current={phase === index ? "step" : undefined} className="flex min-w-0 flex-col items-center text-center">
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-full border text-[#FBFBFB] ${completed[index] ? "border-[#FBFBFB] bg-[#46A95A]" : locked ? "border-border-strong bg-[#002BFF]/20 opacity-30" : "border-[#FBFBFB] bg-[#C58B00]"}`}>
              <span className={locked ? "opacity-30" : undefined}><DashboardStepIcon step={index} /></span>
            </span>
            <span className={`mt-4 w-full break-words text-[11px] leading-4 sm:text-sm sm:leading-5 ${locked ? "text-muted-foreground/50" : "text-foreground"}`}>{title}</span>
            <span className={`mt-1.5 text-[10px] leading-4 sm:text-xs ${completed[index] ? "text-success-foreground" : locked ? "text-muted-foreground/50" : "text-warning-foreground"}`}>
              {completed[index] ? t.done : locked ? t.locked : index === 2 && d.plan.totalItems ? `${implemented}% ${t.active}` : t.active}
            </span>
          </li>
        );
      })}
    </ol>
    <div className="grid w-full min-w-0 grid-cols-1 items-stretch gap-5 @min-[640px]:grid-cols-2">
      <div className="min-w-0" data-dashboard-slot="current">{stageCard(phase)}</div>
      <div className="min-w-0" data-dashboard-slot="next">{stageCard(phase + 1, true)}</div>
      <div className="min-w-0" data-dashboard-slot="documents"><Panel title={t.documents} icon={<FolderOpen size={18} />}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))] gap-3">
          {[[t.total, d.evidence.documentCount, "text-purple-400"], [t.versions, d.evidence.currentVersionCount, "text-green-400"], [t.other, d.evidence.documentCount - d.evidence.currentVersionCount, "text-amber-400"]].map(([label, value, color]) => (
            <div key={label} className="flex min-h-20 min-w-0 flex-col items-start justify-start rounded-xl bg-[#292C34] px-3.5 py-2.5 font-sans outline outline-1 -outline-offset-1 outline-[#3D4149]">
              <p className={`w-full text-2xl leading-7 font-bold ${color}`}>{value}</p>
              <p className="w-full pt-1 text-base leading-5 font-medium break-words text-white">{label}</p>
            </div>
          ))}
        </div>
        <DashboardActionLink href={`${base}/documents`} label={t.documentsLink} />
      </Panel></div>
      <div className="min-w-0" data-dashboard-slot="activity"><Panel title={t.activity} icon={<Activity size={18} />}>
        {activity.length ? <ul className="space-y-4">{activity.slice(0, 4).map((item) => <li key={item.route}><Link href={`${base}/${item.route}`} className="group flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-500"><FileText size={14} /></span><span><span className="text-sm group-hover:underline">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{t.updated} · <time dateTime={item.date!}>{dates.format(new Date(item.date!))}</time></span></span></Link></li>)}</ul> : <p className="py-6 text-sm text-muted-foreground">{t.empty}</p>}
      </Panel></div>
    </div>
    <Panel title={t.progress} icon={<ChartNoAxesCombined size={18} />}>
      <div className="flex items-start justify-between gap-4"><p className="max-w-xl text-sm text-muted-foreground">{t.progressHint}</p><strong className="text-2xl">{progress}%</strong></div>
      <svg viewBox="0 0 900 270" role="img" aria-label={`${t.progress}: ${progress}%. ${t.history}`} className="mt-6 h-auto min-h-48 w-full">
        {[0, 20, 40, 60, 80, 100].map((value) => <g key={value}><text x="40" y={235 - value * 2} textAnchor="end" fill="currentColor" className="text-[11px] text-muted-foreground">{value}%</text><line x1="55" x2="875" y1={231 - value * 2} y2={231 - value * 2} stroke="currentColor" className="text-muted-foreground/15" /></g>)}
        <line x1="465" x2="465" y1="231" y2={231 - progress * 2} stroke="#002bff" strokeWidth="3" strokeDasharray="5 5" /><circle cx="465" cy={231 - progress * 2} r="7" fill="#002bff" /><text x="465" y="260" textAnchor="middle" fill="currentColor" className="text-[12px]">{t.today}</text>
      </svg>
      <p className="mt-5 text-xs text-muted-foreground">{t.history}</p>
    </Panel>
  </section>;
}
