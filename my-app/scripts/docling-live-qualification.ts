import React from "react";
import {
  Document,
  Page,
  Text,
  renderToBuffer,
} from "@react-pdf/renderer";
import { parseWithDocling } from "@/src/server/modules/legal-corpus";

const expectedText = "Controlled compliance extraction fixture";
const endpoint = required("DOCLING_SERVICE_URL");

async function main() {
  const startedAt = performance.now();
  const document = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4" },
      React.createElement(Text, null, expectedText),
    ),
  );
  const pdf = await renderToBuffer(document);
  const result = await parseWithDocling(
    new Uint8Array(pdf),
    "application/pdf",
    {
      endpoint,
      timeoutMs: 180_000,
      maxOutputCharacters: 100_000,
    },
  );
  if (!result.text.toLowerCase().includes(expectedText.toLowerCase())) {
    throw new Error("Docling did not return the controlled fixture text");
  }
  if (result.anchorsReliable || result.pages.length !== 1) {
    throw new Error("Docling adapter returned an unsupported anchor contract");
  }
  process.stdout.write(
    `${JSON.stringify({
      check: "docling-controlled-pdf-extraction",
      status: "passed",
      durationMs: Math.round(performance.now() - startedAt),
      outputFormat: result.metadata.outputFormat,
      pageProjectionCount: result.pages.length,
      anchorsReliable: result.anchorsReliable,
    })}\n`,
  );
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

main().catch((error) => {
  console.error("Live Docling qualification failed", {
    errorType: error instanceof Error ? error.name : "unknown",
    message: error instanceof Error ? error.message : "Unknown error",
  });
  process.exitCode = 1;
});
