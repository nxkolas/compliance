import { nis2ReleaseDefinition } from "../nis2/releases/2026-v1/release";
import { nis2ReleaseDefinition2026V2 } from "../nis2/releases/2026-v2/release";

const releases = new Map([
  ["nis2/2026-v1", nis2ReleaseDefinition],
  ["nis2/2026-v2", nis2ReleaseDefinition2026V2],
]);

export function getRepositoryRelease(reference: string) {
  const release = releases.get(reference);
  if (!release) throw new Error(`Unknown repository release ${reference}`);
  return release;
}
