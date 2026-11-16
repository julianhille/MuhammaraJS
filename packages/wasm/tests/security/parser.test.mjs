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

/**
 * Reads a stream object of a PDF, decoded, as a latin1 string.
 *
 * @param {object} reader - A muhammara PDF reader.
 * @param {number} id - The stream's object ID.
 * @returns {string} The stream contents.
 */
function readStreamText(reader, id) {
  var stream = reader.startReadingFromStream(
    reader.parseNewObject(id).toPDFStream(),
  );
  var result = "";
  while (stream.notEnded()) {
    result += new TextDecoder("latin1").decode(stream.read(4096));
  }
  return result;
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
  // GHSA-fvpv-4wx7-85f6 is native only: Wasm has no createWriterToContinue().
  // Port of tests/security/GHSA-7rr8-wph2-845v.js.
  it("decrypts an AESV2 crypt filter with a short /Length using a 128-bit key", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      await readFile("tests/TestMaterials/EncryptedAESV2Length5.pdf"),
    );
    try {
      assert.equal(
        readStreamText(reader, 6),
        "BT /F1 24 Tf 20 100 Td (Hello Secret) Tj ET",
      );
      assert.equal(
        reader.parseNewObject(2).queryObject("Title").toText(),
        "Secret Title",
      );
    } finally {
      reader.end();
    }
  });
  it("encrypts a modification with a 128-bit AESV2 key", async function () {
    var muhammara = await createMuhammaraWasm();
    var modifier = muhammara.createWriterToModify(
      await readFile("tests/TestMaterials/EncryptedAESV2Length5.pdf"),
      { compress: false },
    );
    var pageModifier = modifier.createPageModifier(0, true).startContext();
    pageModifier.getContext().q().re(7, 8, 9, 10).f().Q();
    pageModifier.endContext().writePage();
    var output = modifier.end();
    writeOutput("GHSA-7rr8-wph2-845v", output);

    var reader = muhammara.createReader(output);
    try {
      var streams = "";
      for (var id = 1; id < reader.getXrefSize(); ++id) {
        if (
          reader.parseNewObject(id).getType() === muhammara.ePDFObjectStream
        ) {
          streams += readStreamText(reader, id);
        }
      }
      assert.ok(streams.includes("Hello Secret"));
      assert.ok(streams.includes("7 8 9 10 re"));
    } finally {
      reader.end();
    }
  });
  // An AESV2 crypt filter without /Length under a top-level /Length 96.
  // Keys of 11 bytes or more give 128-bit object keys, so it reads as in
  // 1.2.3.
  it("keeps an AESV2 file key of 96 bits", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      await readFile("tests/TestMaterials/EncryptedAESV2TopLength96.pdf"),
    );
    try {
      assert.equal(
        reader.parseNewObject(2).queryObject("Title").toText(),
        "Secret Title",
      );
      assert.deepEqual(
        reader.extractPageText(0).map((item) => item.text),
        ["Hello Secret", "Second Stream"],
      );
    } finally {
      reader.end();
    }
  });
  // Keys that reach AES unusable: object 11 runs through two /Crypt
  // filters, an RC4 /Length 40 one and the AESV2 /StmCF; object 8 runs
  // through one /Crypt without /DecodeParms, keyed by the RC4 /StmF but
  // decrypted by the AESV2 filter named Identity; object 6 names an
  // unused AESV3 filter whose /UE and /OE are 24 bytes, which AES-CBC
  // cannot decrypt, so its file key was 24 bytes of leftover memory.
  [
    ["two /Crypt filters", "EncryptedTwoCryptFiltersMixed.pdf", 11],
    [
      "a crypt filter named Identity",
      "EncryptedIdentityNamedCryptFilter.pdf",
      8,
    ],
    ["a 24-byte /UE", "EncryptedAESV3UE24UnusedFilter.pdf", 6],
  ].forEach(function ([name, fixture, id]) {
    it(`reads nothing from an AES stream keyed by ${name}`, async function () {
      var muhammara = await createMuhammaraWasm();
      var reader = muhammara.createReader(
        await readFile("tests/TestMaterials/" + fixture),
      );
      try {
        var stream = reader.startReadingFromStream(
          reader.parseNewObject(id).toPDFStream(),
        );
        assert.equal(stream.read(4096).length, 0);
        assert.equal(stream.notEnded(), false);
      } finally {
        reader.end();
      }
    });
  });
  // An AESV2 document whose /CF also holds an unused AESV3 filter, /X3,
  // which has no 256-bit key in a /V 4 file.
  it("reads a document with an unused AESV3 crypt filter", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      await readFile("tests/TestMaterials/EncryptedUnusedAESV3CryptFilter.pdf"),
    );
    try {
      assert.equal(
        reader.parseNewObject(2).queryObject("Title").toText(),
        "Secret Title",
      );
      assert.equal(
        readStreamText(reader, 7),
        "BT /F1 12 Tf 10 10 Td (Stream0) Tj ET\n",
      );
    } finally {
      reader.end();
    }
  });
  ["/StrF", "/StmF"].forEach(function (entry) {
    it(`fails a ${entry} crypt filter without a valid AES key`, async function () {
      var muhammara = await createMuhammaraWasm();
      var bytes = (
        await readFile(
          "tests/TestMaterials/EncryptedUnusedAESV3CryptFilter.pdf",
        )
      ).toString("latin1");
      var patched = bytes.replace(`${entry} /StdCF`, `${entry} /X3   `);
      assert.notEqual(patched, bytes);
      assert.throws(
        () => muhammara.recrypt(Buffer.from(patched, "latin1")),
        /Unable to recrypt PDF/,
      );
    });
  });
  // A string written outside an indirect object has no object key, which
  // AES rejects.
  it("fails a string encrypted with AES outside an object", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({
      version: muhammara.ePDFVersion16,
      userPassword: "user",
    });
    writer.writePage(writer.createPage(0, 0, 100, 100));
    assert.throws(() => {
      writer.getObjectsContext().writeLiteralString("outside an object");
      writer.end();
    });
  });
  // ProtectedAES256.pdf with its /UE cut to 17 bytes, offsets kept. A /UE
  // that is not 32 bytes gives no AESV3 file key.
  it("fails an AESV3 file key that is not 256 bits", async function () {
    var muhammara = await createMuhammaraWasm();
    var shortUE = await readFile(
      "tests/TestMaterials/EncryptedAESV3ShortUE.pdf",
    );
    assert.throws(
      () => muhammara.recrypt(shortUE, { password: "user" }),
      /Unable to recrypt PDF/,
    );
  });
  // EncryptedAESV2Length5.pdf as /R 2, whose file key is 5 bytes whatever
  // the /Length, with /U recomputed and offsets kept.
  it("fails an AESV2 file key shorter than 88 bits", async function () {
    var muhammara = await createMuhammaraWasm();
    var revision2 = await readFile(
      "tests/TestMaterials/EncryptedAESV2Revision2.pdf",
    );
    assert.throws(() => muhammara.recrypt(revision2), /Unable to recrypt PDF/);
  });
  // Port of tests/security/GHSA-mvmf-5vvf-74m7.js.
  [
    ["the IV and one block", "<< /Length 16 >>"],
    // Half the IV; the same byte length keeps the offsets.
    ["the IV", "<< /Length 8  >>"],
  ].forEach(function ([name, length]) {
    it(`ends an AES stream shorter than ${name}`, async function () {
      // 128 encrypted readers take about 20 s on the Wasm ASan build.
      this.timeout(60000);
      var muhammara = await createMuhammaraWasm();
      var bytes = (
        await readFile(
          "tests/TestMaterials/EncryptedAESStreamShorterThanBlock.pdf",
        )
      )
        .toString("latin1")
        .replace("<< /Length 16 >>", length);
      // Decrypting the never-read block gives a padding byte under 16, so a
      // non-empty read, for one high nibble of the IV's last byte. Sweep the
      // nibbles eight times, as that block is whatever the heap held.
      var last = bytes.indexOf("\nendstream") - 1;
      for (var nibble = 0; nibble < 128; ++nibble) {
        var variant =
          bytes.slice(0, last) +
          String.fromCharCode((nibble % 16) << 4) +
          bytes.slice(last + 1);
        var reader = muhammara.createReader(Buffer.from(variant, "latin1"));
        try {
          var stream = reader.startReadingFromStream(
            reader.parseNewObject(8).toPDFStream(),
          );
          assert.equal(stream.read(4096).length, 0);
          assert.equal(stream.notEnded(), false);
        } finally {
          reader.end();
        }
      }
    });
  });
  // Object 6 runs through an AESV3 /Crypt filter whose empty key the AES
  // key setup rejects, so it reads nothing, then an RC4 one. RC4 decrypted
  // its uninitialised read buffer and returned that byte.
  it("ends an RC4 stream whose source reads nothing", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      await readFile("tests/TestMaterials/RC4EmptyKeyTwoCryptFilters.pdf"),
    );
    try {
      var stream = reader.startReadingFromStream(
        reader.parseNewObject(6).toPDFStream(),
      );
      assert.equal(stream.read(4096).length, 0);
      assert.equal(stream.notEnded(), false);
    } finally {
      reader.end();
    }
  });
  // Object 6 is LZW data whose first code after the clear-table code is the
  // next table entry, which repeats the first byte of a previous sequence
  // that does not exist. It decoded to that never-written byte.
  it("ends an LZW stream whose first code is not a literal", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      await readFile("tests/TestMaterials/LZWFirstCodeNotLiteral.pdf"),
    );
    try {
      var stream = reader.startReadingFromStream(
        reader.parseNewObject(6).toPDFStream(),
      );
      assert.equal(stream.read(4096).length, 0);
      assert.equal(stream.notEnded(), false);
    } finally {
      reader.end();
    }
  });
  // Port of tests/security/GHSA-32r6-f4hm-ccc4.js.
  describe("GHSA-32r6-f4hm-ccc4", function () {
    var muhammara;

    before(async function () {
      muhammara = await createMuhammaraWasm();
      muhammara.registerFont(
        "type2-undefined-div",
        await readFile("tests/TestMaterials/fonts/Type2UndefinedDiv.otf"),
      );
    });

    after(function () {
      muhammara.unregisterFont("type2-undefined-div");
    });

    /**
     * Writes `text` in the crafted font and ends the document. "A" divides
     * by zero, "B" divides LONG_MIN by -1 on 32-bit `long`.
     * @param {string} text - Text to write.
     * @returns {Uint8Array} The produced PDF.
     */
    function writeWithFont(text) {
      var writer = muhammara.createWriter();
      var page = writer.createPage(0, 0, 595, 842);
      writer.startPageContentContext(page).writeText(text, 10, 400, {
        font: writer.getFontForBytes("type2-undefined-div"),
        size: 20,
      });
      writer.writePage(page);
      return writer.end();
    }

    it("fails to embed a Type 2 charstring that divides by zero", function () {
      assert.throws(() => writeWithFont("A"), /Unable to finish PDF/);
    });

    it("fails to embed a Type 2 charstring that divides LONG_MIN by -1", function () {
      assert.throws(() => writeWithFont("B"), /Unable to finish PDF/);
    });

    it("still embeds the glyphs of that font without a division", function () {
      var pdf = writeWithFont("C");
      var reader = muhammara.createReader(pdf);
      assert.equal(reader.getPagesCount(), 1);
      reader.end();
      assert.ok(new TextDecoder("latin1").decode(pdf).includes("/FontFile3"));
    });
  });
  // Port of tests/security/GHSA-fm69-f3cr-v22g.js.
  describe("GHSA-fm69-f3cr-v22g", function () {
    var muhammara;

    before(async function () {
      muhammara = await createMuhammaraWasm();
      muhammara.registerFont(
        "type2-roll-out-of-range",
        await readFile("tests/TestMaterials/fonts/Type2RollOutOfRange.otf"),
      );
    });

    after(function () {
      muhammara.unregisterFont("type2-roll-out-of-range");
    });

    /**
     * Writes `text` in the crafted font and ends the document. "A" runs
     * `1 roll`, "B" `0 5 1 roll`, "C" shifts one item about 2^30 times.
     * @param {string} text - Text to write.
     * @returns {Uint8Array} The produced PDF.
     */
    function writeWithFont(text) {
      var writer = muhammara.createWriter();
      var page = writer.createPage(0, 0, 595, 842);
      writer.startPageContentContext(page).writeText(text, 10, 400, {
        font: writer.getFontForBytes("type2-roll-out-of-range"),
        size: 20,
      });
      writer.writePage(page);
      return writer.end();
    }

    it("fails to embed a Type 2 roll with fewer than two operands", function () {
      assert.throws(() => writeWithFont("A"), /Unable to finish PDF/);
    });

    it("fails to embed a Type 2 roll of more items than on the stack", function () {
      assert.throws(() => writeWithFont("B"), /Unable to finish PDF/);
    });

    it("embeds a Type 2 roll with a huge shift amount", function () {
      this.timeout(10000);
      var pdf = writeWithFont("C");
      var reader = muhammara.createReader(pdf);
      assert.equal(reader.getPagesCount(), 1);
      reader.end();
      assert.ok(new TextDecoder("latin1").decode(pdf).includes("/FontFile3"));
    });
  });
  // Port of tests/security/GHSA-r4mx-qx34-mrx3.js.
  it("measures a missing PDF page as unreadable instead of reading it", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = await readFile("tests/TestMaterials/NullKidsPage.pdf");
    var writer = muhammara.createWriter();

    assert.deepEqual(writer.getImageDimensions(source, 0), {
      width: 200,
      height: 200,
    });
    // The null Kids entry, and an index past the last page.
    for (var index of [1, 5]) {
      assert.throws(
        () => writer.getImageDimensions(source, index),
        /Unable to read image dimensions/,
      );
    }
    // A page that cannot be read without the password.
    var protectedPdf = await readFile("tests/TestMaterials/Protected.pdf");
    assert.throws(
      () => writer.getImageDimensions(protectedPdf, 0),
      /Unable to read image dimensions/,
    );
    writer.end();

    var reader = muhammara.createReader(source);
    try {
      assert.deepEqual(reader.getPageBox(0), [0, 0, 200, 200]);
      assert.throws(() => reader.getPageInfo(1), RangeError);
      assert.throws(() => reader.getPageBox(1), RangeError);
    } finally {
      reader.end();
    }
  });
});
