describe("TextMeasurementsTest", function () {
  it("snapshots glyph array length before coercing elements", function () {
    var assert = require("assert");
    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      __dirname + "/output/TextMeasurementsGlyphLength.pdf",
    );
    var font = pdfWriter.getFontForFile(
      __dirname + "/TestMaterials/fonts/arial.ttf",
    );
    var glyphs = [
      {
        valueOf: function () {
          glyphs.push(2);
          return 1;
        },
      },
    ];

    try {
      assert.deepStrictEqual(
        font.calculateTextDimensions(glyphs, 12),
        font.calculateTextDimensions([1], 12),
      );
      assert.strictEqual(glyphs.length, 2);
    } finally {
      pdfWriter._abort();
    }
  });

  it("measures fractional font sizes exactly", function () {
    var assert = require("assert");
    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      __dirname + "/output/TextMeasurementsFractionalSize.pdf",
    );
    var font = pdfWriter.getFontForFile(
      __dirname + "/TestMaterials/fonts/arial.ttf",
    );

    try {
      var fractional = font.calculateTextDimensions("Hi gy", 10.5);
      var unit = font.calculateTextDimensions("Hi gy", 1);
      assert.ok(Math.abs(fractional.width - unit.width * 10.5) < 1e-9);
      assert.ok(Math.abs(fractional.yMin - unit.yMin * 10.5) < 1e-9);
      assert.ok(
        fractional.width > font.calculateTextDimensions("Hi gy", 10).width,
      );
      [0, -5, NaN, Infinity].forEach(function (size) {
        assert.throws(function () {
          font.calculateTextDimensions("Hi gy", size);
        }, TypeError);
      });
    } finally {
      pdfWriter._abort();
    }
  });

  it("should complete without error", function () {
    var assert = require("assert");
    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      __dirname + "/output/TextMeasurementsTest.pdf",
    );
    var page = pdfWriter.createPage(0, 0, 595, 842);
    var cxt = pdfWriter.startPageContentContext(page);
    var arialFont = pdfWriter.getFontForFile(
      __dirname + "/TestMaterials/fonts/arial.ttf",
    );
    var pathStrokeOptions = { color: "DarkMagenta", width: 4 };

    var textOptions = {
      font: arialFont,
      size: 14,
      colorspace: "gray",
      color: 0x00,
    };

    // write some text, with top and bottom lines, which position is based on the text dimensions
    var textDimensions = arialFont.calculateTextDimensions("Hello World", 14);
    assert.ok(textDimensions.width > 0);
    assert.ok(textDimensions.height > 0);
    assert.ok(textDimensions.xMax > textDimensions.xMin);
    assert.ok(textDimensions.yMax > textDimensions.yMin);
    cxt
      .writeText("Hello World", 10, 100, textOptions)
      .drawPath(
        10 + textDimensions.xMin,
        98 + textDimensions.yMin,
        10 + textDimensions.xMax,
        98 + textDimensions.yMin,
        pathStrokeOptions,
      )
      .drawPath(
        10 + textDimensions.xMin,
        102 + textDimensions.yMax,
        10 + textDimensions.xMax,
        102 + textDimensions.yMax,
        pathStrokeOptions,
      );

    pdfWriter.writePage(page);
    pdfWriter.end();
  });
});
