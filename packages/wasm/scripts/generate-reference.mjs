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
var recipeSources = [
  path.join(packageRoot, "lib/recipe.js"),
  ...fs
    .readdirSync(path.join(packageRoot, "lib/recipe"))
    .filter((file) => file.endsWith(".js"))
    .sort()
    .map((file) => path.join(packageRoot, "lib/recipe", file)),
];
var templateData = await jsdoc2md.getTemplateData({ files: recipeSources });
var recipeData = templateData.filter(
  (item) =>
    (item.kind === "class" && item.name === "Recipe") ||
    (item.memberof === "Recipe" && item.access !== "private"),
);
var recipeReference = await jsdoc2md.render({
  data: recipeData,
  template: '{{#class name="Recipe"}}{{>docs}}{{/class}}',
  "heading-depth": 2,
  "param-list-format": "list",
  separators: true,
});

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
