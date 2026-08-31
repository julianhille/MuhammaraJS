var fs = require("fs");
var path = require("path");

var declarationPath = path.join(__dirname, "../muhammara.d.ts");
var outputPath = path.join(__dirname, "../docs/api/type-declarations.md");
var lines = fs.readFileSync(declarationPath, "utf8").split("\n");
var sections = [
  ["Module Entry Points", 3, 49],
  ["Streams And Page Modification", 51, 103],
  ["Content Contexts And Drawing Options", 105, 285],
  ["Options And Constants", 287, 348],
  ["Pages, Readers, And Document Objects", 350, 558],
  ["Copying And Low-Level Object Writing", 559, 721],
  ["PDF Writer", 722, 820],
  ["Recipe", 821, lines.length - 1],
];

var output = [
  "# Type Declarations Reference",
  "",
  "This generated reference is a grouped view of the public declarations in",
  "`muhammara.d.ts`. It is useful for quickly finding signatures, overloads,",
  "option fields, and literal types. Behavioral details and known declaration",
  "gaps are covered by the curated API and guide pages.",
  "",
];

sections.forEach(function (section) {
  var title = section[0];
  var start = section[1] - 1;
  var end = section[2];
  var declaration = lines
    .slice(start, end)
    .map(function (line) {
      return line.replace(/^  /, "");
    })
    .join("\n")
    .trim();

  output.push(`## ${title}`, "", "```typescript", declaration, "```", "");
});

fs.writeFileSync(outputPath, `${output.join("\n")}\n`);
