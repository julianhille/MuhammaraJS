// Byte-first ports of tests/security/GHSA-*.js and GH-518.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";

var encoder = new TextEncoder();

function joinBytes(parts) {
  var length = parts.reduce((total, part) => total + part.length, 0);
  var result = new Uint8Array(length);
  var offset = 0;
  for (var part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function text(value) {
  return encoder.encode(value);
}

function buildStreamPdf(filter, decodeParms, payload) {
  var header = "%PDF-1.4\n";
  var objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n",
  ];
  var streamHeader = `4 0 obj\n<< /Filter /${filter}${decodeParms} /Length ${payload.length} >>\nstream\n`;
  var streamTail = "\nendstream\nendobj\n";
  var position = header.length;
  var offsets = objects.map((object) => {
    var offset = position;
    position += object.length;
    return offset;
  });
  offsets.push(position);
  var xrefPosition =
    position + streamHeader.length + payload.length + streamTail.length;
  var formatOffset = (offset) => String(offset).padStart(10, "0");
  var xref = `xref\n0 5\n0000000000 65535 f \n${offsets.map((offset) => `${formatOffset(offset)} 00000 n \n`).join("")}`;
  var trailer = `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;
  return joinBytes([
    text(header),
    ...objects.map(text),
    text(streamHeader),
    payload,
    text(streamTail),
    text(xref),
    text(trailer),
  ]);
}

function readStreamWithoutCrash(muhammara, bytes) {
  var reader = muhammara.createReader(bytes);
  try {
    var stream = reader.parseNewObject(4).toPDFStream();
    var streamReader = reader.startReadingFromStream(stream);
    assert.doesNotThrow(() => streamReader.read(1024));
    assert.doesNotThrow(() => reader.startReadingObjectsFromStream(stream));
  } finally {
    reader.end();
  }
}

describe("parser security regressions", function () {
  it("handles malformed filter streams and bounded input", async function () {
    var muhammara = await createMuhammaraWasm();
    assert.throws(() => muhammara.createReader(new Uint8Array([1, 2, 3])));
    readStreamWithoutCrash(
      muhammara,
      buildStreamPdf(
        "LZWDecode",
        "\n   /DecodeParms << >>",
        new Uint8Array([0x80, 0x0b, 0x60]),
      ),
    );
    readStreamWithoutCrash(
      muhammara,
      buildStreamPdf("Crypt", "", new Uint8Array([0])),
    );
    readStreamWithoutCrash(
      muhammara,
      buildStreamPdf("Crypt", " /DecodeParms << >>", new Uint8Array([0])),
    );

    var safeInput = muhammara.createBlankPdf(100, 100);
    var bounded = new muhammara.PDFRStreamForBuffer(safeInput);
    assert.equal(bounded.read(safeInput.length).length, safeInput.length);
    assert.equal(bounded.read(1).length, 0);
    var safeReader = muhammara.createReader(safeInput);
    assert.equal(safeReader.getPagesCount(), 1);
    safeReader.end();
  });
});
