var muhammara = require("@muhammara/native-with-source");
var assert = require("chai").assert;

describe("PDFPageContentItems", function () {
  it("returns page-marking operations without relying on resources", function () {
    var output = __dirname + "/output/PDFPageContentItems.pdf";
    var writer = muhammara.createWriter(output);
    var font = writer.getFontForFile(
      __dirname + "/TestMaterials/fonts/arial.ttf",
    );

    writer.writePage(writer.createPage(0, 0, 200, 200));

    var pathPage = writer.createPage(0, 0, 200, 200);
    writer.startPageContentContext(pathPage).re(20, 20, 40, 40).f();
    writer.writePage(pathPage);

    var textPage = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(textPage)
      .BT()
      .rg(1, 1, 1)
      .Tf(font, 12)
      .Tm(1, 0, 0, 1, 25, 50)
      .Tj("white text")
      .Tr(3)
      .Tj("invisible text")
      .ET();
    writer.writePage(textPage).end();

    var reader = muhammara.createReader(output);
    var emptyItems = reader.extractPageContentItems(0);
    var pathItems = reader.extractPageContentItems(1);
    var textItems = reader.extractPageContentItems(2);
    reader.end();

    assert.deepEqual(emptyItems, []);
    assert.deepEqual(pathItems, [
      { type: muhammara.ePDFPageContentItemPath, operation: "f" },
    ]);
    assert.deepEqual(textItems, [
      { type: muhammara.ePDFPageContentItemText, operation: "Tj" },
    ]);
  });

  it("enforces configurable extraction limits", function () {
    var output = __dirname + "/output/PDFPageContentItemsLimits.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 100, 100);
    writer
      .startPageContentContext(page)
      .re(10, 10, 20, 20)
      .f()
      .re(40, 40, 20, 20)
      .f();
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    assert.lengthOf(reader.extractPageContentItems(0), 2);
    assert.throws(function () {
      reader.extractPageContentItems(0, { maxElements: 1 });
    }, /extraction limits/);
    assert.throws(function () {
      reader.extractPageContentItems(0, { maxParsedObjects: 1 });
    }, /extraction limits/);
    reader.end();
  });

  it("clamps requested limits to the built-in ceilings", function () {
    var output = __dirname + "/output/PDFPageContentItemsClamp.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 100, 100);
    writer.startPageContentContext(page).re(10, 10, 20, 20).f();
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var expected = [
      { type: muhammara.ePDFPageContentItemPath, operation: "f" },
    ];
    // Above the ceiling is clamped down rather than honoured, so the security
    // backstop cannot be raised by a caller.
    assert.deepEqual(
      reader.extractPageContentItems(0, { maxElements: 0xffffffff }),
      expected,
    );
    assert.deepEqual(
      reader.extractPageContentItems(0, { maxTextBytes: 0xffffffff }),
      expected,
    );
    // Omitted and undefined limits keep the defaults.
    assert.deepEqual(reader.extractPageContentItems(0, {}), expected);
    assert.deepEqual(reader.extractPageContentItems(0, undefined), expected);
    reader.end();
  });

  it("rejects malformed limits", function () {
    var output = __dirname + "/output/PDFPageContentItemsInvalid.pdf";
    var writer = muhammara.createWriter(output);
    writer.writePage(writer.createPage(0, 0, 100, 100)).end();

    var reader = muhammara.createReader(output);
    [0, -1, 1.5, 0x100000000].forEach(function (value) {
      assert.throws(function () {
        reader.extractPageContentItems(0, { maxParsedObjects: value });
      }, /positive 32-bit integer/);
    });
    ["x", []].forEach(function (value) {
      assert.throws(function () {
        reader.extractPageContentItems(0, value);
      }, /Extraction limits must be an object/);
    });
    reader.end();
  });
});
