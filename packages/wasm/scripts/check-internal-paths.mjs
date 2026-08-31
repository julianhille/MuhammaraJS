import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

var packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
var repositoryRoot = path.resolve(packageRoot, "../..");
var staleDirectory = ["inter", "nal"].join("");
var stalePackagePath = `packages/wasm/${staleDirectory}`;
var textExtensions = new Set([
  "",
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sh",
  ".ts",
  ".yaml",
  ".yml",
]);
var roots = [
  packageRoot,
  path.join(repositoryRoot, "docs"),
  path.join(repositoryRoot, "packages/native-core/docs"),
  path.join(repositoryRoot, "packages/native-with-source/README.md"),
  path.join(repositoryRoot, ".github"),
  path.join(repositoryRoot, "README.md"),
  path.join(repositoryRoot, "package.json"),
  path.join(repositoryRoot, "package-lock.json"),
  path.join(repositoryRoot, ".gitignore"),
  path.join(repositoryRoot, ".prettierignore"),
  path.join(repositoryRoot, ".readthedocs.yaml"),
  path.join(repositoryRoot, "mkdocs.yml"),
];
var staleReferences = [];

function inspect(target) {
  if (!fs.existsSync(target)) return;
  var stat = fs.statSync(target);
  if (stat.isDirectory()) {
    if (["dist", "node_modules"].includes(path.basename(target))) return;
    fs.readdirSync(target).forEach(function (entry) {
      inspect(path.join(target, entry));
    });
    return;
  }
  if (!textExtensions.has(path.extname(target))) return;

  var relativePath = path.relative(repositoryRoot, target);
  var source = fs.readFileSync(target, "utf8");
  source.split("\n").forEach(function (line, index) {
    var staleRelativeImport =
      relativePath.startsWith("packages/wasm/") &&
      new RegExp(`["'\`]\\.{1,2}/(?:\\.{1,2}/)*${staleDirectory}/`).test(line);
    if (line.includes(stalePackagePath) || staleRelativeImport) {
      staleReferences.push(`${relativePath}:${index + 1}`);
    }
  });
}

roots.forEach(inspect);

if (staleReferences.length > 0) {
  throw new Error(
    `Stale WASM implementation paths found:\n${staleReferences.join("\n")}`,
  );
}
