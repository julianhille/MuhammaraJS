// Byte-first port of packages/native-with-source/tests/PDFPageContentItemsTest.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("PDFPageContentItems", function () {
  it("returns page-marking operations without relying on resources", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });

    writer.writePage(writer.createPage(0, 0, 200, 200));

    var pathPage = writer.createPage(0, 0, 200, 200);
    writer.startPageContentContext(pathPage).re(20, 20, 40, 40).f();
    writer.writePage(pathPage);

    var textPage = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(textPage)
      .writeFreeCode(
        "BT 1 1 1 rg /F1 12 Tf 1 0 0 1 25 50 Tm (white text) Tj 3 Tr (invisible text) Tj ET",
      );
    writer.writePage(textPage);

    var reader = muhammara.createReader(writer.end());
    var emptyItems = reader.extractPageContentItems(0);
    var pathItems = reader.extractPageContentItems(1);
    var textItems = reader.extractPageContentItems(2);
    reader.end();

    assert.deepEqual(emptyItems, []);
    assert.deepEqual(pathItems, [
      { type: muhammara.ePDFPageContentItemPath, operation: "f" },
    ]);
    // The white text is a page mark; the Tr 3 text is not rendered.
    assert.deepEqual(textItems, [
      { type: muhammara.ePDFPageContentItemText, operation: "Tj" },
    ]);
  });

  it("validates the page index", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(muhammara.createBlankPdf(20, 20));
    assert.throws(
      () => reader.extractPageContentItems(-1),
      /Page index must be a non-negative integer/,
    );
    assert.throws(
      () => reader.extractPageContentItems(1),
      /Unable to read page 1/,
    );
    reader.end();
  });

  it("enforces configurable extraction limits", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 100, 100);
    writer
      .startPageContentContext(page)
      .re(10, 10, 20, 20)
      .f()
      .re(40, 40, 20, 20)
      .f();
    writer.writePage(page);
    var reader = muhammara.createReader(writer.end());

    assert.equal(reader.extractPageContentItems(0).length, 2);
    assert.throws(
      () => reader.extractPageContentItems(0, { maxElements: 1 }),
      /extraction limits/,
    );
    assert.throws(
      () => reader.extractPageContentItems(0, { maxParsedObjects: 1 }),
      /extraction limits/,
    );
    for (var value of [0, -1, 1.5, 0x100000000]) {
      assert.throws(
        () => reader.extractPageContentItems(0, { maxParsedObjects: value }),
        /positive 32-bit integer/,
      );
    }
    reader.end();
  });

  it("clamps requested limits to the built-in ceilings", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 100, 100);
    writer.startPageContentContext(page).re(10, 10, 20, 20).f();
    writer.writePage(page);
    var reader = muhammara.createReader(writer.end());

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
    assert.deepEqual(reader.extractPageContentItems(0, {}), expected);
    reader.end();
  });
});
