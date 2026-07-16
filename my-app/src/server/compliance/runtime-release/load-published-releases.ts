import type { Locale } from "@/lib/i18n-config";
import type {
  PublishedComplianceRelease,
  RuntimeReleaseReader,
} from "./types";

export async function loadPublishedReleasesById(
  reader: RuntimeReleaseReader,
  checkReleaseIds: Iterable<string>,
  locale: Locale,
): Promise<Map<string, PublishedComplianceRelease | null>> {
  return new Map(
    await Promise.all(
      [...new Set(checkReleaseIds)].map(
        async (checkReleaseId) => [
          checkReleaseId,
          await reader.getPublished({ checkReleaseId, locale }),
        ] as const,
      ),
    ),
  );
}
