"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  CircleHelp,
  CircleX,
  ClipboardList,
  Loader2,
  Pencil,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n";
import { localizeUiError } from "@/lib/i18n/errors";
import type { getCurrentActionPlan } from "@/src/server/action-plans/service";
import { actionPlansClient } from "@/src/client/action-plans";
import { pollJob } from "@/src/client/job-polling";
import { GapCategoryIcon } from "@/components/gap-analysis/gap-category-icon";

type CurrentPlan = Awaited<ReturnType<typeof getCurrentActionPlan>>;
type Labels = Dictionary["modules"]["actionPlan"]["workflow"];

export function ActionPlanWorkflow({ organizationId, current, availableGapRevisionId = null, canContribute, labels }: {
  organizationId: string;
  current: CurrentPlan;
  availableGapRevisionId?: string | null;
  canContribute: boolean;
  labels: Labels;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(
    current?.categories.flatMap((category) => category.actions)[0]?.id ?? null,
  );
  async function generatePlan() {
    if (!availableGapRevisionId) return;
    setBusy("generation");
    setError(null);
    try {
      const started = await actionPlansClient.generate(organizationId, {
        gapRevisionId: availableGapRevisionId,
      });
      const job = await pollJob({
        jobId: started.data.job.id,
        signal: new AbortController().signal,
        finalRefresh: () => undefined,
      });
      if (job.state !== "succeeded" || !job.result?.actionPlanId) {
        throw new Error(job.safeError?.message ?? labels.generationFailed);
      }
      router.refresh();
    } catch (caught) {
      setError(localizeUiError(caught, { fallback: labels.generationFailed }));
    } finally {
      setBusy(null);
    }
  }

  if (!current && availableGapRevisionId) {
    return (
      <div
        data-action-plan-available-state
        className="mt-8 w-full max-w-[1274px] sm:mt-12 lg:mt-16 xl:mt-16"
      >
        {error ? (
          <Alert variant="destructive" className="mb-6 max-w-[673px]">
            <AlertDescription className="text-current">{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="relative flex min-w-0 flex-col xl:min-h-[410px]">
          <section className="relative min-h-[320px] w-full max-w-[697px] overflow-visible">
            <svg
              data-action-plan-available-speech-bubble
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full"
              viewBox="0 0 697 320"
              fill="none"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0.75 307.25V12.75C0.75 6.123 6.123 0.75 12.75 0.75H661.25C667.877 0.75 673.25 6.123 673.25 12.75V139.75C673.25 144.04 675.54 148.005 679.26 150.147L694.75 159.07L680.18 165.866C675.95 167.837 673.25 172.078 673.25 176.742V307.25C673.25 313.877 667.877 319.25 661.25 319.25H12.75C6.123 319.25 0.75 313.877 0.75 307.25Z"
                fill="url(#action-plan-available-gradient)"
                stroke="#3D4049"
                strokeWidth="1.5"
              />
              <defs>
                <linearGradient
                  id="action-plan-available-gradient"
                  x1="0.75"
                  y1="0.75"
                  x2="281"
                  y2="505"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#1A2540" />
                  <stop offset="1" stopColor="#111825" />
                </linearGradient>
              </defs>
            </svg>

            <div className="relative z-10 px-6 pt-8 sm:px-10 xl:px-[46px] xl:pt-[34px]">
              <h2 className="max-w-[560px] text-2xl leading-8 font-bold tracking-tight text-white sm:text-3xl sm:leading-9">
                {labels.planAvailable}
              </h2>
              <p className="mt-[14px] max-w-[562px] text-base leading-7 text-white">
                <strong className="font-bold">{labels.createPlanTitle}</strong>
                <br />
                {labels.createPlanDescription}
              </p>
              <Button
                type="button"
                className="mt-[29px] h-12 w-full gap-3 overflow-hidden rounded-lg bg-[#002BFF] px-5 font-['Space_Grotesk'] text-base font-medium text-white shadow-none hover:bg-[#123BFF] sm:w-64"
                disabled={busy === "generation"}
                onClick={() => void generatePlan()}
              >
                {busy === "generation" ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <ClipboardList aria-hidden="true" className="size-4" strokeWidth={1.33} />
                )}
                {busy === "generation" ? labels.generating : labels.generate}
              </Button>
            </div>
          </section>

          <div className="order-first mb-6 flex w-full justify-center xl:absolute xl:top-3 xl:left-[690px] xl:order-none xl:mb-0 xl:h-[354px] xl:w-[516px] xl:items-center xl:justify-start">
            <Image
              src="/images/robot.svg"
              alt=""
              width={516}
              height={354}
              className="h-auto w-full max-w-[420px] object-contain xl:max-w-none"
            />
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div
        data-action-plan-empty-state
        className="mt-8 w-full max-w-[1274px] sm:mt-12 lg:mt-16 xl:mt-16"
      >
        <div className="relative flex min-w-0 flex-col xl:min-h-[576px]">
          <div className="w-full min-w-0 xl:w-[694px]">
            <section className="relative min-h-[384px] overflow-visible xl:w-[697px]">
              <svg
                data-action-plan-speech-bubble
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 size-full"
                viewBox="0 0 697 360"
                fill="none"
                preserveAspectRatio="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0.75 346.75V12.75C0.75 6.12258 6.12258 0.75 12.75 0.75H661.248C667.876 0.75 673.248 6.12259 673.248 12.75V156.595C673.248 160.886 675.54 164.851 679.259 166.993L694.75 175.916L680.177 182.712C675.95 184.683 673.248 188.924 673.248 193.588V346.75C673.248 353.377 667.876 358.75 661.248 358.75H12.75C6.12258 358.75 0.75 353.377 0.75 346.75Z"
                  fill="#D9D9D9"
                />
                <path
                  d="M0.75 346.75V12.75C0.75 6.12258 6.12258 0.75 12.75 0.75H661.248C667.876 0.75 673.248 6.12259 673.248 12.75V156.595C673.248 160.886 675.54 164.851 679.259 166.993L694.75 175.916L680.177 182.712C675.95 184.683 673.248 188.924 673.248 193.588V346.75C673.248 353.377 667.876 358.75 661.248 358.75H12.75C6.12258 358.75 0.75 353.377 0.75 346.75Z"
                  fill="url(#action-plan-bubble-gradient)"
                />
                <path
                  d="M0.75 346.75V12.75C0.75 6.12258 6.12258 0.75 12.75 0.75H661.248C667.876 0.75 673.248 6.12259 673.248 12.75V156.595C673.248 160.886 675.54 164.851 679.259 166.993L694.75 175.916L680.177 182.712C675.95 184.683 673.248 188.924 673.248 193.588V346.75C673.248 353.377 667.876 358.75 661.248 358.75H12.75C6.12258 358.75 0.75 353.377 0.75 346.75Z"
                  stroke="#3D4049"
                  strokeWidth="1.5"
                />
                <defs>
                  <linearGradient
                    id="action-plan-bubble-gradient"
                    x1="0.75"
                    y1="0.75"
                    x2="294.595"
                    y2="563.248"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#1A2540" />
                    <stop offset="1" stopColor="#111825" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="relative z-10 px-6 pt-8 sm:px-10 xl:px-[46px] xl:pt-[34px]">
                <h2 className="max-w-[474px] text-2xl leading-8 font-bold tracking-tight text-white sm:text-3xl sm:leading-9">
                  {labels.noPlan}
                </h2>
                <p className="mt-[14px] max-w-[562px] text-base leading-7 font-normal text-white">
                  {labels.noApprovedRevision}
                </p>
                <Button
                  asChild
                  className="mt-[29px] h-12 w-full gap-3 overflow-hidden rounded-lg bg-[#002BFF] px-5 font-['Space_Grotesk'] text-base font-medium text-white shadow-none hover:bg-[#002BFF] sm:w-96"
                >
                  <Link href={`/tool/organizations/${organizationId}/gap-analysis`}>
                    <svg
                      aria-hidden="true"
                      className="h-[18px] w-[17px] shrink-0"
                      viewBox="0 0 17 18"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2.33073 17.3317H13.9974C14.4394 17.3317 14.8633 17.1561 15.1759 16.8435C15.4885 16.531 15.6641 16.1071 15.6641 15.665V5.24837L11.0807 0.665039H3.9974C3.55537 0.665039 3.13145 0.840634 2.81888 1.15319C2.50632 1.46575 2.33073 1.88968 2.33073 2.33171V4.83171M10.6641 0.665039V5.66504H15.6641M6.4974 13.9984L5.2474 12.7484M3.16406 13.165C3.49237 13.165 3.81746 13.1004 4.12077 12.9747C4.42408 12.8491 4.69968 12.665 4.93183 12.4328C5.16398 12.2007 5.34812 11.9251 5.47376 11.6217C5.5994 11.3184 5.66406 10.9933 5.66406 10.665C5.66406 10.3367 5.5994 10.0116 5.47376 9.70833C5.34812 9.40502 5.16398 9.12942 4.93183 8.89727C4.69968 8.66513 4.42408 8.48098 4.12077 8.35534C3.81746 8.2297 3.49237 8.16504 3.16406 8.16504C2.50102 8.16504 1.86514 8.42843 1.3963 8.89727C0.927455 9.36611 0.664063 10.002 0.664062 10.665C0.664063 11.3281 0.927455 11.964 1.3963 12.4328C1.86514 12.9016 2.50102 13.165 3.16406 13.165Z"
                        stroke="#FBFBFB"
                        strokeWidth="1.33"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {labels.openGapAnalysis}
                  </Link>
                </Button>
              </div>

              <div className="absolute right-6 bottom-0 left-0 z-10 flex h-[93px] items-center justify-start border-t border-slate-800 pl-6 sm:pl-10 xl:pl-[46px]">
                <div className="flex items-center gap-[18px] text-white">
                  <CircleHelp aria-hidden="true" className="size-7 shrink-0" strokeWidth={1.33} />
                  <span className="text-base leading-5 font-medium">{labels.whySequence}</span>
                </div>
              </div>
            </section>

            <aside className="relative mt-8 flex min-h-40 w-full items-start rounded-xl bg-[rgba(27,29,38,0.36)] px-6 pt-[23px] text-white outline outline-1 outline-offset-[-1px] outline-[rgba(0,42,255,0.42)] sm:px-10 xl:block xl:h-40 xl:w-[673px] xl:px-0 xl:pt-0">
              <svg
                aria-hidden="true"
                className="mt-0.5 size-6 shrink-0 xl:absolute xl:top-[23px] xl:left-[46px] xl:mt-0"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 12C3 13.1819 3.23279 14.3522 3.68508 15.4442C4.13738 16.5361 4.80031 17.5282 5.63604 18.364C6.47177 19.1997 7.46392 19.8626 8.55585 20.3149C9.64778 20.7672 10.8181 21 12 21C13.1819 21 14.3522 20.7672 15.4442 20.3149C16.5361 19.8626 17.5282 19.1997 18.364 18.364C19.1997 17.5282 19.8626 16.5361 20.3149 15.4442C20.7672 14.3522 21 13.1819 21 12C21 9.61305 20.0518 7.32387 18.364 5.63604C16.6761 3.94821 14.3869 3 12 3C9.61305 3 7.32387 3.94821 5.63604 5.63604C3.94821 7.32387 3 9.61305 3 12Z"
                  stroke="white"
                  strokeWidth="1.33"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M12 9H12.01" stroke="white" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11 12H12V16H13" stroke="white" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="ml-[18px] min-w-0 xl:absolute xl:top-[28px] xl:left-[92px] xl:ml-0 xl:w-[559px]">
                <h3 className="text-lg leading-5 font-bold">{labels.infoTitle}</h3>
                <p className="mt-[13px] whitespace-pre-line text-base leading-7 font-normal">
                  {labels.infoDescription}
                </p>
              </div>
            </aside>
          </div>

          <div className="order-first mb-6 flex w-full justify-center xl:absolute xl:top-1 xl:left-[690px] xl:order-none xl:mb-0 xl:size-[560px] xl:justify-start">
            <Image
              src="/robot-sad.svg"
              alt=""
              width={560}
              height={560}
              className="h-auto w-full max-w-[420px] object-contain xl:max-w-none"
            />
          </div>
        </div>
      </div>
    );
  }
  async function update(itemId: string, status: "open" | "in_progress" | "done" | "cancelled") {
    setBusy(itemId);
    setError(null);
    try {
      await actionPlansClient.updateItem(organizationId, itemId, { status });
      router.refresh();
      return true;
    } catch (caught) {
      setError(localizeUiError(caught, { fallback: labels.error }));
      return false;
    } finally {
      setBusy(null);
    }
  }

  const actions = current.categories.flatMap((category) =>
    category.actions.map((item) => ({ category, item })),
  );
  const statusCounts = {
    all: actions.length,
    open: 0,
    in_progress: 0,
    done: 0,
    cancelled: 0,
  };
  for (const { item } of actions) statusCounts[item.status] += 1;

  return (
    <div data-action-plan-results className="w-full max-w-[1202px]">
      {error ? <Alert variant="destructive"><AlertDescription className="text-current">{error}</AlertDescription></Alert> : null}
      {current.sourceStaleness.stale ? <Alert variant="warning"><AlertDescription className="text-current">{labels.staleSources}</AlertDescription></Alert> : null}

      <div
        data-action-plan-status-summary
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        <StatusCard
          active
          count={statusCounts.all}
          label={labels.allMeasures}
          status="all"
        />
        {(["open", "in_progress", "done", "cancelled"] as const).map(
          (status) => (
            <StatusCard
              key={status}
              count={statusCounts[status]}
              label={labels.statuses[status]}
              status={status}
            />
          ),
        )}
      </div>

      <div className="mt-8 grid gap-4">
        {!current.categories.length ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">{labels.empty}</CardContent></Card>
        ) : actions.map(({ category, item }) => (
          <ActionItem
            key={item.id}
            item={item}
            categoryTitle={category.title}
            categoryIcon={category.icon}
            expanded={expandedItemId === item.id}
            labels={labels}
            canContribute={canContribute}
            busy={busy === item.id}
            onExpand={() => setExpandedItemId(item.id)}
            save={(status) => update(item.id, status)}
          />
        ))}
      </div>
    </div>
  );
}

function ActionItem({
  item,
  categoryTitle,
  categoryIcon,
  expanded,
  labels,
  canContribute,
  busy,
  onExpand,
  save,
}: {
  item: NonNullable<CurrentPlan>["categories"][number]["actions"][number];
  categoryTitle: string;
  categoryIcon: string;
  expanded: boolean;
  labels: Labels;
  canContribute: boolean;
  busy: boolean;
  onExpand: () => void;
  save: (status: "open" | "in_progress" | "done" | "cancelled") => Promise<boolean>;
}) {
  const [status, setStatus] = useState(item.status);
  const changed = status !== item.status;

  async function saveStatus() {
    const saved = await save(status);
    if (!saved) setStatus(item.status);
  }

  return (
    <Card
      data-action-plan-item
      data-action-plan-item-expanded={expanded || undefined}
      className={`w-full gap-0 overflow-hidden rounded-xl border-0 bg-[#1B1E27] py-0 text-white shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10),0px_1px_3px_0px_rgba(0,0,0,0.10)] outline-[1.5px] outline-offset-[-1.5px] outline-[#3D4049] ${
        expanded ? "min-h-[546px]" : "min-h-32"
      }`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        className="flex w-full items-center gap-5 px-6 py-8 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#002BFF] sm:px-10"
        onClick={onExpand}
      >
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#3D4049] bg-[#252832]">
          <GapCategoryIcon name={categoryIcon} className="size-5 text-white" />
        </span>
        <span className="min-w-0">
          <span className="block text-2xl leading-8 font-bold break-words text-white">
            {item.title}
          </span>
          <span className="mt-1 block text-base leading-7 break-words text-white">
            {categoryTitle}
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-1 flex-col">
          <div className="flex-1 px-6 pb-8 sm:px-10">
            <section aria-labelledby={`${item.id}-result`}>
              <h3
                id={`${item.id}-result`}
                className="text-xl leading-7 font-bold text-white"
              >
                {labels.whatToDo}
              </h3>
              <p className="mt-3 max-w-[972px] whitespace-pre-line text-base leading-7 text-white">
                {item.result}
              </p>
            </section>

            {item.suggestedEvidence.length ? (
              <GuidanceList
                id={`${item.id}-evidence`}
                title={labels.evidenceToCreate}
                items={item.suggestedEvidence}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-5 border-t border-[#3D4049] px-6 py-6 sm:px-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid w-full max-w-72 gap-3">
              <span
                id={`${item.id}-status-label`}
                className="text-xl leading-7 font-bold text-white"
              >
                {labels.status}
              </span>
              <Select
                value={status}
                disabled={!canContribute || busy}
                onValueChange={(value) => setStatus(value as typeof status)}
              >
                <SelectTrigger
                  aria-labelledby={`${item.id}-status-label`}
                  className="h-12 w-full rounded-lg border-[1.5px] border-border-strong bg-surface px-5 text-base text-white shadow-none focus:ring-[#002BFF]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-72 rounded-2xl border-surface bg-surface p-0 shadow-popover">
                  {(["open", "in_progress", "done", "cancelled"] as const).map(
                    (value) => (
                      <SelectItem
                        key={value}
                        value={value}
                        className="h-12 rounded-lg px-5 text-base"
                      >
                        {labels.statuses[value]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              className="h-12 w-full rounded-lg bg-[#002BFF] px-5 text-base font-medium text-white hover:bg-[#123BFF] focus-visible:ring-[#002BFF] lg:w-72"
              disabled={!canContribute || busy || !changed}
              onClick={() => void saveStatus()}
            >
              {busy ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="size-4" strokeWidth={1.33} />
              )}
              {busy ? labels.saving : labels.save}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function GuidanceList({ id, title, items }: { id: string; title: string; items: string[] }) {
  return (
    <section className="mt-8" aria-labelledby={id}>
      <h3 id={id} className="text-xl leading-7 font-bold text-white">{title}</h3>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-base leading-7 text-white">
        {items.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}
      </ul>
    </section>
  );
}

type ActionStatus = "all" | "open" | "in_progress" | "done" | "cancelled";

function StatusCard({
  active = false,
  count,
  label,
  status,
}: {
  active?: boolean;
  count: number;
  label: string;
  status: ActionStatus;
}) {
  return (
    <div
      data-action-plan-status-card={status}
      className={`min-h-28 rounded-xl p-4 shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10),0px_1px_3px_0px_rgba(0,0,0,0.10)] outline-[1.5px] outline-offset-[-1.5px] ${
        active
          ? "bg-slate-800 outline-[#002BFF]"
          : "bg-[#1B1E27] outline-[#3D4049]"
      }`}
    >
      <span className="block text-4xl leading-10 font-medium text-white">
        {count}
      </span>
      <span className="mt-1 flex items-center gap-2 text-base leading-7 text-white">
        {status !== "all" ? <ActionStatusIcon status={status} /> : null}
        {label}
      </span>
    </div>
  );
}

function ActionStatusIcon({ status }: { status: Exclude<ActionStatus, "all"> }) {
  const className = "size-5 shrink-0 text-white";
  if (status === "open") {
    return <ClipboardList aria-hidden="true" className={className} strokeWidth={1.33} />;
  }
  if (status === "in_progress") {
    return <Pencil aria-hidden="true" className={className} strokeWidth={1.33} />;
  }
  if (status === "done") {
    return <CircleCheck aria-hidden="true" className={className} strokeWidth={1.33} />;
  }
  return <CircleX aria-hidden="true" className={className} strokeWidth={1.33} />;
}
