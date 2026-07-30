import { AppShell } from "@/components/app-shell";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { getDefaultDictionary } from "@/lib/i18n";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/tool/organizations/example/gap-analysis",
}));

vi.mock("@/components/app-sidebar", () => ({
  AppSidebar: () => <aside>Standardnavigation</aside>,
}));

describe("responsive app sidebar", () => {
  it("uses a fluid shadcn sidebar width", () => {
    const html = renderToStaticMarkup(
      <AppShell
        dictionary={getDefaultDictionary()}
        sidebar={<aside>Navigation</aside>}
      >
        Inhalt
      </AppShell>,
    );

    expect(html).toContain('data-slot="sidebar-wrapper"');
    expect(html).toContain('data-slot="sidebar-inset"');
    expect(html).toContain(
      "--sidebar-width:clamp(18rem, 24vw, 24rem)",
    );
  });

  it("lets all navigation rows use the available sidebar width", () => {
    const html = renderToStaticMarkup(
      <AppShell
        dictionary={getDefaultDictionary()}
        sidebar={
          <AppSidebarNav
            organizationId="example"
            labels={getDefaultDictionary().sidebar}
            organizationSwitcher={<div>Organisation</div>}
            profileMenu={<div>Profil</div>}
          />
        }
      >
        Inhalt
      </AppShell>,
    );

    expect(html).toContain(
      "px-[clamp(1.25rem,2.5vw,3rem)]",
    );
    expect(html).toContain("flex h-12 w-full items-center");
    expect(html).not.toContain("w-72");
    expect(html).not.toContain("Einstellungen");
    expect(html).not.toContain(
      "/tool/organizations/example/settings",
    );
    expect(html).toContain(
      "/tool/organizations/example/help",
    );
    expect(html).not.toContain("/tool/help");
  });
});
