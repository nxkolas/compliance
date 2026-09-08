import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/src/i18n", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/src/i18n")>();
  return {
    ...original,
    getDictionary: async () => original.getDefaultDictionary(),
    getLocale: async () => "de",
  };
});

import { PublicLanguageSwitcher } from "@/components/public-language-switcher";

describe("public language controls", () => {
  it("renders the compact language selector without a theme control", async () => {
    const html = renderToStaticMarkup(
      await PublicLanguageSwitcher({
        compactOnMobile: true,
        inline: true,
      }),
    );

    expect(html).toContain("rounded-lg");
    expect(html).toContain("DE");
    expect(html).toContain("EN");
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain("Zum hellen Modus wechseln");
    expect(html).not.toContain("Zum dunklen Modus wechseln");
  });
});
