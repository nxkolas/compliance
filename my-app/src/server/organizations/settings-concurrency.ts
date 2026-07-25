import { ApiError } from "@/src/server/api/errors";

export function organizationSettingsToken(
  organizationVersion: number,
  policyVersion: number,
) {
  return Buffer.from(`${organizationVersion}:${policyVersion}`).toString("base64url");
}

export function readOrganizationSettingsToken(request: Request) {
  const raw = request.headers.get("if-match")?.trim().replace(/^W\//, "");
  const value = raw?.replace(/^"|"$/g, "");
  if (!value) {
    throw new ApiError(428, "If-Match is required", undefined, "IF_MATCH_REQUIRED");
  }
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const [organizationVersion, policyVersion, extra] = decoded.split(":");
    if (extra || !/^\d+$/.test(organizationVersion) || !/^\d+$/.test(policyVersion)) {
      throw new Error("invalid");
    }
    return {
      organizationVersion: Number(organizationVersion),
      policyVersion: Number(policyVersion),
    };
  } catch {
    throw new ApiError(400, "If-Match is invalid", undefined, "INVALID_IF_MATCH");
  }
}

