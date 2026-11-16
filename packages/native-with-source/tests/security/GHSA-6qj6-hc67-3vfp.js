var assert = require("assert");
var fs = require("fs");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// Each file is encrypted for an empty user password. Object 2 is /Info with an
// encrypted /Title "Plain", object 8 sits in object stream 6, whose header
// starts with a string, and the xref entry of object 7 points at the /Title
// string instead of an "N G obj" header.
var materials = path.join(__dirname, "../TestMaterials");

describe("GHSA-6qj6-hc67-3vfp", function () {
  [
    ["RC4 (/V 2)", "RC4XrefAtString.pdf"],
    ["an RC4 crypt filter (/V 4)", "RC4CryptFilterXrefAtString.pdf"],
    ["an AESV2 crypt filter (/V 4)", "AESXrefAtString.pdf"],
  ].forEach(function ([name, file]) {
    var bytes = fs.readFileSync(path.join(materials, file));

    it(`fails objects that start with a string under ${name}`, function () {
      var reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(bytes),
      );

      assert.ok(reader.isEncrypted());
      var info = reader.parseNewObject(2);
      assert.strictEqual(
        reader.queryDictionaryObject(info, "Title").toText(),
        "Plain",
      );
      assert.throws(() => reader.parseNewObject(7), /Unable to read object/);
      assert.throws(() => reader.parseNewObject(8), /Unable to read object/);
    });

    it(`fails a root that starts with a string under ${name}`, function () {
      var rootAtString = Buffer.from(bytes);
      rootAtString[bytes.indexOf("/Root 1 0 R") + 6] = "7".charCodeAt(0);

      assert.throws(
        () =>
          muhammara.createReader(
            new muhammara.PDFRStreamForBuffer(rootAtString),
          ),
        /Unable to start parsing/,
      );
    });
  });

  // An AESV2 document whose content stream, object 6, runs through two
  // /Crypt filters: an unused AESV3 one, whose file key is empty in a /V 4
  // file, then an RC4 one. Both got the first filter's empty object key,
  // and RC4 divided by zero setting it up.
  it("reads a stream whose RC4 crypt filter gets an empty key", function () {
    var reader = muhammara.createReader(
      path.join(materials, "RC4EmptyKeyTwoCryptFilters.pdf"),
    );
    try {
      var stream = reader.startReadingFromStream(reader.parseNewObject(6));
      for (var reads = 0; stream.notEnded() && reads < 100; ++reads) {
        stream.read(4096);
      }
      assert.strictEqual(stream.notEnded(), false);
      assert.deepStrictEqual(reader.extractPageText(0), []);
    } finally {
      reader.end();
    }
  });
});
