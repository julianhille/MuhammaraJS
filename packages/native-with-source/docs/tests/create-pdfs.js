var assert = require("chai").assert;
var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
require.cache[require.resolve("@muhammara/native")] = { exports: muhammara };

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
    var pdfWriter = muhammara.createWriter(outputPath);
    var page = pdfWriter.createPage(0, 0, 595, 842);

    pdfWriter.writePage(page);
    pdfWriter.end();

    var reader = muhammara.createReader(outputPath);
    assert.strictEqual(reader.getPagesCount(), 1);
    reader.end();
  });

  it("creates a Recipe PDF", function () {
    var outputPath = path.join(outputDirectory, "recipe.pdf");
    var Recipe = require("@muhammara/native").Recipe;
    var pdfDoc = new Recipe("new", outputPath, {
      version: 1.6,
      author: "John Doe",
      title: "A brand new PDF",
    });

    pdfDoc.createPage("letter").endPage().endPDF();

    var reader = muhammara.createReader(outputPath);
    assert.strictEqual(reader.getPagesCount(), 1);
    reader.end();
  });

  it("creates a Recipe pie chart", function () {
    var outputPath = path.join(outputDirectory, "pie-chart.pdf");
    var Recipe = require("@muhammara/native").Recipe;
    var data = [
      { label: "Comedy", value: 8, fill: "#ef4444" },
      { label: "Action", value: 5, fill: "#f97316" },
      { label: "Romance", value: 6, fill: "#22c55e" },
      { label: "Drama", value: 1, fill: "#3b82f6" },
    ];
    var total = data.reduce(function (sum, slice) {
      return sum + slice.value;
    }, 0);
    var startAngle = -90;
    var pdfDoc = new Recipe("new", outputPath);

    pdfDoc.createPage("letter").text("Favorite Movies", 235, 100, { size: 18 });
    data.forEach(function (slice) {
      var endAngle = startAngle + (slice.value / total) * 360;
      pdfDoc.pie(306, 396, 120, startAngle, endAngle, {
        fill: slice.fill,
        stroke: "#ffffff",
      });
      startAngle = endAngle;
    });
    pdfDoc.endPage().endPDF();

    var reader = muhammara.createReader(outputPath);
    assert.strictEqual(reader.getPagesCount(), 1);
    reader.end();
  });
});
