// Ports byte-backed overlay behavior from tests/recipe/overlay.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

describe("Recipe overlay", function () {
  it("overlays registered PDF pages with scale and fit options", async function () {
    var Recipe = await getRecipe();
    var source = new Recipe()
      .createPage(595, 842)
      .endPage()
      .createPage(300, 200)
      .endPage()
      .endPDF();
    writeOutput("overlay-source", source);
    Recipe.registerPdf("source", source);
    var overlay = new Recipe()
      .createPage(595, 842)
      .overlay("source")
      .overlay("source", 20, 20, {
        page: 2,
        scale: 0.5,
        fitHeight: true,
        keepAspectRatio: false,
      })
      .endPage()
      .endPDF();
    writeOutput("overlay", overlay);
    assert.match(new TextDecoder().decode(overlay), /%%EOF/);
  });

  it("overlays a PDF with an empty user password and rejects one that needs a password", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    /**
     * Writes a one-page encrypted PDF.
     * @param {object} options - createWriter encryption options.
     * @returns {Uint8Array} The PDF bytes.
     */
    var writePdf = (options) => {
      var writer = muhammara.createWriter(options);
      writer.writePage(writer.createPage(0, 0, 100, 100));
      return writer.end();
    };
    Recipe.registerPdf(
      "overlay-owner-password",
      writePdf({ userPassword: "", ownerPassword: "owner" }),
    );
    Recipe.registerPdf(
      "overlay-user-password",
      writePdf({
        userPassword: "user",
        ownerPassword: "owner",
        userProtectionFlag: 4,
      }),
    );
    var error = {
      name: "Error",
      message: "Encrypted PDF input is not supported in Wasm",
    };
    /**
     * Counts the form XObjects in a PDF.
     * @param {Uint8Array} bytes - The PDF bytes.
     * @returns {number} The number of form XObjects.
     */
    var forms = (bytes) =>
      (new TextDecoder().decode(bytes).match(/\/Subtype \/Form/g) || []).length;
    var source = new Recipe().createPage(100, 100).endPage().endPDF();
    [
      () => new Recipe().createPage(100, 100),
      () => new Recipe(source).editPage(1),
    ].forEach((start, index) => {
      var recipe = start();
      assert.throws(() => recipe.overlay("overlay-user-password"), error);
      var bytes = recipe.overlay("overlay-owner-password").endPage().endPDF();
      writeOutput(`overlay-owner-password-${index + 1}`, bytes);
      assert.ok(forms(bytes) > forms(start().endPage().endPDF()));
    });
  });
});
