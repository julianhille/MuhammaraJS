// Byte-first port of tests/AppendSpecialPagesTest.js direct writer append behavior.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("AppendPagesTest", function () {
  var muhammara;

  before(async function () {
    muhammara = await createMuhammaraWasm();
  });

  function sourcePdf(pageCount) {
    var writer = muhammara.createWriter();
    for (var index = 0; index < pageCount; ++index) {
      var page = writer.createPage(0, 0, 100 + index, 200 + index);
      writer.startPageContentContext(page).q().Q();
      writer.writePage(page);
    }
    return writer.end();
  }

  it("appends all pages and zero-based inclusive ranges, returning page IDs", function () {
    var source = sourcePdf(4);
    var writer = muhammara.createWriter();
    var allIds = writer.appendPDFPagesFromPDF(source);
    var rangeIds = writer.appendPDFPagesFromPDF(source, {
      type: muhammara.eRangeTypeSpecific,
      specificRanges: [
        [1, 2],
        [0, 0],
      ],
    });
    assert.equal(allIds.length, 4);
    assert.equal(rangeIds.length, 3);
    assert.ok([...allIds, ...rangeIds].every((id) => id > 0));
    var output = writer.end();
    var reader = muhammara.createReader(output);
    assert.equal(reader.getPagesCount(), 7);
    assert.deepEqual(
      Array.from({ length: 7 }, (_, index) => reader.getPageObjectID(index)),
      [...allIds, ...rangeIds],
    );
    reader.end();
  });

  it("accepts Blob through the async variant", async function () {
    var writer = muhammara.createWriter();
    var ids = await writer.appendPDFPagesFromPDFAsync(new Blob([sourcePdf(1)]));
    assert.equal(ids.length, 1);
    assert.ok(writer.end() instanceof Uint8Array);
  });

  it("rejects malformed, encrypted, invalid, active, and ended writer inputs", async function () {
    var writer = muhammara.createWriter();
    assert.throws(
      () => writer.appendPDFPagesFromPDF(new Uint8Array([1, 2, 3])),
      /Unable to append PDF pages/,
    );
    assert.throws(
      () => writer.appendPDFPagesFromPDF(sourcePdf(1), { password: "nope" }),
      /passwords are not supported/,
    );
    assert.throws(
      () =>
        writer.appendPDFPagesFromPDF(sourcePdf(1), {
          type: muhammara.eRangeTypeSpecific,
          specificRanges: [[1, 0]],
        }),
      /specificRanges/,
    );
    assert.throws(
      () => writer.appendPDFPagesFromPDF(new Blob([sourcePdf(1)])),
      /Async API/,
    );
    var protectedPdf = new Uint8Array(
      await readFile("tests/TestMaterials/Protected.pdf"),
    );
    assert.throws(
      () => writer.appendPDFPagesFromPDF(protectedPdf),
      /Encrypted PDF input/,
    );
    var page = writer.createPage();
    writer.startPageContentContext(page);
    assert.throws(
      () => writer.appendPDFPagesFromPDF(sourcePdf(1)),
      /active page/,
    );
    writer.writePage(page);
    writer.end();
    assert.throws(
      () => writer.appendPDFPagesFromPDF(sourcePdf(1)),
      /has ended/,
    );
  });
});
