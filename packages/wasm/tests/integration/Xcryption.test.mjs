import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";

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
});
