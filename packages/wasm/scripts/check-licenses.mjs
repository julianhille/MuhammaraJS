// Checks a built package: dist/THIRD_PARTY_LICENSES.md is the first and only
// "license" section of dist/muhammara-wasm.wasm, lists every component, and
// still matches the license texts and versions of the current sources.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkVersions, extractLicenses } from "./generate-licenses.mjs";
import { components, packageRoot } from "./third-party-licenses.mjs";
import {
  customSections,
  licenseSectionName,
  readSections,
} from "./wasm-section.mjs";

/**
 * Lists every disagreement between the build output and the sources.
 * @returns {Promise<string[]>} Problems found; empty when everything agrees.
 */
export async function checkLicenses() {
  var errors = await checkVersions();
  var licensesFile = path.join(packageRoot, "dist/THIRD_PARTY_LICENSES.md");
  var wasmFile = path.join(packageRoot, "dist/muhammara-wasm.wasm");
  var text = await readFile(licensesFile, "utf8").catch(() => null);
  var wasm = await readFile(wasmFile).catch(() => null);
  if (text === null || wasm === null) {
    return [
      ...errors,
      "dist/THIRD_PARTY_LICENSES.md and dist/muhammara-wasm.wasm are built by npm run build",
    ];
  }
  var bytes = new Uint8Array(wasm);
  if (readSections(bytes)[0]?.name !== licenseSectionName) {
    errors.push(
      `The first section of dist/muhammara-wasm.wasm is not "${licenseSectionName}"`,
    );
  }
  var sections = customSections(bytes, licenseSectionName);
  if (sections.length !== 1) {
    errors.push(
      `dist/muhammara-wasm.wasm has ${sections.length} "${licenseSectionName}" sections instead of 1`,
    );
  } else if (new TextDecoder().decode(sections[0]) !== text) {
    errors.push(
      `The "${licenseSectionName}" section of dist/muhammara-wasm.wasm differs from dist/THIRD_PARTY_LICENSES.md`,
    );
  }
  for (var component of components) {
    if (!text.includes(`\n## ${component.name}\n`)) {
      errors.push(
        `dist/THIRD_PARTY_LICENSES.md has no ${component.name} section`,
      );
    }
  }
  // The Emscripten texts live in the toolchain image; the rest are extracted
  // again so a source change without a rebuild is noticed.
  for (var [name, license] of await extractLicenses({ skipEmscripten: true })) {
    if (!text.includes(license)) {
      errors.push(
        `dist/THIRD_PARTY_LICENSES.md does not contain the current license text of ${name}; rebuild`,
      );
    }
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  var errors = await checkLicenses();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
}
