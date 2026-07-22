import * as z from "zod";

export const entityIdSchema = z.uuid();
export const organizationIdSchema = entityIdSchema;
export const userIdSchema = entityIdSchema;
export const jobIdSchema = entityIdSchema;
export const uploadSessionIdSchema = entityIdSchema;

export type EntityId = z.infer<typeof entityIdSchema>;
