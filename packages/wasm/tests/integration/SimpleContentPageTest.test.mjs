// Port of the creation behavior in tests/SimpleContentPageTest.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("SimpleContentPageTest", function () {
  it("creates a low-level content page", async function () {
    var muhammara = await createMuhammaraWasm();
    var page = new muhammara.PDFPage(10, 20, 605, 862);
    var writer = muhammara.createWriter();
    var context = writer.startPageContentContext(page);

    assert.equal(context.getAssociatedPage(), page);

    assert.equal(
      context.q().k(100, 0, 0, 0).re(100, 500, 100, 100).f().Q(),
      context,
    );
    assert.equal(writer.pausePageContentContext(context), writer);
    assert.equal(
      context.q().k(0, 100, 100, 0).re(200, 600, 200, 100).f().Q(),
      context,
    );
    assert.equal(
      context.q().G(0.5).w(3).m(200, 600).l(400, 400).S().Q(),
      context,
    );
    assert.equal(
      context
        .q()
        .g(0.2)
        .RG(1, 0, 0)
        .K(0, 1, 1, 0)
        .J(1)
        .j(2)
        .M(5)
        .d([3, 2], 1)
        .cm(1, 0, 0, 1, 5, 5)
        .m(20, 20)
        .c(30, 40, 50, 40, 60, 20)
        .v(70, 0, 80, 20)
        .y(90, 40, 100, 20)
        .h()
        .b()
        .re(10, 10, 30, 30)
        .W()
        .n()
        .re(40, 10, 30, 30)
        .WStar()
        .fStar()
        .Q(),
      context,
    );
    var firstPageObjectId = writer.writePageAndReturnID(page);
    assert.ok(firstPageObjectId > 0);
    assert.throws(() => context.q(), /not active/);

    var secondPageObjectId = writer.writePageAndReturnID(page);
    assert.ok(secondPageObjectId > 0);
    assert.notEqual(secondPageObjectId, firstPageObjectId);

    var pdf = writer.end();
    assert.ok(pdf instanceof Uint8Array);
    assert.equal(new TextDecoder().decode(pdf.slice(0, 8)), "%PDF-1.4");
    var text = new TextDecoder().decode(pdf);
    assert.match(text, /%%EOF/);
    assert.match(text, /\/Contents \[ \d+ 0 R \d+ 0 R \]/);

    var reader = muhammara.createReader(pdf);
    assert.equal(reader.getPagesCount(), 2);
    assert.equal(reader.getPageObjectID(0), firstPageObjectId);
    assert.equal(reader.getPageObjectID(1), secondPageObjectId);
    assert.deepEqual(reader.getPageInfo(0).mediaBox, [10, 20, 605, 862]);
    var pageDictionary = reader.parsePageDictionary(0).toPDFDictionary();
    var contents = reader
      .queryDictionaryObject(pageDictionary, "Contents")
      .toPDFArray();
    assert.equal(contents.getLength(), 2);
    var parser = reader.startReadingObjectsFromStreams(contents);
    assert.deepEqual(
      Array.from({ length: 15 }, () => parser.parseNewObject().toString()),
      [
        "q",
        "100",
        "0",
        "0",
        "0",
        "k",
        "100",
        "500",
        "100",
        "100",
        "re",
        "f",
        "Q",
        "q",
        "0",
      ],
    );
    parser.end();
    parser.end();
    assert.throws(() => parser.parseNewObject(), /has ended/);
    assert.throws(
      () => reader.startReadingObjectsFromStreams(pageDictionary),
      /reader-owned PDF array/,
    );
    var foreignReader = muhammara.createReader(pdf);
    var foreignContents = foreignReader
      .queryDictionaryObject(
        foreignReader.parsePageDictionary(0).toPDFDictionary(),
        "Contents",
      )
      .toPDFArray();
    assert.throws(
      () => reader.startReadingObjectsFromStreams(foreignContents),
      /reader-owned PDF array/,
    );
    foreignReader.end();
    assert.throws(
      () => reader.startReadingObjectsFromStreams(foreignContents),
      /reader-owned PDF array/,
    );
    var liveParser = reader.startReadingObjectsFromStreams(contents);
    reader.end();
    assert.throws(() => liveParser.parseNewObject(), /PDF reader has ended/);
    assert.throws(
      () => reader.startReadingObjectsFromStreams(contents),
      /PDF reader has ended/,
    );

    assert.throws(() => new muhammara.PDFPage(0, 0, 0, 10), RangeError);

    var invalidWriter = muhammara.createWriter();
    var activePage = invalidWriter.createPage();
    var otherPage = invalidWriter.createPage();
    assert.throws(
      () => invalidWriter.writePageAndReturnID({}),
      /active PDFPage/,
    );
    invalidWriter.startPageContentContext(activePage);
    assert.throws(
      () => invalidWriter.writePageAndReturnID(otherPage),
      /active PDFPage/,
    );
    invalidWriter.writePageAndReturnID(activePage);
    invalidWriter.end();
    assert.throws(
      () => invalidWriter.writePageAndReturnID(activePage),
      /writer has ended/,
    );
  });
});
