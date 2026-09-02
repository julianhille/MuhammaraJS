import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

var packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
var sourceFiles = ["index.js", ...collectJavaScriptFiles("lib")];
var result = spawnSync(
  "jsdoc2md",
  [
    "--heading-depth",
    "1",
    "--param-list-format",
    "list",
    "--separators",
  ].concat(sourceFiles),
  { cwd: packageRoot, encoding: "utf8" },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status || 1);
}

fs.writeFileSync(
  path.join(packageRoot, "docs/reference.md"),
  [
    "# API Reference",
    "",
    result.stdout.replace(/ {2,}$/gm, "").trim(),
    "",
  ].join("\n"),
);

function collectJavaScriptFiles(directory) {
  return fs
    .readdirSync(path.join(packageRoot, directory), { withFileTypes: true })
    .flatMap(function (entry) {
      var entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectJavaScriptFiles(entryPath);
      return entry.name.endsWith(".js") ? [entryPath] : [];
    })
    .sort();
}
