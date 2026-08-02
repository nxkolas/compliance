import { contentHash } from "@/src/server/compliance";

export type PromptSchemaMetadata = {
  name: string;
  version: string;
  templateHash?: string;
  schemaVersion?: string;
};

export function hashExactPrompt(input: {
  messages: Array<{ role: "system" | "user"; content: string }>;
  responseSchema: PromptSchemaMetadata;
}) {
  return contentHash(input);
}
