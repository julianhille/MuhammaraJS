// Byte-first port of the failure behavior in tests/PDFCopyingContextTest.js.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createMuhammaraWasm } from "../index.js";
import * as malformed from "../malformedInputs.mjs";

describe("PDFCopyingContextTest", function () {
  var muhammara;

  before(async function () {
    muhammara = await createMuhammaraWasm();
  });

  it("keeps the writer usable after a page fails to copy into a form", function () {
    var source = malformed.pdfWith([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>",
      "<< /Length 5 /Filter /NoSuchFilter >>\nstream\nhello\nendstream",
    ]);
    var writer = muhammara.createWriter();
    var copying = writer.createPDFCopyingContext(source);
    // The failed form used to delete the writer's own output stream.
    assert.throws(() =>
      copying.createFormXObjectFromPDFPage(0, muhammara.ePDFPageBoxMediaBox),
    );
    var page = writer.createPage(0, 0, 200, 200);
    writer.startPageContentContext(page).q().Q();
    writer.writePage(page);
    var pdf = writer.end();
    var reader = muhammara.createReader(pdf);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });

  // Array items and dictionary values are borrowed. Casting them with
  // PDFObjectCastPtr released the item when its type didn't match.
  describe("a page whose /Contents array holds a non-reference", function () {
    var source = malformed.pdfWith([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents [5] >>",
    ]);

    /**
     * Runs `action` on a copying context of the source and expects a throw.
     * @param {Function} action - Receives the writer and copying context.
     */
    function copy(action) {
      var writer = muhammara.createWriter();
      var copying = writer.createPDFCopyingContext(source);
      assert.throws(() => action(writer, copying));
      writer.dispose();
    }

    it("fails to become a form", function () {
      copy((writer, copying) =>
        copying.createFormXObjectFromPDFPage(0, muhammara.ePDFPageBoxMediaBox),
      );
    });

    it("fails to merge into a page", function () {
      copy((writer, copying) =>
        copying.mergePDFPageToPage(writer.createPage(0, 0, 200, 200), 0),
      );
    });

    it("fails to be appended", function () {
      copy((writer, copying) => copying.appendPDFPageFromPDF(0));
    });
  });

  it("aborts a copy whose stream dictionary cannot be copied", function () {
    var writer = muhammara.createWriter();
    var copying = writer.createPDFCopyingContext(
      fs.readFileSync(
        path.join(malformed.fuzzInputs, "copy-stream-dictionary-fails.bin"),
      ),
    );
    // The stream's dictionary used to stay open and leak with the writer.
    assert.throws(() => copying.copyObject(2));
    // The half-written object cannot be finished, so the document cannot end.
    assert.throws(() => writer.end());
    writer.dispose();
  });
});
