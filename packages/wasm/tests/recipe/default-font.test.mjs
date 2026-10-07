import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import { defaultFontBytes } from "../../fonts/Roboto-Regular.js";
import { writeOutput } from "../testOutput.mjs";

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

  it("uses bundled Roboto for new and existing documents", async function () {
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
      writeOutput("default-font-hello", bytes);
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
      var styledBytes = recipe.endPage().endPDF();
      writeOutput("default-font-cafe-styles", styledBytes);
      checkText(styledBytes, ["Café", "Café", "Café"]);
    } finally {
      recipe.dispose();
    }

    var source = muhammara.createBlankPdf(612, 792);
    writeOutput("default-font-blank-source", source);
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
      writeOutput("default-font-edited-and-added", bytes);
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

  it("supports custom and overridden default fonts", async function () {
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
      writeOutput("default-font-custom-and-default", bytes);
      checkText(bytes, ["Custom", "Default"]);
      var output = new TextDecoder().decode(bytes);
      assert.match(output, /Arial/);
      assert.match(output, /Roboto-Regular/);
    } finally {
      recipe.dispose();
    }
    // User registration takes precedence, but cleanup restores the bundled face.
    Recipe.registerFont(
      "Roboto",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    var recipe = new Recipe().createPage("letter");
    try {
      var bytes = recipe.text("Override", 72, 72).endPage().endPDF();
      writeOutput("default-font-override", bytes);
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
        writeOutput(`default-font-restored-${index}`, restored);
        checkText(restored, ["Restored"]);
        assert.match(new TextDecoder().decode(restored), /Roboto-Regular/);
      } finally {
        recipe.dispose();
        Recipe.disposeAssets();
      }
    }
    var bytes = new Uint8Array(
      await readFile("tests/TestMaterials/fonts/arial.ttf"),
    );
    for (var [sourceIndex, source] of [
      bytes,
      bytes.buffer,
      new Blob([bytes]),
    ].entries()) {
      var CustomRecipe = await createRecipe({ defaultFont: source });
      for (var index = 0; index < 2; index++) {
        var recipe = new CustomRecipe().createPage("letter");
        try {
          assert.deepEqual(
            recipe.textDimensions("Custom"),
            recipe.textDimensions("Custom", { font: "default" }),
          );
          var output = recipe.text("Custom", 72, 72).endPage().endPDF();
          writeOutput(
            `default-font-custom-default-${sourceIndex}-${index}`,
            output,
          );
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

  it("allows disabling and validates custom defaults", async function () {
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
      writeOutput("default-font-named", bytes);
      checkText(bytes, ["Named"]);
      assert.doesNotMatch(new TextDecoder().decode(bytes), /Roboto-Regular/);
    } finally {
      recipe.dispose();
      NamedRecipe.disposeAssets();
    }

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

  it("uses the defaultFontFamily and defaultFontSize options", async function () {
    Recipe.registerFont(
      "body",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    var recipe = new Recipe({
      defaultFontFamily: "BODY",
      defaultFontSize: 20,
    }).createPage("letter");
    try {
      assert.deepEqual(
        recipe.textDimensions("Hello"),
        recipe.textDimensions("Hello", { font: "body", size: 20 }),
      );
      var bytes = recipe.text("Hello", 72, 72).endPage().endPDF();
      writeOutput("default-font-options", bytes);
      checkText(bytes, ["Hello"]);
      var output = new TextDecoder().decode(bytes);
      assert.match(output, /Arial/);
      assert.doesNotMatch(output, /Roboto-Regular/);
    } finally {
      recipe.dispose();
    }

    // The bundled default can be named too, case-insensitively.
    recipe = new Recipe({ defaultFontFamily: "ROBOTO" }).createPage("letter");
    try {
      assert.deepEqual(
        recipe.textDimensions("Hello"),
        recipe.textDimensions("Hello", { font: "Roboto", size: 14 }),
      );
    } finally {
      recipe.dispose();
    }
  });

  it("throws when the default family is not registered", async function () {
    var recipe = new Recipe({ defaultFontFamily: "missing" }).createPage(
      "letter",
    );
    try {
      assert.throws(
        () => recipe.text("Hello", 72, 72),
        /Unknown font: missing/,
      );
      recipe.registerFont(
        "missing",
        new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
      );
      checkText(recipe.text("Hello", 72, 72).endPage().endPDF(), ["Hello"]);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects invalid default font options", function () {
    [0, -1, NaN, Infinity, "12"].forEach((defaultFontSize) => {
      assert.throws(() => new Recipe({ defaultFontSize }), RangeError);
    });
    ["", 12].forEach((defaultFontFamily) => {
      assert.throws(() => new Recipe({ defaultFontFamily }), TypeError);
    });
  });

  it("makes a registered font the default, latest default wins", async function () {
    var arial = new Uint8Array(
      await readFile("tests/TestMaterials/fonts/arial.ttf"),
    );
    var roboto = defaultFontBytes();
    Recipe.registerFont("serif", arial);
    var first = new Recipe({ defaultFontFamily: "serif" }).createPage("letter");
    var second = new Recipe().createPage("letter");
    try {
      var arialSize = first.textDimensions("Hello", { font: "serif" });
      var robotoSize = first.textDimensions("Hello", { font: "Roboto" });
      assert.deepEqual(first.textDimensions("Hello"), arialSize);
      assert.deepEqual(second.textDimensions("Hello"), robotoSize);

      // A runtime-wide default applies to every Recipe, overriding earlier
      // defaults, including the first Recipe's option.
      Recipe.registerFont("Shared", roboto, "regular", true);
      assert.deepEqual(first.textDimensions("Hello"), robotoSize);
      assert.deepEqual(second.textDimensions("Hello"), robotoSize);

      // A later instance registration overrides it for that Recipe only.
      first.registerFont("Mine", arial, "regular", true);
      assert.deepEqual(first.textDimensions("Hello"), arialSize);
      assert.deepEqual(second.textDimensions("Hello"), robotoSize);

      // Recipes created afterwards use their own option.
      var third = new Recipe({ defaultFontFamily: "serif" });
      third.createPage("letter");
      try {
        assert.deepEqual(third.textDimensions("Hello"), arialSize);
      } finally {
        third.dispose();
      }

      await Recipe.registerFontAsync("async", new Blob([arial]), "r", true);
      assert.deepEqual(second.textDimensions("Hello"), arialSize);
      assert.deepEqual(first.textDimensions("Hello"), arialSize);

      assert.throws(() => Recipe.registerFont("x", arial, "r", 1), TypeError);
      assert.throws(
        () => first.registerFont("x", arial, "r", "yes"),
        TypeError,
      );
      await assert.rejects(
        Recipe.registerFontAsync("x", arial, "r", 1),
        TypeError,
      );
    } finally {
      first.dispose();
      second.dispose();
    }

    // disposeAssets() removes the families and the runtime-wide default.
    Recipe.disposeAssets();
    var recipe = new Recipe().createPage("letter");
    try {
      checkText(recipe.text("Hello", 72, 72).endPage().endPDF(), ["Hello"]);
    } finally {
      recipe.dispose();
    }
  });
});
