import { describe, expect, it } from "vitest";
import {
  ACCOUNT_PASSWORD_MIN_LENGTH,
  isValidAccountPassword,
} from "@/lib/auth/password-policy";

describe("account password policy", () => {
  it("requires at least 10 characters", () => {
    expect(ACCOUNT_PASSWORD_MIN_LENGTH).toBe(10);
    expect(isValidAccountPassword("short123")).toBe(false);
  });

  it("requires at least one number", () => {
    expect(isValidAccountPassword("longpassword")).toBe(false);
    expect(isValidAccountPassword("longpassw0rd")).toBe(true);
  });
});
