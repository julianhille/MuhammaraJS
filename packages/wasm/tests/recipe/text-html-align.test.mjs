import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

var BOX_X = 20;
var BOX_WIDTH = 200;

function pageContent(muhammara, bytes) {
  var reader = muhammara.createReader(new muhammara.PDFRStreamForBuffer(bytes));
  var page = reader.parsePage(0).getDictionary();
  var contents = reader.queryDictionaryObject(page, "Contents");
  var streams =
    contents.getType() === muhammara.ePDFObjectArray
      ? contents
          .toPDFArray()
          .toJSArray()
          .map(function (reference) {
            return reader.parseNewObject(
              reference.toPDFIndirectObjectReference().getObjectID(),
            );
          })
      : [contents];
  return streams
    .map(function (stream) {
      var input = reader.startReadingFromStream(stream.toPDFStream());
      var chunk = [];
      while (input.notEnded()) chunk.push(...input.read(4096));
      return new TextDecoder("latin1").decode(new Uint8Array(chunk));
    })
    .join("\n");
}

/** Start x of every text run the page positions, in drawing order. */
function textStarts(muhammara, bytes) {
  return Array.from(
    pageContent(muhammara, bytes).matchAll(/1 0 0 1 ([-\d.]+) [-\d.]+ Tm/g),
    function (match) {
      return Number(match[1]);
    },
  );
}

describe("Recipe HTML text alignment", function () {
  var muhammara;
  var Recipe;

  before(async function () {
    muhammara = await createMuhammaraWasm();
    Recipe = await getRecipe();
  });

  /** Lays a single text box out with the shared Arial fixture. */
  function layout(text, html, textAlign) {
    var recipe = new Recipe().createPage(300, 300);
    recipe.text(text, BOX_X, 20, {
      font: "arial",
      size: 12,
      html: html,
      textBox: { width: BOX_WIDTH, padding: 0, textAlign: textAlign },
    });
    return textStarts(muhammara, recipe.endPage().endPDF());
  }

  /** xMax of a run measured with the fixture font, as the layout measures it. */
  function runExtent(text) {
    var recipe = new Recipe().createPage(300, 300);
    return recipe.textDimensions(text, { font: "arial", size: 12 }).xMax;
  }

  // Mirrors the native assertions for #708, where HTML lines were measured a
  // space wider than they are drawn and every aligned line sat left of the
  // same text without `html`. Wasm already aligned them correctly; these hold
  // the two ends together.
  ["center", "right", "justify"].forEach(function (textAlign) {
    it(`aligns single-segment HTML like plain text when ${textAlign}`, function () {
      assert.deepEqual(
        layout("one", true, textAlign),
        layout("one", false, textAlign),
      );
    });

    it(`aligns HTML lines ended by <br> like plain text when ${textAlign}`, function () {
      assert.deepEqual(
        layout("one<br>two", true, textAlign),
        layout("one\ntwo", false, textAlign),
      );
    });

    it(`aligns wrapped HTML like plain text when ${textAlign}`, function () {
      var wrapping = "one two three four five six seven";
      assert.deepEqual(
        layout(wrapping, true, textAlign),
        layout(wrapping, false, textAlign),
      );
    });
  });

  it("ends a multi-segment HTML line at the box edge when right aligned", function () {
    var starts = layout("<b>a</b> b", true, "right");
    assert.equal(starts.length, 2, "the line is drawn as two styled runs");
    assert.equal(starts[1] + runExtent(" b"), BOX_X + BOX_WIDTH);
  });

  it("centers a multi-segment HTML line inside the text box", function () {
    var starts = layout("<b>a</b> b", true, "center");
    assert.equal(starts.length, 2, "the line is drawn as two styled runs");
    assert.equal(
      starts[0] - BOX_X,
      BOX_X + BOX_WIDTH - (starts[1] + runExtent(" b")),
    );
  });

  it("writes every aligned pair to one page for review", function () {
    var recipe = new Recipe().createPage(300, 300);
    var y = 20;
    ["center", "right", "justify"].forEach(function (textAlign) {
      [
        ["one", "one"],
        ["one\ntwo", "one<br>two"],
        ["a b", "<b>a</b> b"],
      ].forEach(function (pair) {
        [false, true].forEach(function (html) {
          recipe.text(pair[html ? 1 : 0], BOX_X, y, {
            font: "arial",
            size: 12,
            html: html,
            textBox: {
              width: BOX_WIDTH,
              padding: 0,
              textAlign: textAlign,
              style: { stroke: "#cccccc", lineWidth: 0.5 },
            },
          });
          y += 40;
        });
      });
    });
    var bytes = recipe.endPage().endPDF();
    writeOutput("text-html-align", bytes);
    assert.ok(bytes.length > 0);
  });
});
