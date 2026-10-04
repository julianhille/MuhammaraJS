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

  /**
   * Lays a single text box out with the shared Arial fixture and writes the
   * PDF for manual review.
   *
   * @param {string} text Text or HTML to lay out.
   * @param {boolean} html Whether the text is HTML.
   * @param {string} textAlign Text box alignment.
   * @param {string} outputName Test output file name without extension.
   * @param {Object} [box] Text box options that replace the defaults.
   * @returns {number[]} Horizontal start of each drawn text run.
   */
  function layout(text, html, textAlign, outputName, box) {
    var recipe = new Recipe().createPage(300, 300);
    recipe.text(text, BOX_X, 20, {
      font: "arial",
      size: 12,
      html: html,
      textBox: Object.assign(
        { width: BOX_WIDTH, padding: 0, textAlign: textAlign },
        box,
      ),
    });
    var bytes = recipe.endPage().endPDF();
    writeOutput(outputName, bytes);
    return textStarts(muhammara, bytes);
  }

  /**
   * xMax of a run measured with the fixture font, as the layout measures it.
   *
   * @param {string} text Text to measure.
   * @param {string} outputName Test output file name without extension.
   * @returns {number} The measured xMax.
   */
  function runExtent(text, outputName) {
    var recipe = new Recipe().createPage(300, 300);
    var extent = recipe.textDimensions(text, { font: "arial", size: 12 }).xMax;
    writeOutput(outputName, recipe.endPage().endPDF());
    return extent;
  }

  // Mirrors the native assertions for #708, where HTML lines were measured a
  // space wider than they are drawn and every aligned line sat left of the
  // same text without `html`. Wasm already aligned them correctly; these hold
  // the two ends together.
  ["center", "right", "justify"].forEach(function (textAlign) {
    it(`aligns single-segment HTML like plain text when ${textAlign}`, function () {
      assert.deepEqual(
        layout(
          "one",
          true,
          textAlign,
          `text-html-align-single-${textAlign}-html`,
        ),
        layout(
          "one",
          false,
          textAlign,
          `text-html-align-single-${textAlign}-plain`,
        ),
      );
    });

    it(`aligns HTML lines ended by <br> like plain text when ${textAlign}`, function () {
      assert.deepEqual(
        layout(
          "one<br>two",
          true,
          textAlign,
          `text-html-align-br-${textAlign}-html`,
        ),
        layout(
          "one\ntwo",
          false,
          textAlign,
          `text-html-align-br-${textAlign}-plain`,
        ),
      );
    });

    it(`aligns wrapped HTML like plain text when ${textAlign}`, function () {
      var wrapping = "one two three four five six seven";
      assert.deepEqual(
        layout(
          wrapping,
          true,
          textAlign,
          `text-html-align-wrapped-${textAlign}-html`,
        ),
        layout(
          wrapping,
          false,
          textAlign,
          `text-html-align-wrapped-${textAlign}-plain`,
        ),
      );
    });
  });

  // Mirrors the native assertions for #930, where the spaces that end a line
  // moved centered and right-aligned text left. Wasm already ended every line
  // with its last word and kept non-breaking spaces and clipped text; these
  // hold the two ends together.
  ["center", "right"].forEach(function (textAlign) {
    it(`ignores trailing spaces when ${textAlign} aligned`, function () {
      var name = `text-html-align-trailing-${textAlign}`;
      var expected = layout("alpha bravo", false, textAlign, `${name}-none`);
      assert.deepEqual(
        layout("alpha bravo ", false, textAlign, `${name}-one`),
        expected,
      );
      assert.deepEqual(
        layout("alpha bravo   ", false, textAlign, `${name}-three`),
        expected,
      );
      assert.deepEqual(
        layout("alpha bravo   ", true, textAlign, `${name}-html`),
        expected,
      );
      assert.deepEqual(
        layout("alpha bravo\ncharlie   ", false, textAlign, `${name}-lines`),
        layout("alpha bravo\ncharlie", false, textAlign, `${name}-lines-none`),
      );
    });

    it(`ignores the trailing spaces of every HTML block when ${textAlign} aligned`, function () {
      var name = `text-html-align-trailing-${textAlign}`;
      assert.deepEqual(
        layout("<p>alpha   </p><p>bravo</p>", true, textAlign, `${name}-p`),
        layout("<p>alpha</p><p>bravo</p>", true, textAlign, `${name}-p-none`),
      );
      assert.deepEqual(
        layout(
          "<ul><li>alpha  </li><li>bravo  </li></ul>",
          true,
          textAlign,
          `${name}-li`,
        ),
        layout(
          "<ul><li>alpha</li><li>bravo</li></ul>",
          true,
          textAlign,
          `${name}-li-none`,
        ),
      );
    });

    it(`ignores the trailing spaces of every HTML block in a flow when ${textAlign} aligned`, function () {
      /**
       * Lays HTML out as a flow that the next call ends.
       * @param {string} html HTML to lay out.
       * @param {string} outputName Test output file name without extension.
       * @returns {number[]} Horizontal start of each drawn text run.
       */
      var flowLayout = function (html, outputName) {
        var recipe = new Recipe().createPage(300, 300);
        recipe
          .text(html, BOX_X, 20, {
            font: "arial",
            size: 12,
            html: true,
            flow: true,
            textBox: { width: BOX_WIDTH, padding: 0, textAlign: textAlign },
          })
          .text("", { flow: false });
        var bytes = recipe.endPage().endPDF();
        writeOutput(outputName, bytes);
        return textStarts(muhammara, bytes);
      };
      var name = `text-html-align-trailing-${textAlign}-flow`;
      assert.deepEqual(
        flowLayout("<p>alpha   </p><p>bravo</p>", `${name}-p`),
        flowLayout("<p>alpha</p><p>bravo</p>", `${name}-p-none`),
      );
    });

    it(`keeps trailing non-breaking spaces when ${textAlign} aligned`, function () {
      var name = `text-html-align-nbsp-${textAlign}`;
      var nbsp = layout("alpha\u00a0\u00a0", false, textAlign, name);
      assert.notDeepEqual(
        nbsp,
        layout("alpha", false, textAlign, `${name}-none`),
      );
      assert.deepEqual(
        layout("alpha\u00a0\u00a0 ", false, textAlign, `${name}-space`),
        nbsp,
      );
      assert.equal(
        layout(
          "alpha\u00a0\u00a0\nbravo",
          false,
          textAlign,
          `${name}-lines`,
        )[0],
        nbsp[0],
      );
      assert.equal(
        layout(
          "<p>alpha&nbsp;&nbsp;</p><p>bravo</p>",
          true,
          textAlign,
          `${name}-html`,
        )[0],
        nbsp[0],
      );
      var narrow = { width: 60 };
      assert.equal(
        layout(
          "alpha\u00a0\u00a0 bravo",
          false,
          textAlign,
          `${name}-wrapped`,
          narrow,
        )[0],
        layout(
          "alpha\u00a0\u00a0",
          false,
          textAlign,
          `${name}-narrow`,
          narrow,
        )[0],
      );
    });

    it(`keeps the trailing spaces of clipped text when ${textAlign} aligned`, function () {
      var name = `text-html-align-clip-${textAlign}`;
      var clip = { wrap: "clip" };
      assert.ok(
        layout("alpha   ", false, textAlign, name, clip)[0] <
          layout("alpha", false, textAlign, `${name}-none`, clip)[0],
      );
      assert.equal(
        layout("alpha   \nbravo", false, textAlign, `${name}-lines`, clip)[0],
        layout("alpha   ", false, textAlign, `${name}-plain`, clip)[0],
      );
    });
  });

  it("ends a multi-segment HTML line at the box edge when right aligned", function () {
    var starts = layout(
      "<b>a</b> b",
      true,
      "right",
      "text-html-align-multi-segment-right",
    );
    assert.equal(starts.length, 2, "the line is drawn as two styled runs");
    assert.equal(
      starts[1] + runExtent(" b", "text-html-align-multi-segment-right-extent"),
      BOX_X + BOX_WIDTH,
    );
  });

  it("centers a multi-segment HTML line inside the text box", function () {
    var starts = layout(
      "<b>a</b> b",
      true,
      "center",
      "text-html-align-multi-segment-center",
    );
    assert.equal(starts.length, 2, "the line is drawn as two styled runs");
    assert.equal(
      starts[0] - BOX_X,
      BOX_X +
        BOX_WIDTH -
        (starts[1] +
          runExtent(" b", "text-html-align-multi-segment-center-extent")),
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
