import { expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect,
}));

it("redirects the retired settings page to organization management", async () => {
  const { default: OrganizationSettingsPage } = await import(
    "@/app/tool/organizations/[organizationId]/settings/page"
  );

  OrganizationSettingsPage();

  expect(redirect).toHaveBeenCalledWith("/tool/organizations");
});
