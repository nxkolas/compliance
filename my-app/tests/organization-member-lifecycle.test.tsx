import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationMemberRoster } from "@/components/organizations/organization-member-roster";
import { organizationsMessages } from "@/lib/i18n/messages/organizations";
import {
  memberUpdateSchema,
  membershipSchema,
} from "@/src/contracts/organizations";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const baseMember = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  role: "member" as const,
  version: 1,
  createdAt: "2026-07-25T10:00:00.000Z",
  updatedAt: "2026-07-25T10:00:00.000Z",
  identityResolved: true,
  displayName: null,
};

describe("organization membership lifecycle contract", () => {
  it.each(["active", "removed", "left"] as const)(
    "accepts the explicit %s membership status",
    (status) => {
      expect(
        membershipSchema.safeParse({
          ...baseMember,
          id: "00000000-0000-4000-8000-000000000010",
          userId: "00000000-0000-4000-8000-000000000020",
          email: undefined,
          identityResolved: undefined,
          displayName: undefined,
          status,
        }).success,
      ).toBe(true);
    },
  );

  it("does not allow lifecycle changes through the role update contract", () => {
    expect(memberUpdateSchema.safeParse({ role: "auditor" }).success).toBe(true);
    expect(
      memberUpdateSchema.safeParse({
        role: "auditor",
        status: "active",
      }).success,
    ).toBe(false);
  });
});

describe("organization member roster", () => {
  beforeEach(() => {
    router.push.mockReset();
    router.refresh.mockReset();
  });

  it("separates active and past members and restores only removed members", () => {
    const html = renderToStaticMarkup(
      <OrganizationMemberRoster
        organizationId={baseMember.organizationId}
        initialMembers={[
          {
            ...baseMember,
            id: "00000000-0000-4000-8000-000000000010",
            userId: "00000000-0000-4000-8000-000000000020",
            email: "active@example.test",
            displayName: "Active Member",
            status: "active",
          },
          {
            ...baseMember,
            id: "00000000-0000-4000-8000-000000000011",
            userId: "00000000-0000-4000-8000-000000000021",
            email: "removed@example.test",
            displayName: "Removed Member",
            status: "removed",
          },
          {
            ...baseMember,
            id: "00000000-0000-4000-8000-000000000012",
            userId: "00000000-0000-4000-8000-000000000022",
            email: "left@example.test",
            displayName: "Voluntary Leaver",
            status: "left",
          },
        ]}
        controls={{
          actorUserId: "00000000-0000-4000-8000-000000000020",
          canManage: true,
          canManageOwners: true,
        }}
        labels={organizationsMessages.en.teamManagement}
      />,
    );

    expect(html).toContain("Active members");
    expect(html).toContain("Past members");
    expect(html).toContain("Removed Member");
    expect(html).toContain("Voluntary Leaver");
    expect(html).toContain("Left voluntarily");
    expect(html.match(/Restore member/g)).toHaveLength(1);
  });

  it("uses the approved OpenAI wording in both locales", () => {
    expect(organizationsMessages.de.organizationManagement.aiPolicy).toBe(
      "OpenAI erlauben",
    );
    expect(
      organizationsMessages.de.organizationManagement.aiPolicyDescription,
    ).toContain("Gap-Analyse und die Erstellung des Maßnahmenplans");
    expect(organizationsMessages.en.organizationManagement.aiPolicy).toBe(
      "Allow OpenAI",
    );
    expect(
      organizationsMessages.en.organizationManagement.aiPolicyDescription,
    ).toContain("gap analysis and creation of the action plan");
  });
});
