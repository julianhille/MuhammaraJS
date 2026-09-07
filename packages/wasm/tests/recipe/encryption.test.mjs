import assert from "node:assert/strict";
import { createMuhammaraWasm, createRecipe } from "../../index.js";

describe("Recipe encryption", function () {
  it("encrypts the final bytes and caches the encrypted result", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe({ userPassword: "view", ownerPassword: "edit" })
      .createPage(100, 100)
      .endPage();
    var encrypted = recipe.endPDF();
    assert.strictEqual(recipe.endPDF(), encrypted);

    var muhammara = await createMuhammaraWasm();
    var encryptedReader = muhammara.createReader(encrypted);
    assert.equal(encryptedReader.isEncrypted(), true);
    encryptedReader.end();
    var plain = muhammara.recrypt(encrypted, { password: "view" });
    var plainReader = muhammara.createReader(plain);
    assert.equal(plainReader.getPagesCount(), 1);
    plainReader.end();
    recipe.dispose();
    Recipe.disposeAssets();
  });

  it("queues native Recipe password aliases", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe().createPage(100, 100).endPage();
    assert.strictEqual(recipe.encrypt({ password: "edit" }), recipe);
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(recipe.endPDF());
    assert.equal(reader.isEncrypted(), true);
    reader.end();
    recipe.dispose();
    Recipe.disposeAssets();
  });
});
