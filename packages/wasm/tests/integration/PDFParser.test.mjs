// Byte-first ports of tests/PDFParser.js, ParseInfo.js, and
// SettingInfoValuesFromParsedContentTest.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("PDFParser", function () {
  it("parses byte-backed objects and reuses metadata", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    var sourceInfo = sourceWriter.getDocumentContext().getInfoDictionary();
    sourceInfo.author = "Gal Kahana";
    sourceInfo.creator = "PDFHummus";
    sourceInfo.setCreationDate("D:20140720204655+03'00'");
    var sourcePage = new muhammara.PDFPage(0, 0, 200, 200);
    sourcePage.cropBox = [1, 2, 190, 195];
    sourcePage.trimBox = [3, 4, 180, 185];
    sourcePage.bleedBox = [5, 6, 170, 175];
    sourcePage.artBox = [7, 8, 160, 165];
    sourcePage.rotate = 90;
    sourceWriter.startPageContentContext(sourcePage).re(10, 10, 20, 20).f();
    sourceWriter.writePage(sourcePage);
    var fallbackPage = new muhammara.PDFPage(10, 20, 210, 220);
    sourceWriter.startPageContentContext(fallbackPage);
    sourceWriter.writePage(fallbackPage);
    var source = sourceWriter.end();

    var reader = muhammara.createReader(source);
    assert.equal(reader.getPagesCount(), 2);
    var trailer = reader.getTrailer().toPDFDictionary();
    var infoReference = trailer
      .queryObject("Info")
      .toPDFIndirectObjectReference();
    assert.ok(infoReference.getObjectID() > 0);
    assert.equal(infoReference.getVersion(), 0);
    var info = reader.queryDictionaryObject(trailer, "Info").toPDFDictionary();
    assert.equal(info.queryObject("Author").value, "Gal Kahana");
    assert.equal(info.queryObject("Author").toText(), "Gal Kahana");
    assert.equal(info.queryObject("Creator").toText(), "PDFHummus");
    assert.equal(
      info.queryObject("CreationDate").value,
      "D:20140720204655+03'00'",
    );
    assert.deepEqual(Object.keys(info.toJSObject()).sort(), [
      "Author",
      "CreationDate",
      "Creator",
    ]);

    var page = reader.parsePageDictionary(0).toPDFDictionary();
    var mediaBox = reader.queryDictionaryObject(page, "MediaBox").toPDFArray();
    assert.equal(mediaBox.getLength(), 4);
    assert.deepEqual(
      mediaBox.toJSArray().map((value) => value.toNumber()),
      [0, 0, 200, 200],
    );
    var pageInput = reader.parsePage(0);
    assert.deepEqual(pageInput.getMediaBox(), [0, 0, 200, 200]);
    assert.deepEqual(pageInput.getCropBox(), [1, 2, 190, 195]);
    assert.deepEqual(pageInput.getTrimBox(), [3, 4, 180, 185]);
    assert.deepEqual(pageInput.getBleedBox(), [5, 6, 170, 175]);
    assert.deepEqual(pageInput.getArtBox(), [7, 8, 160, 165]);
    assert.equal(pageInput.getRotate(), 90);
    assert.deepEqual(
      pageInput
        .getDictionary()
        .toPDFDictionary()
        .queryObject("MediaBox")
        .toPDFArray()
        .toJSArray()
        .map((value) => value.toNumber()),
      [0, 0, 200, 200],
    );

    var fallbackPageInput = reader.parsePage(1);
    assert.deepEqual(fallbackPageInput.getMediaBox(), [10, 20, 210, 220]);
    assert.deepEqual(fallbackPageInput.getCropBox(), [10, 20, 210, 220]);
    assert.deepEqual(fallbackPageInput.getTrimBox(), [10, 20, 210, 220]);
    assert.deepEqual(fallbackPageInput.getBleedBox(), [10, 20, 210, 220]);
    assert.deepEqual(fallbackPageInput.getArtBox(), [10, 20, 210, 220]);
    assert.equal(fallbackPageInput.getRotate(), 0);
    assert.throws(() => reader.parsePage(-1), /non-negative integer/);
    assert.throws(() => reader.parsePage(2), /Unable to read page 2/);
    var contents = reader.queryDictionaryObject(page, "Contents").toPDFStream();
    assert.ok(contents.getStreamContentStart() >= 0);
    assert.equal(
      reader
        .queryDictionaryObject(contents.getDictionary(), "Length")
        .toNumber() > 0,
      true,
    );
    var objectParser = reader.startReadingObjectsFromStream(contents);
    assert.equal(objectParser.parseNewObject().toNumber(), 10);
    assert.equal(objectParser.parseNewObject().toNumber(), 10);
    assert.equal(objectParser.parseNewObject().toNumber(), 20);
    assert.equal(objectParser.parseNewObject().toNumber(), 20);
    assert.equal(objectParser.parseNewObject().toString(), "re");
    objectParser.end();
    assert.throws(() => objectParser.parseNewObject(), /has ended/);

    var copyWriter = muhammara.createWriter();
    var copyInfo = copyWriter.getDocumentContext().getInfoDictionary();
    copyInfo.author = info.queryObject("Author").toText();
    copyInfo.creator = info.queryObject("Creator").toText();
    copyInfo.setCreationDate(info.queryObject("CreationDate").value);
    var copyPage = new muhammara.PDFPage(0, 0, 100, 100);
    copyWriter.startPageContentContext(copyPage);
    copyWriter.writePage(copyPage);
    var copied = copyWriter.end();
    reader.end();
    assert.throws(() => info.queryObject("Author"), /has ended/);
    assert.throws(() => pageInput.getMediaBox(), /PDF reader has ended/);
    assert.throws(
      () => fallbackPageInput.getDictionary(),
      /PDF reader has ended/,
    );

    var copiedReader = muhammara.createReader(copied);
    var copiedInfo = copiedReader
      .queryDictionaryObject(copiedReader.getTrailer(), "Info")
      .toPDFDictionary();
    assert.equal(copiedInfo.queryObject("Author").toText(), "Gal Kahana");
    assert.equal(copiedInfo.queryObject("Creator").toText(), "PDFHummus");
    assert.equal(
      copiedInfo.queryObject("CreationDate").value,
      "D:20140720204655+03'00'",
    );
    copiedReader.end();
  });
});
