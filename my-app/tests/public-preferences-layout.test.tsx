import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("@/lib/i18n", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/i18n")>();
  return {
    ...original,
    getDictionary: async () => original.getDefaultDictionary(),
    getLocale: async () => "de",
  };
});

import { PublicLanguageSwitcher } from "@/components/public-language-switcher";

describe("public language and theme controls", () => {
  it("groups language and theme controls into one compact panel", async () => {
    const html = renderToStaticMarkup(
      await PublicLanguageSwitcher({
        showThemeSwitcher: true,
        compactOnMobile: true,
        inline: true,
      }),
    );

    expect(html).toContain("data-public-preferences");
    expect(html).toContain("rounded-lg");
    expect(html).toContain("h-10");
    expect(html).toContain("size-8");
    expect(html).toContain("shadow-xs");
    expect(html).toContain("DE");
    expect(html).toContain("EN");
    expect(html).toContain('aria-pressed="true"');
  });
});
