import * as z from "zod";

export const resourceVersionSchema = z.number().int().nonnegative();

export type ResourceVersion = z.infer<typeof resourceVersionSchema>;
