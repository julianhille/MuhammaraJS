var muhammara = require("@muhammara/native-with-source");
var assert = require("chai").assert;

describe("PDFTextExtraction", function () {
  it("returns text operations and their active text state", function () {
    var output = __dirname + "/output/PDFTextExtraction.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    var font = writer.getFontForFile(
      __dirname + "/TestMaterials/fonts/arial.ttf",
    );
    var context = writer.startPageContentContext(page);
    context
      .BT()
      .Tf(font, 12)
      .Tm(1, 0, 0, 1, 25, 50)
      .Tj("first")
      .Tm(1, 0, 0, 1, 25, 75)
      .Tj("second")
      .ET();
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map(function (element) {
        return element.content;
      }),
      ["first", "second"],
    );
    assert.equal(elements[0].fontSize, 12);
    assert.deepEqual(elements[0].textMatrix, [1, 0, 0, 1, 25, 50]);
    assert.deepEqual(elements[1].textMatrix, [1, 0, 0, 1, 25, 75]);
  });

  it("skips inline image payloads", function () {
    var output = __dirname + "/output/PDFTextExtractionInlineImage.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "BI /W 4 /H 1 /BPC 8 /CS /G ID BT (fabricated) Tj ET EI BT (real) Tj ET",
      );
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map(function (element) {
        return element.content;
      }),
      ["real"],
    );
  });

  it("tracks text and line positioning matrices", function () {
    var output = __dirname + "/output/PDFTextExtractionMatrices.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "BT 0 1 -1 0 90 80 Tm (rotated) Tj 10 20 Td (relative) Tj ET " +
          "BT (reset) Tj 10 20 Td (td) Tj 5 -4 TD (TD) Tj T* (star) Tj " +
          "6 TL T* (leading) Tj (quote) ' 1 2 (double-quote) \" ET",
      );
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map(function (element) {
        return [element.content, element.textMatrix];
      }),
      [
        ["rotated", [0, 1, -1, 0, 90, 80]],
        ["relative", [0, 1, -1, 0, 70, 90]],
        ["reset", [1, 0, 0, 1, 0, 0]],
        ["td", [1, 0, 0, 1, 10, 20]],
        ["TD", [1, 0, 0, 1, 15, 16]],
        ["star", [1, 0, 0, 1, 15, 12]],
        ["leading", [1, 0, 0, 1, 15, 6]],
        ["quote", [1, 0, 0, 1, 15, 0]],
        ["double-quote", [1, 0, 0, 1, 15, -6]],
      ],
    );
  });

  it("ignores malformed and out-of-context text positioning", function () {
    var output = __dirname + "/output/PDFTextExtractionMalformedMatrices.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "9 TL T* BT /bad TL T* (after-leading) Tj /bad 2 Td (after-td) Tj " +
          "/bad 0 0 1 5 6 Tm (after-tm) Tj 99 T* (after-star) Tj " +
          "/bad ' 99 (ignored-quote) ' (after-quote) Tj " +
          '1 2 /bad " 1 /bad (ignored-double-quote) " (after-double-quote) Tj ET',
      );
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map(function (element) {
        return [element.content, element.textMatrix];
      }),
      [
        ["after-leading", [1, 0, 0, 1, 0, 0]],
        ["after-td", [1, 0, 0, 1, 0, 0]],
        ["after-tm", [1, 0, 0, 1, 0, 0]],
        ["after-star", [1, 0, 0, 1, 0, 0]],
        ["after-quote", [1, 0, 0, 1, 0, 0]],
        ["after-double-quote", [1, 0, 0, 1, 0, 0]],
      ],
    );
  });

  it("ignores malformed text object boundaries", function () {
    var output = __dirname + "/output/PDFTextExtractionMalformedObjects.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "99 BT (outside) Tj BT 10 20 Td BT (after-nested) Tj 99 ET (after-et) Tj ET",
      );
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map(function (element) {
        return [element.content, element.textMatrix];
      }),
      [
        ["after-nested", [1, 0, 0, 1, 10, 20]],
        ["after-et", [1, 0, 0, 1, 10, 20]],
      ],
    );
  });

  it("restores extracted text state with the graphics state", function () {
    var output = __dirname + "/output/PDFTextExtractionLeadingState.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "BT /F1 10 Tf 7 TL ET q BT /F2 20 Tf 3 TL ET Q BT T* (restored) Tj ET",
      );
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(elements[0].textMatrix, [1, 0, 0, 1, 0, -7]);
    assert.equal(elements[0].fontResource, "F1");
    assert.equal(elements[0].fontSize, 10);
  });
  it("enforces configurable extraction limits", function () {
    var output = __dirname + "/output/PDFTextExtractionLimits.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    var font = writer.getFontForFile(
      __dirname + "/TestMaterials/fonts/arial.ttf",
    );
    writer
      .startPageContentContext(page)
      .BT()
      .Tf(font, 12)
      .Tm(1, 0, 0, 1, 25, 50)
      .Tj("first")
      .Tm(1, 0, 0, 1, 25, 75)
      .Tj("second")
      .ET();
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    assert.lengthOf(reader.extractPageText(0), 2);
    assert.throws(function () {
      reader.extractPageText(0, { maxElements: 1 });
    }, /extraction limits/);
    assert.throws(function () {
      reader.extractPageText(0, { maxTextBytes: 5 });
    }, /extraction limits/);
    // Requests above the ceiling clamp down instead of raising the backstop.
    assert.lengthOf(reader.extractPageText(0, { maxElements: 0xffffffff }), 2);
    [0, -1, 1.5, 0x100000000].forEach(function (value) {
      assert.throws(function () {
        reader.extractPageText(0, { maxParsedObjects: value });
      }, /positive 32-bit integer/);
    });
    reader.end();
  });
});
