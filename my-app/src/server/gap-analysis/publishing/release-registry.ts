import { demoGapRelease } from "../releases/demo-v1/release";
import { guidedGapRelease } from "../releases/guided-v2/release";

const releases = new Map([
  ["nis2-gap/demo-v1", demoGapRelease],
  ["nis2-gap/guided-v2", guidedGapRelease],
]);

export function getRepositoryGapRelease(reference: string) {
  const release = releases.get(reference);
  if (!release) throw new Error(`Unknown repository gap release ${reference}`);
  return release;
}
