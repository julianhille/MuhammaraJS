var assert = require("chai").assert;
var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

describe("PDF versions", function () {
  var outputDirectory;

  beforeEach(function () {
    outputDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "muhammara-version-"),
    );
  });

  afterEach(function () {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  });

  it("creates a PDF 2.0 document", function () {
    var outputPath = path.join(outputDirectory, "version-20.pdf");
    var writer = muhammara.createWriter(outputPath, {
      version: muhammara.ePDFVersion20,
    });

    writer.writePage(writer.createPage(0, 0, 100, 100));
    writer.end();

    assert.match(fs.readFileSync(outputPath, "latin1"), /^%PDF-2\.0/);
  });

  [true, false].forEach(function (compress) {
    it(`${compress ? "compresses" : "does not compress"} content streams when compress is ${compress}`, function () {
      var outputPath = path.join(outputDirectory, `compress-${compress}.pdf`);
      var writer = muhammara.createWriter(outputPath, { compress: compress });
      var page = writer.createPage(0, 0, 100, 100);
      writer.startPageContentContext(page).q().re(1, 1, 10, 10).f().Q();
      writer.writePage(page);
      writer.end();

      var output = fs.readFileSync(outputPath, "latin1");
      if (compress) assert.match(output, /\/Filter\s*\/FlateDecode/);
      else assert.notMatch(output, /\/Filter\s*\/FlateDecode/);
    });
  });
});
