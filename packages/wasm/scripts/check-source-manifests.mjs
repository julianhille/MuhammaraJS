import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

var packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
var pdfWriterRoot = path.resolve(
  packageRoot,
  "../native-with-source/src/deps/PDFWriter",
);

/**
 * Extract C++ filenames from a build-manifest fragment.
 *
 * @param {string} source Manifest source.
 * @returns {string[]} C++ filenames in declaration order.
 */
function cppFiles(source) {
  return Array.from(
    source.matchAll(/["']?([A-Za-z0-9_]+\.cpp)["']?/g),
    function (match) {
      return match[1];
    },
  );
}

/**
 * Return duplicate values from a list.
 *
 * @param {string[]} values Values to inspect.
 * @returns {string[]} Sorted duplicates.
 */
function duplicates(values) {
  var seen = new Set();
  return [
    ...new Set(values.filter((value) => seen.has(value) || !seen.add(value))),
  ].sort();
}

var gyp = await readFile(path.join(pdfWriterRoot, "binding.gyp"), "utf8");
var cmake = await readFile(path.join(pdfWriterRoot, "CMakeLists.txt"), "utf8");
var gypSourcesBlock = gyp.match(/'sources':\s*\[([\s\S]*?)\n\s*\]/);
var cmakeSourcesBlock = cmake.match(
  /add_library\s*\(PDFWriter([\s\S]*?)#headers/,
);
var cmakeAesBlock = cmake.match(
  /else\(\)\s*set\(AES_SOURCES([\s\S]*?)\)\s*endif\(\)/,
);
if (!gypSourcesBlock || !cmakeSourcesBlock || !cmakeAesBlock) {
  throw new Error("Could not parse PDFWriter source manifests");
}

var gypSources = cppFiles(gypSourcesBlock[1]);
var cmakeSources = cppFiles(cmakeSourcesBlock[1]).concat(
  cppFiles(cmakeAesBlock[1]),
);
var gypSet = new Set(gypSources);
var cmakeSet = new Set(cmakeSources);
var sourceFiles = (await readdir(pdfWriterRoot))
  .filter((filename) => filename.endsWith(".cpp"))
  .sort();
var intentionalAlternatives = new Set([
  "InputAESDecodeStreamSSL.cpp",
  "OutputAESEncodeStreamSSL.cpp",
]);
var errors = [];
var gypDuplicates = duplicates(gypSources);
var cmakeDuplicates = duplicates(cmakeSources);
if (gypDuplicates.length)
  errors.push(`Duplicate GYP sources: ${gypDuplicates.join(", ")}`);
if (cmakeDuplicates.length)
  errors.push(`Duplicate CMake sources: ${cmakeDuplicates.join(", ")}`);
var gypOnly = [...gypSet].filter((source) => !cmakeSet.has(source)).sort();
var cmakeOnly = [...cmakeSet].filter((source) => !gypSet.has(source)).sort();
if (gypOnly.length) errors.push(`GYP-only sources: ${gypOnly.join(", ")}`);
if (cmakeOnly.length)
  errors.push(`CMake-only sources: ${cmakeOnly.join(", ")}`);
var unlisted = sourceFiles.filter(
  (source) => !gypSet.has(source) && !intentionalAlternatives.has(source),
);
if (unlisted.length)
  errors.push(`Unlisted PDFWriter sources: ${unlisted.join(", ")}`);
if (errors.length) throw new Error(errors.join("\n"));
