import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

var packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
var cmake = await readFile(path.join(packageRoot, "CMakeLists.txt"), "utf8");
var exports = new Set(cmake.match(/'_muhammara_wasm_[^']+'/g) || []);
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

var missing = [];
for (var filename of (await list(path.join(packageRoot, "lib"))).filter(
  (file) => file.endsWith(".js"),
)) {
  var source = await readFile(filename, "utf8");
  for (var name of source.match(/_muhammara_wasm_[A-Za-z0-9_]+/g) || []) {
    if (!exports.has(`'${name}'`))
      missing.push(`${name} (${path.relative(packageRoot, filename)})`);
  }
}
for (var filename of (await list(path.join(packageRoot, "src"))).filter(
  (file) => file.endsWith(".cpp"),
)) {
  var source = await readFile(filename, "utf8");
  for (var definition of source.match(
    /WASM_EXPORT\s+[^\s]+\s+(muhammara_wasm_[A-Za-z0-9_]+)/g,
  ) || []) {
    var name = definition.match(/(muhammara_wasm_[A-Za-z0-9_]+)$/)[1];
    if (!exports.has(`'_${name}'`))
      missing.push(`${name} (${path.relative(packageRoot, filename)})`);
  }
}
if (missing.length) {
  throw new Error(
    `Wasm symbols missing CMake exports:\n${[...new Set(missing)].join("\n")}`,
  );
}
