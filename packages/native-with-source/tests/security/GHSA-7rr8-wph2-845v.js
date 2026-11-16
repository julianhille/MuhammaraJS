var assert = require("assert");
var fs = require("fs");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

/**
 * Reads a stream object of a PDF, decoded, as a latin1 string.
 *
 * @param {object} reader - A muhammara PDF reader.
 * @param {number} id - The stream's object ID.
 * @returns {string} The stream contents.
 */
function readStream(reader, id) {
  var stream = reader.startReadingFromStream(reader.parseNewObject(id));
  var text = "";
  while (stream.notEnded()) {
    text += Buffer.from(stream.read(4096)).toString("latin1");
  }
  return text;
}

// An AESV2 crypt filter declaring /Length 5. AESV2 keys are 128 bits; the
// 5-byte file key gave 10-byte object keys, which the AES key setup rejects,
// leaving an uninitialised AES context to decrypt and encrypt with.
var source = path.join(__dirname, "../TestMaterials/EncryptedAESV2Length5.pdf");

describe("GHSA-7rr8-wph2-845v", function () {
  it("decrypts an AESV2 crypt filter with a short /Length using a 128-bit key", function () {
    var reader = muhammara.createReader(source);
    try {
      assert.strictEqual(
        readStream(reader, 6),
        "BT /F1 24 Tf 20 100 Td (Hello Secret) Tj ET",
      );
      assert.strictEqual(
        reader.parseNewObject(2).queryObject("Title").toText(),
        "Secret Title",
      );
    } finally {
      reader.end();
    }
  });

  it("encrypts a modification with a 128-bit AESV2 key", function () {
    var target = path.join(__dirname, "../output/GHSA-7rr8-wph2-845v.pdf");
    var writer = muhammara.createWriterToModify(source, {
      modifiedFilePath: target,
      compress: false,
    });
    var pageModifier = new muhammara.PDFPageModifier(writer, 0, true);
    pageModifier.startContext().getContext().q().re(7, 8, 9, 10).f().Q();
    pageModifier.endContext().writePage();
    writer.end();

    var reader = muhammara.createReader(target);
    try {
      var streams = "";
      for (var id = 1; id < reader.getXrefSize(); ++id) {
        var object = reader.parseNewObject(id);
        if (object && object.getType() === muhammara.ePDFObjectStream) {
          streams += readStream(reader, id);
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
  // 7.2.3, and a continued writer of it is not rejected.
  it("keeps an AESV2 file key of 96 bits", function () {
    var topLength96 = path.join(
      __dirname,
      "../TestMaterials/EncryptedAESV2TopLength96.pdf",
    );
    var reader = muhammara.createReader(topLength96);
    try {
      assert.strictEqual(
        reader.parseNewObject(2).queryObject("Title").toText(),
        "Secret Title",
      );
      assert.deepStrictEqual(
        reader.extractPageText(0).map(function (item) {
          return item.text;
        }),
        ["Hello Secret", "Second Stream"],
      );
    } finally {
      reader.end();
    }

    var target = path.join(__dirname, "../output/GHSA-7rr8-wph2-845v-96.pdf");
    var state = path.join(__dirname, "../output/GHSA-7rr8-wph2-845v-96.state");
    var writer = muhammara.createWriterToModify(topLength96, {
      modifiedFilePath: target,
      compress: false,
    });
    writer.shutdown(state);
    writer = muhammara.createWriterToContinue(target, state, {
      modifiedFilePath: topLength96,
    });
    var page = writer.createPage(0, 0, 200, 200);
    writer.startPageContentContext(page).q().re(7, 8, 9, 10).f().Q();
    writer.writePage(page);
    writer.end();

    reader = muhammara.createReader(target);
    try {
      assert.strictEqual(reader.getPagesCount(), 2);
      var page1 = reader.parsePageDictionary(1);
      assert.strictEqual(
        readStream(reader, page1.queryObject("Contents").getObjectID()),
        "q\r\n7 8 9 10 re\r\nf\r\nQ\r\n",
      );
    } finally {
      reader.end();
    }
  });

  // Keys that reach AES unusable: object 11 runs through two /Crypt
  // filters, an RC4 /Length 40 one and the AESV2 /StmCF, and was decrypted
  // by AES with the RC4 filter's 10-byte object key; object 8 runs through
  // one /Crypt without /DecodeParms, keyed by the RC4 /StmF but decrypted
  // by the AESV2 filter named Identity; object 6 names an unused AESV3
  // filter whose /UE and /OE are 24 bytes, which AES-CBC cannot decrypt,
  // so its file key was 24 uninitialised bytes, a key AES accepts.
  [
    ["two /Crypt filters", "EncryptedTwoCryptFiltersMixed.pdf", 11],
    [
      "a crypt filter named Identity",
      "EncryptedIdentityNamedCryptFilter.pdf",
      8,
    ],
    ["a 24-byte /UE", "EncryptedAESV3UE24UnusedFilter.pdf", 6],
  ].forEach(function ([name, fixture, id]) {
    it(`reads nothing from an AES stream keyed by ${name}`, function () {
      var reader = muhammara.createReader(
        path.join(__dirname, "../TestMaterials", fixture),
      );
      try {
        var stream = reader.startReadingFromStream(reader.parseNewObject(id));
        assert.strictEqual(stream.read(4096).length, 0);
        assert.strictEqual(stream.notEnded(), false);
      } finally {
        reader.end();
      }
    });
  });

  // An AESV2 document whose /CF also holds an unused AESV3 filter, /X3,
  // which has no 256-bit key in a /V 4 file.
  var unusedAESV3 = path.join(
    __dirname,
    "../TestMaterials/EncryptedUnusedAESV3CryptFilter.pdf",
  );

  it("reads a document with an unused AESV3 crypt filter", function () {
    var reader = muhammara.createReader(unusedAESV3);
    try {
      assert.strictEqual(
        reader.parseNewObject(2).queryObject("Title").toText(),
        "Secret Title",
      );
      assert.strictEqual(
        readStream(reader, 7),
        "BT /F1 12 Tf 10 10 Td (Stream0) Tj ET\n",
      );
    } finally {
      reader.end();
    }
  });

  ["/StrF", "/StmF"].forEach(function (entry) {
    it(`fails a ${entry} crypt filter without a valid AES key`, function () {
      var bytes = fs.readFileSync(unusedAESV3, "latin1");
      var patched = bytes.replace(`${entry} /StdCF`, `${entry} /X3   `);
      assert.notStrictEqual(patched, bytes);
      assert.throws(function () {
        muhammara.recrypt(
          new muhammara.PDFRStreamForBuffer(Buffer.from(patched, "latin1")),
          new muhammara.PDFWStreamForBuffer(),
        );
      }, /Unable to recrypt/);
    });
  });

  // A string written outside an indirect object has no object key, which
  // AES rejects.
  it("fails a string encrypted with AES outside an object", function () {
    var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer(), {
      version: muhammara.ePDFVersion16,
      userPassword: "user",
    });
    writer.writePage(writer.createPage(0, 0, 100, 100));
    assert.throws(function () {
      writer.getObjectsContext().writeLiteralString("outside an object");
      writer.end();
    });
  });

  // ProtectedAES256.pdf with its /UE cut to 17 bytes, offsets kept. A /UE
  // that is not 32 bytes gives no AESV3 file key.
  it("fails an AESV3 file key that is not 256 bits", function () {
    var shortUE = path.join(
      __dirname,
      "../TestMaterials/EncryptedAESV3ShortUE.pdf",
    );
    assert.throws(function () {
      muhammara.recrypt(
        shortUE,
        path.join(__dirname, "../output/GHSA-7rr8-wph2-845v-aesv3.pdf"),
        { password: "user" },
      );
    }, /Unable to recrypt/);
  });

  // EncryptedAESV2Length5.pdf as /R 2, whose file key is 5 bytes whatever
  // the /Length, with /U recomputed and offsets kept.
  it("fails an AESV2 file key shorter than 88 bits", function () {
    var revision2 = path.join(
      __dirname,
      "../TestMaterials/EncryptedAESV2Revision2.pdf",
    );
    assert.throws(function () {
      muhammara.recrypt(
        revision2,
        path.join(__dirname, "../output/GHSA-7rr8-wph2-845v-r2.pdf"),
      );
    }, /Unable to recrypt/);
  });
});
