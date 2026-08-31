import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCompositionMethods } from "../../lib/recipe/composition.js";
import { createInfoMethods } from "../../lib/recipe/info.js";
import { permission } from "../../lib/recipe/security.js";

describe("Recipe extracted modules", function () {
  it("keeps metadata byte writes and shallow reads at the info boundary", function () {
    var writes = [];
    var methods = createInfoMethods({
      call: (...args) => writes.push(args),
      withString: (value, callback) => callback(value),
    });
    var recipe = { _recipe: 7, _info: {}, info: methods.info };
    assert.strictEqual(
      methods.info.call(recipe, { keywords: ["one", "two"] }),
      recipe,
    );
    assert.deepEqual(writes, [
      ["_muhammara_wasm_recipe_set_info", 7, "keywords", "one, two"],
    ]);
    var info = methods.info.call(recipe);
    info.keywords.push("three");
    assert.deepEqual(recipe._info.keywords, ["one", "two", "three"]);
  });

  it("keeps composition range clamping and overlay coordinate conversion injectable", function () {
    var calls = [];
    var methods = createCompositionMethods({
      pdfs: new Map([["source", "/pdfs/source.pdf"]]),
      withString: (value, callback) => callback(value),
      call: (...args) => calls.push(args),
      inspectPdf: () => ({
        pages: 2,
        1: { width: 100, height: 50 },
        2: { width: 80, height: 40 },
      }),
    });
    var recipe = { _recipe: 9, _pageWidth: 200, _pageHeight: 300 };
    assert.strictEqual(methods.appendPage.call(recipe, "source", 9), recipe);
    assert.deepEqual(calls.pop(), [
      "_muhammara_wasm_recipe_append_pdf_range",
      9,
      "/pdfs/source.pdf",
      1,
      1,
    ]);
    assert.strictEqual(
      methods.overlay.call(recipe, "source", { page: 2, fitWidth: true }),
      recipe,
    );
    assert.deepEqual(calls.pop(), [
      "_muhammara_wasm_recipe_image_page",
      9,
      "/pdfs/source.pdf",
      0,
      200,
      200,
      100,
      1,
    ]);
  });

  it("keeps permission parsing independent of Recipe instances", function () {
    assert.equal(permission("print, copy"), 20);
    assert.throws(
      () => permission("unknown"),
      /Unknown user access permission/,
    );
  });

  it("keeps extracted modules as the only Recipe method implementations", async function () {
    var source = await readFile("../wasm/lib/recipe.js", "utf8");
    [
      "endPage()",
      "rectangle(x, y, width, height, options = {})",
      "image(name, x, y, options = {})",
      "textDimensions(value, options = {})",
      "Recipe.registerFont =",
      "Recipe.registerImage =",
      "Recipe.registerPdf =",
      "Recipe.splitPdf =",
      "Recipe.inspectPdf =",
    ].forEach((implementation) =>
      assert.doesNotMatch(
        source,
        new RegExp(implementation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      ),
    );
  });
});
