describe("HighLevelContentContext", function () {
  var expect = require("chai").expect;
  var fs = require("fs");
  var os = require("os");
  var path = require("path");
  var outputPath = __dirname + "/output/HighLevelContentContext.pdf";

  it("should complete without error", function () {
    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      outputPath,
    );
    var page = pdfWriter.createPage(0, 0, 595, 842);
    var cxt = pdfWriter.startPageContentContext(page);

    var textOptions = {
      font: pdfWriter.getFontForFile(
        __dirname + "/TestMaterials/fonts/arial.ttf",
      ),
      size: 14,
      colorspace: "gray",
      color: 0x00,
      underline: true,
    };

    var pathFillOptions = {
      color: 0xff000000,
      colorspace: "cmyk",
      type: "fill",
    };
    var pathStrokeOptions = { color: "DarkMagenta", width: 4 };

    // drawPath
    cxt
      .drawPath(
        [
          [75, 640],
          [149, 800],
          [225, 640],
        ],
        pathFillOptions,
      )
      .drawPath(
        75,
        540,
        110,
        440,
        149,
        540,
        188,
        440,
        223,
        540,
        pathStrokeOptions,
      );

    // drawSquare
    cxt
      .drawSquare(375, 640, 120, pathFillOptions)
      .drawSquare(375, 440, 120, pathStrokeOptions);

    // drawRectangle
    cxt
      .drawRectangle(375, 220, 50, 160, pathFillOptions)
      .drawRectangle(375, 10, 50, 160, pathStrokeOptions);

    // drawCircle
    cxt
      .drawCircle(149, 300, 80, pathFillOptions)
      .drawCircle(149, 90, 80, pathStrokeOptions);

    // writeText (writing labels for each of the shapes)
    cxt
      .writeText("Paths", 75, 805, textOptions)
      .writeText("Squares", 375, 805, textOptions)
      .writeText("Rectangles", 375, 400, textOptions)
      .writeText("Circles", 75, 400, textOptions);

    cxt
      .q()
      .setOpacity(0.5)
      .writeText("Transparent", 75, 370, textOptions)
      .Q()
      .writeText("Opaque", 75, 350, textOptions);

    pdfWriter.writePage(page);
    pdfWriter.end();

    var pdf = fs.readFileSync(outputPath, "latin1");
    expect(pdf).to.contain("/ca 0.5");
    expect(pdf).to.contain("/CA 0.5");
  });

  it("should reject invalid opacity values", function () {
    var tempDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "muhammara-opacity-"),
    );
    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      path.join(tempDirectory, "invalid-opacity.pdf"),
    );
    var page = pdfWriter.createPage(0, 0, 595, 842);
    var cxt = pdfWriter.startPageContentContext(page);

    try {
      expect(function () {
        cxt.setOpacity();
      }).to.throw("opacity value between 0 and 1");
      expect(function () {
        cxt.setOpacity("0.5");
      }).to.throw("opacity value between 0 and 1");
      expect(function () {
        cxt.setOpacity(NaN);
      }).to.throw("opacity value between 0 and 1");
      expect(function () {
        cxt.setOpacity(-0.1);
      }).to.throw("opacity value between 0 and 1");
      expect(function () {
        cxt.setOpacity(1.1);
      }).to.throw("opacity value between 0 and 1");

      pdfWriter.writePage(page);
      pdfWriter.end();
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
