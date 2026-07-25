import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";
import { ApiError } from "@/src/server/api/errors";

export async function validateControlledUrl(
  value: string,
  resolveHost: (hostname: string) => Promise<string[]> = async (hostname) =>
    (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address),
) {
  return (await resolveControlledUrl(value, resolveHost)).url;
}

async function resolveControlledUrl(
  value: string,
  resolveHost: (hostname: string) => Promise<string[]>,
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalidUrl();
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw invalidUrl();
  const hostname = stripIpv6Brackets(url.hostname);
  const addresses = isIP(hostname) ? [hostname] : await resolveHost(hostname);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new ApiError(400, "Source URL resolves to a forbidden network", undefined, "SOURCE_URL_FORBIDDEN");
  }
  return { url, addresses };
}

export async function fetchControlledUrl(input: {
  url: string;
  maxBytes: number;
  timeoutMs: number;
  allowedMimeTypes: ReadonlySet<string>;
  maxRedirects?: number;
  requestHeaders?: Readonly<Record<string, string>>;
}) {
  let url = input.url;
  const redirects = input.maxRedirects ?? 3;
  for (let redirect = 0; redirect <= redirects; redirect += 1) {
    const validated = await resolveControlledUrl(
      url,
      async (hostname) =>
        (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address),
    );
    const response = await requestPinnedAddress(validated.url, validated.addresses, input.timeoutMs, input.requestHeaders);
    try {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        const location = response.headers.location;
        if (!location || redirect === redirects) throw new ApiError(422, "Source URL redirect is invalid", undefined, "SOURCE_REDIRECT_INVALID");
        response.resume();
        url = new URL(location, validated.url).toString();
        continue;
      }
      const rawEtag = response.headers.etag;
      const rawLastModified = response.headers["last-modified"];
      const etag = Array.isArray(rawEtag) ? rawEtag[0] : rawEtag;
      const lastModified = Array.isArray(rawLastModified) ? rawLastModified[0] : rawLastModified;
      if (status === 304) {
        response.resume();
        return {
          status,
          notModified: true,
          finalUrl: validated.url.toString(),
          mimeType: "",
          bytes: Buffer.alloc(0),
          etag,
          lastModified,
        };
      }
      if (status < 200 || status >= 300) throw new ApiError(502, "Source URL returned an error", { status }, "SOURCE_FETCH_FAILED");
      const rawContentType = response.headers["content-type"];
      const mimeType = (Array.isArray(rawContentType) ? rawContentType[0] : rawContentType)?.split(";", 1)[0]?.trim() ?? "";
      if (!input.allowedMimeTypes.has(mimeType)) throw new ApiError(415, "Source media type is not supported", undefined, "SOURCE_MEDIA_UNSUPPORTED");
      const rawContentLength = response.headers["content-length"];
      const declared = Number(Array.isArray(rawContentLength) ? rawContentLength[0] : rawContentLength);
      if (Number.isFinite(declared) && declared > input.maxBytes) throw new ApiError(413, "Source exceeds the size limit", undefined, "SOURCE_TOO_LARGE");
      const chunks: Uint8Array[] = [];
      let size = 0;
      for await (const value of response) {
        const chunk = typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
        size += chunk.byteLength;
        if (size > input.maxBytes) {
          response.destroy();
          throw new ApiError(413, "Source exceeds the size limit", undefined, "SOURCE_TOO_LARGE");
        }
        chunks.push(chunk);
      }
      return {
        status,
        notModified: false,
        finalUrl: validated.url.toString(),
        mimeType,
        bytes: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
        etag,
        lastModified,
      };
    } finally {
      if (!response.complete) response.destroy();
    }
  }
  throw new ApiError(422, "Too many source redirects", undefined, "SOURCE_REDIRECT_INVALID");
}

function isPrivateAddress(address: string) {
  const normalized = stripIpv6Brackets(address).toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return isPrivateAddress(mapped);
  }
  if (
    normalized === "::1"
    || normalized === "::"
    || normalized.startsWith("fe8")
    || normalized.startsWith("fe9")
    || normalized.startsWith("fea")
    || normalized.startsWith("feb")
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("ff")
  ) return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) ||
    parts[0] >= 224;
}

async function requestPinnedAddress(
  url: URL,
  addresses: string[],
  timeoutMs: number,
  requestHeaders?: Readonly<Record<string, string>>,
): Promise<IncomingMessage> {
  let lastError: unknown;
  for (const address of addresses) {
    try {
      return await new Promise<IncomingMessage>((resolve, reject) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const request = httpsRequest({
          protocol: "https:",
          hostname: stripIpv6Brackets(address),
          port: 443,
          path: `${url.pathname}${url.search}`,
          method: "GET",
          headers: { ...requestHeaders, host: url.hostname },
          servername: isIP(stripIpv6Brackets(url.hostname)) ? undefined : stripIpv6Brackets(url.hostname),
          signal: controller.signal,
        }, (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
        request.on("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        request.end();
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw new ApiError(
    502,
    "Source URL could not be fetched",
    { errorType: lastError instanceof Error ? lastError.name : "unknown" },
    "SOURCE_FETCH_FAILED",
  );
}

function stripIpv6Brackets(value: string) {
  return value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
}

function invalidUrl() {
  return new ApiError(400, "Source URL must be an exact HTTPS URL without credentials or a custom port", undefined, "INVALID_SOURCE_URL");
}
