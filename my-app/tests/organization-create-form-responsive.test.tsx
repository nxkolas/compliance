import { OrganizationCreateForm } from "@/components/organizations/organization-create-form";
import { getDictionaryForLocale } from "@/lib/i18n";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("responsive organization creation form", () => {
  it("renders fluid form controls without a desktop-only minimum width", () => {
    const labels = getDictionaryForLocale("de").organizationForm;
    const html = renderToStaticMarkup(
      <OrganizationCreateForm
        labels={labels}
        locale="de"
      />,
    );
    const formClassName =
      html.match(/<form[^>]*class="([^"]*)"/)?.[1] ?? "";
    const submitButtonTag =
      html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";
    const submitButtonClassName =
      submitButtonTag.match(/class="([^"]*)"/)?.[1] ?? "";

    expect(html).toContain('id="organization-name"');
    expect(html).toContain('id="legal-name"');
    expect(html).toContain('id="country"');
    expect(html).toContain('id="ai-provider"');
    expect(html).toContain("KI-Anbieter");
    expect(html).toContain("OpenAI");
    expect(formClassName).toContain("w-full");
    expect(formClassName).toContain("min-w-0");
    expect(html).not.toContain("min-w-[1225px]");
    expect(html).not.toContain("max-w-[1205px]");
    expect(html).not.toContain("max-w-[1159px]");
    expect(submitButtonClassName).toContain("w-full");
    expect(submitButtonClassName).toContain("sm:w-72");
  });
});
