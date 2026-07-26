import { demoGapRelease } from "../releases/demo-v1/release";
import { guidedGapRelease } from "../releases/guided-v2/release";
import { singleLifecycleGapRelease } from "../releases/guided-v3/release";
import { guidedV4GapRelease } from "../releases/guided-v4/release";
import { guidedV5GapRelease } from "../releases/guided-v5/release";

const releases = new Map([
  ["nis2-gap/demo-v1", demoGapRelease],
  ["nis2-gap/guided-v2", guidedGapRelease],
  ["nis2-gap/guided-v3", singleLifecycleGapRelease],
  ["nis2-gap/guided-v4", guidedV4GapRelease],
  ["nis2-gap/guided-v5", guidedV5GapRelease],
]);

export function getRepositoryGapRelease(reference: string) {
  const release = releases.get(reference);
  if (!release) throw new Error(`Unknown repository gap release ${reference}`);
  return release;
}
