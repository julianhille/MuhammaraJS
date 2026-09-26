import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";

function readStreamIVs(pdf) {
  var marker = new TextEncoder().encode("stream");
  var ivs = [];

  for (var offset = 1; offset <= pdf.length - marker.length; offset++) {
    if (!marker.every((byte, index) => pdf[offset + index] === byte)) continue;
    var contentOffset = offset + marker.length;
    var previous = pdf[offset - 1];
    if (
      (previous === 0x0a || previous === 0x0d || previous === 0x20) &&
      (pdf[contentOffset] === 0x0a || pdf[contentOffset] === 0x0d)
    ) {
      if (pdf[contentOffset] === 0x0d) contentOffset++;
      if (pdf[contentOffset] === 0x0a) contentOffset++;
      ivs.push(pdf.slice(contentOffset, contentOffset + 16));
    }
  }

  return ivs;
}

describe("Xcryption", function () {
  it("adds, changes, and removes passwords from byte PDFs", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = muhammara.createBlankPdf(100, 100);
    var encrypted = muhammara.recrypt(source, {
      userPassword: "view",
      ownerPassword: "edit",
      userProtectionFlag: 4,
      version: muhammara.ePDFVersion17,
    });
    var encryptedReader = muhammara.createReader(encrypted);
    assert.equal(encryptedReader.isEncrypted(), true);
    encryptedReader.end();

    var changed = muhammara.recrypt(encrypted, {
      password: "view",
      userPassword: "new-view",
      ownerPassword: "new-edit",
    });
    var plain = muhammara.recrypt(changed, { password: "new-view" });
    var plainReader = muhammara.createReader(plain);
    assert.equal(plainReader.isEncrypted(), false);
    assert.equal(plainReader.getPagesCount(), 1);
    plainReader.end();
  });

  it("keeps the native recrypt option defaults", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = muhammara.createBlankPdf(100, 100);
    var encrypted = muhammara.recrypt(source, { userPassword: "" });
    var reader = muhammara.createReader(encrypted);
    assert.equal(reader.isEncrypted(), true);
    reader.end();
    assert.throws(
      () => muhammara.recrypt(source, { log: "muhammara-error.log" }),
      /log files are unavailable/,
    );
  });

  it("uses the native RC4 and AES-128 version selection", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = muhammara.createBlankPdf(100, 100);
    for (var version of [10, 14, 17]) {
      var encrypted = muhammara.recrypt(source, {
        userPassword: "view",
        version,
      });
      var reader = muhammara.createReader(encrypted);
      assert.equal(reader.isEncrypted(), true);
      reader.end();
      var plain = muhammara.recrypt(encrypted, { password: "view" });
      var plainReader = muhammara.createReader(plain);
      assert.equal(plainReader.isEncrypted(), false);
      plainReader.end();
    }
  });

  it("rejects unsupported PDF 2.0 AES-256 encryption", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = muhammara.createBlankPdf(100, 100);
    assert.throws(
      () =>
        muhammara.recrypt(source, {
          userPassword: "view",
          version: muhammara.ePDFVersion20,
        }),
      /PDF 2\.0\/AES-256 encryption is unavailable in WebAssembly/,
    );
  });

  it("generates a distinct IV for each AES-encrypted stream", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    for (var index = 0; index < 2; index++) {
      var page = writer.createPage(0, 0, 100, 100);
      writer.startPageContentContext(page).q().re(1, 1, 10, 10).f().Q();
      writer.writePage(page);
    }

    var encrypted = muhammara.recrypt(writer.end(), {
      userPassword: "view",
      version: muhammara.ePDFVersion17,
      compress: false,
    });
    var ivs = readStreamIVs(encrypted);
    assert.ok(ivs.length >= 2);
    assert.notDeepEqual(ivs[0], ivs[1]);
  });
});
