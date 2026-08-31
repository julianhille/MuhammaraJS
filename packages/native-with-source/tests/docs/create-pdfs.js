var assert = require("chai").assert;
var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
var createLowLevelPdf = require("../../../native/docs/examples/create-low-level-pdf");
var createRecipePdf = require("../../../native/docs/examples/create-recipe-pdf");

describe("Documentation examples", function () {
  var outputDirectory;

  beforeEach(function () {
    outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "muhammara-docs-"));
  });

  afterEach(function () {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  });

  it("creates a low-level PDF", function () {
    var outputPath = path.join(outputDirectory, "low-level.pdf");

    createLowLevelPdf(outputPath);

    var reader = muhammara.createReader(outputPath);
    assert.strictEqual(reader.getPagesCount(), 1);
    reader.end();
  });

  it("creates a Recipe PDF", function (done) {
    var outputPath = path.join(outputDirectory, "recipe.pdf");

    createRecipePdf(outputPath, function () {
      var reader = muhammara.createReader(outputPath);
      assert.strictEqual(reader.getPagesCount(), 1);
      reader.end();
      done();
    });
  });
});
