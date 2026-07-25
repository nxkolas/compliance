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
