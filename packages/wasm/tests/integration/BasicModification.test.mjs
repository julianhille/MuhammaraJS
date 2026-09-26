// Byte-first port of meaningful behavior from tests/BasicModification*.js,
// ModifyExistingPageContent.js, and BufferReadTest.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";
import { writeOutput } from "../testOutput.mjs";

describe("BasicModification", function () {
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
    writeOutput("BasicModification-modified", modified);
    var modifiedReader = muhammara.createReader(modified);
    assert.equal(modifiedReader.getPagesCount(), 2);
    assert.deepEqual(modifiedReader.getPageInfo(1).mediaBox, [0, 0, 300, 400]);
    modifiedReader.end();

    var copyWriter = muhammara.createWriterToModify(source);
    var copying = copyWriter.createPDFCopyingContext(modified);
    copying.appendPDFPagesFromPDF(0, 1).end();
    var copied = copyWriter.end();
    writeOutput("BasicModification-copied", copied);
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
    writeOutput("BasicModification-merged", merged);
    var mergedReader = muhammara.createReader(merged);
    assert.equal(mergedReader.getPagesCount(), 2);
    mergedReader.end();

    assert.throws(
      () => muhammara.createWriterToModify(new ArrayBuffer(1)),
      /Unable to modify PDF/,
    );
    assert.throws(() => pageModifier.getContext(), /has ended/);
  });

  // https://github.com/julianhille/MuhammaraJS/issues/324
  it("returns Uint8Array chunks from PDFRStreamForBuffer reads", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = new TextEncoder().encode("%PDF-1.7");
    var stream = new muhammara.PDFRStreamForBuffer(source);
    var bytes = stream.read(5);

    assert.ok(bytes instanceof Uint8Array);
    assert.equal(new TextDecoder().decode(bytes), "%PDF-");
    assert.equal(stream.getCurrentPosition(), 5);
    // The chunk is a copy; changing it must not change later reads.
    bytes[0] = 0;
    stream.setPosition(0);
    assert.equal(stream.read(1)[0], 0x25);
  });

  // https://github.com/julianhille/MuhammaraJS/issues/324
  it("joins PDFWStreamForBuffer chunks into its buffer on access", async function () {
    var muhammara = await createMuhammaraWasm();
    var encoder = new TextEncoder();
    var decoder = new TextDecoder();
    var stream = new muhammara.PDFWStreamForBuffer();

    assert.equal(stream.buffer.length, 0);
    assert.equal(stream.write(encoder.encode("ab")), 2);
    assert.equal(stream.write(new Uint8Array()), 0);
    assert.equal(stream.write(encoder.encode("cd").buffer), 2);
    assert.equal(decoder.decode(stream.buffer), "abcd");
    stream.write(encoder.encode("e"));
    assert.equal(decoder.decode(stream.toUint8Array()), "abcde");
    assert.equal(stream.getCurrentPosition(), 5);
    stream.buffer = encoder.encode("x");
    assert.equal(decoder.decode(stream.buffer), "x");
  });
});
