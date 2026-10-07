import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

var examplePrefix = "wasm/browser-example";
var versionsFile = "versions.json";
var repositoryUrl = "https://github.com/julianhille/MuhammaraJS";

/**
 * Escapes a string for use in HTML text and attribute values.
 * @param {string} value Raw text.
 * @returns {string} The text with HTML special characters escaped.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Reads the mike version manifest of the browser example when one exists.
 * @param {string} pagesRoot Directory that holds the GitHub Pages site.
 * @returns {Promise<Array<{version: string, title: string, aliases: string[]}>>}
 *   The deployed example versions, newest first, or an empty list before the
 *   first deployment.
 */
async function readExampleVersions(pagesRoot) {
  var manifestPath = path.join(pagesRoot, examplePrefix, versionsFile);
  var manifest;
  try {
    manifest = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  var versions = JSON.parse(manifest);
  if (!Array.isArray(versions)) {
    throw new Error(`${manifestPath} must hold a JSON array`);
  }
  return versions;
}

/**
 * Renders one example version as a table row.
 * @param {{version: string, title: string, aliases: string[]}} entry A mike
 *   manifest entry.
 * @returns {string} The HTML table row.
 */
function renderVersionRow(entry) {
  var href = `${examplePrefix}/${encodeURIComponent(entry.version)}/index.html`;
  var aliases = (entry.aliases || [])
    .map(function (alias) {
      return `<span class="alias">${escapeHtml(alias)}</span>`;
    })
    .join(" ");
  return [
    "        <tr>",
    `          <td><a href="${escapeHtml(href)}">${escapeHtml(entry.title || entry.version)}</a></td>`,
    `          <td>${aliases}</td>`,
    "        </tr>",
  ].join("\n");
}

/**
 * Renders the GitHub Pages root index page.
 * @param {Array<{version: string, title: string, aliases: string[]}>} versions
 *   The deployed browser example versions, newest first.
 * @returns {string} A complete HTML document.
 */
export function renderPagesIndex(versions) {
  var rows =
    versions.length > 0
      ? versions.map(renderVersionRow).join("\n")
      : '        <tr><td colspan="2">No example has been deployed yet.</td></tr>';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MuhammaraJS</title>
    <meta
      name="description"
      content="Executable browser examples, documentation, and packages of MuhammaraJS, the PDF library for Node.js and WebAssembly."
    />
    <style>
      :root {
        color-scheme: light dark;
        --fg: #102a43;
        --bg: #eee7da;
        --panel: #f7f1e5;
        --line: #102a43;
        --accent: #0b5fff;
        --muted: #4a5d70;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --fg: #eee7da;
          --bg: #10151c;
          --panel: #171f29;
          --line: #3b4a5c;
          --accent: #8ab4ff;
          --muted: #a8b4c0;
        }
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        color: var(--fg);
        background: var(--bg);
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        line-height: 1.5;
      }
      main {
        max-width: 56rem;
        margin: 0 auto;
        padding: 2rem 1rem 4rem;
      }
      h1 {
        font-size: clamp(1.8rem, 5vw, 2.6rem);
        margin: 0 0 0.25rem;
      }
      h2 {
        font-size: 1.15rem;
        margin: 2rem 0 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      p {
        margin: 0.4rem 0;
      }
      .lede {
        color: var(--muted);
        max-width: 42rem;
      }
      a {
        color: var(--accent);
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 0.5rem;
        padding: 1rem;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: left;
        padding: 0.5rem 0.25rem;
        border-top: 1px solid var(--line);
        vertical-align: top;
      }
      thead th {
        border-top: 0;
        color: var(--muted);
        font-weight: 600;
        font-size: 0.85rem;
      }
      .alias {
        display: inline-block;
        padding: 0.05rem 0.5rem;
        border: 1px solid var(--line);
        border-radius: 1rem;
        font: 600 0.75rem/1.5 ui-monospace, monospace;
      }
      ul {
        margin: 0;
        padding-left: 1.2rem;
      }
      li {
        margin: 0.3rem 0;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>MuhammaraJS</h1>
      <p class="lede">
        A PDF library for creating, reading, and modifying PDF files, shipped
        as a native Node.js addon and as a browser-safe WebAssembly package.
      </p>

      <h2>Browser example</h2>
      <div class="panel">
        <p>
          The executable browser example runs
          <code>@muhammara/wasm</code> on the page and in a Worker.
          <a href="${examplePrefix}/index.html">Open the default version</a>
          or pick a deployed version below. Each version runs its own Wasm
          build; <code>dev</code> tracks the <code>develop</code> branch.
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">Version</th>
              <th scope="col">Aliases</th>
            </tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>

      <h2>Documentation</h2>
      <ul>
        <li>
          <a href="https://muhammarajs.readthedocs.io/">Native documentation</a>
          for <code>@muhammara/native</code> and
          <code>@muhammara/native-with-source</code>
        </li>
        <li>
          <a href="https://muhammarajs-wasm.readthedocs.io/">WebAssembly documentation</a>
          for <code>@muhammara/wasm</code>
        </li>
      </ul>

      <h2>Packages</h2>
      <ul>
        <li>
          <a href="https://www.npmjs.com/package/@muhammara/native">@muhammara/native</a>
        </li>
        <li>
          <a href="https://www.npmjs.com/package/@muhammara/native-with-source">@muhammara/native-with-source</a>
        </li>
        <li>
          <a href="https://www.npmjs.com/package/@muhammara/wasm">@muhammara/wasm</a>
        </li>
      </ul>

      <h2>Source</h2>
      <ul>
        <li><a href="${repositoryUrl}">Repository on GitHub</a></li>
        <li>
          <a href="${repositoryUrl}/blob/develop/CHANGELOG.md">Native changelog</a>
        </li>
        <li>
          <a href="${repositoryUrl}/blob/develop/packages/wasm/CHANGELOG.md">WebAssembly changelog</a>
        </li>
        <li><a href="${repositoryUrl}/issues">Issues</a></li>
      </ul>
    </main>
  </body>
</html>
`;
}

/**
 * Writes the root index page of the GitHub Pages site from the browser
 * example's mike version manifest.
 * @param {string} pagesRoot Directory that holds the GitHub Pages site, such as
 *   a checkout of the `gh-pages` branch.
 * @returns {Promise<string>} The path of the written index page.
 */
export async function generatePagesIndex(pagesRoot) {
  var versions = await readExampleVersions(pagesRoot);
  var indexPath = path.join(pagesRoot, "index.html");
  await writeFile(indexPath, renderPagesIndex(versions));
  return indexPath;
}

/**
 * Runs the generator when the script is executed directly.
 * @returns {Promise<void>} Resolves once the index is written.
 */
async function main() {
  var pagesRoot = process.argv[2];
  if (!pagesRoot) {
    throw new Error(
      "Usage: node generate-pages-index.mjs <pages-root>, for example a gh-pages checkout",
    );
  }
  var indexPath = await generatePagesIndex(path.resolve(pagesRoot));
  console.log(`Wrote ${indexPath}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
