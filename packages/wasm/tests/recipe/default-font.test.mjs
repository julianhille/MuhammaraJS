import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import { defaultFontBytes } from "../../fonts/Roboto-Regular.js";

describe("Recipe default font", function () {
  var Recipe;
  var muhammara;

  before(async function () {
    Recipe = await createRecipe();
    muhammara = await createMuhammaraWasm();
  });

  afterEach(function () {
    Recipe.disposeAssets();
  });

  after(function () {
    muhammara.disposeAssets();
  });

  function checkText(bytes, expected) {
    var reader = muhammara.createReader(bytes);
    try {
      assert.deepEqual(
        reader.extractPageText(0).map((item) => item.content),
        expected,
      );
      assert.match(new TextDecoder().decode(bytes), /\/FontFile2\s/);
    } finally {
      reader.end();
    }
  }

  it("bundles the complete, unmodified open Roboto face", async function () {
    assert.deepEqual(
      defaultFontBytes(),
      new Uint8Array(
        await readFile(
          new URL("../../../native-core/fonts/Roboto.ttf", import.meta.url),
        ),
      ),
    );

    var recipe = new Recipe().createPage("letter");
    try {
      var dimensions = recipe.textDimensions("Hello");
      assert.ok(dimensions.width > 0);
      assert.deepEqual(
        dimensions,
        recipe.textDimensions("Hello", { font: "rObOtO" }),
      );
      var bytes = recipe.text("Hello", 72, 72).endPage().endPDF();
      checkText(bytes, ["Hello"]);
      assert.match(new TextDecoder().decode(bytes), /Roboto-Regular/);
    } finally {
      recipe.dispose();
    }

    recipe = new Recipe().createPage("letter");
    try {
      var options = [
        { bold: true },
        { italic: true },
        { bold: true, italic: true },
      ];
      options.forEach((style, index) => {
        assert.deepEqual(
          recipe.textDimensions("Café", style),
          recipe.textDimensions("Café"),
        );
        recipe.text("Café", 72, 72 + index * 30, style);
      });
      checkText(recipe.endPage().endPDF(), ["Café", "Café", "Café"]);
    } finally {
      recipe.dispose();
    }

    var source = muhammara.createBlankPdf(612, 792);
    recipe = new Recipe(source, { compress: false });
    try {
      assert.ok(recipe.textDimensions("Edited").width > 0);
      var bytes = recipe
        .editPage(1)
        .text("Edited", 72, 72)
        .endPage()
        .createPage("letter")
        .text("Added", 72, 72)
        .endPage()
        .endPDF();
      // Page edits live in a Form XObject, which extractPageText does not recurse into.
      var output = new TextDecoder().decode(bytes);
      assert.match(output, /\(Edited\) Tj/);
      assert.match(output, /\/BaseFont \/\w+\+Roboto-Regular/);
      assert.match(output, /\/FontFile2\s/);
      var reader = muhammara.createReader(bytes);
      try {
        assert.equal(reader.extractPageText(1)[0].content, "Added");
      } finally {
        reader.end();
      }
    } finally {
      recipe.dispose();
    }
  });

  it("preserves custom font selection and rejects unknown explicit names", async function () {
    Recipe.registerFont(
      "custom",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    var recipe = new Recipe().createPage("letter");
    try {
      assert.throws(
        () => recipe.textDimensions("Hello", { font: "missing" }),
        /Unknown font: missing/,
      );
      var bytes = recipe
        .text("Custom", 72, 72, { font: "custom" })
        .text("Default", 72, 100)
        .endPage()
        .endPDF();
      checkText(bytes, ["Custom", "Default"]);
      var output = new TextDecoder().decode(bytes);
      assert.match(output, /Arial/);
      assert.match(output, /Roboto-Regular/);
    } finally {
      recipe.dispose();
    }
  });

    // User registration takes precedence, but cleanup restores the bundled face.
    Recipe.registerFont(
      "Roboto",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    var recipe = new Recipe().createPage("letter");
    try {
      var bytes = recipe.text("Override", 72, 72).endPage().endPDF();
      assert.match(new TextDecoder().decode(bytes), /Arial/);
      assert.doesNotMatch(new TextDecoder().decode(bytes), /Roboto-Regular/);
    } finally {
      recipe.dispose();
    }
    assert.equal(Recipe.unregisterFont("Roboto"), true);
    for (var index = 0; index < 2; index++) {
      recipe = new Recipe().createPage("letter");
      try {
        var restored = recipe.text("Restored", 72, 72).endPage().endPDF();
        checkText(restored, ["Restored"]);
        assert.match(new TextDecoder().decode(restored), /Roboto-Regular/);
      } finally {
        recipe.dispose();
        Recipe.disposeAssets();
      }
    }
  });

    var bytes = new Uint8Array(
      await readFile("tests/TestMaterials/fonts/arial.ttf"),
    );
    for (var source of [bytes, bytes.buffer, new Blob([bytes])]) {
      var CustomRecipe = await createRecipe({ defaultFont: source });
      for (var index = 0; index < 2; index++) {
        var recipe = new CustomRecipe().createPage("letter");
        try {
          assert.deepEqual(
            recipe.textDimensions("Custom"),
            recipe.textDimensions("Custom", { font: "default" }),
          );
          var output = recipe.text("Custom", 72, 72).endPage().endPDF();
          checkText(output, ["Custom"]);
          assert.match(new TextDecoder().decode(output), /Arial/);
          assert.doesNotMatch(
            new TextDecoder().decode(output),
            /Roboto-Regular/,
          );
        } finally {
          recipe.dispose();
          CustomRecipe.disposeAssets();
        }
      }
    }
  });

  it("supports explicit registration when the default is disabled", async function () {
    var NamedRecipe = await createRecipe({ defaultFont: false });
    var recipe = new NamedRecipe().createPage("letter");
    try {
      assert.throws(
        () => recipe.textDimensions("Hello"),
        /Unknown font: \(none\)/,
      );
      assert.throws(
        () => recipe.textDimensions("Hello", { font: "Roboto" }),
        /Unknown font: Roboto/,
      );
      NamedRecipe.registerFont(
        "body",
        new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
      );
      var bytes = recipe
        .text("Named", 72, 72, { font: "body" })
        .endPage()
        .endPDF();
      checkText(bytes, ["Named"]);
      assert.doesNotMatch(new TextDecoder().decode(bytes), /Roboto-Regular/);
    } finally {
      recipe.dispose();
      NamedRecipe.disposeAssets();
    }
  });

    // Invalid custom defaults fail during asynchronous Recipe initialization.
    await assert.rejects(
      createRecipe({ defaultFont: true }),
      /Default font bytes must be a Uint8Array or ArrayBuffer/,
    );
    await assert.rejects(
      createRecipe({
        defaultFont: new Uint8Array(2),
        limits: { maxInputBytes: 1 },
      }),
      /Default font bytes exceeds maxInputBytes/,
    );
  });
});
