import { db } from "@/src/db";
import { auditEvents } from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import { and, desc, eq, inArray } from "drizzle-orm";

const gapEventTypes = [
  "gap_assessment.created",
  "gap_questionnaire.submitted",
  "gap_reassessment.prepared",
  "gap_reassessment.evidence_updated",
  "gap_reassessment.generation_enqueued",
  "gap_reassessment.retry_enqueued",
  "gap_reassessment.generated",
  "gap_reassessment.failed",
  "gap_revision.created",
  "gap_revision.corrected",
  "gap_revision.approved",
] as const;

const eventLabels: Record<
  (typeof gapEventTypes)[number],
  { de: string; en: string }
> = {
  "gap_assessment.created": {
    de: "Gap-Analyse begonnen",
    en: "Gap analysis started",
  },
  "gap_questionnaire.submitted": {
    de: "Antworten gespeichert",
    en: "Answers saved",
  },
  "gap_reassessment.prepared": {
    de: "Analyseangaben vorbereitet",
    en: "Analysis information prepared",
  },
  "gap_reassessment.evidence_updated": {
    de: "Dokumentauswahl geändert",
    en: "Document selection changed",
  },
  "gap_reassessment.generation_enqueued": {
    de: "Analyse gestartet",
    en: "Analysis started",
  },
  "gap_reassessment.retry_enqueued": {
    de: "Analyse erneut gestartet",
    en: "Analysis started again",
  },
  "gap_reassessment.generated": {
    de: "Analyse abgeschlossen",
    en: "Analysis completed",
  },
  "gap_reassessment.failed": {
    de: "Analyse fehlgeschlagen",
    en: "Analysis failed",
  },
  "gap_revision.created": {
    de: "Neues Analyseergebnis erstellt",
    en: "New analysis result created",
  },
  "gap_revision.corrected": {
    de: "Bewertung manuell geändert",
    en: "Assessment changed manually",
  },
  "gap_revision.approved": {
    de: "Ergebnis bestätigt",
    en: "Result confirmed",
  },
};

export async function loadGapHistoryPreauthorized(input: {
  organizationId: string;
  currentUserId: string;
  locale: Locale;
  limit?: number;
}) {
  const rows = await db.query.auditEvents.findMany({
    where: and(
      eq(auditEvents.organizationId, input.organizationId),
      inArray(auditEvents.eventType, [...gapEventTypes]),
    ),
    orderBy: [desc(auditEvents.createdAt), desc(auditEvents.id)],
    limit: input.limit ?? 30,
  });
  const actors = await resolveActors(
    [...new Set(rows.flatMap((row) => (row.actorUserId ? [row.actorUserId] : [])))],
    input.currentUserId,
    input.locale,
  );
  return rows.map((row) => {
    const metadata = row.metadata as {
      reasons?: unknown;
      reason?: unknown;
    };
    const reasons = Array.isArray(metadata.reasons)
      ? metadata.reasons.filter(
          (reason): reason is string => typeof reason === "string",
        )
      : typeof metadata.reason === "string"
        ? [metadata.reason]
        : [];
    return {
      id: row.id,
      label:
        eventLabels[row.eventType as (typeof gapEventTypes)[number]]?.[
          input.locale
        ] ??
        (input.locale === "de" ? "Workflow aktualisiert" : "Workflow updated"),
      actor:
        (row.actorUserId ? actors.get(row.actorUserId) : null) ??
        (input.locale === "de" ? "System" : "System"),
      occurredAt: row.createdAt.toISOString(),
      reason: reasons.join(" · ") || null,
    };
  });
}

async function resolveActors(
  actorUserIds: string[],
  currentUserId: string,
  locale: Locale,
) {
  const fallback = locale === "de" ? "Teammitglied" : "Team member";
  const result = new Map<string, string>();
  for (const id of actorUserIds) {
    if (id === currentUserId) result.set(id, locale === "de" ? "Sie" : "You");
    else result.set(id, fallback);
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SECRET_KEY
  ) {
    return result;
  }
  try {
    const admin = getSupabaseAdminClient();
    await Promise.all(
      actorUserIds
        .filter((id) => id !== currentUserId)
        .map(async (id) => {
          const { data, error } = await admin.auth.admin.getUserById(id);
          if (error || !data.user) return;
          const metadata = data.user.user_metadata as {
            full_name?: unknown;
            name?: unknown;
          };
          const name =
            typeof metadata.full_name === "string"
              ? metadata.full_name
              : typeof metadata.name === "string"
                ? metadata.name
                : data.user.email;
          if (name) result.set(id, name);
        }),
    );
  } catch {
    // History stays useful with a localized, non-identifying fallback.
  }
  return result;
}
