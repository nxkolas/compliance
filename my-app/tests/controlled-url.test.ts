import { describe, expect, it } from "vitest";
import { validateControlledUrl } from "@/src/worker/security/controlled-url";

describe("controlled source URLs", () => {
  it("accepts an exact public HTTPS target", async () => {
    await expect(validateControlledUrl("https://example.test/legal.pdf", async () => ["203.0.113.10"])).resolves.toMatchObject({ protocol: "https:", hostname: "example.test" });
  });

  it.each([
    "http://example.test/legal.pdf",
    "https://user:pass@example.test/legal.pdf",
    "https://example.test:8443/legal.pdf",
  ])("rejects unsafe URL shape %s", async (url) => {
    await expect(validateControlledUrl(url, async () => ["203.0.113.10"])).rejects.toMatchObject({ code: "INVALID_SOURCE_URL" });
  });

  it.each([
    "169.254.169.254",
    "127.0.0.1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "198.18.0.1",
    "224.0.0.1",
  ])("rejects private, mapped, metadata, benchmark, and multicast address %s", async (address) => {
    await expect(validateControlledUrl("https://example.test", async () => [address])).rejects.toMatchObject({ code: "SOURCE_URL_FORBIDDEN" });
  });
});
