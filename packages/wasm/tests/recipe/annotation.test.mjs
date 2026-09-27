// Ports annotation behavior from tests/recipe/annotation-*.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

describe("Recipe annotation", function () {
  it("writes known subtypes with their PDF casing and markup colors", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe({ compress: false });
    recipe
      .createPage(200, 200)
      .annot(20, 20, "highlight", { width: 50, height: 10 })
      .annot(20, 60, Recipe.AnnotSubtype.SQUARE, {
        width: 10,
        height: 10,
        flag: Recipe.AnnotFlag.LOCKED_CONTENTS,
      })
      .endPage();
    var bytes = recipe.endPDF();
    writeOutput("annotation-subtypes", bytes);
    var output = new TextDecoder("latin1").decode(bytes);
    assert.match(output, /\/Subtype\s*\/Highlight/);
    assert.doesNotMatch(output, /\/Subtype\s*\/highlight/);
    assert.match(output, /\/C\s*\[\s*1 1 0\s*\]/);
    assert.match(output, /\/F\s+512\b/);
  });

  it("resolves annotation colors and rejects unknown ones", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe({ compress: false }).createPage(200, 200);
    recipe.chroma("brand", "#336699");
    [
      "bogus",
      "ff0000",
      "#ff00",
      "#ff00001",
      "%1,2",
      "%101,0,0",
      0xff0000,
    ].forEach(function (color) {
      assert.throws(() => recipe.annot(20, 20, "Square", { color }), {
        name: "TypeError",
        message: `Unknown annotation color (${color})`,
      });
    });
    assert.throws(() => recipe.comment("note", 20, 20, { color: "bogus" }), {
      name: "TypeError",
      message: "Unknown annotation color (bogus)",
    });
    [[1, 2], [256, 0, 0], [-1, 0, 0], [Number.NaN]].forEach(function (color) {
      assert.throws(() => recipe.annot(20, 20, "Square", { color }), {
        name: "TypeError",
        message:
          "Annotation colors need one, three, or four numbers from 0 to 255",
      });
    });
    [
      "#FF0000",
      "%0,100,0",
      "NaVy",
      "green",
      "brand",
      [255, 255, 0],
      [128],
      [0, 255, 0, 0],
      [1, 0, 0],
    ].forEach(function (color, index) {
      recipe.annot(20, 10 + index * 20, "Square", {
        width: 10,
        height: 10,
        color,
      });
    });
    recipe.comment("note", 150, 20, { color: "DarkMagenta" });
    recipe.endPage();
    var pdf = recipe.endPDF();
    writeOutput("annotation-colors", pdf);
    var bytes = new TextDecoder("latin1").decode(pdf);
    var colors = Array.from(bytes.matchAll(/\/C\s*\[\s*([^\]]*?)\s*\]/g), (m) =>
      m[1].split(/\s+/).map((part) => Math.round(Number(part) * 255)),
    );
    assert.deepEqual(colors, [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 128],
      [0, 255, 0],
      [0x33, 0x66, 0x99],
      [255, 255, 0],
      [128],
      [0, 255, 0, 0],
      [1, 0, 0],
      [0x8b, 0, 0x8b],
    ]);
  });

  it("rejects invalid text markup before drawing the text", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    /**
     * Renders "Kept", after rejected markup calls when `reject` is set.
     *
     * @param {boolean} reject Whether to attempt the rejected markup first.
     * @param {string} outputName Test output file name without extension.
     * @returns {string} The page content streams as latin1 text.
     */
    var render = function (reject, outputName) {
      var recipe = new Recipe().createPage(200, 200);
      if (reject) {
        assert.throws(
          () =>
            recipe.text("Rejected", 20, 20, { underline: { color: "bogus" } }),
          { name: "TypeError", message: "Unknown annotation color (bogus)" },
        );
        assert.throws(
          () =>
            recipe.text("Rejected", 20, 20, { highlight: true, flag: "bogus" }),
          /Unknown annotation flag \(bogus\)/,
        );
      }
      recipe.text("Kept", 20, 60).endPage();
      var bytes = recipe.endPDF();
      writeOutput(outputName, bytes);
      var reader = muhammara.createReader(bytes);
      try {
        var page = reader.parsePage(0).getDictionary();
        assert.equal(page.exists("Annots"), false);
        var contents = reader.queryDictionaryObject(page, "Contents");
        var streams =
          contents.getType() === muhammara.ePDFObjectArray
            ? contents
                .toPDFArray()
                .toJSArray()
                .map((entry) =>
                  reader
                    .parseNewObject(
                      entry.toPDFIndirectObjectReference().getObjectID(),
                    )
                    .toPDFStream(),
                )
            : [contents.toPDFStream()];
        return streams
          .map((stream) => {
            var readStream = reader.startReadingFromStream(stream);
            var text = "";
            while (readStream.notEnded())
              text += Buffer.from(readStream.read(4096)).toString("latin1");
            return text;
          })
          .join("");
      } finally {
        reader.end();
      }
    };
    var kept = render(false, "annotation-markup-kept");
    assert.match(kept, /Tj/);
    assert.equal(render(true, "annotation-markup-rejected"), kept);
  });

  it("writes links, comments, and square annotations", async function () {
    var Recipe = await getRecipe();
    var pdf = new Recipe()
      .createPage(595, 842)
      .link("https://example.com", 50, 300, 160, 24)
      .text("Linked text", 50, 250, { link: "https://text.example.com" })
      .text('<a href="https://html.example.com">HTML link</a>', 180, 250, {
        html: true,
      })
      .image("logo", 50, 275, {
        width: 40,
        height: 40,
        keepAspectRatio: false,
        align: "center center",
        link: "https://image.example.com",
      })
      .rectangle(110, 300, 100, 24, {
        fill: "#dbeafe",
        link: "https://shape.example.com",
      })
      .rectangle(250, 100, 40, 40, {
        fill: "#dbeafe",
        useGivenCoords: true,
        link: "https://pdf-coordinates.example.com",
      })
      .comment("A browser comment", 250, 300, { title: "Muhammara" })
      .annot(350, 300, "Square", { width: 60, height: 30, text: "A square" })
      .endPage()
      .endPDF();
    writeOutput("annotations", pdf);
    var output = new TextDecoder().decode(pdf);
    assert.match(output, /A browser comment/);
    assert.match(output, /\/URI \(https:\/\/example.com\)/);
    assert.match(output, /\/Rect \[\s*50 518 210 542\s*\]/);
    assert.match(output, /\/Subtype \/Square/);
    assert.match(output, /\/URI \(https:\/\/text\.example\.com\)/);
    assert.match(output, /\/URI \(https:\/\/html\.example\.com\)/);
    assert.match(output, /\/URI \(https:\/\/image\.example\.com\)/);
    assert.match(output, /\/URI \(https:\/\/shape\.example\.com\)/);
    assert.match(output, /\/URI \(https:\/\/pdf-coordinates\.example\.com\)/);
    assert.match(output, /\/Rect \[\s*30 547 70 587\s*\]/);
    assert.match(output, /\/Rect \[\s*250 100 290 140\s*\]/);
  });
});
