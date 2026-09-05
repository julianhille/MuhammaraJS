var assert = require("chai").assert;
var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
require.cache[require.resolve("@muhammara/native")] = { exports: muhammara };
var replacePageObject = require("../../../native/docs/examples/replace-page-object");
var replaceRecipeText = require("../../../native/docs/examples/replace-recipe-text");

var fontPath = path.join(
  __dirname,
  "../../tests/TestMaterials/fonts/arial.ttf",
);

function getPageContentsId(reader, pageIndex) {
  return reader
    .parsePage(pageIndex)
    .getDictionary()
    .queryObject("Contents")
    .toPDFIndirectObjectReference()
    .getObjectID();
}

function writeSourcePdf(sourcePath) {
  var writer = muhammara.createWriter(sourcePath);
  var page = writer.createPage(0, 0, 200, 200);

  writer
    .startPageContentContext(page)
    .BT()
    .Tf(writer.getFontForFile(fontPath), 12)
    .Tm(1, 0, 0, 1, 20, 30)
    .Tj("Before")
    .ET();
  writer.writePage(page);
  writer.end();
}

describe("Documentation examples", function () {
  var outputDirectory;
  var sourcePath;

  beforeEach(function () {
    outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "muhammara-docs-"));
    sourcePath = path.join(outputDirectory, "source.pdf");
    writeSourcePdf(sourcePath);
  });

  afterEach(function () {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  });

  it("replaces a page object", function () {
    var outputPath = path.join(outputDirectory, "replaced-object.pdf");
    var sourceReader = muhammara.createReader(sourcePath);
    var sourceContentsId = getPageContentsId(sourceReader, 0);

    sourceReader.end();
    replacePageObject(sourcePath, outputPath);

    var reader = muhammara.createReader(outputPath);

    assert.notStrictEqual(getPageContentsId(reader, 0), sourceContentsId);
    assert.deepStrictEqual(reader.extractPageText(0), []);
    reader.end();
  });

  it("replaces literal Recipe text", function () {
    var outputPath = path.join(outputDirectory, "replaced-text.pdf");

    replaceRecipeText(sourcePath, outputPath);

    var reader = muhammara.createReader(outputPath);
    var text = reader.extractPageText(0);

    assert.strictEqual(text.length, 1);
    assert.strictEqual(text[0].content, "After");
    assert.deepStrictEqual(text[0].textMatrix, [1, 0, 0, 1, 20, 30]);
    reader.end();
  });
});
