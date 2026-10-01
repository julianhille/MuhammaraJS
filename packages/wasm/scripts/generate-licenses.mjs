// Builds THIRD_PARTY_LICENSES.md from licenses/manifest.json and the verbatim
// license files next to it. The same text is embedded into
// dist/muhammara-wasm.wasm as its first custom section.
//
//   node scripts/generate-licenses.mjs           write the file
//   node scripts/generate-licenses.mjs --check   fail if anything disagrees
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  customSections,
  licenseSectionName,
  readSections,
} from "./wasm-section.mjs";

export var packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export var licensesFile = path.join(packageRoot, "THIRD_PARTY_LICENSES.md");
var licensesDirectory = path.join(packageRoot, "licenses");
var manifestFile = path.join(licensesDirectory, "manifest.json");
var wasmFile = path.join(packageRoot, "dist/muhammara-wasm.wasm");
var depsDirectory = path.join(packageRoot, "../native-with-source/src/deps");
// Each vendored library's version as its headers state it, so a dependency
// update without a matching manifest and license update fails the check.
var vendoredVersions = [
  {
    names: [
      "FreeType",
      "FreeType BDF driver",
      "FreeType PCF driver",
      "FreeType hash functions (fthash.c)",
    ],
    file: "FreeType/include/freetype/freetype.h",
    read: (source) =>
      ["MAJOR", "MINOR", "PATCH"]
        .map(
          (part) =>
            source.match(new RegExp(`#define FREETYPE_${part}\\s+(\\d+)`))?.[1],
        )
        .join("."),
  },
  {
    names: ["Zlib"],
    file: "Zlib/zlib.h",
    read: (source) => source.match(/#define ZLIB_VERSION "([^"]+)"/)?.[1],
  },
  {
    names: ["LibPng"],
    file: "LibPng/png.h",
    read: (source) =>
      source.match(/#define PNG_LIBPNG_VER_STRING "([^"]+)"/)?.[1],
  },
  {
    names: ["LibTiff"],
    file: "LibTiff/tiffvers.h",
    read: (source) =>
      source.match(/#define TIFFLIB_VERSION_STR_MAJ_MIN_MIC "([^"]+)"/)?.[1],
  },
  {
    names: ["LibJpeg"],
    file: "LibJpeg/jversion.h",
    read: (source) => {
      var match = source.match(/#define JVERSION\s+"(\S+)\s+(\S+)"/);
      return match && `${match[1]} (${match[2]})`;
    },
  },
];

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
 * Tells whether a manifest version names exactly the given version, so that
 * 1.3.1 does not match 1.3.10.
 * @param {string} text - Manifest version text.
 * @param {string} version - Version read from the vendored headers.
 * @returns {boolean} True when the version appears as a whole token.
 */
function mentionsVersion(text, version) {
  var escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w.])${escaped}(?![\\w]|\\.\\d)`).test(text);
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
 * Reads the manifest and checks that every entry is complete.
 * @returns {Promise<object>} The manifest.
 * @throws {Error} If an entry is missing a field or a license file.
 */
export async function readManifest() {
  var manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  var names = new Set();
  for (var component of manifest.components) {
    for (var field of ["name", "version", "license", "source", "shippedIn"]) {
      if (typeof component[field] !== "string" || !component[field].trim()) {
        throw new Error(
          `License manifest entry ${component.name || "?"} has no ${field}`,
        );
      }
    }
    if (names.has(component.name)) {
      throw new Error(`Duplicate license manifest entry: ${component.name}`);
    }
    names.add(component.name);
    if (!Array.isArray(component.files) || component.files.length === 0) {
      throw new Error(`License manifest entry ${component.name} has no files`);
    }
  }
  return manifest;
}

/**
 * Reads one license file exactly as stored, minus its final newline.
 * @param {string} file - Path relative to the package root.
 * @returns {Promise<string>} The text.
 * @throws {Error} If the file is missing or empty.
 */
async function readLicense(file) {
  var text;
  try {
    text = await readFile(path.join(packageRoot, file), "utf8");
  } catch (error) {
    throw new Error(`License file ${file} cannot be read: ${error.message}`);
  }
  text = text.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  if (!text.trim()) throw new Error(`License file ${file} is empty`);
  return text;
}

/**
 * Renders the notices: a header, a table of every component, then each
 * component's license text in full, repeated for every component that uses it.
 * @returns {Promise<string>} The Markdown text.
 */
export async function generateLicenses() {
  var manifest = await readManifest();
  var components = [...manifest.components].sort((a, b) =>
    compare(a.name, b.name),
  );
  var lines = [
    "# Third-Party Licenses",
    "",
    manifest.header,
    "",
    ...(manifest.acknowledgements ?? []).flatMap((line) => [line, ""]),
    "| Component | Version | License (SPDX) | Source | Shipped in |",
    "| --- | --- | --- | --- | --- |",
    ...components.map(
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
  for (var component of components) {
    var text = (
      await Promise.all(component.files.map((file) => readLicense(file)))
    ).join("\n\n");
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
 * Lists every file below licenses/ except the manifest.
 * @returns {Promise<string[]>} Paths relative to the package root.
 */
async function licenseFiles() {
  return (await readdir(licensesDirectory))
    .filter((name) => name !== "manifest.json")
    .map((name) => `licenses/${name}`);
}

/**
 * Checks the committed file, the license folder, and, when built, the wasm.
 * @returns {Promise<string[]>} Problems found; empty when everything agrees.
 */
export async function checkLicenses() {
  var errors = [];
  var expected = await generateLicenses();
  var committed = await readFile(licensesFile, "utf8").catch(() => null);
  if (committed !== expected) {
    errors.push(
      "THIRD_PARTY_LICENSES.md is out of date; run npm run licenses:generate --workspace=@muhammara/wasm",
    );
  }
  var manifest = await readManifest();
  for (var check of vendoredVersions) {
    var source = await readFile(path.join(depsDirectory, check.file), "utf8");
    var version = check.read(source);
    for (var name of check.names) {
      var component = manifest.components.find((c) => c.name === name);
      if (
        !component ||
        !version ||
        !mentionsVersion(component.version, version)
      ) {
        errors.push(
          `licenses/manifest.json lists ${name} as ${component?.version}, but ${check.file} is version ${version}`,
        );
      }
    }
  }
  var referenced = new Set(manifest.components.flatMap((c) => c.files));
  for (var file of await licenseFiles()) {
    if (!referenced.has(file)) {
      errors.push(`${file} is not referenced by licenses/manifest.json`);
    }
  }
  var wasm = await readFile(wasmFile).catch(() => null);
  if (wasm) {
    var bytes = new Uint8Array(wasm);
    var sections = customSections(bytes, licenseSectionName);
    if (readSections(bytes)[0]?.name !== licenseSectionName) {
      errors.push(
        `The first section of dist/muhammara-wasm.wasm is not "${licenseSectionName}"; rebuild the wasm`,
      );
    }
    if (sections.length !== 1) {
      errors.push(
        `dist/muhammara-wasm.wasm has ${sections.length} "${licenseSectionName}" sections instead of 1`,
      );
    } else if (new TextDecoder().decode(sections[0]) !== expected) {
      errors.push(
        `The "${licenseSectionName}" section of dist/muhammara-wasm.wasm differs from THIRD_PARTY_LICENSES.md; rebuild the wasm`,
      );
    }
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    var errors = await checkLicenses();
    if (errors.length) {
      console.error(errors.join("\n"));
      process.exit(1);
    }
  } else {
    await writeFile(licensesFile, await generateLicenses());
  }
}
