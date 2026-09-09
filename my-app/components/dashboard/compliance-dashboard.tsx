import { ApplicabilityCheckIcon, GapAnalysisIcon } from "@/components/workflow-icons";
import { PageHeader } from "@/components/page-header";
import type { dashboardSchema } from "@/src/contracts/dashboard";
import type { Dictionary, Locale } from "@/src/i18n";
import { dashboardWorkflowMessages } from "@/src/i18n/dashboard-workflow";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  FolderOpen,
  LockKeyhole,
} from "lucide-react";
import type { ReactNode } from "react";
import type { z } from "zod";
import { formatDateTime } from "@/src/i18n/format";
import { DashboardActionLink } from "./dashboard-action-link";
import { DashboardActivityFeed } from "./dashboard-activity-feed";
import { DashboardStepIcon } from "./dashboard-step-icon";
import { ActionPlanSummary } from "./action-plan-summary";

function ActionPlanIcon({ className = "size-[22px]" }: { className?: string }) {
  return (
    <svg className={`${className} scale-135`} viewBox="0 0 24 23" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 8.27922V11.4992M12 14.7192H12.009M12 19.5492C12 19.5492 19.2 16.3292 19.2 11.4992V5.86422L12 3.44922L4.80005 5.86422V11.4992C4.80005 16.3292 12 19.5492 12 19.5492Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Dashboard = z.infer<typeof dashboardSchema>;

function StatusProgressRing({ value }: { value: number }) {
  const progress = Math.min(100, Math.max(0, value));
  return (
    <svg aria-hidden="true" className="size-3.5 shrink-0 -rotate-90" data-status-progress={progress} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      {progress > 0 ? <circle cx="8" cy="8" r="6" fill="none" pathLength="100" stroke="currentColor" strokeDasharray={`${progress} ${100 - progress}`} strokeLinecap="round" strokeWidth="2" /> : null}
    </svg>
  );
}

function relativeDashboardTime(value: string, locale: Locale) {
  const formatter = new Intl.RelativeTimeFormat(locale === "de" ? "de-DE" : "en-GB", { numeric: "always" });
  const seconds = Math.round((Date.parse(value) - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function Panel({ title, icon, headerAccessory, centerIcon = false, scrollable = false, expandedScroll = false, children }: { title: string; icon: ReactNode; headerAccessory?: ReactNode; centerIcon?: boolean; scrollable?: boolean; expandedScroll?: boolean; children: ReactNode }) {
  const height = scrollable
    ? expandedScroll
      ? "h-[320px] overflow-hidden @min-[640px]:h-full @min-[640px]:min-h-0"
      : "h-[240px] overflow-hidden"
    : "h-full min-h-[240px]";
  return <section className={`flex min-w-0 flex-col rounded-2xl border border-border-strong bg-card p-5 shadow-sm dark:bg-[#1e2029] sm:p-6 ${height}`}><div className="mb-5 flex shrink-0 items-center justify-between gap-3"><h2 className={`min-w-0 flex justify-start gap-2 font-sans text-2xl leading-6 font-bold text-card-foreground [&>svg]:shrink-0 ${centerIcon ? "items-center [&>span]:translate-y-[2px]" : "items-start [&>svg]:mt-[3px]"}`}>{icon}<span className="min-w-0 break-words">{title}</span></h2>{headerAccessory}</div><div className={`flex-1 [overflow-wrap:anywhere] ${scrollable ? "min-h-0 overflow-y-auto overscroll-contain" : ""}`}>{children}</div></section>;
}
function ActionPlanPlaceholderIcon({ className = "size-[52px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 65 62" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g filter="url(#filter0_d_2434_9910)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M36.6989 4.63249C38.0067 4.9012 39.2891 5.29566 40.5281 5.81228C43.0712 6.8726 45.3819 8.42675 47.3283 10.386C49.2747 12.3452 50.8187 14.6712 51.8721 17.231C52.3853 18.4782 52.7772 19.7691 53.0441 21.0855L43.4707 21.0855C43.4323 20.9844 43.3925 20.8838 43.3513 20.7837C42.7614 19.3502 41.8968 18.0476 40.8068 16.9505C39.7169 15.8533 38.4229 14.983 36.9987 14.3892C36.8993 14.3477 36.7993 14.3077 36.6989 14.269V4.63249ZM36.6989 0.34052C38.5587 0.656951 40.3816 1.18369 42.1324 1.91368C45.1841 3.18607 47.957 5.05105 50.2926 7.40212C52.6283 9.7532 54.4811 12.5443 55.7451 15.6162C56.4703 17.3785 56.9936 19.2134 57.308 21.0855C57.4952 22.2001 57.6083 23.328 57.6458 24.4615C57.6612 24.9273 57.2844 25.3053 56.8213 25.3053L40.8911 25.3053C40.428 25.3053 40.0575 24.9263 40.0061 24.463C39.9276 23.7547 39.7503 23.0596 39.4783 22.3985C39.0991 21.477 38.5432 20.6396 37.8425 19.9343C37.1418 19.229 36.31 18.6695 35.3945 18.2878C34.9211 18.0904 33.994 17.9181 33.2502 17.8077C32.8278 17.745 32.5068 17.3846 32.5068 16.9547V0.830355C32.5068 0.364247 32.8824 -0.0150752 33.3452 0.000460835C34.4712 0.0382613 35.5916 0.152111 36.6989 0.34052ZM24.9608 3.71637C22.2903 4.17076 19.7009 5.05795 17.296 6.35187C13.648 8.31463 10.5371 11.1527 8.23905 14.6147C5.94097 18.0767 4.52656 22.0558 4.12112 26.1994C3.71568 30.3431 4.33172 34.5235 5.91467 38.3702C7.49762 42.217 9.99861 45.6114 13.1961 48.2529C16.3936 50.8943 20.189 52.7012 24.2459 53.5135C28.3029 54.3258 32.4962 54.1184 36.4546 52.9098C39.064 52.113 41.5182 50.8973 43.7258 49.3177C44.6299 48.6709 45.5117 47.9438 46.3344 47.171C46.6733 46.8527 46.6729 46.3165 46.345 45.9865L35.0816 34.6488C34.7542 34.3192 34.2259 34.3235 33.8642 34.6145C33.1178 35.215 32.2628 35.669 31.3435 35.9497C30.156 36.3123 28.898 36.3745 27.6809 36.1308C26.4638 35.8871 25.3252 35.3451 24.366 34.5527C23.4067 33.7602 22.6564 32.7419 22.1815 31.5879C21.7066 30.4338 21.5218 29.1797 21.6435 27.9366C21.7651 26.6935 22.1894 25.4998 22.8788 24.4612C23.5683 23.4226 24.5015 22.5712 25.5959 21.9823C26.4426 21.5268 27.3655 21.2393 28.3146 21.1325C28.7748 21.0807 29.153 20.7076 29.153 20.2415L29.153 4.23482C29.153 3.75769 28.7605 3.37534 28.2872 3.40103C27.1895 3.4606 25.8189 3.57038 24.9608 3.71637ZM24.9608 8.00834C22.9826 8.41482 21.0658 9.10836 19.2721 10.0734C16.2321 11.709 13.6398 14.0741 11.7247 16.9591C9.80964 19.8441 8.63097 23.16 8.29311 26.6131C7.95524 30.0661 8.46861 33.5497 9.78773 36.7554C11.1069 39.961 13.191 42.7897 15.8556 44.9909C18.5202 47.1921 21.683 48.6979 25.0638 49.3748C28.4446 50.0517 31.939 49.8789 35.2376 48.8717C37.1839 48.2774 39.0265 47.4035 40.7108 46.2828L33.9414 39.4688C33.4936 39.6702 33.0325 39.8437 32.5604 39.9878C30.7132 40.5519 28.7563 40.6486 26.863 40.2696C24.9698 39.8905 23.1986 39.0473 21.7065 37.8146C20.2143 36.5819 19.0472 34.9979 18.3085 33.2027C17.5698 31.4076 17.2823 29.4567 17.4715 27.523C17.6607 25.5893 18.3207 23.7324 19.3932 22.1168C20.4656 20.5012 21.9173 19.1768 23.6197 18.2608C24.0548 18.0267 24.5027 17.8212 24.9609 17.6449L24.9608 8.00834ZM41.7493 34.2685C41.4621 34.6317 41.4597 35.1612 41.7858 35.4895L53.0535 46.8315C53.3809 47.161 53.9129 47.162 54.2292 46.8216C54.9989 45.9934 55.7112 45.1154 56.3619 44.194C57.4547 42.6465 58.3736 40.9765 59.0989 39.2142C59.8241 37.4519 60.3474 35.6169 60.6617 33.7449C60.8489 32.6302 60.962 31.5024 60.9995 30.3689C61.015 29.903 60.6381 29.5251 60.1751 29.5251H44.2448C43.7818 29.5251 43.4112 29.9041 43.3599 30.3673C43.2814 31.0757 43.104 31.7708 42.832 32.4318C42.5637 33.0838 42.1918 33.709 41.7493 34.2685ZM46.5775 34.345C46.6213 34.2462 46.6639 34.1468 46.7051 34.0467C46.7463 33.9466 46.786 33.846 46.8244 33.7449H56.3979C56.1309 35.0613 55.739 36.3521 55.2258 37.5993C54.7126 38.8466 54.0829 40.0383 53.3469 41.1591L46.5775 34.345Z"
          fill="#82848C"
        />
        <path
          d="M19.2721 10.0734C21.0658 9.10836 22.9826 8.41482 24.9608 8.00834L24.9609 17.6449C24.5027 17.8212 24.0548 18.0267 23.6197 18.2608C21.9173 19.1768 20.4656 20.5012 19.3932 22.1168C18.3207 23.7324 17.6607 25.5893 17.4715 27.523C17.2823 29.4567 17.5698 31.4076 18.3085 33.2027C19.0472 34.9979 20.2143 36.5819 21.7065 37.8146C23.1986 39.0473 24.9698 39.8905 26.863 40.2696C28.7563 40.6486 30.7132 40.5519 32.5604 39.9878C33.0325 39.8437 33.4936 39.6702 33.9414 39.4688L40.7108 46.2828C39.0265 47.4035 37.1839 48.2774 35.2376 48.8717C31.939 49.8789 28.4446 50.0517 25.0638 49.3748C21.683 48.6979 18.5202 47.1921 15.8556 44.9909C13.191 42.7897 11.1069 39.961 9.78773 36.7554C8.46861 33.5497 7.95524 30.0661 8.29311 26.6131C8.63097 23.16 9.80964 19.8441 11.7247 16.9591C13.6398 14.0741 16.2321 11.709 19.2721 10.0734Z"
          fill="#82848C"
        />
        <path
          d="M36.6989 4.63249C38.0067 4.9012 39.2891 5.29566 40.5281 5.81228C43.0712 6.8726 45.3819 8.42675 47.3283 10.386C49.2747 12.3452 50.8187 14.6712 51.8721 17.231C52.3853 18.4782 52.7772 19.7691 53.0441 21.0855L43.4707 21.0855C43.4323 20.9844 43.3925 20.8838 43.3513 20.7837C42.7614 19.3502 41.8968 18.0476 40.8068 16.9505C39.7169 15.8533 38.4229 14.983 36.9987 14.3892C36.8993 14.3477 36.7993 14.3077 36.6989 14.269V4.63249Z"
          fill="#82848C"
        />
        <path
          d="M46.5775 34.345C46.6213 34.2462 46.6639 34.1468 46.7051 34.0467C46.7463 33.9466 46.786 33.846 46.8244 33.7449H56.3979C56.1309 35.0613 55.739 36.3521 55.2258 37.5993C54.7126 38.8466 54.0829 40.0383 53.3469 41.1591L46.5775 34.345Z"
          fill="#82848C"
        />
      </g>
      <defs>
        <filter id="filter0_d_2434_9910" x="0" y="0" width="65" height="62" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="4" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2434_9910" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2434_9910" result="shape" />
        </filter>
      </defs>
    </svg>
  );
}

export function ComplianceDashboard({ dashboard: d, organizationId, labels, locale }: { dashboard: Dashboard; organizationId: string; labels: Dictionary["modules"]["dashboard"]; locale: Locale }) {
  const t = dashboardWorkflowMessages[locale];
  const base = `/tool/organizations/${encodeURIComponent(organizationId)}`;
  const routes = ["applicability-check", "gap-analysis", "action-plan"];
  const icons = [ApplicabilityCheckIcon, GapAnalysisIcon, ActionPlanIcon];
  const completed = d.workflow.steps.map((step) => step.status === "completed");
  const activePhase = d.workflow.steps.findIndex((step) => step.status !== "completed" && step.status !== "locked");
  const phase = activePhase >= 0 ? activePhase : 2;
  const expandedActionPlanLayout = phase === 2 && Boolean(d.plan.id);
  const months = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { month: "short" });
  const actionLink = (route: string, label = t.open, className?: string) => {
    const unfinishedCheck = route === "applicability-check" && !d.applicability.revisionId;
    return <DashboardActionLink href={`${base}/${route}${unfinishedCheck ? "/new" : ""}`} label={label} draftKey={unfinishedCheck ? `/api/organizations/${organizationId}/applicability-check/submissions` : undefined} startLabel={t.start} continueLabel={t.continue} className={className} />;
  };
  function stageCard(index: number) {
  const report = index === 3;
  const Icon = report ? FileText : icons[index];
  const step = d.workflow.steps[index];
  const locked = Boolean(step && step.status === "locked");
  const stale = Boolean(step && step.status === "outdated");
  const done = Boolean(step && step.status === "completed");
  const inProgress = !locked && !stale && !done && !report && !(index === 2 && !d.plan?.id);
  const stagePercentage = index === 1 ? d.gap.progress.percentage : index === 2 ? d.plan.percentage : 50;

  return (
    <Panel
      title={report ? t.report : t.steps[index]}
      icon={<Icon className="size-[18px]" />}
      headerAccessory={
  locked ? (
    <span className="inline-flex h-8 w-36 shrink-0 items-center justify-center gap-2.5 rounded-full bg-foreground/5 px-3 font-sans text-sm leading-4 font-normal text-foreground outline outline-1 outline-offset-[-1px] outline-foreground/90 dark:bg-white/5 dark:text-white dark:outline-white/90">
      <svg
        width="13"
        height="15"
        viewBox="0 0 13 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M3.1676 6.66406V3.9974C3.1676 3.11334 3.49718 2.26549 4.08383 1.64037C4.67049 1.01525 5.46616 0.664063 6.29581 0.664062C7.12546 0.664062 7.92113 1.01525 8.50778 1.64037C9.09444 2.26549 9.42401 3.11334 9.42401 3.9974V6.66406M1.91632 6.66406H10.6753C11.3664 6.66406 11.9266 7.26102 11.9266 7.9974V12.6641C11.9266 13.4004 11.3664 13.9974 10.6753 13.9974H1.91632C1.22526 13.9974 0.665039 13.4004 0.665039 12.6641V7.9974C0.665039 7.26102 1.22526 6.66406 1.91632 6.66406Z"
          stroke="currentColor"
          strokeWidth="1.33"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{t.locked}</span>
    </span>
  ) : report ? (
    <ReportStatusBadge state={d.report.state} stale={d.report.stale} labels={t} />
  ) : inProgress ? (
    <div className="inline-flex h-8 w-36 shrink-0 items-center justify-center gap-2.5 rounded-full bg-zinc-800 px-3 font-sans text-sm leading-4 font-normal text-amber-500 outline outline-1 outline-offset-[-1px] outline-amber-500">
      <StatusProgressRing value={stagePercentage} />
      <span className="whitespace-nowrap">{t.active}</span>
    </div>
  ) : (
    <span className="inline-flex h-8 w-36 shrink-0 items-center justify-center gap-2.5 rounded-full border border-card-foreground/30 bg-transparent px-3 font-sans text-sm leading-4 font-normal text-card-foreground">
      {!stale && !done ? <StatusProgressRing value={0} /> : <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border-2 border-current" />}
      <span className="truncate">{stale ? t.stale : done ? t.done : report || (index === 2 && !d.plan.id) ? t.pending : t.active}</span>
    </span>
  )
}
    >
      {report ? (
        <DashboardReportSummary dashboard={d} labels={t} locale={locale} />
      ) : index === 2 && !d.plan?.id ? (
  <div className="flex min-h-24 flex-col items-center justify-center gap-10 text-center">
    {/* HIER mt-4 HINZUFÜGEN (oder mt-6 / mt-8 für noch mehr Abstand) */}
    <ActionPlanPlaceholderIcon className="mt-5 size-[52px]" />
    <p className="max-w-[420px] text-sm leading-5 text-muted-foreground">
      {t.actionPlanEmptyHint}
    </p>
  </div>
) : locked ? (
        <div className="flex min-h-24 translate-y-4 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
          <LockKeyhole size={28} />
          {t.lockHint}
        </div>
      ) : index === 2 ? (
        <ActionPlanSummary dashboard={d} labels={t} />
      ) : index === 1 && !d.gap.revisionId ? (
        <div className="space-y-2 pt-6 text-sm">
          <p className="leading-6 text-muted-foreground">
            {t.gapQuestionsRemaining
              .replace("{remaining}", String(d.gap.progress.remaining))
              .replace("{total}", String(d.gap.progress.total))}
            {d.gap.progress.updatedAt ? ` · ${t.gapLastEdited} ${relativeDashboardTime(d.gap.progress.updatedAt, locale)}` : ""}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-[#002bff]" style={{ width: `${d.gap.progress.percentage}%` }} />
          </div>
          <p className="text-right text-xs text-muted-foreground">{d.gap.progress.percentage}%</p>
        </div>
      ) : (
        <>
          <p className={`text-sm leading-6 text-muted-foreground ${index === 0 ? "flex min-h-24 items-center justify-center text-center" : "min-h-12"}`}>
            {t.hints[index]}
          </p>
          {index === 0 && d.applicability.outcome && (
            <p className="mt-3 text-sm font-medium">
              {labels.overview.outcomes[d.applicability.outcome as keyof typeof labels.overview.outcomes] ?? labels.overview.pending}
            </p>
          )}
          {index === 1 && <p className="mt-3 text-sm">{d.gap.findingCount} {t.findings} · {d.gap.criticalCount} {t.critical}</p>}
        </>
      )}
      {!locked && actionLink(
        report ? "pdf-export" : routes[index],
        report ? (d.report.id ? t.manageReport : t.createReport) : index === 2 && d.plan.id ? t.continue : t.open,
        report
          ? "translate-y-3"
          : index === 1 && !d.gap.revisionId
            ? "translate-y-6"
            : undefined,
      )}
    </Panel>
  );
}
  return <section className="@container flex w-full min-w-0 flex-col gap-8">
    <PageHeader className="w-full [&>p]:w-full [&>p]:max-w-none" title={labels.title} subtitle={labels.description} />
    <ol aria-label={labels.title} className="grid w-full min-w-0 grid-cols-3 gap-2 py-5 sm:gap-6 sm:py-8">
      {t.steps.map((title, index) => {
        const status = d.workflow.steps[index].status;
        const locked = status === "locked";
        return <li key={title} aria-current={phase === index ? "step" : undefined} className="flex min-w-0 flex-col items-center text-center"><span className={`flex size-12 shrink-0 items-center justify-center rounded-full border text-[#FBFBFB] ${completed[index] ? "border-[#FBFBFB] bg-[#46A95A]" : locked ? "border-border-strong bg-[#002BFF]/20 opacity-30" : "border-[#FBFBFB] bg-[#C58B00]"}`}><span className={locked ? "opacity-30" : undefined}><DashboardStepIcon step={index} /></span></span><span className={`mt-4 w-full break-words text-[11px] leading-4 sm:text-sm sm:leading-5 ${locked ? "text-muted-foreground/50" : "text-foreground"}`}>{title}</span><span className={`mt-1.5 text-[10px] leading-4 sm:text-xs ${completed[index] ? "text-success-foreground" : locked ? "text-muted-foreground/50" : "text-[#FFAA00]"}`}>{completed[index] ? t.done : locked ? t.locked : index === 1 ? `${d.gap.progress.percentage}% ${t.active}` : index === 2 ? `${d.plan.percentage}% ${t.active}` : t.active}</span></li>;
      })}
    </ol>
    <div data-dashboard-layout={expandedActionPlanLayout ? "action-plan" : "standard"} className={expandedActionPlanLayout ? "flex w-full min-w-0 flex-col gap-5 @min-[640px]:grid @min-[640px]:grid-cols-2 @min-[640px]:items-stretch" : "grid w-full min-w-0 grid-cols-1 items-stretch gap-5 @min-[640px]:grid-cols-2"}>
      <div className={expandedActionPlanLayout ? "contents @min-[640px]:flex @min-[640px]:h-full @min-[640px]:min-w-0 @min-[640px]:flex-col @min-[640px]:gap-5" : "contents"}>
        <div className="order-1 min-w-0" data-dashboard-slot="current">{stageCard(phase)}</div>
        <div className="order-3 min-w-0" data-dashboard-slot="documents">
  <Panel title={t.documents} icon={<FolderOpen size={18} />}>
    <div className="flex h-full flex-col justify-between">
      {/* mt-auto schiebt NUR die 3 Boxen nach unten, ohne die Kachel zu vergrößern */}
      <div className="mt-auto grid grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))] gap-3">
        {[[t.total, d.evidence.counts.total, "text-purple-400"], [t.versions, d.evidence.counts.active, "text-green-400"], [t.other, d.evidence.counts.archived, "text-amber-400"]].map(([label, value, color]) => (
          <div key={label} className="flex min-h-20 min-w-0 flex-col items-start justify-start rounded-xl bg-[#292C34] px-3.5 py-2.5 font-sans outline outline-1 -outline-offset-1 outline-[#3D4149]">
            <p className={`w-full text-2xl leading-7 font-bold ${color}`}>{value}</p>
            <p className="w-full pt-1 text-base leading-5 font-medium break-words text-white">{label}</p>
          </div>
        ))}
      </div>
      <div className="pt-2">
        <DashboardActionLink href={`${base}/documents`} label={t.documentsLink} />
      </div>
    </div>
  </Panel>
</div>
      </div>
      <div className={expandedActionPlanLayout ? "contents @min-[640px]:flex @min-[640px]:h-full @min-[640px]:min-w-0 @min-[640px]:flex-col @min-[640px]:gap-5 @min-[640px]:overflow-hidden @min-[640px]:[contain:size]" : "contents"}>
        <div className="order-2 min-w-0" data-dashboard-slot="next">{stageCard(phase + 1)}</div>
        <div className={`order-4 min-w-0 ${expandedActionPlanLayout ? "@min-[640px]:min-h-0 @min-[640px]:flex-1 @min-[640px]:overflow-hidden" : ""}`} data-dashboard-slot="activity"><Panel title={t.activity} scrollable expandedScroll={expandedActionPlanLayout} icon={<Activity size={18} />}><DashboardActivityFeed organizationId={organizationId} initialItems={d.recentActivity} initialCursor={d.recentActivityNextCursor} locale={locale} labels={{ empty: t.empty, loading: t.loadingActivity, loadError: t.activityLoadError, activityText: t.activityText }} /></Panel></div>
      </div>
    </div>
    <ProgressChart dashboard={d} labels={t} months={months} />
  </section>;
}

type ReportState = "queued" | "rendering" | "ready" | "failed" | "cancelled";

function normalizeReportState(state: string | null): ReportState | null {
  return state === "queued" || state === "rendering" || state === "ready" || state === "failed" || state === "cancelled"
    ? state
    : null;
}

function ReportStatusBadge({ state, stale, labels }: { state: string | null; stale: boolean; labels: typeof dashboardWorkflowMessages.de }) {
  const normalized = normalizeReportState(state);
  if (!normalized) {
    return <span className="inline-flex h-8 w-36 shrink-0 items-center justify-center gap-2.5 rounded-full border border-card-foreground/20 px-3 font-sans text-sm leading-4 font-normal text-muted-foreground"><StatusProgressRing value={0} /><span className="truncate">{labels.pending}</span></span>;
  }

  const failed = normalized === "failed" || normalized === "cancelled";
  const ready = normalized === "ready";
  const Icon = ready ? Check : failed ? AlertTriangle : Clock3;
  const text = stale ? labels.stale : labels.reportStatuses[normalized];
  const tone = stale
    ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
    : failed
      ? "border-red-400/50 bg-red-400/10 text-red-400"
      : ready
      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
      : "border-blue-400/50 bg-blue-400/10 text-blue-300";

  return (
    <span className={`inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-full border px-2.5 font-sans text-sm leading-4 font-normal ${ready ? "w-[88px]" : "w-36"} ${tone}`}>
      <Icon aria-hidden="true" className={`size-3.5 shrink-0 ${!ready && !failed ? "animate-pulse" : ""}`} />
      <span className="truncate">{text}</span>
    </span>
  );
}

function DashboardReportSummary({ dashboard: d, labels, locale }: { dashboard: Dashboard; labels: typeof dashboardWorkflowMessages.de; locale: Locale }) {
  const state = normalizeReportState(d.report.state);
  if (!d.report.id || !state) {
    return (
      <div className="flex min-h-32 translate-y-3 items-center gap-4 rounded-xl border border-dashed border-border-strong bg-foreground/[0.02] p-4" data-dashboard-report-empty>
        <div className="relative flex h-20 w-16 shrink-0 items-center justify-center rounded-lg border border-[#3D4149] bg-[#292C34] shadow-lg shadow-black/15">
          <FileText aria-hidden="true" className="size-8 text-zinc-400" strokeWidth={1.4} />
          <span className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full border-2 border-card bg-[#002BFF] text-white dark:border-[#1e2029]">
            <span className="text-lg leading-none">+</span>
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-card-foreground">{labels.reportEmptyTitle}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{labels.reportEmptyHint}</p>
        </div>
      </div>
    );
  }

  const processing = state === "queued" || state === "rendering";
  const failed = state === "failed" || state === "cancelled";
  const ready = state === "ready";
  const title = ready ? labels.reportReadyTitle : failed ? labels.reportFailedTitle : labels.reportCreatingTitle;
  const description = ready ? labels.reportReadyHint : failed ? labels.reportFailedHint : labels.reportCreatingHint;

  return (
    <div className="overflow-hidden rounded-xl border border-[#3D4149] bg-[#292C34]" data-dashboard-report-state={state}>
      <div className="flex items-start gap-3 p-4">
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-lg border ${ready ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : failed ? "border-red-400/30 bg-red-400/10 text-red-400" : "border-blue-400/30 bg-blue-400/10 text-blue-300"}`}>
          {ready ? <CheckCircle2 className="size-5" /> : failed ? <AlertTriangle className="size-5" /> : <Clock3 className="size-5 animate-pulse" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-400">{description}</p>
          {d.report.sourceUpdatedAt ? <p className="mt-1 text-[11px] leading-4 text-zinc-500">{labels.reportUpdated}: {formatDateTime(d.report.sourceUpdatedAt, locale)}</p> : null}
        </div>
      </div>
      {processing ? (
        <div className="h-1 w-full overflow-hidden bg-white/5" aria-hidden="true">
          <div className="h-full w-2/3 animate-pulse rounded-r-full bg-[#002BFF]" />
        </div>
      ) : null}
      {ready ? (
        <div className="grid grid-cols-3 border-t border-[#3D4149]" aria-label={labels.reportOverview}>
          {[
            { included: d.report.includes.applicability, label: labels.reportApplicability },
            { included: d.report.includes.gap, label: labels.reportGap },
            { included: d.report.includes.actionPlan, label: labels.reportMeasures },
          ].map(({ included, label }) => (
            <div key={label} className="min-w-0 px-2 py-2.5 text-center [&+&]:border-l [&+&]:border-[#3D4149]">
              <Check aria-hidden="true" className={`mx-auto size-4 ${included ? "text-emerald-400" : "text-zinc-600"}`} />
              <p className={`mt-0.5 truncate text-[10px] leading-4 ${included ? "text-zinc-300" : "text-zinc-600"}`}>{label}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function layoutProgressTimeline(
  points: Dashboard["complianceProgress"]["points"],
  milestones: Dashboard["complianceProgress"]["milestones"],
  first: number,
  last: number,
) {
  const left = 70;
  const right = 1030;
  const minimumGap = 18;
  const items = [
    ...points.map((point) => ({ key: `point:${point.at}`, at: point.at, percentage: point.percentage, kind: "point" as const })),
    ...milestones.map((milestone) => ({ key: `milestone:${milestone.id}`, at: milestone.occurredAt, percentage: milestone.percentage, kind: "milestone" as const, milestone })),
  ]
    .filter((item) => {
      const time = new Date(item.at).getTime();
      return time >= first && time <= last;
    })
    .sort((leftItem, rightItem) => {
      const difference = new Date(leftItem.at).getTime() - new Date(rightItem.at).getTime();
      if (difference !== 0) return difference;
      return leftItem.kind === rightItem.kind ? 0 : leftItem.kind === "milestone" ? -1 : 1;
    });
  const xAtTime = (time: number) => left + (time - first) / Math.max(1, last - first) * (right - left);
  const positions = items.map((item) => xAtTime(new Date(item.at).getTime()));

  for (let index = 1; index < positions.length; index += 1) {
    positions[index] = Math.max(positions[index], positions[index - 1] + minimumGap);
  }
  if (positions.at(-1)! > right) {
    positions[positions.length - 1] = right;
    for (let index = positions.length - 2; index >= 0; index -= 1) {
      positions[index] = Math.min(positions[index], positions[index + 1] - minimumGap);
    }
  }
  if (positions[0] < left) {
    const gap = items.length > 1 ? (right - left) / (items.length - 1) : 0;
    positions.forEach((_, index) => { positions[index] = left + index * gap; });
  }

  return items.map((item, index) => ({ ...item, x: positions[index], y: 390 - item.percentage * 3.6 }));
}

function ProgressChart({ dashboard: d, labels: t, months }: { dashboard: Dashboard; labels: typeof dashboardWorkflowMessages.de; months: Intl.DateTimeFormat }) {
  const progress = d.complianceProgress;
  const points = progress.points;
  const times = points.map((point) => new Date(point.at).getTime());
  const lastDate = new Date(times.length ? Math.max(...times) : Date.now());
  const year = lastDate.getUTCFullYear();
  const first = Date.UTC(year, 0, 1);
  const last = lastDate.getTime();
  const lastMonth = lastDate.getUTCMonth();
  const monthTicks = Array.from({ length: lastMonth + 1 }, (_, month) => new Date(Date.UTC(year, month, 1)));
  const xAt = (at: string) => 70 + (new Date(at).getTime() - first) / Math.max(1, last - first) * 960;
  const milestones = progress.milestones.filter((item) => new Date(item.occurredAt).getTime() >= first && new Date(item.occurredAt).getTime() <= last);
  const coordinates = layoutProgressTimeline(points, milestones, first, last);
  const path = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = coordinates.length > 1 ? `${path} L${coordinates[coordinates.length - 1].x},390 L${coordinates[0].x},390 Z` : "";
  const milestoneColor = (code: string) => code === "applicability_submitted" ? "#4ADE80" : code.startsWith("gap_") ? "#FBBF24" : "#818CF8";
  const legend = [
    { label: t.progressLegend.total, color: "#002BFF", line: true },
    { label: t.progressLegend.applicabilityCompleted, color: "#4ADE80", line: false },
    { label: t.progressLegend.gapCompleted, color: "#FBBF24", line: false },
    { label: t.progressLegend.actionPlanCreated, color: "#818CF8", line: false },
  ];
  const currentPointKey = points.length ? `point:${points.at(-1)!.at}` : null;

  return <section className="min-w-0 rounded-2xl border-[1.5px] border-border-strong bg-card px-5 py-7 shadow-sm dark:bg-[#1e2029] sm:px-9 sm:py-10">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-4 font-sans text-2xl leading-6 font-bold text-card-foreground [&>svg]:shrink-0">
          <svg width="22" height="28" viewBox="0 0 22 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M1.45119 8.42478L4.99208 16.9322L0 27.8348L4.70185 27.9174L7.43008 21.6401L10.2744 28L14.9763 27.8348L9.69393 16.767C9.69393 16.767 11.6192 12.4995 12.6544 10.6549C13.6453 8.88913 14.7441 7.15834 15.905 5.69911C17.048 4.26252 18.6042 2.84956 19.6201 1.89971C20.3802 1.18888 22 0 22 0C22 0 16.8024 1.91845 15.4406 3.05605C14.6064 3.75291 13.7011 4.52122 12.8865 5.36873C11.9868 6.30479 10.917 7.45461 10.0422 8.67257C9.14248 9.9253 7.48813 12.885 7.48813 12.885L5.57256 8.34218L1.45119 8.42478Z" fill="currentColor" />
  </svg>
          <span className="min-w-0 translate-y-[2px] break-words">{t.progress}</span>
        </h2>
      </div>
      <div className="mr-8 shrink-0 justify-self-end text-right sm:mr-[60%]">
        <strong className="block text-2xl leading-6 font-bold">{progress.currentPercentage}%</strong>
        <span className={`block whitespace-nowrap ${progress.delta >= 0 ? "text-xs text-green-500" : "text-xs text-red-400"}`}>
          {progress.delta >= 0 ? "+" : ""}{progress.delta}
          {progress.comparisonAt ? ` ${t.since} ${months.format(new Date(progress.comparisonAt))}` : ""}
        </span>
      </div>
      <p className="col-span-2 text-sm leading-6 text-muted-foreground sm:ml-[38px]">{t.progressHint}</p>
    </div>
    <div className="mt-8 overflow-x-auto sm:mt-10">
      <svg viewBox="0 0 1060 460" role="img" aria-label={`${t.progress}: ${progress.currentPercentage}%. ${t.history}`} className="h-auto w-full min-w-[480px]">
        <defs>
          <linearGradient id="dashboard-progress-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="22%" stopColor="#1D4ED8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 11 }, (_, index) => index * 10).map((value) => <g key={value}>
          <text x="46" y={390 - value * 3.6} textAnchor="end" dominantBaseline="middle" fill="currentColor" className="text-sm text-card-foreground">{value}%</text>
          <line x1="70" x2="1030" y1={390 - value * 3.6} y2={390 - value * 3.6} stroke="currentColor" className="text-muted-foreground/15" />
        </g>)}
        {area && <path d={area} fill="url(#dashboard-progress-area)" />}
        {path && <path d={path} fill="none" stroke="#002BFF" strokeWidth="3" strokeLinejoin="round" />}
        {coordinates.map((point) => point.key === currentPointKey ? <circle key={point.key} cx={point.x} cy={point.y} r="7" fill="#002BFF" stroke="#111827" strokeWidth="3"><title>{t.today}: {point.percentage}%</title></circle> : null)}
        {monthTicks.map((date) => <text key={date.toISOString()} x={xAt(date.toISOString())} y="438" textAnchor="middle" fill="currentColor" className="text-sm text-card-foreground">{months.format(date)}</text>)}
        {coordinates.filter((point) => point.kind === "milestone").map((point) => <g key={point.key}>
          <circle cx={point.x} cy={point.y} r="11" fill={milestoneColor(point.milestone.code)} fillOpacity="0.25" />
          <circle cx={point.x} cy={point.y} r="7" fill={milestoneColor(point.milestone.code)} stroke="#1E2029" strokeWidth="3"><title>{t.activityText[point.milestone.code]}: {point.percentage}%</title></circle>
        </g>)}
      </svg>
    </div>
    <ul className="mt-5 ml-[5.5%] flex flex-wrap gap-x-10 gap-y-3 text-sm text-card-foreground">
      {legend.map((item) => <li key={item.label} className="flex items-center gap-2"><span className={item.line ? "h-0.5 w-4 shrink-0 rounded-full" : "size-1.5 shrink-0 rounded-full"} style={{ backgroundColor: item.color }} />{item.label}</li>)}
    </ul>
  </section>;
}
