import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jsdoc2md from "jsdoc-to-markdown";

var packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
var declarations = fs.readFileSync(
  path.join(packageRoot, "index.d.ts"),
  "utf8",
);
/**
 * The JavaScript files of a directory, sorted.
 * @param {string} directory - The directory.
 * @returns {string[]} Their paths.
 */
function scripts(directory) {
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".js"))
    .sort()
    .map((file) => path.join(directory, file));
}

// The shared Recipe, which both ends run, and the Wasm platform's own
// documentation on top of it. Where the Wasm sources document a name too,
// such as the class itself or split(), theirs replaces the shared entry.
var sharedData = await jsdoc2md.getTemplateData({
  files: scripts(path.join(packageRoot, "../shared/lib/recipe")),
});
var wasmData = await jsdoc2md.getTemplateData({
  files: [
    path.join(packageRoot, "lib/recipe.js"),
    ...scripts(path.join(packageRoot, "lib/recipe")),
  ],
});
var wasmNames = new Set(wasmData.map((item) => item.longname));
var recipeData = [
  ...wasmData,
  ...sharedData.filter((item) => !wasmNames.has(item.longname)),
].filter(
  (item) =>
    (item.kind === "class" && item.name === "Recipe") ||
    (item.memberof === "Recipe" && item.access !== "private"),
);
var recipeReference = (
  await jsdoc2md.render({
    data: recipeData,
    template: '{{#class name="Recipe"}}{{>docs}}{{/class}}',
    "heading-depth": 2,
    "param-list-format": "list",
    separators: true,
  })
)
  // MkDocs resolves no <a name> anchors, so the member index lists names
  // instead of links, as native's reference does.
  .replace(/^([ \t]*[-*] )\[(.+)\]\(#Recipe[+.][^)]+\)/gm, "$1`$2`");

fs.writeFileSync(
  path.join(packageRoot, "docs/reference.md"),
  [
    "# API Reference",
    "",
    "This generated reference is the public TypeScript contract exported by",
    "`@muhammara/wasm`. It is useful for finding signatures, overloads, and",
    "option fields. Behavioral guidance is covered by the curated API pages.",
    "",
    "## Recipe Methods",
    "",
    "The high-level Recipe method reference below is generated from the runtime",
    "JSDoc. Its named parameter and result types refer to the declarations that",
    "follow it.",
    "",
    recipeReference.trim(),
    "",
    "## TypeScript Declarations",
    "",
    "```typescript",
    declarations.trim(),
    "```",
    "",
  ].join("\n"),
);
