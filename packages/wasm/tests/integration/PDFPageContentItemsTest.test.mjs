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

  it("classifies xobject, shading, and non-painting operations", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 200, 200);

    // Names are not resolved against the resource dictionary, so the operators
    // alone decide. "n" ends a path without painting and "W" only clips, so
    // neither marks the page.
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "/Fx1 Do /Sh1 sh 10 10 20 20 re n 30 30 40 40 re W n 50 50 10 10 re f",
      );
    writer.writePage(page);

    var reader = muhammara.createReader(writer.end());
    var items = reader.extractPageContentItems(0);
    reader.end();

    assert.deepEqual(items, [
      { type: muhammara.ePDFPageContentItemXObject, operation: "Do" },
      { type: muhammara.ePDFPageContentItemShading, operation: "sh" },
      { type: muhammara.ePDFPageContentItemPath, operation: "f" },
    ]);
  });

  it("reports an inline image and skips its binary payload", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 200, 200);

    // The payload deliberately contains bytes that lex as painting operators
    // ("f", "S") and an "EI" that is not delimited by whitespace. Neither may
    // produce an item, and neither may end the image early.
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "BI /W 4 /H 1 /BPC 8 /CS /G ID \x66\x53xEIy\x42\x49 EI Q 10 10 20 20 re f",
      );
    writer.writePage(page);

    var reader = muhammara.createReader(writer.end());
    var items = reader.extractPageContentItems(0);
    reader.end();

    assert.deepEqual(items, [
      { type: muhammara.ePDFPageContentItemXObject, operation: "BI" },
      { type: muhammara.ePDFPageContentItemPath, operation: "f" },
    ]);
  });

  it("restores the text rendering mode saved by q and Q", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 200, 200);

    // Tr 3 inside q/Q must not leak past the Q that restores it.
    writer
      .startPageContentContext(page)
      .writeFreeCode("BT /F1 12 Tf q 3 Tr (hidden) Tj Q (visible) Tj ET");
    writer.writePage(page);

    var reader = muhammara.createReader(writer.end());
    var items = reader.extractPageContentItems(0);
    reader.end();

    assert.deepEqual(items, [
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
