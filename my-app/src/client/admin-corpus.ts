import * as z from "zod";
import { createClient } from "@/lib/supabase/client";
import {
  changeAlertResolveSchema,
  changeAlertSchema,
  corpusActivateSchema,
  corpusFamilyCreateSchema,
  corpusFamilySchema,
  corpusFamilyUpdateSchema,
  corpusMonitorCreateSchema,
  corpusMonitorSchema,
  corpusMonitorUpdateSchema,
  corpusReleaseCreateSchema,
  corpusReleaseMemberSchema,
  corpusReleaseMembersSchema,
  corpusReleaseSchema,
  legalChunkSchema,
  legalProcessingGenerationSchema,
  legalSourceCreateSchema,
  legalSourceRenditionSchema,
  legalSourceSchema,
  legalSourceUpdateSchema,
  legalSourceVersionSchema,
  legalUploadCompleteSchema,
  legalUploadSessionSchema,
  legalUrlImportSchema,
  reasonSchema,
} from "@/src/contracts/admin";
import { jobDtoSchema } from "@/src/contracts/common/jobs";
import { uploadSessionDtoSchema } from "@/src/contracts/common/uploads";
import { request } from "./api-client";
import { jobsClient } from "./jobs";

const base = "/api/admin/corpus";
const id = (value: string) => encodeURIComponent(value);
const reusedSchema = z.object({ reused: z.boolean() }).partial();

export const adminCorpusClient = {
  listFamilies(input: PageInput = {}) { return request(`${base}/families${query(input)}`, { outputSchema: z.object({ families: z.array(corpusFamilySchema) }) }); },
  getFamily(familyId: string) { return request(`${base}/families/${id(familyId)}`, { outputSchema: z.object({ family: corpusFamilySchema }) }); },
  createFamily(input: z.input<typeof corpusFamilyCreateSchema>) { return request(`${base}/families`, { method: "POST", input: corpusFamilyCreateSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ family: corpusFamilySchema }).merge(reusedSchema) }); },
  updateFamily(familyId: string, input: z.input<typeof corpusFamilyUpdateSchema>, version: number) { return request(`${base}/families/${id(familyId)}`, { method: "PATCH", input: corpusFamilyUpdateSchema.parse(input), ifMatch: version, outputSchema: z.object({ family: corpusFamilySchema }) }); },

  listSources(input: PageInput & { q?: string } = {}) { return request(`${base}/sources${query(input)}`, { outputSchema: z.object({ sources: z.array(legalSourceSchema) }) }); },
  getSource(sourceId: string) { return request(`${base}/sources/${id(sourceId)}`, { outputSchema: z.object({ source: legalSourceSchema, versions: z.array(legalSourceVersionSchema) }) }); },
  createSource(input: z.input<typeof legalSourceCreateSchema>) { return request(`${base}/sources`, { method: "POST", input: legalSourceCreateSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ source: legalSourceSchema }).merge(reusedSchema) }); },
  updateSource(sourceId: string, input: z.input<typeof legalSourceUpdateSchema>, version: number) { return request(`${base}/sources/${id(sourceId)}`, { method: "PATCH", input: legalSourceUpdateSchema.parse(input), ifMatch: version, outputSchema: z.object({ source: legalSourceSchema }) }); },
  withdrawSource(sourceId: string, input: z.input<typeof reasonSchema>, version: number) { return request(`${base}/sources/${id(sourceId)}/withdraw`, { method: "POST", input: reasonSchema.parse(input), ifMatch: version, outputSchema: z.object({ source: legalSourceSchema }) }); },
  importUrl(sourceId: string, input: z.input<typeof legalUrlImportSchema>) { return request(`${base}/sources/${id(sourceId)}/url-imports`, { method: "POST", input: legalUrlImportSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ job: jobDtoSchema }).merge(reusedSchema) }); },
  createUploadSession(sourceId: string, input: z.input<typeof legalUploadSessionSchema>) { return request(`${base}/sources/${id(sourceId)}/upload-sessions`, { method: "POST", input: legalUploadSessionSchema.parse(input), outputSchema: z.object({ upload: uploadSessionDtoSchema }) }); },
  completeUpload(sessionId: string, input: z.input<typeof legalUploadCompleteSchema>) { return request(`${base}/upload-sessions/${id(sessionId)}/complete`, { method: "POST", input: legalUploadCompleteSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ version: legalSourceVersionSchema, rendition: legalSourceRenditionSchema, generation: legalProcessingGenerationSchema, job: jobDtoSchema }).merge(reusedSchema) }); },
  async uploadSource(sourceId: string, file: File, completion: Omit<z.input<typeof legalUploadCompleteSchema>, "sourceId">) {
    const session = await this.createUploadSession(sourceId, { fileName: file.name, mimeType: file.type, size: file.size });
    const token = session.data.upload.uploadToken;
    if (!token) throw new Error("The upload session did not include an upload token");
    const { error } = await createClient().storage.from("legal-corpus").uploadToSignedUrl(session.data.upload.objectPath, token, file, { contentType: file.type });
    if (error) throw error;
    return this.completeUpload(session.data.upload.id, { ...completion, sourceId });
  },

  getSourceVersion(versionId: string) { return request(`${base}/source-versions/${id(versionId)}`, { outputSchema: z.object({ version: legalSourceVersionSchema, renditions: z.array(legalSourceRenditionSchema), generations: z.array(legalProcessingGenerationSchema) }) }); },
  reviewSourceVersion(versionId: string) { return request(`${base}/source-versions/${id(versionId)}/review`, { method: "POST", outputSchema: z.object({ generation: legalProcessingGenerationSchema }) }); },
  getProcessingGeneration(generationId: string, previewLimit = 20) { return request(`${base}/processing-generations/${id(generationId)}?previewLimit=${previewLimit}`, { outputSchema: z.object({ generation: legalProcessingGenerationSchema, chunks: z.array(legalChunkSchema) }) }); },
  retryProcessingGeneration(generationId: string) { return request(`${base}/processing-generations/${id(generationId)}/retry`, { method: "POST", idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ generation: legalProcessingGenerationSchema, job: jobDtoSchema }).merge(reusedSchema) }); },
  async cancelProcessingGeneration(generationId: string, signal?: AbortSignal) { const result = await this.getProcessingGeneration(generationId); const jobId = result.data.generation.embeddingJobId ?? result.data.generation.jobId; if (!jobId) throw new Error("The processing generation has no active job"); return jobsClient.cancel(jobId, signal); },
  getChunk(chunkId: string) { return request(`${base}/chunks/${id(chunkId)}`, { outputSchema: z.object({ chunk: legalChunkSchema }) }); },
  createRenditionAccess(renditionId: string) { return request(`${base}/renditions/${id(renditionId)}/source-access`, { method: "POST", outputSchema: z.object({ access: z.object({ url: z.url(), expiresInSeconds: z.number().int().positive() }) }) }); },

  listReleases(input: PageInput = {}) { return request(`${base}/releases${query(input)}`, { outputSchema: z.object({ releases: z.array(corpusReleaseSchema) }) }); },
  getRelease(releaseId: string) { return request(`${base}/releases/${id(releaseId)}`, { outputSchema: z.object({ release: corpusReleaseSchema, members: z.array(corpusReleaseMemberSchema) }) }); },
  createRelease(input: z.input<typeof corpusReleaseCreateSchema>) { return request(`${base}/releases`, { method: "POST", input: corpusReleaseCreateSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ release: corpusReleaseSchema }).merge(reusedSchema) }); },
  replaceReleaseMembers(releaseId: string, input: z.input<typeof corpusReleaseMembersSchema>, version: number) { return request(`${base}/releases/${id(releaseId)}`, { method: "PATCH", input: corpusReleaseMembersSchema.parse(input), ifMatch: version, outputSchema: z.object({ release: corpusReleaseSchema }) }); },
  publish(releaseId: string) { return request(`${base}/releases/${id(releaseId)}/publish`, { method: "POST", idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ release: corpusReleaseSchema }).merge(reusedSchema) }); },
  evaluate(releaseId: string) { return request(`${base}/releases/${id(releaseId)}/evaluate`, { method: "POST", idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ job: jobDtoSchema }).merge(reusedSchema) }); },
  activate(releaseId: string, input: z.input<typeof corpusActivateSchema> = {}) { return request(`${base}/releases/${id(releaseId)}/activate`, { method: "POST", input: corpusActivateSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ release: corpusReleaseSchema }).merge(reusedSchema) }); },
  withdrawRelease(releaseId: string, input: z.input<typeof reasonSchema>) { return request(`${base}/releases/${id(releaseId)}/withdraw`, { method: "POST", input: reasonSchema.parse(input), outputSchema: z.object({ release: corpusReleaseSchema }) }); },

  listMonitors(input: PageInput = {}) { return request(`${base}/monitors${query(input)}`, { outputSchema: z.object({ monitors: z.array(corpusMonitorSchema) }) }); },
  createMonitor(input: z.input<typeof corpusMonitorCreateSchema>) { return request(`${base}/monitors`, { method: "POST", input: corpusMonitorCreateSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ monitor: corpusMonitorSchema, job: jobDtoSchema }).merge(reusedSchema) }); },
  updateMonitor(monitorId: string, input: z.input<typeof corpusMonitorUpdateSchema>, version: number) { return request(`${base}/monitors/${id(monitorId)}`, { method: "PATCH", input: corpusMonitorUpdateSchema.parse(input), ifMatch: version, outputSchema: z.object({ monitor: corpusMonitorSchema }) }); },
  listChangeAlerts(input: PageInput = {}) { return request(`${base}/change-alerts${query(input)}`, { outputSchema: z.object({ alerts: z.array(changeAlertSchema) }) }); },
  resolveChangeAlert(alertId: string, input: z.input<typeof changeAlertResolveSchema>, version: number) { return request(`${base}/change-alerts/${id(alertId)}/resolve`, { method: "POST", input: changeAlertResolveSchema.parse(input), ifMatch: version, outputSchema: z.object({ alert: changeAlertSchema, jobId: z.uuid().optional() }) }); },
};

type PageInput = { cursor?: string; limit?: number };
function query(input: PageInput & { q?: string }) {
  const params = new URLSearchParams();
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.limit !== undefined) params.set("limit", String(input.limit));
  if (input.q) params.set("q", input.q);
  return params.size ? `?${params}` : "";
}
