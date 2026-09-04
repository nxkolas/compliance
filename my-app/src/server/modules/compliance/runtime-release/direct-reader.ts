import type {
  ActiveReleasePointer,
  PublishedComplianceRelease,
  RuntimeReleaseReader,
} from "./types";

export function createRuntimeReleaseReader(input: {
  loadPublished: (input: {
    checkReleaseId: string;
    locale: PublishedComplianceRelease["locale"];
  }) => Promise<PublishedComplianceRelease | null>;
  loadActivePointer: (
    checkCode: string,
  ) => Promise<ActiveReleasePointer | null>;
}): RuntimeReleaseReader {
  return {
    getPublished: input.loadPublished,
    getActivePointer: input.loadActivePointer,
    async getActive({ checkCode, locale }) {
      const pointer = await input.loadActivePointer(checkCode);
      if (!pointer) return null;
      const published = await input.loadPublished({
        checkReleaseId: pointer.checkReleaseId,
        locale,
      });
      return published
        ? { published, activePointer: pointer, isActive: true }
        : null;
    },
  };
}

