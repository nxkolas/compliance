import { guidedV6GapRelease } from "../releases/guided-v6/release";
import { reliabilityV1GapRelease } from "../releases/reliability-v1/release";

const releases = new Map([
  ["nis2-gap/guided-v6", guidedV6GapRelease],
  ["nis2-gap/reliability-v1", reliabilityV1GapRelease],
]);

export function getRepositoryGapRelease(reference: string) {
  const release = releases.get(reference);
  if (!release) throw new Error(`Unknown repository gap release ${reference}`);
  return release;
}
