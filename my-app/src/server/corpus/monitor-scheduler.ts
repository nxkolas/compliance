import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { backgroundJobs, legalSourceMonitors } from "@/src/db/schema";

export async function ensureScheduledLegalSourceMonitorJobs() {
  const monitors = await db.query.legalSourceMonitors.findMany({
    where: eq(legalSourceMonitors.active, true),
  });
  let created = 0;
  for (const monitor of monitors) {
    const [job] = await db.insert(backgroundJobs).values({
      kind: "legal-source-monitor",
      payload: { monitorId: monitor.id },
      requestedByUserId: monitor.createdBy,
      cancellable: false,
      runAfter: monitor.nextCheckAt,
    }).onConflictDoNothing().returning({ id: backgroundJobs.id });
    if (job) created += 1;
  }
  return created;
}

export async function syncLegalSourceMonitorJob(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: { monitorId: string; active: boolean; runAfter: Date; requestedByUserId: string },
) {
  const monitorJob = sql`${backgroundJobs.payload} ->> 'monitorId' = ${input.monitorId}`;
  const now = new Date();
  if (!input.active) {
    await tx.update(backgroundJobs).set({
      state: "cancelled",
      cancellationRequestedAt: now,
      finishedAt: now,
      updatedAt: now,
    }).where(and(
      eq(backgroundJobs.kind, "legal-source-monitor"),
      eq(backgroundJobs.state, "queued"),
      monitorJob,
    ));
    await tx.update(backgroundJobs).set({
      state: "cancellation_requested",
      cancellationRequestedAt: now,
      updatedAt: now,
    }).where(and(
      eq(backgroundJobs.kind, "legal-source-monitor"),
      eq(backgroundJobs.state, "running"),
      monitorJob,
    ));
    return;
  }

  await tx.update(backgroundJobs).set({ runAfter: input.runAfter, updatedAt: now }).where(and(
    eq(backgroundJobs.kind, "legal-source-monitor"),
    eq(backgroundJobs.state, "queued"),
    monitorJob,
  ));
  await tx.insert(backgroundJobs).values({
    kind: "legal-source-monitor",
    payload: { monitorId: input.monitorId },
    requestedByUserId: input.requestedByUserId,
    cancellable: false,
    runAfter: input.runAfter,
  }).onConflictDoNothing();
}
