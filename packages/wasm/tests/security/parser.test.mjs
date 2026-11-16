// Byte-first ports of tests/security/GHSA-*.js, GH-518.js and GH-917.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../../index.js";
import { writeOutput } from "../testOutput.mjs";

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

/**
 * Builds a one-page PDF whose content stream uses the given filter.
 *
 * @param {string} filter - The stream's /Filter value, e.g. "/Crypt".
 * @param {string} decodeParms - Extra stream dictionary entries, or "".
 * @param {Uint8Array} payload - The raw stream data.
 * @returns {Uint8Array} The PDF bytes.
 */
function buildStreamPdf(filter, decodeParms, payload) {
  var header = "%PDF-1.4\n";
  var objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n",
  ];
  var streamHeader = `4 0 obj\n<< /Filter ${filter}${decodeParms} /Length ${payload.length} >>\nstream\n`;
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
        "/LZWDecode",
        "\n   /DecodeParms << >>",
        new Uint8Array([0x80, 0x0b, 0x60]),
      ),
    );
    readStreamWithoutCrash(
      muhammara,
      buildStreamPdf("/Crypt", "", new Uint8Array([0])),
    );
    readStreamWithoutCrash(
      muhammara,
      buildStreamPdf("/Crypt", " /DecodeParms << >>", new Uint8Array([0])),
    );
    // GHSA-q3f9-hvrq-7wwh: the same streams in an encrypted document.
    for (var [filter, decodeParms] of [
      ["/Crypt", " /DecodeParms << >>"],
      ["[/Crypt]", " /DecodeParms [<< >>]"],
    ]) {
      var encrypted = muhammara.recrypt(
        buildStreamPdf(filter, decodeParms, new Uint8Array([0])),
        { userPassword: "", ownerPassword: "owner", userProtectionFlag: 4 },
      );
      readStreamWithoutCrash(muhammara, encrypted);
    }

    var safeInput = muhammara.createBlankPdf(100, 100);
    writeOutput("parser-bounded-input", safeInput);
    var bounded = new muhammara.PDFRStreamForBuffer(safeInput);
    assert.equal(bounded.read(safeInput.length).length, safeInput.length);
    assert.equal(bounded.read(1).length, 0);
    var safeReader = muhammara.createReader(safeInput);
    assert.equal(safeReader.getPagesCount(), 1);
    safeReader.end();
  });

  // Port of tests/security/TruncatedInput.js.
  it("either parses or rejects every sampled truncation cleanly", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = await readFile("tests/TestMaterials/Original.pdf");
    var offsets = new Set([1, source.length - 1]);
    var originalReader = muhammara.createReader(source);
    var originalPageCount;

    try {
      originalPageCount = originalReader.getPagesCount();
    } finally {
      originalReader.end();
    }

    for (var offset = 1024; offset < source.length; offset += 1024)
      offsets.add(offset);

    offsets.forEach(function (offset) {
      var reader;
      try {
        reader = muhammara.createReader(source.subarray(0, offset));
      } catch (error) {
        assert.match(
          error.message,
          /Unable to parse PDF/,
          `Unexpected error at truncation offset ${offset}`,
        );
        return;
      }

      try {
        assert.equal(
          reader.getPagesCount(),
          originalPageCount,
          `Unexpected page count at truncation offset ${offset}`,
        );
      } finally {
        reader.end();
      }
    });
  });
  // Port of tests/security/GH-917.js.
  it("rejects an object stream count larger than the xref table", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = await readFile(
      "tests/TestMaterials/ObjectStreamHugeCount.pdf",
    );

    assert.throws(() => muhammara.createReader(source), /Unable to parse PDF/);
    assert.throws(() => muhammara.recrypt(source), /Unable to recrypt PDF/);
    await assert.rejects(
      muhammara.recryptAsync(source),
      /Unable to recrypt PDF/,
    );
    assert.throws(
      () => muhammara.createWriterToModify(source),
      /Unable to modify PDF/,
    );

    // The instance was not aborted and still parses a valid PDF.
    var reader = muhammara.createReader(
      await readFile("tests/TestMaterials/Original.pdf"),
    );
    try {
      assert.ok(reader.getPagesCount() > 0);
    } finally {
      reader.end();
    }
  });
  // Port of tests/security/GHSA-f2qr-8r8j-mm94.js.
  it("decodes a text string that is only a UTF-16BE byte order mark to an empty string", async function () {
    var muhammara = await createMuhammaraWasm();
    assert.equal(new muhammara.PDFTextString([0xfe, 0xff]).toString(), "");

    var reader = muhammara.createReader(
      await readFile("tests/TestMaterials/BOMOnlyTextString.pdf"),
    );
    try {
      var info = reader.parseNewObject(4).toJSObject();
      assert.equal(info.Title.toText(), "");
      assert.equal(info.Subject.toText(), "");
    } finally {
      reader.end();
    }
  });
  // Port of tests/security/GHSA-8j62-hp3j-vp33.js.
  it("rejects more null Kids entries than the page tree Count", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = await readFile("tests/TestMaterials/NullKidsOverCount.pdf");

    assert.throws(() => muhammara.createReader(source), /Unable to parse PDF/);
  });
  // Port of tests/security/GHSA-5pp7-hx79-5mm2.js.
  it("ends a TIFF predictor stream whose row size overflows", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      await readFile("tests/TestMaterials/TIFFPredictorOverflow.pdf"),
    );
    try {
      var stream = reader.startReadingFromStream(
        reader.parseNewObject(3).toPDFStream(),
      );

      assert.deepEqual(stream.read(65536), new Uint8Array());
      assert.equal(stream.notEnded(), false);
    } finally {
      reader.end();
    }
  });
  // Port of tests/security/GHSA-6qj6-hc67-3vfp.js.
  [
    ["RC4 (/V 2)", "RC4XrefAtString.pdf"],
    ["an RC4 crypt filter (/V 4)", "RC4CryptFilterXrefAtString.pdf"],
    ["an AESV2 crypt filter (/V 4)", "AESXrefAtString.pdf"],
  ].forEach(function ([name, file]) {
    it(`fails objects that start with a string under ${name}`, async function () {
      var muhammara = await createMuhammaraWasm();
      var reader = muhammara.createReader(
        await readFile(`tests/TestMaterials/${file}`),
      );
      try {
        assert.ok(reader.isEncrypted());
        var info = reader.parseNewObject(2);
        assert.equal(
          reader.queryDictionaryObject(info, "Title").toText(),
          "Plain",
        );
        assert.throws(() => reader.parseNewObject(7), /Unable to read object/);
        assert.throws(() => reader.parseNewObject(8), /Unable to read object/);
      } finally {
        reader.end();
      }
    });

    it(`fails a root that starts with a string under ${name}`, async function () {
      var muhammara = await createMuhammaraWasm();
      var bytes = await readFile(`tests/TestMaterials/${file}`);
      var rootAtString = Uint8Array.from(bytes);
      rootAtString[bytes.indexOf("/Root 1 0 R") + 6] = "7".charCodeAt(0);
      assert.throws(
        () => muhammara.createReader(rootAtString),
        /Unable to parse PDF/,
      );
    });
  });
  // An AESV2 document whose content stream, object 6, runs through two
  // /Crypt filters: an unused AESV3 one, whose file key is empty in a /V 4
  // file, then an RC4 one. Both got the first filter's empty object key,
  // and RC4 divided by zero setting it up.
  it("reads a stream whose RC4 crypt filter gets an empty key", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      await readFile("tests/TestMaterials/RC4EmptyKeyTwoCryptFilters.pdf"),
    );
    try {
      var stream = reader.startReadingFromStream(
        reader.parseNewObject(6).toPDFStream(),
      );
      for (var reads = 0; stream.notEnded() && reads < 100; ++reads) {
        stream.read(4096);
      }
      assert.equal(stream.notEnded(), false);
      assert.deepEqual(reader.extractPageText(0), []);
    } finally {
      reader.end();
    }
  });
  // Port of tests/security/GHSA-wj5h-wf8p-8vhv.js.
  [
    ["/StmF /Identity", "EncryptedStmFIdentity.pdf"],
    ["/CFM /None", "EncryptedCFMNone.pdf"],
  ].forEach(function ([name, fixture]) {
    it(`modifies an encrypted PDF with ${name}`, async function () {
      var muhammara = await createMuhammaraWasm();
      var modifier = muhammara.createWriterToModify(
        await readFile("tests/TestMaterials/" + fixture),
        { compress: false },
      );
      var pageModifier = modifier.createPageModifier(0, true).startContext();
      pageModifier.getContext().q().re(7, 8, 9, 10).f().Q();
      pageModifier.endContext().writePage();
      var output = modifier.end();
      writeOutput("GHSA-wj5h-wf8p-8vhv-" + fixture.slice(0, -4), output);

      var reader = muhammara.createReader(output);
      try {
        assert.equal(reader.isEncrypted(), true);
        var streams = "";
        for (var id = 1; id < reader.getXrefSize(); ++id) {
          var object = reader.parseNewObject(id);
          if (object.getType() !== muhammara.ePDFObjectStream) continue;
          var stream = reader.startReadingFromStream(object.toPDFStream());
          while (stream.notEnded()) {
            streams += new TextDecoder("latin1").decode(stream.read(4096));
          }
        }
        assert.ok(streams.includes("Hello Secret"));
        assert.ok(streams.includes("7 8 9 10 re"));
        assert.equal(
          reader.parseNewObject(2).queryObject("Title").toText(),
          "Secret Title",
        );
      } finally {
        reader.end();
      }
    });
  });
});
