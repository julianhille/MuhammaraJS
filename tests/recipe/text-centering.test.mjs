// Merges packages/native-with-source/tests/recipe/text-centering.js; Wasm had
// no counterpart. The page is a visual sample; the assertions check the
// alignment it shows.
import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { textRuns } from "../support/pdf.mjs";
import { arialFont, placedRuns, turnClockwise } from "../support/text.mjs";

var ROTATED = {
  color: "#000000",
  font: "Arial",
  size: 70,
  opacity: 0.6,
  textBox: {
    width: 140,
    textAlign: "center",
    padding: [0, 0, 0, 0],
    style: { stroke: "#000000", lineWidth: 1, fill: "#ffff00" },
  },
};

/**
 * Draw the text-centering sample page.
 * @param {object} recipe - The Recipe with an open letter page.
 * @returns {object} The Recipe.
 */
function drawSample(recipe) {
  var fs = 20;
  var x = 450;
  var y = 100;
  var w = 70;
  var p = 8;
  var h = 28;
  recipe
    .circle(30, 220, 2, { stroke: "red" })
    .text("NO_Space_Breaks_And_Wrap=false_gives_Ellipsis", 350, 27, {
      color: "red",
      size: 10,
      font: "arial",
      textBox: { width: 215, wrap: false },
    })
    .text("Crusty", 30, 220, {
      color: "#000000",
      font: "Arial",
      size: 12,
      textBox: {
        width: 300,
        textAlign: "center",
        padding: 0,
        style: { stroke: "#000000", lineWidth: 0.5, fill: "#ffffff" },
      },
    })
    .circle(30, 50, 2, { stroke: "red" })
    .text("Dusty", 30, 50, {
      color: "#000000",
      font: "Arial",
      size: 30,
      textBox: {
        width: 300,
        textAlign: "center",
        padding: 0,
        style: { stroke: "#000000", lineWidth: 0.5, fill: "#ffffff" },
      },
    })
    .circle(30, 120, 2, { stroke: "red" })
    .text("{o}", 30, 120, {
      color: "#000000",
      font: "Arial",
      size: 70,
      opacity: 0.6,
      textBox: {
        width: 300,
        textAlign: "center",
        padding: [0, 0, 0, 0],
        style: { stroke: "#000000", lineWidth: 0.5, fill: "#ffff00" },
      },
    })
    .circle(30, 260, 2, { stroke: "red" })
    .text("A\nAAA\nOOO\nVVV\n{0}", 30, 260, {
      color: "#000000",
      font: "Arial",
      size: 20,
      textBox: {
        width: 300,
        textAlign: "center",
        padding: 0,
        style: { fill: "#ffff00" },
      },
    })
    .text(
      "<-- Text with line height applied\n            (1.16% font size).",
      340,
      490,
    )
    .text("A\nAAA\nOOO\nVVV\n|", 30, 400, {
      color: "#000000",
      font: "Arial",
      size: fs,
      textBox: {
        width: 300,
        textAlign: "center",
        padding: 2,
        lineHeight: 1.16 * fs, // percentage of font size
        style: { fill: "default" },
      },
    })
    .circle(30, 400, 2, { stroke: "red" })
    .circle(330, 400, 2, { stroke: "red" })
    .line(
      [
        [180, 25],
        [180, 425],
      ],
      { stroke: "#ff00ff", lineWidth: 0.5 },
    );

  recipe.text("Rotation should occur\naround red dot below.", 400, 50);
  recipe.circle(x, y, 2, { stroke: "red" });
  for (var angle = 5; angle <= 45; angle += 5) {
    recipe.text("{o}", x, y, { ...ROTATED, rotation: angle });
  }

  y = 280;
  recipe
    .text(`[${p},0,0,0]`, x + 10, y - 25)
    .text(`TOP\nPad ${p}`, x, y, {
      color: "#000000",
      textBox: {
        width: w,
        textAlign: "center",
        padding: [p, 0, 0, 0],
        style: { stroke: "#000000", lineWidth: 0.5, fill: "#ffff00" },
      },
    })
    .line(
      [
        [x - 5, y + p],
        [x + w + 5, y + p],
      ],
      { lineWidth: 0.5, stroke: "red", lineCap: "butt" },
    )
    .circle(x, y, 2, { stroke: "red" });

  y = 400;
  recipe
    .text(`[0,0,${p},0]`, x + 10, y - 17)
    .text(`BOTTOM Pad ${p}`, x, y, {
      color: "#000000",
      textBox: {
        width: w,
        textAlign: "center bottom",
        padding: [0, 0, p, 0],
        style: { stroke: "#000000", lineWidth: 0.5, fill: "#ffff00" },
      },
    })
    .line(
      [
        [x - 5, y + h],
        [x + w + 5, y + h],
      ],
      { lineWidth: 0.5, stroke: "red", lineCap: "butt" },
    )
    .circle(x, y, 2, { stroke: "red" });

  x = 500;
  y = 340;
  recipe
    .text(`[0,${p},0,0]`, x + 10, y - 17)
    .text(`RIGHT Pad ${p}`, x, y, {
      color: "#000000",
      textBox: {
        width: w,
        textAlign: "right",
        padding: [0, p, 0, 0],
        style: { stroke: "#000000", lineWidth: 0.5, fill: "#ffff00" },
      },
    })
    .line(
      [
        [x + w - p, y - 5],
        [x + w - p, y + h + 5],
      ],
      { lineWidth: 0.5, stroke: "red", lineCap: "butt" },
    )
    .circle(x, y, 2, { stroke: "red" });

  x = 400;
  recipe
    .text(`[0,0,0,${p}]`, x + 10, y - 17)
    .text(`LEFT\nPad ${p}`, x, y, {
      color: "#000000",
      textBox: {
        width: w,
        textAlign: "left",
        padding: [0, 0, 0, p],
        style: { stroke: "#000000", lineWidth: 0.5, fill: "#ffff00" },
      },
    })
    .line(
      [
        [x + p, y - 5],
        [x + p, y + h + 5],
      ],
      { lineWidth: 0.5, stroke: "red", lineCap: "butt" },
    )
    .circle(x, y, 2, { stroke: "red" });

  recipe
    .text(
      'Using horizontal "justify" setting with default "top" vertical setting, no height.',
      40,
      535,
      {
        color: "#000000",
        textBox: {
          width: 130,
          textAlign: "justify",
          style: { stroke: "#ffff00", lineWidth: 0.5 },
        },
      },
    )
    .text(
      '... now with "justify center" setting and specific height',
      180,
      535,
      {
        textBox: {
          width: 130,
          height: 70,
          textAlign: "justify center",
          style: { stroke: "#ff0000", lineWidth: 0.5 },
        },
      },
    )
    .text(
      '... finally, using "justify bottom" setting with specific height',
      320,
      535,
      {
        color: "blue",
        textBox: {
          width: 140,
          height: 70,
          textAlign: "justify bottom",
          style: { stroke: "#ff00ff", lineWidth: 0.5 },
        },
      },
    )
    .text(
      "Oh, wait a minute. How about a justification view without any box drawn. It gives you the sense of an old fashioned newspaper column.",
      470,
      535,
      {
        color: "#000000",
        size: 10,
        textBox: { width: 120, height: 70, textAlign: "justify" },
      },
    );

  h = 70;
  var boxed = { stroke: "#000000", lineWidth: 0.5 };
  return recipe
    .circle(40, 625, 2, { stroke: "red" })
    .text(
      "text box without\nheight or\nminHeight\n setting\nauto fits text",
      40,
      625,
      {
        color: "#000000",
        textBox: { width: 100, textAlign: "center", style: boxed },
      },
    )
    .circle(150, 625, 2, { stroke: "red" })
    .circle(150, 625 + h, 2, { stroke: "red" })
    .text(
      `minHeight: ${h}\nBox will not collapse when not enough text to fill it. It will auto grow when text exceeds minHeight.`,
      150,
      625,
      {
        color: "#000000",
        size: 9,
        textBox: { width: 100, minHeight: h, style: boxed },
      },
    )
    .text("text at\ncenter center", 265, 625, {
      color: "#000000",
      textBox: {
        width: 100,
        minHeight: h,
        textAlign: "center center",
        style: boxed,
      },
    })
    .text("text at\ncenter bottom", 380, 625, {
      color: "#000000",
      textBox: {
        width: 100,
        minHeight: h,
        textAlign: "center bottom",
        style: boxed,
      },
    })
    .text("text at\nright bottom", 500, 625, {
      color: "#000000",
      textBox: {
        width: 100,
        minHeight: h,
        textAlign: "right bottom",
        style: boxed,
      },
    })
    .text(
      'This is what happens when you use "height" and have too much text',
      40,
      725,
      {
        color: "#000000",
        textBox: { width: 125, height: 40, style: boxed },
      },
    )
    .text("Using height and supplying textAlign: center center", 180, 725, {
      color: "#000000",
      textBox: {
        width: 120,
        height: 40,
        textAlign: "center center",
        style: boxed,
      },
    })
    .text('Using "height" and supplying textAlign: right bottom', 310, 725, {
      color: "#000000",
      textBox: {
        width: 100,
        height: 40,
        textAlign: "right bottom",
        style: boxed,
      },
    })
    .text(
      "Showing text with\nellipsis when wrap\ndisabled on the last line",
      440,
      725,
      {
        color: "#000000",
        size: 10,
        textBox: {
          width: 100,
          height: 40,
          wrap: "ellipsis",
          style: boxed,
        },
      },
    );
}

describeEnds("Recipe text centering", function (end) {
  var bytes;
  var runs;

  before(function () {
    bytes = drawSample(end.newRecipe().createPage("letter")).endPage().endPDF();
    writeOutput(end, "text-centering", bytes);
    runs = textRuns(end, bytes);
  });

  it("centers text of every size on the box center", function () {
    var font = arialFont(end);
    [
      ["Crusty", 12],
      ["Dusty", 30],
      ["A", 20],
      ["AAA", 20],
      ["OOO", 20],
      ["VVV", 20],
      ["{0}", 20],
    ].forEach(([text, size]) => {
      var run = runs.find((candidate) => candidate.text === text);
      var center = run.x + font.calculateTextDimensions(text, size).xMax / 2;
      // The 300 point boxes start at x 30.
      assert.ok(Math.abs(center - 180) < 0.5, `${text} ${center}`);
    });
  });

  it("ellipsizes an unbreakable line when wrapping is off", function () {
    var line = runs.find((run) => run.text.startsWith("NO_Space"));
    assert.match(line.text, /…$/);
    var last = runs.findLast((run) => run.text.startsWith("disabled"));
    assert.match(last.text, /…$/);
  });

  it("ends right-aligned lines at the box edge", function () {
    var measure = end.newRecipe().createPage("letter");
    var edges = ["text at", "right bottom"].map((text) => {
      var run = runs.findLast((candidate) => candidate.text === text);
      return run.x + measure.textDimensions(text).xMax;
    });
    // The 100 point box starts at x 500.
    edges.forEach((edge) =>
      assert.ok(Math.abs(edge - 600) < 0.5, JSON.stringify(edges)),
    );
  });

  it("turns rotated text around its position", function () {
    var upright = placedRuns(
      end,
      end
        .newRecipe()
        .createPage("letter")
        .text("{o}", 450, 100, ROTATED)
        .endPage()
        .endPDF(),
    )[0];
    var turned = placedRuns(end, bytes).filter((run) => run.text === "{o}");
    // The upright one in the 300 point box, then one per 5 degrees.
    assert.equal(turned.length, 10);
    turned.slice(1).forEach((run, index) => {
      var angle = 5 * (index + 1);
      // Recipe (450, 100) is PDF (450, 692) on the 792 point high page.
      var [x, y] = turnClockwise([upright.x, upright.y], [450, 692], angle);
      assert.ok(Math.abs(run.x - x) < 0.01, `${angle}: x ${run.x} ${x}`);
      assert.ok(Math.abs(run.y - y) < 0.01, `${angle}: y ${run.y} ${y}`);
    });
  });
});
