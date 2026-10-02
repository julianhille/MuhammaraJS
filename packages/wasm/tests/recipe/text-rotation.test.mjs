// Ports tests/recipe/text-rotation.js.
import assert from "node:assert/strict";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

/**
 * The `cm` operators of an uncompressed PDF, in order.
 * @param {Uint8Array} pdf - The PDF bytes.
 * @returns {string[]} Each operator's six operands joined by single spaces.
 */
function cmOperators(pdf) {
  var content = new TextDecoder("latin1").decode(pdf);
  return [...content.matchAll(/((?:-?[\d.]+\s+){6})cm\b/g)].map((match) =>
    match[1].trim().split(/\s+/).join(" "),
  );
}

/**
 * The rotation a positive 30 degree `rotation` writes around a PDF point:
 * clockwise, as native Recipe turns it.
 * @param {number} x - The PDF x of the pivot.
 * @param {number} y - The PDF y of the pivot.
 * @returns {string[]} The three `cm` operands around the pivot.
 */
function clockwiseAround(x, y) {
  return [
    `1 0 0 1 ${x} ${y}`,
    "0.866025 -0.5 0.5 0.866025 0 0",
    `1 0 0 1 ${-x} ${-y}`,
  ];
}

describe("Text Rotation", function () {
  it("Add text with rotation", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe();
    [0, 1, 45, -45, 90, 135, -135, 180, 270, 360, -90, -180, -270, -360, 450]
      // One page per angle, as native draws them over test.pdf's pages.
      .forEach((angle) => {
        recipe
          .createPage(595, 842)
          .circle(297, 421, 10, { stroke: "#0032FF" })
          .text(`${angle} ROTATION pjqy`, 297, 421, {
            font: "arial",
            size: 40,
            color: "#0000FF",
            align: "center center",
            rotation: angle,
            opacity: 0.5,
          })
          .endPage();
      });
    writeOutput("text-rotation", recipe.endPDF());
  });

  it("turns text clockwise around its position", async function () {
    var Recipe = await getRecipe();
    var pdf = new Recipe({ compress: false })
      .createPage(400, 400)
      .text("alpha", 100, 100, { font: "arial", rotation: 30 })
      .endPage()
      .endPDF();
    writeOutput("text-rotation-clockwise", pdf);
    // Recipe (100, 100) is PDF (100, 300) on a 400 point high page. Native
    // Recipe asserts the same direction and pivot in text-rotation.js.
    assert.deepEqual(cmOperators(pdf), clockwiseAround(100, 300));
  });

  it("turns every line around the text position, before alignment", async function () {
    var Recipe = await getRecipe();
    var pdf = new Recipe({ compress: false })
      .createPage(400, 400)
      .text("alpha beta gamma delta", 200, 100, {
        font: "arial",
        rotation: 30,
        align: "center center",
        textBox: { width: 60 },
      })
      .endPage()
      .endPDF();
    var operators = cmOperators(pdf);
    assert.ok(operators.length > 3, "the text wraps onto several lines");
    // Each line repeats the same pivot instead of turning around its own
    // baseline, so the lines stay one block as on native.
    for (var index = 0; index < operators.length; index += 3) {
      assert.deepEqual(
        operators.slice(index, index + 3),
        clockwiseAround(200, 300),
      );
    }
  });

  it("turns a clipped line's clip box with its text", async function () {
    var Recipe = await getRecipe();
    var pdf = new Recipe({ compress: false })
      .createPage(400, 400)
      .text("alpha beta gamma", 100, 100, {
        font: "arial",
        rotation: 30,
        textBox: { width: 60, height: 20, wrap: "clip" },
      })
      .endPage()
      .endPDF();
    writeOutput("text-rotation-clip", pdf);
    var content = new TextDecoder("latin1").decode(pdf);
    // Native clips each rotated line inside its form, so the clip turns with
    // the text: turn, clip, turn back, then draw the turned text.
    var turn = clockwiseAround(100, 300).join("\\s+cm\\s+");
    var turnBack = turn.replace(
      "0.866025 -0.5 0.5 0.866025",
      "0.866025 0.5 -0.5 0.866025",
    );
    assert.match(
      content,
      new RegExp(
        `${turn}\\s+cm\\s+[\\d.\\s-]+re\\s+W\\s+n\\s+${turnBack}\\s+cm[\\s\\S]*${turn}\\s+cm`,
      ),
    );
  });

  it("turns a text link with its text", async function () {
    var Recipe = await getRecipe();
    var pdf = new Recipe({ compress: false })
      .createPage(400, 400)
      .text("alpha", 100, 100, {
        font: "arial",
        rotation: 30,
        link: "https://example.com",
      })
      .endPage()
      .endPDF();
    var rect = new TextDecoder("latin1")
      .decode(pdf)
      .match(/\/Rect \[\s*([^\]]+)\]/)[1]
      .trim()
      .split(/\s+/)
      .map(Number);
    // Turning clockwise around the text's top-left corner, PDF (100, 300),
    // swings the text down and to the left of it, never above it.
    assert.ok(rect[0] < 100, `left ${rect[0]} is left of the pivot`);
    assert.ok(rect[3] <= 300, `top ${rect[3]} is not above the pivot`);
  });
});
