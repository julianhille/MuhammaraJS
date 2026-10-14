import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCompositionMethods } from "../../lib/recipe/composition.js";
import { PAGE_CONTEXT_STATE } from "../../lib/recipe/context-state.js";
import { createInfoMethods } from "../../lib/recipe/info.js";
import { createTextMethods } from "../../lib/recipe/text.js";
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

  it("measures text once for each font and size", function () {
    var measured = [];
    var methods = createTextMethods({
      module: {},
      drawText: () => {},
      measure: (text, options) => {
        measured.push([text, options.font, options.fontSize]);
        return {
          xMin: 0,
          yMin: 0,
          xMax: text.length,
          yMax: 1,
          width: text.length,
          height: 1,
        };
      },
      fontKey: (options) => options.font + "/" + options.fontSize,
    });
    var recipe = {};
    var other = {};
    var spaced = { font: "a", fontSize: 10, charSpace: 2 };
    assert.equal(methods.textDimensions.call(recipe, "abc", spaced).width, 7);
    // The spacing added to one result does not reach the next.
    assert.equal(methods.textDimensions.call(recipe, "abc", spaced).width, 7);
    methods.textDimensions.call(recipe, "abc", { font: "a", fontSize: 12 });
    methods.textDimensions.call(recipe, "abc", { font: "b", fontSize: 10 });
    methods.textDimensions.call(other, "abc", spaced);
    assert.deepEqual(measured, [
      ["abc", "a", 10],
      ["abc", "a", 12],
      ["abc", "b", 10],
      ["abc", "a", 10],
    ]);
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
    // appendPage() finishes an open page first, so the stub reports the idle
    // lifecycle state a Recipe between pages would have.
    var recipe = {
      _recipe: 9,
      _pageWidth: 200,
      _pageHeight: 300,
      _contextState: PAGE_CONTEXT_STATE.IDLE,
    };
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
