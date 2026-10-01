// Inserts THIRD_PARTY_LICENSES.md into the linked wasm as a custom section
// named "license", directly after the 8-byte header, so the notices travel
// with the binary when a bundler copies it without the package's files.
//
//   node scripts/embed-licenses.mjs dist/muhammara-wasm.wasm
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateLicenses, licensesFile } from "./generate-licenses.mjs";
import {
  customSections,
  insertLicenseSection,
  licenseSectionName,
  readSections,
} from "./wasm-section.mjs";

var target = process.argv[2];
if (!target) {
  console.error("usage: embed-licenses.mjs <module.wasm>");
  process.exit(2);
}

var text = await readFile(licensesFile, "utf8");
if (text !== (await generateLicenses())) {
  throw new Error(
    "THIRD_PARTY_LICENSES.md is out of date; run npm run licenses:generate --workspace=@muhammara/wasm",
  );
}
var output = insertLicenseSection(new Uint8Array(await readFile(target)), text);
var first = readSections(output)[0];
var embedded = customSections(output, licenseSectionName);
if (
  first?.name !== licenseSectionName ||
  embedded.length !== 1 ||
  new TextDecoder().decode(embedded[0]) !== text ||
  WebAssembly.Module.customSections(
    new WebAssembly.Module(output),
    licenseSectionName,
  ).length !== 1
) {
  throw new Error(`Could not embed the "${licenseSectionName}" section`);
}
await writeFile(target, output);
console.log(
  `Embedded ${path.basename(licensesFile)} (${embedded[0].length} bytes) into ${target}`,
);
