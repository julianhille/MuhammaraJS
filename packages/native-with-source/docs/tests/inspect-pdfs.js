var assert = require("chai").assert;
var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
require.cache[require.resolve("@muhammara/native")] = { exports: muhammara };
var detectBlankPages = require("../../../native/docs/examples/detect-blank-pages");
var findTextPositions = require("../../../native/docs/examples/find-text-positions");

describe("Documentation examples for reading pages", function () {
  var outputDirectory;

  beforeEach(function () {
    outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "muhammara-docs-"));
  });

  afterEach(function () {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  });

  function writeSamplePdf(inputPath) {
    var writer = muhammara.createWriter(inputPath);
    var font = writer.getFontForFile(
      path.join(__dirname, "../../tests/TestMaterials/fonts/arial.ttf"),
    );

    // Page 0 is blank, page 1 is painted, page 2 shows text.
    writer.writePage(writer.createPage(0, 0, 200, 200));

    var pathPage = writer.createPage(0, 0, 200, 200);
    writer.startPageContentContext(pathPage).re(20, 20, 40, 40).f();
    writer.writePage(pathPage);

    var textPage = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(textPage)
      .BT()
      .Tf(font, 12)
      .Tm(1, 0, 0, 1, 25, 50)
      .Tj("locate me")
      .ET();
    writer.writePage(textPage);

    writer.end();
  }

  it("detects blank pages", function () {
    var inputPath = path.join(outputDirectory, "pages.pdf");
    writeSamplePdf(inputPath);

    assert.deepEqual(detectBlankPages(inputPath), [0]);
  });

  it("finds text positions", function () {
    var inputPath = path.join(outputDirectory, "pages.pdf");
    writeSamplePdf(inputPath);

    assert.deepEqual(findTextPositions(inputPath, 2, "locate me"), [
      { x: 25, y: 50, fontSize: 12, fontResource: "FN1" },
    ]);
    assert.deepEqual(findTextPositions(inputPath, 2, "missing"), []);
  });
});
