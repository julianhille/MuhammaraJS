var assert = require("chai").assert;
var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("../lib/muhammara");

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
});
