import assert from "node:assert/strict";
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
