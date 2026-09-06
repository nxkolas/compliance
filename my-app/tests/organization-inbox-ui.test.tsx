import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OrganizationInbox } from "@/components/organizations/organization-inbox";
import { getDefaultDictionary } from "@/src/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("OrganizationInbox", () => {
  it("renders the designed empty invitation state", () => {
    const html = renderToStaticMarkup(
      <OrganizationInbox
        initialInvitations={[]}
        userEmail="eyasdga@gmail.com"
        labels={getDefaultDictionary().inbox}
        locale="de"
      />,
    );

    expect(html).toContain("data-inbox-card");
    expect(html).toContain("data-inbox-empty-state");
    expect(html).toContain("data-inbox-empty-icon");
    expect(html).toContain("data-inbox-mail-icon");
    expect(html).toContain('viewBox="0 0 132 101"');
    expect(html).toContain('viewBox="0 0 36 36"');
    expect(html).toContain('fill="#82848C"');
    expect(html).toContain('fill="#1D2C71"');
    expect(html).toContain("Offene Einladungen für");
    expect(html).toContain("eyasdga@gmail.com");
    expect(html).toContain("0 offen");
    expect(html).toContain("Alles erledigt.");
    expect(html).toContain(
      "Einladungen zu Organisationen werden hier angezeigt, sobald Sie eine erhalten.",
    );
    expect(html).toContain("min-h-96");
    expect(html).not.toContain("border-dashed");
  });

  it("renders a pending invitation in the designed inbox card", () => {
    const html = renderToStaticMarkup(
      <OrganizationInbox
        initialInvitations={[
          {
            id: "00000000-0000-4000-8000-000000000001",
            organizationId: "00000000-0000-4000-8000-000000000002",
            email: "eyasdga@gmail.com",
            role: "contributor",
            invitedBy: "00000000-0000-4000-8000-000000000003",
            expiresAt: "2026-08-27T00:00:00.000Z",
            createdAt: "2026-08-13T00:00:00.000Z",
            organization: {
              id: "00000000-0000-4000-8000-000000000002",
              name: "Test",
              legalName: null,
              countryCode: "DE",
              aiProviderMode: "openai",
              archivedAt: null,
              createdAt: "2026-08-01T00:00:00.000Z",
              updatedAt: "2026-08-01T00:00:00.000Z",
            },
          },
        ]}
        userEmail="eyasdga@gmail.com"
        labels={getDefaultDictionary().inbox}
        locale="de"
      />,
    );

    expect(html).toContain("data-inbox-invitations");
    expect(html).toContain("data-inbox-invitation");
    expect(html).toContain("1 offen");
    expect(html).toContain("Test");
    expect(html).toContain("Eingeladen von Test");
    expect(html).toContain("Rolle: Mitwirkende");
    expect(html).toContain("Läuft ab am 27.08.2026");
    expect(html).toContain(">Ablehnen</button>");
    expect(html).toContain(">Akzeptieren</button>");
    expect(html).toContain("min-h-[320px]");
    expect(html).not.toContain("data-inbox-empty-state");
  });
});
