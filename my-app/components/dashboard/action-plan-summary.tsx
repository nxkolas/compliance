import type { z } from "zod";
import type { dashboardSchema } from "@/src/contracts/dashboard";
import type { dashboardWorkflowMessages } from "@/src/i18n/dashboard-workflow";

type Props = {
  dashboard: Pick<z.infer<typeof dashboardSchema>, "plan">;
  labels: typeof dashboardWorkflowMessages.de;
};

export function ActionPlanSummary({ dashboard: { plan }, labels }: Props) {
  const segments = [
    { key: "done", label: labels.doneItems, count: plan.statuses.done, color: "#002BFF" },
    { key: "inProgress", label: labels.inProgressItems, count: plan.statuses.inProgress, color: "#D946EF" },
    { key: "open", label: labels.openItems, count: plan.statuses.open, color: "#F87171" },
    ...(plan.statuses.cancelled > 0
      ? [{ key: "cancelled", label: labels.cancelledItems, count: plan.statuses.cancelled, color: "#82848C" }]
      : []),
  ];
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  const visibleSegments = segments.filter((segment) => segment.count > 0);

  return (
    <div className="@container -mt-3 font-sans" data-action-plan-summary>
      <p className="ml-7 text-sm leading-5 text-muted-foreground">
        {labels.actionPlanTotal.replace("{count}", String(plan.totalItems))}
      </p>
      <div className="mt-3 grid grid-cols-1 items-center gap-4 @min-[420px]:grid-cols-[minmax(0,288fr)_minmax(0,216fr)] @min-[420px]:gap-6">
        <div className="relative mx-auto flex size-56 max-w-full items-center justify-center @min-[420px]:mx-0 @min-[420px]:ml-7">
          <svg viewBox="0 0 224 224" role="img" aria-label={`${plan.percentage}% ${labels.implemented}`} className="size-56 max-w-full">
            <title>{segments.map((segment) => `${segment.label} (${segment.count})`).join(", ")}</title>
            {total === 0 && <circle cx="112" cy="112" r="90" fill="none" strokeWidth="36" className="stroke-muted" />}
            {visibleSegments.map((segment, index) => {
              const share = segment.count / total * 100;
              const offset = visibleSegments.slice(0, index).reduce((sum, previous) => sum + previous.count / total * 100, 0);
              // Small separators match the reference without hiding tiny nonzero slices.
              const gap = visibleSegments.length > 1 ? Math.min(0.8, share / 4) : 0;
              return <circle
                key={segment.key}
                data-action-segment={segment.key}
                cx="112" cy="112" r="90" fill="none" stroke={segment.color} strokeWidth="36"
                pathLength="100" strokeDasharray={`${share - gap} ${100 - share + gap}`}
                strokeDashoffset={-offset - gap / 2} transform="rotate(-90 112 112)"
              />;
            })}
          </svg>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-card-foreground">
            <strong className="text-4xl font-bold leading-[46px] tabular-nums">{plan.percentage}%</strong>
            <span className="mt-1 text-xs font-medium">{labels.implemented}</span>
          </div>
        </div>
        <ul className="mx-auto space-y-5 text-sm leading-5 text-card-foreground @min-[420px]:mx-0">
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
              <span>{segment.label} ({segment.count})</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
