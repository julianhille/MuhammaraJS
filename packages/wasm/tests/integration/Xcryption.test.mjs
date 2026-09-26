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

  it("creates a PDF with a password, as native createWriter does", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({
      userPassword: "user",
      ownerPassword: "owner",
      userProtectionFlag: 4,
    });
    writer.writePage(writer.createPage(0, 0, 595, 842));
    var encrypted = writer.end();
    var reader = muhammara.createReader(encrypted);
    assert.equal(reader.isEncrypted(), true);
    reader.end();
    for (var password of ["user", "owner"]) {
      var plainReader = muhammara.createReader(
        muhammara.recrypt(encrypted, { password }),
      );
      assert.equal(plainReader.isEncrypted(), false);
      assert.deepEqual(
        plainReader.parsePage(0).getMediaBox(),
        [0, 0, 595, 842],
      );
      plainReader.end();
    }

    for (var readerPassword of ["user", "owner"]) {
      var passwordReader = muhammara.createReader(encrypted, {
        password: readerPassword,
      });
      assert.equal(passwordReader.getPagesCount(), 1);
      assert.deepEqual(
        passwordReader.parsePage(0).getMediaBox(),
        [0, 0, 595, 842],
      );
      passwordReader.end();
    }
    var asyncReader = await muhammara.createReaderAsync(new Blob([encrypted]), {
      password: "user",
    });
    assert.equal(asyncReader.getPagesCount(), 1);
    asyncReader.end();
    var wrongReader = muhammara.createReader(encrypted, { password: "wrong" });
    assert.throws(() => wrongReader.parsePage(0), /Unable to read page 0/);
    wrongReader.end();
    assert.throws(
      () => muhammara.createReader(encrypted, 5),
      /createReader options must be an object/,
    );
    assert.throws(
      () => muhammara.createReader(encrypted, { password: 1 }),
      /createReader password must be a string/,
    );

    // An owner password alone does not encrypt, as in native.
    var ownerOnly = muhammara.createWriter({ ownerPassword: "owner" });
    ownerOnly.writePage(ownerOnly.createPage(0, 0, 10, 10));
    var ownerOnlyReader = muhammara.createReader(ownerOnly.end());
    assert.equal(ownerOnlyReader.isEncrypted(), false);
    ownerOnlyReader.end();

    assert.throws(
      () => muhammara.createWriter({ userPassword: 1 }),
      /createWriter userPassword must be a string/,
    );
    assert.throws(
      () => muhammara.createWriter({ log: "muhammara.log" }),
      /log files are unavailable in WebAssembly/,
    );
    assert.throws(
      () =>
        muhammara.createWriter({
          userPassword: "user",
          version: muhammara.ePDFVersion20,
        }),
      /PDF 2.0 encryption needs AES-256/,
    );
    assert.throws(
      () =>
        muhammara.createWriterToModify(muhammara.createBlankPdf(10, 10), {
          userPassword: "user",
        }),
      /createWriterToModify userPassword is unavailable in WebAssembly/,
    );
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
