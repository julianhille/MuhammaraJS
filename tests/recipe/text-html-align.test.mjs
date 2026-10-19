import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { drawnRuns } from "../support/flow.mjs";

var BOX_X = 20;
var BOX_WIDTH = 200;

/**
 * A file name part for a text and its box options.
 * @param {string} text - The laid out text.
 * @param {object} [box] - Text box options.
 * @returns {string} The slug.
 */
function slug(text, box) {
  return (text + JSON.stringify(box || {}))
    .replace(/\u00a0/g, "nbsp")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

describeEnds("Recipe HTML text alignment", function (end) {
  /**
   * Lay a single text box out with Arial, write the PDF for review, and
   * return the start x of every text run.
   * @param {string} text - Text or HTML to lay out.
   * @param {boolean} html - Whether `text` is HTML.
   * @param {string} textAlign - Text box alignment.
   * @param {object} [box] - Text box options that replace the defaults.
   * @returns {number[]} Start x of every text run, in drawing order.
   */
  function layout(text, html, textAlign, box) {
    var bytes = end
      .newRecipe()
      .createPage(300, 300)
      .text(text, BOX_X, 20, {
        font: "arial",
        size: 12,
        html: html,
        textBox: Object.assign(
          { width: BOX_WIDTH, padding: 0, textAlign: textAlign },
          box,
        ),
      })
      .endPage()
      .endPDF();
    writeOutput(
      end,
      `text-html-align-${textAlign}-${html ? "html" : "plain"}-${slug(text, box)}`,
      bytes,
    );
    return drawnRuns(end, bytes).map((run) => run.x);
  }

  /**
   * xMax of a run measured with Arial, as the layout measures it.
   * @param {string} text - Text to measure.
   * @returns {number} The measured xMax.
   */
  function runExtent(text) {
    var recipe = end.newRecipe().createPage(300, 300);
    var extent = recipe.textDimensions(text, { font: "arial", size: 12 }).xMax;
    writeOutput(
      end,
      `text-html-align-extent-${slug(text)}`,
      recipe.endPage().endPDF(),
    );
    return extent;
  }

  // Regression for #708: HTML lines were measured one space wider than they
  // are drawn, so every aligned line sat a space (centered: half a space)
  // to the left of the same text without `html`.
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

  // Regression for #930: the spaces that end a line were measured as part of
  // it, so centered and right-aligned text moved left. Every line ends with
  // its last word; non-breaking spaces and clipped text keep their spaces.
  ["center", "right"].forEach(function (textAlign) {
    it(`ignores trailing spaces when ${textAlign} aligned`, function () {
      var expected = layout("alpha bravo", false, textAlign);
      assert.deepEqual(layout("alpha bravo ", false, textAlign), expected);
      assert.deepEqual(layout("alpha bravo   ", false, textAlign), expected);
      assert.deepEqual(layout("alpha bravo   ", true, textAlign), expected);
      assert.deepEqual(
        layout("alpha bravo\ncharlie   ", false, textAlign),
        layout("alpha bravo\ncharlie", false, textAlign),
      );
    });

    it(`ignores the trailing spaces of every HTML block when ${textAlign} aligned`, function () {
      assert.deepEqual(
        layout("<p>alpha   </p><p>bravo</p>", true, textAlign),
        layout("<p>alpha</p><p>bravo</p>", true, textAlign),
      );
      assert.deepEqual(
        layout("<ul><li>alpha  </li><li>bravo  </li></ul>", true, textAlign),
        layout("<ul><li>alpha</li><li>bravo</li></ul>", true, textAlign),
      );
    });

    it(`ignores the trailing spaces of every HTML block in a flow when ${textAlign} aligned`, function () {
      /**
       * Lay HTML out as a flow that the next call ends.
       * @param {string} html - HTML to lay out.
       * @returns {number[]} Start x of every text run.
       */
      var flowLayout = function (html) {
        var bytes = end
          .newRecipe()
          .createPage(300, 300)
          .text(html, BOX_X, 20, {
            font: "arial",
            size: 12,
            html: true,
            flow: true,
            textBox: { width: BOX_WIDTH, padding: 0, textAlign: textAlign },
          })
          .text("", { flow: false })
          .endPage()
          .endPDF();
        writeOutput(
          end,
          `text-html-align-${textAlign}-flow-${slug(html)}`,
          bytes,
        );
        return drawnRuns(end, bytes).map((run) => run.x);
      };
      assert.deepEqual(
        flowLayout("<p>alpha   </p><p>bravo</p>"),
        flowLayout("<p>alpha</p><p>bravo</p>"),
      );
    });

    it(`keeps trailing non-breaking spaces when ${textAlign} aligned`, function () {
      var nbsp = layout("alpha\u00a0\u00a0", false, textAlign);
      assert.notDeepEqual(nbsp, layout("alpha", false, textAlign));
      assert.deepEqual(layout("alpha\u00a0\u00a0 ", false, textAlign), nbsp);
      assert.equal(
        layout("alpha\u00a0\u00a0\nbravo", false, textAlign)[0],
        nbsp[0],
      );
      assert.equal(
        layout("<p>alpha&nbsp;&nbsp;</p><p>bravo</p>", true, textAlign)[0],
        nbsp[0],
      );
      var narrow = { width: 60 };
      assert.equal(
        layout("alpha\u00a0\u00a0 bravo", false, textAlign, narrow)[0],
        layout("alpha\u00a0\u00a0", false, textAlign, narrow)[0],
      );
    });

    it(`keeps the trailing spaces of clipped text when ${textAlign} aligned`, function () {
      var clip = { wrap: "clip" };
      assert.ok(
        layout("alpha   ", false, textAlign, clip)[0] <
          layout("alpha", false, textAlign, clip)[0],
      );
      assert.equal(
        layout("alpha   \nbravo", false, textAlign, clip)[0],
        layout("alpha   ", false, textAlign, clip)[0],
      );
    });
  });

  it("ends a multi-segment HTML line at the box edge when right aligned", function () {
    var starts = layout("<b>a</b> b", true, "right");
    assert.equal(starts.length, 2, "the line is drawn as two styled runs");
    // Before #708 the line stopped a full space short of the box edge.
    assert.equal(starts[1] + runExtent(" b"), BOX_X + BOX_WIDTH);
  });

  it("centers a multi-segment HTML line inside the text box", function () {
    var starts = layout("<b>a</b> b", true, "center");
    assert.equal(starts.length, 2, "the line is drawn as two styled runs");
    // Before #708 the line sat half a space left of centre.
    assert.equal(
      starts[0] - BOX_X,
      BOX_X + BOX_WIDTH - (starts[1] + runExtent(" b")),
    );
  });

  it("writes every aligned pair to one page for review", function () {
    var recipe = end.newRecipe().createPage(300, 300);
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
    writeOutput(end, "text-html-align", bytes);
    // Every alignment draws "one" in four boxes and "two" in two.
    var texts = drawnRuns(end, bytes).map((run) => run.text.trim());
    assert.equal(texts.filter((text) => text === "one").length, 12);
    assert.equal(texts.filter((text) => text === "two").length, 6);
  });
});
