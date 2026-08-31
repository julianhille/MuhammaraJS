var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");

var outputPath = path.join(__dirname, "../../native/docs/recipe/reference.md");
var sourceFiles = [
  "lib/Recipe.js",
  ...fs
    .readdirSync(path.join(__dirname, "../lib/recipe"))
    .filter(function (file) {
      return file.endsWith(".js");
    })
    .sort()
    .map(function (file) {
      return path.join("lib/recipe", file);
    }),
];
var result = childProcess.spawnSync(
  "jsdoc2md",
  [
    "--heading-depth",
    "1",
    "--param-list-format",
    "list",
    "--separators",
  ].concat(sourceFiles),
  { cwd: path.join(__dirname, ".."), encoding: "utf8" },
);

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status || 1);
}

var reference = result.stdout
  .replace(/Recipe\.([A-Za-z]+)/g, "recipe-$1")
  .replace(/^(\s*[*-]\s*)\[(.+)\]\(#recipe-[^)]+\)/gm, "$1`$2`")
  .replace(/ {2,}$/gm, "");
fs.writeFileSync(outputPath, reference);
