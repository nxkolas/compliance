import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Space_Grotesk: () => ({ className: "font-space-grotesk" }),
}));

vi.mock("@/lib/i18n", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/i18n")>();
  return {
    ...original,
    getDictionary: async () => original.getDefaultDictionary(),
    getLocale: async () => "de",
  };
});

vi.mock("@/src/config/env/supabase", () => ({
  serializeBrowserSupabaseEnvironment: () => "{}",
}));

vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => <footer data-site-footer />,
}));

import RootLayout from "@/app/layout";

describe("RootLayout sticky footer structure", () => {
  it("keeps content flexible and renders the footer after it", async () => {
    const html = renderToStaticMarkup(
      await RootLayout({ children: <main data-test-page /> }),
    );

    expect(html).toContain("flex min-h-svh flex-col");
    expect(html).toContain("data-site-main");
    expect(html).toContain("min-h-0 min-w-0 flex-1");
    expect(html).toContain("[&amp;&gt;*]:min-h-0");
    expect(html.indexOf("data-test-page")).toBeLessThan(
      html.indexOf("data-site-footer"),
    );
  });
});
