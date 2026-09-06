import type { GapLabels, GapWorkflow } from "./types";
import { formatDateTime } from "@/src/i18n/format";

export function GapHistory({
  history,
  labels,
  locale,
}: {
  history: GapWorkflow["history"];
  labels: GapLabels;
  locale: "de" | "en";
}) {
  return (
    <section aria-labelledby="gap-history-heading">
      <h2 id="gap-history-heading" className="text-xl font-semibold">
        {labels.history}
      </h2>
      {history.length ? (
        <ol className="mt-4 grid gap-4">
          {history.map((event) => (
            <li key={event.id} className="border-l-2 pl-4 text-sm">
              <p className="font-medium">{event.label}</p>
              <p className="text-muted-foreground">
                {formatDateTime(event.occurredAt, locale)}{" "}
                · {event.actor}
              </p>
              {event.reason ? <p className="mt-1">{event.reason}</p> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {labels.historyEmpty}
        </p>
      )}
    </section>
  );
}
