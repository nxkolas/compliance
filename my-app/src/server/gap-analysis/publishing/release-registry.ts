import { demoGapRelease } from "../releases/demo-v1/release";

const releases = new Map([["nis2-gap/demo-v1", demoGapRelease]]);

export function getRepositoryGapRelease(reference: string) {
  const release = releases.get(reference);
  if (!release) throw new Error(`Unknown repository gap release ${reference}`);
  return release;
}
