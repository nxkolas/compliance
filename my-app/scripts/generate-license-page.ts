import fs from "node:fs";
import path from "node:path";

// Renders third-party-licenses.json (license-checker --json output) into a
// self-contained attribution page at public/licenses.html.
//
//   npm run licenses:scan   # refresh the JSON from node_modules
//   npm run licenses:html   # rebuild the page

const projectRoot = path.resolve(__dirname, "..");
const inputFile = path.join(projectRoot, "third-party-licenses.json");
const outputFile = path.join(projectRoot, "public", "licenses.html");
const productName = "complyX";

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

const licenseCounts = new Map<string, number>();
for (const pkg of packages) {
  licenseCounts.set(pkg.license, (licenseCounts.get(pkg.license) ?? 0) + 1);
}
const licenses = [...licenseCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const missingText = packages.filter((pkg) => !pkg.licenseText);

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, renderPage(), "utf8");

const sizeKb = Math.round(fs.statSync(outputFile).size / 1024);
console.log(`Wrote ${path.relative(projectRoot, outputFile)} — ${packages.length} packages, ${licenses.length} license types, ${sizeKb} KB`);
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
  const licenseText = readTextFile(entry.licenseFile);

  return {
    name,
    version,
    license: Array.isArray(entry.licenses) ? entry.licenses.join(", ") : (entry.licenses ?? "UNKNOWN"),
    repository: normalizeRepository(entry.repository),
    publisher: entry.publisher,
    licenseText,
    // Absolute developer-machine paths must never reach the published page.
    licenseSource: licenseText ? toRelativePath(entry.licenseFile) : undefined,
    noticeText: readTextFile(entry.noticeFile),
  };
}

function readTextFile(file: string | undefined): string | undefined {
  if (!file) return undefined;
  try {
    const text = fs.readFileSync(file, "utf8").trim();
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

function renderPage(): string {
  const generatedAt = new Date().toISOString().slice(0, 10);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Third-Party Licenses — ${escapeHtml(productName)}</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #ffffff; --fg: #18181b; --muted: #71717a; --border: #e4e4e7;
  --surface: #fafafa; --accent: #2563eb;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #09090b; --fg: #f4f4f5; --muted: #a1a1aa; --border: #27272a; --surface: #18181b; --accent: #60a5fa; }
}
* { box-sizing: border-box; }
body {
  margin: 0 auto; padding: 2rem 1.25rem 4rem; max-width: 62rem;
  background: var(--bg); color: var(--fg);
  font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
h1 { font-size: 1.6rem; margin: 0 0 .5rem; }
p.lede { color: var(--muted); margin: 0 0 1.5rem; max-width: 46rem; }
a { color: var(--accent); }
.controls { position: sticky; top: 0; padding: .75rem 0; background: var(--bg); border-bottom: 1px solid var(--border); display: flex; gap: .5rem; flex-wrap: wrap; }
input, select { padding: .45rem .6rem; font: inherit; color: inherit; background: var(--surface); border: 1px solid var(--border); border-radius: .4rem; }
input { flex: 1 1 16rem; min-width: 0; }
#count { color: var(--muted); font-size: .85rem; padding: .75rem 0; }
details.pkg { border: 1px solid var(--border); border-radius: .5rem; margin-bottom: .5rem; background: var(--surface); }
details.pkg > summary { padding: .7rem .85rem; cursor: pointer; display: flex; gap: .6rem; align-items: baseline; flex-wrap: wrap; }
summary::marker { color: var(--muted); }
.name { font-weight: 600; }
.version, .publisher { color: var(--muted); font-size: .85rem; }
.badge { margin-left: auto; font-size: .75rem; padding: .15rem .5rem; border: 1px solid var(--border); border-radius: 999px; background: var(--bg); white-space: nowrap; }
.body { padding: 0 .85rem .85rem; }
.meta { font-size: .85rem; color: var(--muted); margin: 0 0 .6rem; word-break: break-word; }
pre { margin: 0; padding: .8rem; background: var(--bg); border: 1px solid var(--border); border-radius: .4rem; overflow-x: auto; white-space: pre-wrap; word-break: break-word; font: 12px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }
pre + h4 { margin: 1rem 0 .4rem; font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.empty { color: var(--muted); font-style: italic; }
footer { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--muted); font-size: .85rem; }
</style>
</head>
<body>
<h1>Third-Party Licenses</h1>
<p class="lede">
  ${escapeHtml(productName)} bundles open-source software. The ${packages.length} packages below are
  redistributed under the licenses shown, with the full license text of each. Generated ${generatedAt}.
</p>

<div class="controls">
  <input id="search" type="search" placeholder="Filter by package, publisher or license…" aria-label="Filter packages">
  <select id="license" aria-label="Filter by license">
    <option value="">All licenses (${packages.length})</option>
    ${licenses.map(([name, count]) => `<option value="${escapeHtml(name)}">${escapeHtml(name)} (${count})</option>`).join("\n    ")}
  </select>
</div>
<div id="count"></div>

<main id="list">
${packages.map(renderPackage).join("\n")}
</main>

<footer>
  Regenerate with <code>npm run licenses:scan &amp;&amp; npm run licenses:html</code>.
</footer>

<script>
const search = document.getElementById("search");
const license = document.getElementById("license");
const count = document.getElementById("count");
const items = [...document.querySelectorAll("details.pkg")];

function apply() {
  const term = search.value.trim().toLowerCase();
  const lic = license.value;
  let shown = 0;
  for (const item of items) {
    const match = (!term || item.dataset.search.includes(term)) && (!lic || item.dataset.license === lic);
    item.hidden = !match;
    if (match) shown++;
  }
  count.textContent = shown + " of " + items.length + " packages";
}

search.addEventListener("input", apply);
license.addEventListener("change", apply);
apply();
</script>
</body>
</html>
`;
}

function renderPackage(pkg: Package): string {
  const searchKey = [pkg.name, pkg.version, pkg.license, pkg.publisher ?? ""].join(" ").toLowerCase();
  const meta: string[] = [];
  if (pkg.repository) meta.push(`<a href="${escapeHtml(pkg.repository)}" rel="noopener noreferrer">${escapeHtml(pkg.repository)}</a>`);
  if (pkg.licenseSource) meta.push(escapeHtml(pkg.licenseSource));

  return `<details class="pkg" data-license="${escapeHtml(pkg.license)}" data-search="${escapeHtml(searchKey)}">
  <summary>
    <span class="name">${escapeHtml(pkg.name)}</span>
    <span class="version">${escapeHtml(pkg.version)}</span>
    ${pkg.publisher ? `<span class="publisher">${escapeHtml(pkg.publisher)}</span>` : ""}
    <span class="badge">${escapeHtml(pkg.license)}</span>
  </summary>
  <div class="body">
    ${meta.length > 0 ? `<p class="meta">${meta.join(" · ")}</p>` : ""}
    ${
      pkg.licenseText
        ? `<pre>${escapeHtml(pkg.licenseText)}</pre>`
        : `<p class="empty">No license file shipped with this package; declared license: ${escapeHtml(pkg.license)}.</p>`
    }
    ${pkg.noticeText ? `<h4>Notice</h4>\n    <pre>${escapeHtml(pkg.noticeText)}</pre>` : ""}
  </div>
</details>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
