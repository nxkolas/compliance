import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/src/client/api-client";
import {
  classifyExternalError,
  localizeUiError,
} from "@/lib/i18n/errors";

describe("UI error localization", () => {
  it("maps stable API codes without exposing diagnostic messages", () => {
    const error = new ApiClientError(
      429,
      "RATE_LIMITED",
      "Postgres connection pool exhausted",
      { internal: true },
      "request-1",
    );

    expect(
      localizeUiError(error, {
        fallback: "Request failed",
        codeMessages: { RATE_LIMITED: "Please try again later" },
      }),
    ).toBe("Please try again later");
  });

  it("uses a localized fallback for unknown errors", () => {
    expect(
      localizeUiError(new Error("private service message"), {
        fallback: "Aktion fehlgeschlagen",
      }),
    ).toBe("Aktion fehlgeschlagen");
  });

  it("classifies external rate-limit errors by stable properties", () => {
    expect(
      classifyExternalError({
        status: 429,
        code: "over_request_rate_limit",
        message: "provider wording",
      }),
    ).toBe("RATE_LIMITED");
  });
});
