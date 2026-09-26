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
  it("writes arrays of byte values as native does", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var objects = writer.getObjectsContext();
    var literalId = objects.startNewIndirectObject();
    objects.writeLiteralString([0, 0x80, 0xff, 0x28]).endIndirectObject();
    var hexId = objects.startNewIndirectObject();
    objects.writeHexString([0, 0x80, 0xff]).endIndirectObject();
    var dictionaryId = objects.startNewIndirectObject();
    var dictionary = objects.startDictionary();
    dictionary.writeKey("L").writeLiteralStringValue([72, 105]);
    dictionary.writeKey("H").writeHexStringValue([0xca, 0xfe]);
    assert.throws(
      () => dictionary.writeLiteralStringValue([1.5]),
      /Literal string value bytes must be integers from 0 to 255/,
    );
    objects.endDictionary(dictionary).endIndirectObject();
    objects.startNewIndirectObject();
    assert.throws(
      () => objects.writeLiteralString([0, 256]),
      /Value bytes must be integers from 0 to 255/,
    );
    objects.writeNumber(0).endIndirectObject();

    var stream = new muhammara.PDFWStreamForBuffer();
    assert.equal(stream.write([1, 2, 3]), 3);
    assert.deepEqual(Array.from(stream.toUint8Array()), [1, 2, 3]);
    assert.throws(
      () => stream.write([-1]),
      /PDFWStreamForBuffer input bytes must be integers from 0 to 255/,
    );

    writer.writePage(new muhammara.PDFPage(0, 0, 100, 100));
    var reader = muhammara.createReader(writer.end());
    assert.deepEqual(
      Array.from(
        reader.parseNewObject(literalId).toPDFLiteralString().toBytesArray(),
      ),
      [0, 0x80, 0xff, 0x28],
    );
    assert.deepEqual(
      Array.from(reader.parseNewObject(hexId).toPDFHexString().toBytesArray()),
      [0, 0x80, 0xff],
    );
    var parsed = reader.parseNewObject(dictionaryId).toPDFDictionary();
    assert.equal(parsed.queryObject("L").toPDFLiteralString().toText(), "Hi");
    assert.deepEqual(
      Array.from(parsed.queryObject("H").toPDFHexString().toBytesArray()),
      [0xca, 0xfe],
    );
    reader.end();
  });
});
