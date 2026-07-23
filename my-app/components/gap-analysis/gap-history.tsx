import type { GapLabels, GapWorkflow } from "./types";

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
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer font-semibold">
        {labels.history}
      </summary>
      {history.length ? (
        <ol className="mt-4 grid gap-4">
          {history.map((event) => (
            <li key={event.id} className="border-l-2 pl-4 text-sm">
              <p className="font-medium">{event.label}</p>
              <p className="text-muted-foreground">
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(event.occurredAt))}{" "}
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
    </details>
  );
}
