import { guidedV6GapRelease } from "../releases/guided-v6/release";
import { reliabilityV1GapRelease } from "../releases/reliability-v1/release";
import { reliabilityV2GapRelease } from "../releases/reliability-v2/release";
import { reliabilityV3GapRelease } from "../releases/reliability-v3/release";
import { reliabilityV4GapRelease } from "../releases/reliability-v4/release";
import { reliabilityV5GapRelease } from "../releases/reliability-v5/release";
import { reliabilityV6GapRelease } from "../releases/reliability-v6/release";
import { reliabilityV7GapRelease } from "../releases/reliability-v7/release";
import { reliabilityV8GapRelease } from "../releases/reliability-v8/release";

const releases = new Map([
  ["nis2-gap/guided-v6", guidedV6GapRelease],
  ["nis2-gap/reliability-v1", reliabilityV1GapRelease],
  ["nis2-gap/reliability-v2", reliabilityV2GapRelease],
  ["nis2-gap/reliability-v3", reliabilityV3GapRelease],
  ["nis2-gap/reliability-v4", reliabilityV4GapRelease],
  ["nis2-gap/reliability-v5", reliabilityV5GapRelease],
  ["nis2-gap/reliability-v6", reliabilityV6GapRelease],
  ["nis2-gap/reliability-v7", reliabilityV7GapRelease],
  ["nis2-gap/reliability-v8", reliabilityV8GapRelease],
]);

export function getRepositoryGapRelease(reference: string) {
  const release = releases.get(reference);
  if (!release) throw new Error(`Unknown repository gap release ${reference}`);
  return release;
}
