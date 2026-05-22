import type {
  organizationInvitations,
  organizationMembers,
  organizations,
} from "@/src/db/schema";

export type OrganizationRole =
  (typeof organizationMembers.$inferSelect)["role"];

export type OrganizationInvitationStatus =
  (typeof organizationInvitations.$inferSelect)["status"];

export type CreateOrganizationInput = {
  name: string;
  legalName?: string | null;
  industryDescription?: string | null;
  employeeCount?: number | null;
  annualRevenueEur?: string | null;
  balanceSheetTotalEur?: string | null;
  size?: (typeof organizations.$inferSelect)["size"];
  countryCode?: string | null;
};

export type CreateOrganizationInvitationInput = {
  email: string;
  role?: OrganizationRole;
  expiresInDays?: number;
};

export type AcceptOrganizationInvitationInput = {
  token: string;
};

export type OrganizationDto = typeof organizations.$inferSelect;

export type OrganizationInvitationDto = Omit<
  typeof organizationInvitations.$inferSelect,
  "tokenHash"
>;

export type CreatedOrganizationInvitationDto = OrganizationInvitationDto & {
  token: string;
};
