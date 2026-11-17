var assert = require("assert");
var fs = require("fs");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// An AESV2 document whose content stream, object 8, is only the 16-byte
// IV, without a block to decrypt. The next read decrypted the never-read
// block buffer, returning uninitialised heap memory.
var source = path.join(
  __dirname,
  "../TestMaterials/EncryptedAESStreamShorterThanBlock.pdf",
);

describe("GHSA-mvmf-5vvf-74m7", function () {
  [
    ["the IV and one block", "<< /Length 16 >>"],
    // Half the IV; the same byte length keeps the offsets.
    ["the IV", "<< /Length 8  >>"],
  ].forEach(function ([name, length]) {
    it(`ends an AES stream shorter than ${name}`, function () {
      // 128 encrypted readers take about 20 s on the Wasm ASan build.
      this.timeout(60000);
      var bytes = fs
        .readFileSync(source, "latin1")
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
        var reader = muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(Buffer.from(variant, "latin1")),
        );
        try {
          var stream = reader.startReadingFromStream(reader.parseNewObject(8));
          assert.strictEqual(stream.read(4096).length, 0);
          assert.strictEqual(stream.notEnded(), false);
        } finally {
          reader.end();
        }
      }
    });
  });

  // Object 6 runs through an AESV3 /Crypt filter whose empty key the AES
  // key setup rejects, so it reads nothing, then an RC4 one. RC4 decrypted
  // its uninitialised read buffer and returned that byte.
  it("ends an RC4 stream whose source reads nothing", function () {
    var reader = muhammara.createReader(
      path.join(__dirname, "../TestMaterials/RC4EmptyKeyTwoCryptFilters.pdf"),
    );
    try {
      var stream = reader.startReadingFromStream(reader.parseNewObject(6));
      assert.strictEqual(stream.read(4096).length, 0);
      assert.strictEqual(stream.notEnded(), false);
    } finally {
      reader.end();
    }
  });

  // Object 6 is LZW data whose first code after the clear-table code is the
  // next table entry, which repeats the first byte of a previous sequence
  // that does not exist. It decoded to that never-written byte.
  it("ends an LZW stream whose first code is not a literal", function () {
    var reader = muhammara.createReader(
      path.join(__dirname, "../TestMaterials/LZWFirstCodeNotLiteral.pdf"),
    );
    try {
      var stream = reader.startReadingFromStream(reader.parseNewObject(6));
      assert.strictEqual(stream.read(4096).length, 0);
      assert.strictEqual(stream.notEnded(), false);
    } finally {
      reader.end();
    }
  });
});
