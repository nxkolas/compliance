import fs from "node:fs";
import path from "node:path";

// Enriches license-checker output with license and notice text for the app's
// /licenses.html page.
//
//   npm run licenses:scan   # refresh the JSON from node_modules
//   npm run licenses:html   # rebuild the generated data

const projectRoot = path.resolve(__dirname, "..");
const inputFile = path.join(projectRoot, "third-party-licenses.json");
const outputFile = path.join(projectRoot, "src", "generated", "third-party-licenses.json");

type RawEntry = {
  licenses?: string | string[];
  repository?: string;
  publisher?: string;
  email?: string;
  path?: string;
  licenseFile?: string;
  noticeFile?: string;
};

type Package = {
  name: string;
  version: string;
  license: string;
  repository?: string;
  publisher?: string;
  licenseText?: string;
  licenseSource?: string;
  noticeText?: string;
};

const raw = readJsonFile(inputFile) as Record<string, RawEntry>;
const packages = Object.entries(raw)
  .map(([id, entry]) => toPackage(id, entry))
  .filter((pkg) => pkg.name !== rootPackageName())
  .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const missingText = packages.filter((pkg) => !pkg.licenseText);

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(
  outputFile,
  `${JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), packages }, null, 2)}\n`,
  "utf8",
);

const sizeKb = Math.round(fs.statSync(outputFile).size / 1024);
const licenseCount = new Set(packages.map((pkg) => pkg.license)).size;
console.log(`Wrote ${path.relative(projectRoot, outputFile)} — ${packages.length} packages, ${licenseCount} license types, ${sizeKb} KB`);
if (missingText.length > 0) {
  console.warn(`No license text found for ${missingText.length} package(s): ${missingText.map((pkg) => pkg.name).join(", ")}`);
}

/** license-checker writes UTF-8, but a PowerShell `>` redirect writes UTF-16LE. Accept both. */
function readJsonFile(file: string): unknown {
  const buffer = fs.readFileSync(file);
  const isUtf16Le = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;
  const text = isUtf16Le ? buffer.toString("utf16le") : buffer.toString("utf8");
  return JSON.parse(text.replace(/^﻿/, ""));
}

function rootPackageName(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  return String(pkg.name ?? "");
}

function toPackage(id: string, entry: RawEntry): Package {
  const at = id.lastIndexOf("@");
  const name = at > 0 ? id.slice(0, at) : id;
  const version = at > 0 ? id.slice(at + 1) : "";
  const licenseFile = resolveDependencyFile(entry.licenseFile, name);
  const noticeFile = resolveDependencyFile(entry.noticeFile, name);
  const licenseText = readTextFile(licenseFile);

  return {
    name,
    version,
    license: Array.isArray(entry.licenses) ? entry.licenses.join(", ") : (entry.licenses ?? "UNKNOWN"),
    repository: normalizeRepository(entry.repository),
    publisher: entry.publisher,
    licenseText,
    // Absolute developer-machine paths must never reach the published page.
    licenseSource: licenseText ? toRelativePath(licenseFile) : undefined,
    noticeText: readTextFile(noticeFile),
  };
}

function resolveDependencyFile(file: string | undefined, packageName: string): string | undefined {
  if (!file || fs.existsSync(file)) return file;
  const normalized = file.replace(/\\/g, "/");
  const marker = "/node_modules/";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0) return file;
  const matchingDependencyPath = path.join(
    projectRoot,
    normalized.slice(markerIndex + 1),
  );
  if (fs.existsSync(matchingDependencyPath)) return matchingDependencyPath;
  const hoistedDependencyPath = path.join(
    projectRoot,
    "node_modules",
    packageName,
    path.basename(normalized),
  );
  return fs.existsSync(hoistedDependencyPath) ? hoistedDependencyPath : file;
}

function readTextFile(file: string | undefined): string | undefined {
  if (!file) return undefined;
  try {
    const text = fs.readFileSync(file, "utf8").trim().replace(/[ \t]+$/gm, "");
    return text.length > 0 ? text : undefined;
  } catch {
    return undefined;
  }
}

function toRelativePath(file: string | undefined): string | undefined {
  if (!file) return undefined;
  return path.relative(projectRoot, file).split(path.sep).join("/");
}

function normalizeRepository(repository: string | undefined): string | undefined {
  if (!repository) return undefined;
  const url = repository.replace(/^git\+/, "").replace(/\.git$/, "");
  return url.startsWith("http") ? url : `https://${url}`;
}
