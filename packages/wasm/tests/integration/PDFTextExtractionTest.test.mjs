// Byte-first port of tests/PDFTextExtractionTest.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("PDFTextExtraction", function () {
  it("returns text operations and their active text state", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "BT /F1 12 Tf 1 0 0 1 25 50 Tm (first) Tj 1 0 0 1 25 75 Tm (second) Tj ET",
      );
    writer.writePage(page);

    var reader = muhammara.createReader(writer.end());
    var elements = reader.extractPageText(0);

    assert.deepEqual(
      elements.map((element) => element.content),
      ["first", "second"],
    );
    assert.equal(elements[0].fontResource, "F1");
    assert.equal(elements[0].fontSize, 12);
    assert.deepEqual(elements[0].textMatrix, [1, 0, 0, 1, 25, 50]);
    assert.deepEqual(elements[1].textMatrix, [1, 0, 0, 1, 25, 75]);

    reader.end();
    assert.throws(() => reader.extractPageText(0), /PDF reader has ended/);
  });

  it("validates the page index", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(muhammara.createBlankPdf(20, 20));
    assert.throws(
      () => reader.extractPageText(-1),
      /Page index must be a non-negative integer/,
    );
    assert.throws(() => reader.extractPageText(1), /Unable to read page 1/);
    reader.end();
  });

  it("enforces configurable extraction limits", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 100, 100);
    writer
      .startPageContentContext(page)
      .writeFreeCode("BT (first) Tj (second) Tj ET");
    writer.writePage(page);
    var reader = muhammara.createReader(writer.end());

    assert.throws(
      () => reader.extractPageText(0, { maxElements: 1 }),
      /extraction limits/,
    );
    assert.throws(
      () => reader.extractPageText(0, { maxTextBytes: 5 }),
      /extraction limits/,
    );
    for (var value of [0, -1, 1.5, 0x100000000]) {
      assert.throws(
        () => reader.extractPageText(0, { maxParsedObjects: value }),
        /positive 32-bit integer/,
      );
    }
    reader.end();
  });
});
