import { nis2ReleaseDefinition } from "../nis2/releases/2026-v1/release";

const releases = new Map([["nis2/2026-v1", nis2ReleaseDefinition]]);

export function getRepositoryRelease(reference: string) {
  const release = releases.get(reference);
  if (!release) throw new Error(`Unknown repository release ${reference}`);
  return release;
}
