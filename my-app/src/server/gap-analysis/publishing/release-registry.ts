import { guidedV6GapRelease } from "../releases/guided-v6/release";

const releases = new Map([
  ["nis2-gap/guided-v6", guidedV6GapRelease],
]);

export function getRepositoryGapRelease(reference: string) {
  const release = releases.get(reference);
  if (!release) throw new Error(`Unknown repository gap release ${reference}`);
  return release;
}
