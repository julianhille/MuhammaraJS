// Builds THIRD_PARTY_LICENSES.md at build time by extracting every
// component's license and copyright notice from its sources (see
// third-party-licenses.mjs). build.sh embeds the result into the wasm.
//
//   node scripts/generate-licenses.mjs --emscripten-root <dir> [--output <file>]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  acknowledgements,
  components,
  extractPiece,
  header,
  mentionsVersion,
  packageRoot,
  versionChecks,
} from "./third-party-licenses.mjs";

export var defaultOutput = path.join(
  packageRoot,
  "dist/THIRD_PARTY_LICENSES.md",
);
var repositoryRoot = path.resolve(packageRoot, "../..");

/**
 * Compares strings by UTF-16 code units, independent of the locale.
 * @param {string} left - First string.
 * @param {string} right - Second string.
 * @returns {number} Negative, zero, or positive.
 */
function compare(left, right) {
  var a = left.toLowerCase();
  var b = right.toLowerCase();
  if (a !== b) return a < b ? -1 : 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Escapes text for a Markdown table cell.
 * @param {string} value - Cell text.
 * @returns {string} The escaped text.
 */
function cell(value) {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

/**
 * Picks a code fence longer than any backtick run in the text.
 * @param {string} text - Fenced text.
 * @returns {string} The fence.
 */
function fence(text) {
  var longest = Math.max(
    0,
    ...(text.match(/`+/g) || []).map((run) => run.length),
  );
  return "`".repeat(Math.max(3, longest + 1));
}

/**
 * Checks each component's version against the version its sources state.
 * @param {object} [options] - `emscriptenRoot`; without it, Emscripten's
 * version is not checked.
 * @returns {Promise<string[]>} Problems found.
 */
export async function checkVersions({ emscriptenRoot } = {}) {
  var errors = [];
  for (var check of versionChecks) {
    if (check.emscripten && !emscriptenRoot) continue;
    var file = check.emscripten
      ? path.join(emscriptenRoot, check.file)
      : path.join(repositoryRoot, check.file);
    var version = check.read(await readFile(file, "utf8"));
    for (var name of check.names) {
      var component = components.find((c) => c.name === name);
      if (
        !component ||
        !version ||
        !mentionsVersion(component.version, version)
      ) {
        errors.push(
          `third-party-licenses.mjs lists ${name} as ${component?.version}, but ${check.file} is version ${version}`,
        );
      }
    }
  }
  return errors;
}

/**
 * Extracts every component's license text.
 * @param {object} [options] - `emscriptenRoot`, required for the Emscripten
 * components; `skipEmscripten` leaves those out.
 * @returns {Promise<Map<string, string>>} Text by component name.
 */
export async function extractLicenses({ emscriptenRoot, skipEmscripten } = {}) {
  var texts = new Map();
  for (var component of components) {
    if (skipEmscripten && component.pieces.some((piece) => piece.emscripten))
      continue;
    var pieces = [];
    for (var piece of component.pieces) {
      pieces.push(await extractPiece(piece, emscriptenRoot));
    }
    texts.set(component.name, pieces.join("\n\n"));
  }
  return texts;
}

/**
 * Renders the notices: a header, a table of every component, then each
 * component's license text in full, repeated for every component that uses it.
 * @param {object} options - `emscriptenRoot`: the Emscripten installation the
 * wasm was linked with.
 * @returns {Promise<string>} The Markdown text.
 * @throws {Error} If a source is missing or a version disagrees.
 */
export async function generateLicenses({ emscriptenRoot }) {
  var errors = await checkVersions({ emscriptenRoot });
  if (errors.length) throw new Error(errors.join("\n"));
  var texts = await extractLicenses({ emscriptenRoot });
  var sorted = [...components].sort((a, b) => compare(a.name, b.name));
  var lines = [
    "# Third-Party Licenses",
    "",
    header,
    "",
    ...acknowledgements.flatMap((line) => [line, ""]),
    "| Component | Version | License (SPDX) | Source | Shipped in |",
    "| --- | --- | --- | --- | --- |",
    ...sorted.map(
      (component) =>
        `| ${[
          component.name,
          component.version,
          component.license,
          component.source,
          component.shippedIn,
        ]
          .map(cell)
          .join(" | ")} |`,
    ),
  ];
  for (var component of sorted) {
    var text = texts.get(component.name);
    var marker = fence(text);
    lines.push(
      "",
      `## ${component.name}`,
      "",
      `Version: ${component.version}  `,
      `License: ${component.license}  `,
      `Source: ${component.source}  `,
      `Shipped in: ${component.shippedIn}`,
      "",
      `${marker}text`,
      text,
      marker,
    );
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Reads a `--name value` command-line option.
 * @param {string} name - Option name.
 * @returns {string|undefined} The value.
 */
function option(name) {
  var index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  var emscriptenRoot = option("--emscripten-root");
  if (!emscriptenRoot) {
    console.error(
      "usage: generate-licenses.mjs --emscripten-root <dir> [--output <file>]",
    );
    process.exit(2);
  }
  var output = option("--output") || defaultOutput;
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, await generateLicenses({ emscriptenRoot }));
  console.log(`Wrote ${output}`);
}
