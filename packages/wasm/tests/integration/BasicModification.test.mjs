// Byte-first port of meaningful behavior from tests/BasicModification*.js,
// ModifyExistingPageContent.js, and BufferReadTest.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("BasicModification", function () {
  it("retains every context when a page modifier is resumed before writing", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    sourceWriter.writePage(sourceWriter.createPage(0, 0, 200, 200));
    var writer = muhammara.createWriterToModify(sourceWriter.end());
    var pageModifier = writer.createPageModifier(0, true);
    [1, 3, 5].forEach((x) => {
      pageModifier
        .startContext()
        .getContext()
        .m(x, x + 1)
        .l(10, 10)
        .S();
      pageModifier.endContext();
    });
    pageModifier.writePage();
    var reader = muhammara.createReader(writer.end());
    try {
      var resources = reader
        .queryDictionaryObject(reader.parsePage(0).getDictionary(), "Resources")
        .toPDFDictionary();
      var forms = reader
        .queryDictionaryObject(resources, "XObject")
        .toPDFDictionary();
      var streams = Object.keys(forms.toJSObject()).map((name) => {
        var input = reader.startReadingFromStream(
          reader.queryDictionaryObject(forms, name).toPDFStream(),
        );
        var bytes = [];
        while (input.notEnded()) bytes.push(...input.read(4096));
        return Buffer.from(bytes).toString("latin1");
      });
      assert.equal(streams.length, 3);
      [1, 3, 5].forEach((x) =>
        assert.match(
          streams.join("\n"),
          new RegExp(`(^|\\s)${x} ${x + 1} m\\b`),
        ),
      );
    } finally {
      reader.end();
    }
  });

  it("modifies, appends, and merges byte-backed PDFs", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    var sourcePage = new muhammara.PDFPage(0, 0, 200, 200);
    sourceWriter.startPageContentContext(sourcePage).re(10, 10, 20, 20).f();
    sourceWriter.writePage(sourcePage);
    var source = sourceWriter.end();

    muhammara.registerFont(
      "arial",
      new Uint8Array(
        await (
          await import("node:fs/promises")
        ).readFile("tests/TestMaterials/fonts/arial.ttf"),
      ),
    );

    var writer = muhammara.createWriterToModify(source);
    var appended = writer.createPage(0, 0, 300, 400);
    var font = writer.getFontForBytes("arial");
    writer
      .startPageContentContext(appended)
      .BT()
      .k(0, 0, 0, 1)
      .Tf(font, 14)
      .Tm(1, 0, 0, 1, 20, 300)
      .Tj("appended")
      .ET();
    writer.writePage(appended);

    var pageModifier = writer.createPageModifier(0);
    pageModifier.startContext().getContext().writeText("modified", 20, 100, {
      font,
      size: 14,
      colorspace: "gray",
      color: 0,
    });
    pageModifier.endContext().writePage();
    var modified = writer.end();
    var modifiedReader = muhammara.createReader(modified);
    assert.equal(modifiedReader.getPagesCount(), 2);
    assert.deepEqual(modifiedReader.getPageInfo(1).mediaBox, [0, 0, 300, 400]);
    modifiedReader.end();

    var copyWriter = muhammara.createWriterToModify(source);
    var copying = copyWriter.createPDFCopyingContext(modified);
    copying.appendPDFPagesFromPDF(0, 1).end();
    var copied = copyWriter.end();
    var copiedReader = muhammara.createReader(copied);
    assert.equal(copiedReader.getPagesCount(), 3);
    copiedReader.end();

    var mergeWriter = muhammara.createWriterToModify(source);
    var mergePage = mergeWriter.createPage(0, 0, 200, 200);
    var merging = mergeWriter.createPDFCopyingContext(source);
    merging.mergePDFPageToPage(mergePage, 0).end();
    mergeWriter.startPageContentContext(mergePage).q().Q();
    mergeWriter.writePage(mergePage);
    var merged = mergeWriter.end();
    var mergedReader = muhammara.createReader(merged);
    assert.equal(mergedReader.getPagesCount(), 2);
    mergedReader.end();

    assert.throws(
      () => muhammara.createWriterToModify(new ArrayBuffer(1)),
      /Unable to modify PDF/,
    );
    assert.throws(() => pageModifier.getContext(), /has ended/);
  });
});
