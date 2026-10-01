// Inserts the generated THIRD_PARTY_LICENSES.md into the linked wasm as a
// custom section named "license", directly after the 8-byte header, so the
// notices travel with the binary when a bundler copies it without the
// package's other files.
//
//   node scripts/embed-licenses.mjs <module.wasm> <THIRD_PARTY_LICENSES.md>
import { readFile, writeFile } from "node:fs/promises";
import {
  customSections,
  insertLicenseSection,
  licenseSectionName,
  readSections,
} from "./wasm-section.mjs";

var [target, licensesFile] = process.argv.slice(2);
if (!target || !licensesFile) {
  console.error("usage: embed-licenses.mjs <module.wasm> <licenses.md>");
  process.exit(2);
}

var text = await readFile(licensesFile, "utf8");
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
  `Embedded ${licensesFile} (${embedded[0].length} bytes) into ${target}`,
);
