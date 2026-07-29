import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import {
  capabilitiesForOrganizationRole,
  hasOrganizationCapability,
} from "@/src/server/auth/capabilities";
import { organizationActionsForRole } from "@/src/server/organizations/workflow-permissions";
import {
  organizationSettingsToken,
  readOrganizationSettingsToken,
} from "@/src/server/organizations/settings-concurrency";
import { projectAuthenticatedUser } from "@/src/server/users/projection";
import {
  isoCountryCodes,
  localizedCountries,
} from "@/components/organizations/country-selector";
import {
  organizationInitials,
} from "@/components/organizations/organization-avatar";
import {
  organizationAiProviderPolicyUpdateSchema,
  organizationSettingsUpdateSchema,
} from "@/src/contracts/organizations";

describe("organization management permission invariants", () => {
  it("keeps archive and owner governance owner-only", () => {
    expect(hasOrganizationCapability("owner", "organizations:archive")).toBe(true);
    expect(hasOrganizationCapability("owner", "members:manage-owners")).toBe(true);
    expect(hasOrganizationCapability("admin", "organizations:archive")).toBe(false);
    expect(hasOrganizationCapability("admin", "members:manage-owners")).toBe(false);
    expect(capabilitiesForOrganizationRole("member").has("members:read")).toBe(true);
    expect(capabilitiesForOrganizationRole("auditor").has("members:read")).toBe(true);
  });

  it("derives visible actions from role and archive state", () => {
    expect(organizationActionsForRole("admin", false)).toMatchObject({
      edit: true,
      manageMembers: true,
      archive: false,
      restore: false,
    });
    expect(organizationActionsForRole("owner", true)).toMatchObject({
      edit: false,
      manageMembers: false,
      archive: false,
      restore: true,
    });
  });
});

describe("organization management shared UI contracts", () => {
  it("keeps the selected organization independent from paginated switcher results", () => {
    const sidebarSource = readFileSync(
      resolve(process.cwd(), "components/app-sidebar.tsx"),
      "utf8",
    );
    const switcherSource = readFileSync(
      resolve(process.cwd(), "components/organization-switcher.tsx"),
      "utf8",
    );

    expect(sidebarSource).toContain("listOrganizationsForUserPage({");
    expect(sidebarSource).toContain("getOrganizationForUser(user.id, organizationId)");
    expect(sidebarSource).toContain("nextCursor={organizationPage.nextCursor}");
    expect(switcherSource).toContain("selectedOrganization?: SwitcherOrganization");
    expect(switcherSource).toContain("organizationsClient.list({");
    expect(switcherSource).toContain('query: query || undefined');
    expect(switcherSource).toContain('new IntersectionObserver');
    expect(switcherSource).toContain('className="shrink-0 border-t p-1"');
  });

  it("keeps the OpenAI usage control without a reason field", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "components/organizations/organization-management-list.tsx",
      ),
      "utf8",
    );
    const dedicatedFormSource = readFileSync(
      resolve(
        process.cwd(),
        "components/organizations/organization-ai-provider-policy-form.tsx",
      ),
      "utf8",
    );
    const settingsServiceSource = readFileSync(
      resolve(
        process.cwd(),
        "src/server/organizations/settings-service.ts",
      ),
      "utf8",
    );
    const policyServiceSource = readFileSync(
      resolve(
        process.cwd(),
        "src/server/organizations/ai-provider-policy-service.ts",
      ),
      "utf8",
    );

    expect(source).toContain('id="edit-openai-policy"');
    expect(source).toContain('htmlFor="edit-openai-policy"');
    expect(source).not.toContain('id="edit-reason"');
    expect(dedicatedFormSource).not.toContain('id="ai-policy-reason"');
    expect(settingsServiceSource).not.toContain("AI_POLICY_REASON_REQUIRED");
    expect(policyServiceSource).not.toContain("AI_POLICY_REASON_REQUIRED");
    expect(source).toContain(
      "openAiDisclosureApproved: form.openAiDisclosureApproved",
    );

    expect(organizationAiProviderPolicyUpdateSchema.parse({
      openAiDisclosureApproved: true,
    })).toEqual({ openAiDisclosureApproved: true });
    expect(organizationSettingsUpdateSchema.parse({
      organization: {
        name: "Example GmbH",
        legalName: null,
        country: "DE",
      },
      policy: { openAiDisclosureApproved: true },
    })).toMatchObject({
      policy: { openAiDisclosureApproved: true },
    });
  });

  it("contains every ISO alpha-2 country exactly once and localizes it", () => {
    expect(isoCountryCodes).toHaveLength(249);
    expect(new Set(isoCountryCodes).size).toBe(249);
    expect(localizedCountries("de").find((country) => country.code === "DE")?.name)
      .not.toBe("DE");
  });

  it("derives compact initials", () => {
    expect(organizationInitials("Example GmbH")).toBe("EG");
    expect(organizationInitials("Acme")).toBe("AC");
  });
});

describe("safe identity and composite concurrency", () => {
  it("projects only normalized safe auth identity fields", () => {
    const projected = projectAuthenticatedUser({
      id: "3052c867-f50b-43a4-b59d-7971f4d06348",
      email: "  PERSON@Example.COM ",
      user_metadata: { full_name: "  Ada Lovelace  ", secret: "not projected" },
    } as unknown as User);
    expect(projected).toEqual({
      userId: "3052c867-f50b-43a4-b59d-7971f4d06348",
      email: "person@example.com",
      displayName: "Ada Lovelace",
    });
  });

  it("round-trips both versions through If-Match", () => {
    const token = organizationSettingsToken(4, 9);
    const request = new Request("https://example.test", {
      headers: { "if-match": `"${token}"` },
    });
    expect(readOrganizationSettingsToken(request)).toEqual({
      organizationVersion: 4,
      policyVersion: 9,
    });
  });
});
