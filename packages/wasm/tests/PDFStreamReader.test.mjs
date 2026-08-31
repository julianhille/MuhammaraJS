// Byte-first port of PDFReader.startReadingFromStream behavior.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

var encoder = new TextEncoder();
var decodedBytes = encoder.encode("decoded flate bytes");
var flateBytes = new Uint8Array([
  120, 156, 75, 73, 77, 206, 79, 73, 77, 81, 72, 203, 73, 44, 73, 85, 72, 170,
  44, 73, 45, 6, 0, 71, 159, 7, 60,
]);

function text(value) {
  return encoder.encode(value);
}

function joinBytes(parts) {
  var result = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 0),
  );
  var offset = 0;
  for (var part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function buildFlatePdf() {
  var header = "%PDF-1.4\n";
  var objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] /Contents 4 0 R >>\nendobj\n",
  ];
  var streamHeader = `4 0 obj\n<< /Filter /FlateDecode /Length ${flateBytes.length} >>\nstream\n`;
  var streamTail = "\nendstream\nendobj\n";
  var position = header.length;
  var offsets = objects.map((object) => {
    var offset = position;
    position += object.length;
    return offset;
  });
  offsets.push(position);
  var xrefPosition =
    position + streamHeader.length + flateBytes.length + streamTail.length;
  var xref = `xref\n0 5\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  return joinBytes([
    text(header),
    ...objects.map(text),
    text(streamHeader),
    flateBytes,
    text(streamTail),
    text(xref),
    text(
      `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`,
    ),
  ]);
}

describe("PDFReader stream byte readers", function () {
  it("provides a reader-owned random-access parser byte handle", async function () {
    var muhammara = await createMuhammaraWasm();
    var bytes = buildFlatePdf();
    var reader = muhammara.createReader(bytes);
    var parserStream = reader.getParserStream();

    parserStream.setPosition(0);
    assert.equal(parserStream.getCurrentPosition(), 0);
    assert.deepEqual(parserStream.read(5), Array.from(text("%PDF-")));
    assert.equal(parserStream.getCurrentPosition(), 5);
    parserStream.skip(2);
    assert.equal(parserStream.getCurrentPosition(), 7);
    parserStream.setPositionFromEnd(0);
    assert.equal(parserStream.getCurrentPosition(), bytes.length);
    assert.deepEqual(parserStream.read(1), []);
    assert.equal(parserStream.notEnded(), false);
    parserStream.setPositionFromEnd(5);
    assert.deepEqual(parserStream.read(5), Array.from(text("%%EOF")));
    assert.equal(parserStream.notEnded(), false);
    assert.throws(() => parserStream.setPosition(-1), /non-negative integer/);
    assert.throws(() => parserStream.skip(-1), /non-negative integer/);

    reader.end();
    assert.throws(() => parserStream.read(1), /PDF reader has ended/);
    assert.throws(() => parserStream.notEnded(), /PDF reader has ended/);
    assert.throws(() => parserStream.setPosition(0), /PDF reader has ended/);
    assert.throws(
      () => parserStream.setPositionFromEnd(0),
      /PDF reader has ended/,
    );
    assert.throws(() => parserStream.skip(0), /PDF reader has ended/);
    assert.throws(
      () => parserStream.getCurrentPosition(),
      /PDF reader has ended/,
    );
  });

  it("reads decoded and plain Flate stream bytes", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(buildFlatePdf());
    var stream = reader.parseNewObject(4).toPDFStream();
    var decoded = reader.startReadingFromStream(stream);

    assert.deepEqual(decoded.read(7), Array.from(decodedBytes.slice(0, 7)));
    assert.equal(decoded.notEnded(), true);
    assert.deepEqual(decoded.read(100), Array.from(decodedBytes.slice(7)));
    assert.equal(decoded.notEnded(), false);
    assert.deepEqual(decoded.read(1), []);

    var plain = reader.startReadingFromStreamForPlainCopying(stream);
    assert.deepEqual(plain.read(100), Array.from(flateBytes));
    assert.equal(plain.notEnded(), false);
    assert.deepEqual(plain.read(1), []);
    reader.end();
  });

  it("rejects invalid, foreign, and ended stream inputs", async function () {
    var muhammara = await createMuhammaraWasm();
    var bytes = buildFlatePdf();
    var reader = muhammara.createReader(bytes);
    var stream = reader.parseNewObject(4).toPDFStream();
    var foreignReader = muhammara.createReader(bytes);
    var foreignStream = foreignReader.parseNewObject(4).toPDFStream();

    assert.throws(
      () => reader.startReadingFromStream(stream.getDictionary()),
      /reader-owned PDF stream input/,
    );
    assert.throws(
      () => reader.startReadingFromStream(foreignStream),
      /reader-owned PDF stream input/,
    );
    assert.throws(
      () => reader.startReadingObjectsFromStream(foreignStream),
      /reader-owned PDF stream input/,
    );
    assert.throws(
      () => reader.startReadingFromStream({}),
      /reader-owned PDF stream input/,
    );
    var streamReader = reader.startReadingFromStream(stream);
    assert.throws(() => streamReader.read(-1), /non-negative integer/);
    reader.end();
    assert.throws(() => streamReader.read(1), /PDF reader has ended/);
    assert.throws(() => streamReader.notEnded(), /PDF reader has ended/);
    assert.throws(
      () => reader.startReadingFromStream(stream),
      /PDF reader has ended/,
    );
    foreignReader.end();
  });
});
