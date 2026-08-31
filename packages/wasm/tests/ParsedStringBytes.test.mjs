// Byte-first coverage for PDFLiteralString/PDFHexString.toBytesArray().
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("Parsed string bytes", function () {
  it("preserves decoded literal and hex bytes independently of text conversion", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var objects = writer.getObjectsContext();
    var literalId = objects.startNewIndirectObject();
    objects
      .writeLiteralString(new Uint8Array([0, 0x80, 0xff, 0x28, 0x29, 0x5c]))
      .endIndirectObject();
    var hexId = objects.startNewIndirectObject();
    objects.writeHexString(new Uint8Array([0, 0x80, 0xff])).endIndirectObject();

    var page = new muhammara.PDFPage(0, 0, 100, 100);
    writer
      .startPageContentContext(page)
      .writeFreeCode("(\\000\\200\\377\\(\\)\\\\) <0080ff0>");
    writer.writePage(page);
    var reader = muhammara.createReader(writer.end());

    var literal = reader.parseNewObject(literalId).toPDFLiteralString();
    var hex = reader.parseNewObject(hexId).toPDFHexString();
    assert.ok(literal);
    assert.ok(hex);
    assert.ok(literal.toBytesArray() instanceof Uint8Array);
    assert.deepEqual(
      Array.from(literal.toBytesArray()),
      [0, 0x80, 0xff, 40, 41, 92],
    );
    assert.deepEqual(Array.from(hex.toBytesArray()), [0, 0x80, 0xff]);
    assert.equal(
      literal.toText(),
      new muhammara.PDFTextString(literal.toBytesArray()).toString(),
    );
    assert.equal(
      hex.toText(),
      new muhammara.PDFTextString(hex.toBytesArray()).toString(),
    );
    assert.equal(reader.getTrailer().toPDFDictionary().toBytesArray, undefined);

    var stream = reader
      .queryDictionaryObject(reader.parsePageDictionary(0), "Contents")
      .toPDFStream();
    var parser = reader.startReadingObjectsFromStream(stream);
    var escapedLiteral = parser.parseNewObject().toPDFLiteralString();
    var oddHex = parser.parseNewObject().toPDFHexString();
    assert.deepEqual(
      Array.from(escapedLiteral.toBytesArray()),
      [0, 0x80, 0xff, 40, 41, 92],
    );
    assert.deepEqual(Array.from(oddHex.toBytesArray()), [0, 0x80, 0xff, 0]);
    parser.end();
    assert.throws(
      () => escapedLiteral.toBytesArray(),
      /PDF object parser has ended/,
    );

    reader.end();
    assert.throws(() => literal.toBytesArray(), /PDF reader has ended/);
  });
});
