import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

var packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
var cmake = await readFile(path.join(packageRoot, "CMakeLists.txt"), "utf8");
var exportEntries = Array.from(
  cmake.matchAll(/'(_muhammara_wasm_[A-Za-z0-9_]+)'/g),
  (match) => match[1],
);
var exports = new Set(exportEntries);

/**
 * Recursively list files below a directory.
 *
 * @param {string} directory Directory to inspect.
 * @returns {Promise<string[]>} Discovered filenames.
 */
async function list(directory) {
  var entries = await readdir(directory, {
    withFileTypes: true,
  });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        var filename = path.join(directory, entry.name);
        return entry.isDirectory() ? list(filename) : [filename];
      }),
    )
  ).flat();
}

var runtimeFiles = [
  path.join(packageRoot, "index.js"),
  ...(await list(path.join(packageRoot, "lib"))).filter((file) =>
    file.endsWith(".js"),
  ),
];
var required = new Set();
for (var filename of runtimeFiles) {
  var source = await readFile(filename, "utf8");
  for (var name of source.match(/_muhammara_wasm_[A-Za-z0-9_]+/g) || []) {
    required.add(name);
  }
}
var definitions = new Set();
for (var filename of (await list(path.join(packageRoot, "src"))).filter(
  (file) => file.endsWith(".cpp"),
)) {
  var source = await readFile(filename, "utf8");
  for (var match of source.matchAll(
    /^(?:WASM_EXPORT\s+)?(?:const\s+)?(?:unsigned\s+long|unsigned\s+char|[A-Za-z_][A-Za-z0-9_:<>]*)(?:\s*\*)?\s+(muhammara_wasm_[A-Za-z0-9_]+)\s*\(/gm,
  )) {
    definitions.add(`_${match[1]}`);
  }
}
var duplicates = [
  ...new Set(
    exportEntries.filter(
      (name, index) => exportEntries.indexOf(name) !== index,
    ),
  ),
].sort();
var missing = [...required].filter((name) => !exports.has(name)).sort();
var stale = [...exports].filter((name) => !required.has(name)).sort();
var undefinedSymbols = [...required]
  .filter((name) => !definitions.has(name))
  .sort();
var errors = [];
if (duplicates.length)
  errors.push(`Duplicate CMake exports: ${duplicates.join(", ")}`);
if (missing.length) errors.push(`Missing CMake exports: ${missing.join(", ")}`);
if (stale.length) errors.push(`Unused CMake exports: ${stale.join(", ")}`);
if (undefinedSymbols.length)
  errors.push(
    `Exports without C++ definitions: ${undefinedSymbols.join(", ")}`,
  );
if (errors.length) throw new Error(errors.join("\n"));
