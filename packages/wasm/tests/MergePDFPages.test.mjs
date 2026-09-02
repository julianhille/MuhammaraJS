// Byte-first ports of tests/MergeToPDFForm.js, MergePDFPages.js, and
// AppendSpecialPagesTest.js. Browser callers provide source PDF bytes.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("MergePDFPages", function () {
  var muhammara;

  before(async function () {
    muhammara = await createMuhammaraWasm();
  });

  function sourcePdf(width, height) {
    var writer = muhammara.createWriter();
    for (var index = 0; index < 2; ++index) {
      var page = new muhammara.PDFPage(0, 0, width, height);
      writer
        .startPageContentContext(page)
        .q()
        .cm(1, 0, 0, 1, 10 + index * 20, 10)
        .re(0, 0, 20, 20)
        .f()
        .Q();
      writer.writePage(page);
    }
    return writer.end();
  }

  it("copies pages and forms from byte-backed PDFs", function () {
    var source = sourcePdf(200, 300);
    var formWriter = muhammara.createWriter();
    var formCopying = formWriter.createPDFCopyingContext(source);
    var mergedForm = formWriter.createFormXObject(0, 0, 100, 150);
    mergedForm.getContentContext().q().cm(0.5, 0, 0, 0.5, 0, 0);
    formCopying.mergePDFPageToFormXObject(mergedForm, 0);
    mergedForm.getContentContext().Q();
    formWriter.endFormXObject(mergedForm);
    var copiedForm = formCopying.createFormXObjectFromPDFPage(
      1,
      muhammara.ePDFPageBoxMediaBox,
    );
    assert.equal(typeof copiedForm, "number");
    assert.ok(copiedForm > 0);
    formCopying.end();
    var formPage = new muhammara.PDFPage(0, 0, 400, 300);
    formWriter
      .startPageContentContext(formPage)
      .q()
      .doXObject(mergedForm)
      .cm(1, 0, 0, 1, 200, 0)
      .doXObject(copiedForm)
      .Q();
    formWriter.writePage(formPage);
    var forms = formWriter.end();
    var formsReader = muhammara.createReader(forms);
    assert.equal(formsReader.getPagesCount(), 1);
    formsReader.end();

    var mergeWriter = muhammara.createWriter();
    var mergePage = new muhammara.PDFPage(0, 0, 400, 300);
    var mergeContext = mergeWriter
      .startPageContentContext(mergePage)
      .q()
      .cm(0.5, 0, 0, 0.5, 0, 0);
    var pageCopying = mergeWriter.createPDFCopyingContext(source);
    pageCopying.mergePDFPageToPage(mergePage, 0);
    mergeContext.Q().q().cm(0.5, 0, 0, 0.5, 200, 0);
    pageCopying.mergePDFPageToPage(mergePage, 1).end();
    mergeContext.Q();
    mergeWriter.writePage(mergePage);
    var merged = mergeWriter.end();
    var mergedReader = muhammara.createReader(merged);
    assert.equal(mergedReader.getPagesCount(), 1);
    mergedReader.end();

    var appendWriter = muhammara.createWriter();
    for (var bytes of [sourcePdf(100, 100), sourcePdf(120, 120), source]) {
      var copying = appendWriter.createPDFCopyingContext(bytes);
      copying.appendPDFPagesFromPDF(0, 1).end();
    }
    var appended = appendWriter.end();
    var appendedReader = muhammara.createReader(appended);
    assert.equal(appendedReader.getPagesCount(), 6);
    appendedReader.end();
  });

  it("returns copied IDs and accepts crop boxes and transformation matrices", function () {
    var source = sourcePdf(200, 300);
    var writer = muhammara.createWriter();
    var copying = writer.createPDFCopyingContext(source);
    var appendedId = copying.appendPDFPageFromPDF(0);
    var formId = copying.createFormXObjectFromPDFPage(
      1,
      [10, 20, 110, 170],
      [1, 0, 0, 1, 5, 6],
    );
    assert.ok(appendedId > 0);
    assert.ok(formId > 0);
    assert.throws(
      () => copying.createFormXObjectFromPDFPage(0, [0, 0, 10]),
      /page-box enum or four finite numbers/,
    );
    assert.throws(
      () => copying.createFormXObjectFromPDFPage(0, 0, [1, 0, 0]),
      /six finite numbers/,
    );
    copying.end();

    var page = writer.createPage(0, 0, 200, 300);
    writer.startPageContentContext(page).doXObject(formId);
    writer.writePage(page);
    var output = writer.end();
    var reader = muhammara.createReader(output);
    assert.equal(reader.getPagesCount(), 2);
    var form = reader.parseNewObject(formId).toPDFStream().getDictionary();
    assert.deepEqual(
      form
        .queryObject("BBox")
        .toPDFArray()
        .toJSArray()
        .map((value) => value.toNumber()),
      [10, 20, 110, 170],
    );
    assert.deepEqual(
      form
        .queryObject("Matrix")
        .toPDFArray()
        .toJSArray()
        .map((value) => value.toNumber()),
      [1, 0, 0, 1, 5, 6],
    );
    reader.end();
  });

  it("directly merges byte-backed pages before and during target content", function () {
    var source = sourcePdf(200, 300);
    var writer = muhammara.createWriter();
    var page = writer.createPage(0, 0, 400, 300);

    var callbacks = 0;
    assert.equal(
      writer.mergePDFPagesToPage(page, source, function () {
        callbacks += 1;
        writer.attachURLLinktoCurrentPage("https://example.com", 0, 0, 1, 1);
      }),
      writer,
    );
    assert.equal(callbacks, 1);
    var context = writer.startPageContentContext(page);
    context.q().cm(0.5, 0, 0, 0.5, 200, 0);
    assert.equal(
      writer.mergePDFPagesToPage(
        page,
        source,
        {
          type: muhammara.eRangeTypeSpecific,
          specificRanges: [[1, 1]],
        },
        function () {
          callbacks += 1;
        },
      ),
      writer,
    );
    assert.equal(callbacks, 2);
    context.Q().q().re(10, 10, 20, 20).f().Q();
    writer.writePage(page);

    var output = writer.end();
    var reader = muhammara.createReader(output);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });

  it("directly merges all and zero-based inclusive selected pages", function () {
    var source = sourcePdf(100, 100);
    var writer = muhammara.createWriter();
    var page = writer.createPage();
    writer.mergePDFPagesToPage(page, source, {
      type: muhammara.eRangeTypeSpecific,
      specificRanges: [
        [1, 1],
        [0, 0],
      ],
    });
    writer.writePage(page);
    var output = writer.end();
    var reader = muhammara.createReader(output);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();

    var allWriter = muhammara.createWriter();
    var allPage = allWriter.createPage();
    allWriter.mergePDFPagesToPage(allPage, source);
    allWriter.writePage(allPage);
    assert.ok(allWriter.end() instanceof Uint8Array);
  });

  it("propagates callback errors after a successful native merge", function () {
    var writer = muhammara.createWriter();
    var page = writer.createPage();
    assert.throws(
      () =>
        writer.mergePDFPagesToPage(page, sourcePdf(1), () => {
          throw new Error("callback failure");
        }),
      /callback failure/,
    );
    writer.writePage(page);
    var reader = muhammara.createReader(writer.end());
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });

  it("rejects an empty source", function () {
    var writer = muhammara.createWriter();
    var page = writer.createPage();
    assert.throws(
      () => writer.mergePDFPagesToPage(page, new Uint8Array()),
      /Unable to merge PDF pages/,
    );
  });

  it("accepts Blob through the direct merge async variant", async function () {
    var writer = muhammara.createWriter();
    var page = writer.createPage();
    assert.equal(
      await writer.mergePDFPagesToPageAsync(page, new Blob([sourcePdf(1)])),
      writer,
    );
    writer.writePage(page);
    assert.ok(writer.end() instanceof Uint8Array);
  });

  it("rejects invalid direct merge inputs and writer lifecycle", async function () {
    var writer = muhammara.createWriter();
    var page = writer.createPage();
    assert.throws(
      () => writer.mergePDFPagesToPage(page, new Uint8Array([1, 2, 3])),
      /Unable to merge PDF pages/,
    );
    assert.throws(
      () =>
        writer.mergePDFPagesToPage(page, sourcePdf(1), { password: "nope" }),
      /passwords are not supported/,
    );
    assert.throws(
      () => writer.mergePDFPagesToPage(page, sourcePdf(1), {}, true),
      /callback must be a function/,
    );
    assert.throws(
      () =>
        writer.mergePDFPagesToPage(page, sourcePdf(1), { callback: () => {} }),
      /callback must be provided as an argument/,
    );
    assert.throws(
      () => writer.mergePDFPagesToPage(page, "source.pdf"),
      /Uint8Array or ArrayBuffer/,
    );
    assert.throws(
      () => writer.mergePDFPagesToPage(page, { read: () => [] }),
      /Uint8Array or ArrayBuffer/,
    );
    assert.throws(
      () => writer.mergePDFPagesToPage(page, new Blob([sourcePdf(1)])),
      /Async API/,
    );
    assert.throws(
      () =>
        writer.mergePDFPagesToPage(page, sourcePdf(1), {
          type: muhammara.eRangeTypeSpecific,
          specificRanges: [],
        }),
      /specific page range/,
    );
    assert.throws(
      () =>
        writer.mergePDFPagesToPage(page, sourcePdf(1), {
          type: muhammara.eRangeTypeSpecific,
          specificRanges: [[1, 0]],
        }),
      /specificRanges/,
    );
    assert.throws(
      () =>
        writer.mergePDFPagesToPage(page, sourcePdf(1), {
          type: muhammara.eRangeTypeSpecific,
          specificRanges: [[1, 2]],
        }),
      /Unable to merge PDF pages/,
    );
    var protectedPdf = new Uint8Array(
      await readFile("tests/TestMaterials/Protected.pdf"),
    );
    assert.throws(
      () => writer.mergePDFPagesToPage(page, protectedPdf),
      /Encrypted PDF input/,
    );
    writer.writePage(page);

    var activePage = writer.createPage();
    writer.startPageContentContext(activePage);
    assert.throws(
      () => writer.mergePDFPagesToPage(page, sourcePdf(1)),
      /active target PDFPage/,
    );
    writer.writePage(activePage);
    writer.end();
    assert.throws(
      () => writer.mergePDFPagesToPage(page, sourcePdf(1)),
      /has ended/,
    );
  });
});
