import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import { recipeFixture } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

describe("Recipe encryption", function () {
  it("encrypts the final bytes and caches the encrypted result", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe({ userPassword: "view", ownerPassword: "edit" })
      .createPage(100, 100)
      .endPage();
    var encrypted = recipe.endPDF();
    writeOutput("encryption-user-owner-passwords", encrypted);
    assert.strictEqual(recipe.endPDF(), encrypted);

    var muhammara = await createMuhammaraWasm();
    var encryptedReader = muhammara.createReader(encrypted);
    assert.equal(encryptedReader.isEncrypted(), true);
    encryptedReader.end();
    var plain = muhammara.recrypt(encrypted, { password: "view" });
    writeOutput("encryption-user-owner-passwords-decrypted", plain);
    var plainReader = muhammara.createReader(plain);
    assert.equal(plainReader.getPagesCount(), 1);
    plainReader.end();
    recipe.dispose();
    Recipe.disposeAssets();
  });

  // Mirrors native "Buffer source with view password" (GH-446): a modified
  // source is encrypted by endPDF() just like a new document.
  it("encrypts a modified source with a view password", async function () {
    var Recipe = await createRecipe();
    var source = recipeFixture("test2");
    var recipe = new Recipe(source)
      .editPage(1)
      .text("Encrypted from a byte source", 150, 300)
      .endPage()
      .encrypt({ userPassword: "123" });
    var encrypted = recipe.endPDF();
    writeOutput("encryption-modified-source-view-password", encrypted);
    assert.strictEqual(recipe.endPDF(), encrypted);

    var muhammara = await createMuhammaraWasm();
    var locked = muhammara.createReader(encrypted);
    assert.equal(locked.isEncrypted(), true);
    assert.equal(locked.getPagesCount(), 0);
    locked.end();
    var unlocked = muhammara.createReader(encrypted, { password: "123" });
    assert.equal(unlocked.isEncrypted(), true);
    assert.ok(unlocked.getPagesCount() > 0);
    unlocked.end();
    recipe.dispose();
    Recipe.disposeAssets();
  });

  // Mirrors native "New Buffer file with constructor password re-encrypted".
  it("re-encrypts a document the constructor already encrypted", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe({ userPassword: "first" })
      .createPage(100, 100)
      .endPage()
      .encrypt({ userPassword: "second" });
    var encrypted = recipe.endPDF();
    writeOutput("encryption-constructor-then-encrypt", encrypted);

    var muhammara = await createMuhammaraWasm();
    var stale = muhammara.createReader(encrypted, { password: "first" });
    assert.equal(stale.getPagesCount(), 0);
    stale.end();
    var reader = muhammara.createReader(encrypted, { password: "second" });
    assert.equal(reader.isEncrypted(), true);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
    recipe.dispose();
    Recipe.disposeAssets();
  });

  it("encrypts a PDF 2.0 document with AES-256", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe({
      version: 2.0,
      userPassword: "view",
      ownerPassword: "edit",
    })
      .createPage(100, 100)
      .endPage();
    var encrypted = recipe.endPDF();
    writeOutput("encryption-pdf20-aes256", encrypted);
    assert.match(new TextDecoder("latin1").decode(encrypted), /\/AESV3/);

    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(encrypted, { password: "view" });
    assert.equal(reader.getPDFLevel(), 2);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
    recipe.dispose();
    Recipe.disposeAssets();
  });

  // Mirrors native "New Buffer file with constructor flag re-encrypted".
  it("re-encrypts a document a constructor userProtectionFlag encrypted", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe({ userProtectionFlag: 4 })
      .createPage(100, 100)
      .endPage()
      .encrypt({ userPassword: "second" });
    var encrypted = recipe.endPDF();
    writeOutput("encryption-constructor-flag-then-encrypt", encrypted);

    var muhammara = await createMuhammaraWasm();
    var locked = muhammara.createReader(encrypted);
    assert.equal(locked.getPagesCount(), 0);
    locked.end();
    var reader = muhammara.createReader(encrypted, { password: "second" });
    assert.equal(reader.isEncrypted(), true);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
    recipe.dispose();
    Recipe.disposeAssets();
  });

  // Mirrors native "Encrypted Buffer source needs its password" (GH-1003).
  it("reads an encrypted source only with its password", async function () {
    var Recipe = await createRecipe();
    var source = new Uint8Array(
      readFileSync("tests/TestMaterials/PDFWithPassword.PDF"),
    );
    assert.throws(() => new Recipe(source), /pages=0/);
    assert.throws(() => new Recipe(source, { password: "wrong" }), /pages=0/);
    var recipe = new Recipe(source, { password: "user" });
    assert.equal(recipe.pageInfo(1).width, 595);
    assert.equal(recipe.pageInfo(1).height, 842);
    recipe.dispose();
    var aes = new Uint8Array(
      readFileSync("tests/TestMaterials/ProtectedAES256.pdf"),
    );
    var reading = new Recipe();
    assert.throws(() => reading.read(aes), /pages=0/);
    reading.dispose();
    reading = new Recipe({ password: "user" });
    assert.equal(reading.read(aes)[1].width, 200);
    reading.dispose();
    recipe = new Recipe(aes, { password: "user" });
    assert.equal(recipe.pageInfo(1).height, 300);
    // Editing stays unsupported, so no output is written over the encryption.
    assert.throws(
      () => recipe.info({ title: "T" }).endPDF(),
      /Editing a password-protected source is unsupported/,
    );
    recipe.dispose();
    // An owner-password-only source opens without a password and stays editable.
    var ownerOnly = new Recipe({ ownerPassword: "own" })
      .createPage(100, 100)
      .endPage()
      .endPDF();
    var edited = new Recipe(ownerOnly)
      .editPage(1)
      .text("Edited", 10, 10)
      .endPage()
      .endPDF();
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(edited);
    assert.equal(reader.isEncrypted(), true);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });

  it("queues native Recipe password aliases", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe().createPage(100, 100).endPage();
    assert.strictEqual(recipe.encrypt({ password: "edit" }), recipe);
    var muhammara = await createMuhammaraWasm();
    var bytes = recipe.endPDF();
    writeOutput("encryption-password-alias", bytes);
    var reader = muhammara.createReader(bytes);
    assert.equal(reader.isEncrypted(), true);
    reader.end();
    recipe.dispose();
    Recipe.disposeAssets();
  });
});
