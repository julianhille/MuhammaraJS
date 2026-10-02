var assert = require("chai").assert;
var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
require.cache[require.resolve("@muhammara/native")] = { exports: muhammara };
var deviceColors = require("../../../native/docs/examples/draw-device-colors");
var placePdfPageAsImage = require("../../../native/docs/examples/place-pdf-page-as-image");
var rightToLeftText = require("../../../native/docs/examples/write-right-to-left-text");
var { imagePlacements } = require("../../tests/helpers/imagePlacement");

describe("Documentation examples", function () {
  var outputDirectory;

  beforeEach(function () {
    outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "muhammara-docs-"));
  });

  afterEach(function () {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  });

  it("draws in gray and CMYK", function () {
    var lowLevelPath = path.join(outputDirectory, "device-colors.pdf");
    var recipePath = path.join(outputDirectory, "recipe-device-colors.pdf");
    deviceColors.drawDeviceColors(lowLevelPath);
    deviceColors.drawRecipeDeviceColors(recipePath);

    var readContent = function (inputPath) {
      var reader = muhammara.createReader(inputPath);
      var content = [];
      for (var id = 1; id < reader.getXrefSize(); id++) {
        var object = reader.parseNewObject(id);
        if (!object || object.getType() !== muhammara.ePDFObjectStream) {
          continue;
        }
        var input = reader.startReadingFromStream(object.toPDFStream());
        var bytes = [];
        while (input.notEnded()) bytes.push(...input.read(4096));
        content.push(Buffer.from(bytes).toString("latin1"));
      }
      reader.end();
      return content.join("\n");
    };
    var lowLevel = readContent(lowLevelPath);
    assert.match(lowLevel, /0\.50\d* g/);
    assert.match(lowLevel, /0 1 0 0 k/);
    assert.match(lowLevel, /0 0\.50\d* 0\.50\d* rg/);
    var recipe = readContent(recipePath);
    assert.match(recipe, /0\.50\d* g/);
    assert.match(recipe, /0 1 0 0 k/);
    assert.match(recipe, /0 0 0 1 k/);

    // A named or #rrggbb color is RGB and cannot use the gray colorspace.
    var writer = muhammara.createWriter(
      path.join(outputDirectory, "rejected.pdf"),
    );
    var page = writer.createPage(0, 0, 100, 100);
    var context = writer.startPageContentContext(page);
    assert.throws(
      () =>
        context.drawRectangle(1, 2, 3, 4, {
          colorspace: muhammara.DeviceColorSpace.GRAY,
          color: "teal",
        }),
      TypeError,
      "only a numeric color can use the gray or cmyk colorspace",
    );
    writer.writePage(page);
    writer.end();
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

  it("writes a PDF to a custom stream", function () {
    var chunks = [];
    var position = 0;
    var writer = muhammara.createWriter({
      write: function (bytes) {
        chunks.push(bytes);
        position += bytes.length;
        return bytes.length;
      },
      getCurrentPosition: function () {
        return position;
      },
    });
    writer.writePage(writer.createPage(0, 0, 595, 842));
    writer.end();
    var pdfBuffer = Buffer.concat(chunks);

    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(pdfBuffer),
    );
    assert.strictEqual(reader.getPagesCount(), 1);
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

  it("places a PDF page as a framed image", function () {
    var sourcePath = path.join(outputDirectory, "two-pages.pdf");
    var outputPath = path.join(outputDirectory, "pdf-page-image.pdf");
    var source = new muhammara.Recipe("new", sourcePath);
    source.createPage(595, 842).endPage().createPage(300, 150).endPage();
    source.endPDF();

    placePdfPageAsImage(sourcePath, outputPath);

    var placements = imagePlacements(fs.readFileSync(outputPath), {
      pageBoxes: [[0, 0, 300, 150]],
    });
    var box = [
      [72, 670],
      [272, 670],
      [272, 770],
      [72, 770],
    ];
    assert.deepStrictEqual(
      placements.map((placement) => placement.kind),
      ["fill", "page", "stroke"],
    );
    assert.deepStrictEqual(placements[0].corners, box);
    assert.deepStrictEqual(placements[1].corners, box);
    assert.strictEqual(placements[2].lineWidth, 2);
    assert.deepStrictEqual(placements[2].dash, [4, 2]);
  });

  it("writes right-to-left text", function () {
    var readText = function (inputPath) {
      var reader = muhammara.createReader(inputPath);
      try {
        return reader.extractPageText(0).map(function (element) {
          return { text: element.text, x: element.textMatrix[4] };
        });
      } finally {
        reader.end();
      }
    };
    var lowLevelPath = path.join(outputDirectory, "hebrew.pdf");
    var recipePath = path.join(outputDirectory, "recipe-hebrew.pdf");
    rightToLeftText.writeHebrew(
      lowLevelPath,
      path.join(__dirname, "../../tests/TestMaterials/fonts/arial.ttf"),
    );
    rightToLeftText.writeRecipeHebrew(recipePath);

    var lines = readText(lowLevelPath);
    assert.deepEqual(
      lines.map(function (line) {
        return line.text;
      }),
      ["םלוע םולש", "ח״ש 120 ריחמ", "םלוע םולש"],
    );
    assert.isAbove(lines[2].x, 400);
    assert.deepEqual(
      readText(recipePath).map(function (line) {
        return line.text;
      }),
      ["בלכה לעמ ץפק ריהמה םוחה לעושה", "ןלצעה"],
    );
  });
});
