var assert = require("assert");
var fs = require("fs");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
var Recipe = muhammara.Recipe;

describe("Recipe default font", function () {
  it("writes text without registering a font", function () {
    var output = path.join(__dirname, "../output/default-font.pdf");
    new Recipe("new", output)
      .createPage("letter")
      .text("Hello", 72, 72)
      .endPage()
      .endPDF();
    var reader = muhammara.createReader(output);
    try {
      assert.deepStrictEqual(
        reader.extractPageText(0).map(function (item) {
          return item.content;
        }),
        ["Hello"],
      );
    } finally {
      reader.end();
    }
  });

  it("also offers the bundled Roboto family without registration", function () {
    var output = path.join(__dirname, "../output/default-font-roboto.pdf");
    new Recipe("new", output)
      .createPage("letter")
      .text("Café", 72, 72, { font: "Roboto" })
      .endPage()
      .endPDF();
    var reader = muhammara.createReader(output);
    try {
      assert.strictEqual(reader.extractPageText(0)[0].content, "Café");
    } finally {
      reader.end();
    }
  });

  function fontNames(output) {
    return fs.readFileSync(output, "latin1").match(/\/BaseFont\s*\/[^\s/>]+/g);
  }

  it("uses the defaultFontFamily and defaultFontSize options", function () {
    var output = path.join(__dirname, "../output/default-font-options.pdf");
    var recipe = new Recipe("new", output, {
      defaultFontFamily: "ROBOTO",
      defaultFontSize: 20,
    }).createPage("letter");
    assert.deepStrictEqual(
      recipe.textDimensions("Hello"),
      recipe.textDimensions("Hello", { font: "roboto", size: 20 }),
    );
    recipe.text("Hello", 72, 72).endPage().endPDF();
    var names = fontNames(output);
    assert.ok(
      names.some((name) => /Roboto/.test(name)),
      names,
    );
    assert.ok(!names.some((name) => /Helvetica/i.test(name)), names);
  });

  it("falls back to the default family for unknown fonts", function () {
    var recipe = new Recipe(
      "new",
      path.join(__dirname, "../output/default-font-fallback.pdf"),
      { defaultFontFamily: "georgia" },
    ).createPage("letter");
    assert.deepStrictEqual(
      recipe.textDimensions("Hello", { font: "missing" }),
      recipe.textDimensions("Hello", { font: "georgia" }),
    );
    // Georgia has no bold face, so bold text uses its regular face.
    assert.deepStrictEqual(
      recipe.textDimensions("Hello", { bold: true }),
      recipe.textDimensions("Hello", { font: "georgia" }),
    );
    recipe.endPage().endPDF();
  });

  it("throws when the default family is not registered", function () {
    var recipe = new Recipe(
      "new",
      path.join(__dirname, "../output/default-font-unknown.pdf"),
      { defaultFontFamily: "missing" },
    ).createPage("letter");
    assert.throws(() => recipe.text("Hello", 72, 72), /Unknown font: missing/);
    recipe
      .registerFont(
        "missing",
        path.join(__dirname, "../../../native-core/fonts/Roboto.ttf"),
      )
      .text("Hello", 72, 72)
      .endPage()
      .endPDF();
  });

  it("rejects invalid default font options", function () {
    var output = path.join(__dirname, "../output/default-font-invalid.pdf");
    [0, -1, NaN, Infinity, "12"].forEach((defaultFontSize) => {
      assert.throws(
        () => new Recipe("new", output, { defaultFontSize }),
        RangeError,
      );
    });
    ["", 12].forEach((defaultFontFamily) => {
      assert.throws(
        () => new Recipe("new", output, { defaultFontFamily }),
        TypeError,
      );
    });
  });
});
