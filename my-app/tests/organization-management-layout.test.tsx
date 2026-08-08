import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OrganizationManagementList } from "@/components/organizations/organization-management-list";
import { getDefaultDictionary } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("organization management layout", () => {
  it("keeps the pre-refactor organization rows and management controls", () => {
    const dictionary = getDefaultDictionary();
    const html = renderToStaticMarkup(
      <OrganizationManagementList
        initialActive={{
          items: [{
            id: "00000000-0000-4000-8000-000000000001",
            name: "Example GmbH",
            legalName: "Example GmbH",
            countryCode: "DE",
            aiProviderMode: "openai",
            archivedAt: null,
            createdAt: "2026-08-02T10:00:00.000Z",
            updatedAt: "2026-08-02T10:00:00.000Z",
            activeMemberCount: 3,
            currentUserRole: "owner",
            allowedActions: {
              edit: true,
              manageMembers: true,
              archive: true,
              restore: false,
            },
          }],
        }}
        initialArchived={{
          items: [{
            id: "00000000-0000-4000-8000-000000000002",
            name: "Gelöschte GmbH",
            legalName: "Gelöschte GmbH",
            countryCode: "DE",
            aiProviderMode: "openai",
            archivedAt: "2026-08-03T10:00:00.000Z",
            createdAt: "2026-08-02T10:00:00.000Z",
            updatedAt: "2026-08-03T10:00:00.000Z",
            activeMemberCount: 1,
            currentUserRole: "owner",
            allowedActions: {
              edit: false,
              manageMembers: false,
              archive: false,
              restore: true,
            },
          }],
        }}
        locale="de"
        labels={dictionary.organizationManagement}
        teamLabels={dictionary.teamManagement}
        inviteLabels={dictionary.invite}
        createHref="/tool/organizations/new"
        createLabel={dictionary.organizations.switcherCreate}
      />,
    );

    expect(html).toContain("Example GmbH");
    expect(html).toContain("h-20 items-center");
    expect(html).toContain("rounded-xl border-[1.5px]");
    expect(html).toContain('data-slot="dropdown-menu-trigger"');
    expect(html).toContain("max-w-[539px]");
    expect(html).toContain("/tool/organizations/new");
    expect(html).toContain(">Gelöschte Organisationen</h2>");
    expect(html).toContain("Gelöschte GmbH");
  });
});
