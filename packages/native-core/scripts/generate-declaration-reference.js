var fs = require("fs");
var path = require("path");

var declarationPath = path.join(__dirname, "../muhammara.d.ts");
var outputPath = path.join(
  __dirname,
  "../../native/docs/api/type-declarations.md",
);
var lines = fs.readFileSync(declarationPath, "utf8").split("\n");
var namespaceStart = lines.findIndex(function (line) {
  return line === "declare namespace muhammara {";
});
var namespaceEnd = lines.findIndex(function (line, index) {
  return index > namespaceStart && line === "}";
});
if (namespaceStart === -1 || namespaceEnd === -1)
  throw new Error("Expected a muhammara namespace declaration");
var sections = [
  ["Module Entry Points", "type EventEmitter"],
  ["Streams And Page Modification", "export interface WriteStream"],
  ["Content Contexts And Drawing Options", "export interface ColorOptions"],
  ["Options And Constants", "export interface PDFReaderOptions"],
  ["Pages, Readers, And Document Objects", "type FormXObjectId"],
  ["Copying And Low-Level Object Writing", "export interface ImageXObject"],
  ["PDF Writer", "export type PDFRectangle"],
  ["Recipe", "namespace Recipe"],
];

function findDeclarationStart(declaration) {
  var matches = lines.reduce(function (result, line, index) {
    if (line.trimStart().startsWith(declaration)) result.push(index);
    return result;
  }, []);
  if (matches.length !== 1)
    throw new Error(`Expected one declaration start for ${declaration}`);
  return matches[0];
}

var sectionStarts = sections.map(function (section) {
  return findDeclarationStart(section[1]);
});

var output = [
  "# Type Declarations Reference",
  "",
  "This generated reference is a grouped view of the public declarations in",
  "`muhammara.d.ts`. It is useful for quickly finding signatures, overloads,",
  "option fields, and literal types. Behavioral details and known declaration",
  "gaps are covered by the curated API and guide pages.",
  "",
];

sections.forEach(function (section, index) {
  var title = section[0];
  var start = sectionStarts[index];
  var end = sectionStarts[index + 1] || namespaceEnd;
  var declaration = lines
    .slice(start, end)
    .map(function (line) {
      return line.replace(/^  /, "");
    })
    .join("\n")
    .trim();

  output.push(
    `## ${title}`,
    "",
    "```typescript",
    "declare namespace muhammara {",
    declaration,
    "}",
    "```",
    "",
  );
});

fs.writeFileSync(outputPath, output.join("\n"));
