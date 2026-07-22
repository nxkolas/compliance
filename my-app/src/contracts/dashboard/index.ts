import * as z from "zod";
export const dashboardSchema = z.object({
  applicability: z.object({ outcome: z.string().nullable(), revisionId: z.uuid().nullable(), sourceUpdatedAt: z.iso.datetime().nullable(), stale: z.boolean(), outdated: z.boolean() }),
  gap: z.object({ revisionId: z.uuid().nullable(), findingCount: z.number().int(), criticalCount: z.number().int(), sourceUpdatedAt: z.iso.datetime().nullable(), stale: z.boolean(), outdated: z.boolean() }),
  evidence: z.object({ documentCount: z.number().int(), currentVersionCount: z.number().int(), sourceUpdatedAt: z.iso.datetime().nullable(), stale: z.boolean(), outdated: z.boolean() }),
  plan: z.object({ id: z.uuid().nullable(), openItems: z.number().int(), totalItems: z.number().int(), sourceUpdatedAt: z.iso.datetime().nullable(), stale: z.boolean(), outdated: z.boolean() }),
  report: z.object({ id: z.uuid().nullable(), state: z.string().nullable(), sourceUpdatedAt: z.iso.datetime().nullable(), stale: z.boolean(), outdated: z.boolean() }),
  nextSteps: z.array(z.string()),
});
