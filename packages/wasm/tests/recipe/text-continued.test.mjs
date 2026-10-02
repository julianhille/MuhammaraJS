// Ports the flow assertions from tests/recipe/text-continued.js (issue #888).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRecipe } from "../../index.js";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

/**
 * Lists the text runs drawn in uncompressed PDF bytes, in drawing order.
 * @param {Uint8Array} bytes - The PDF bytes.
 * @returns {Array<{text: string, x: number, y: number, color: string}>} The runs with their
 *   text-matrix position in PDF points and fill color.
 */
function drawnRuns(bytes) {
  var content = Buffer.from(bytes).toString("latin1");
  return [
    ...content.matchAll(
      /(-?[\d.]+) (-?[\d.]+) Tm[^()<>]*?(?:\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f]*)>) Tj/g,
    ),
  ].map((match) => ({
    text:
      match[3]?.replace(/\\(.)/g, "$1") ??
      Buffer.from(match[4], "hex").toString("latin1"),
    x: Number(match[1]),
    y: Number(match[2]),
    // The last fill color set before the run.
    color: content.slice(0, match.index).match(/[^]*\s(\S+ \S+ \S+) rg\s/)?.[1],
  }));
}

/**
 * Where native places the run after a run: at its right edge, plus the width
 * of an "o" when it ends with a space.
 * @param {Recipe} recipe - Recipe that measures.
 * @param {string} text - The run before.
 * @param {RecipeTextOptions} options - Its options.
 * @returns {number} The distance between the two runs' starts.
 */
function runAdvance(recipe, text, options) {
  return (
    recipe.textDimensions(text, options).xMax +
    (text.endsWith(" ") ? recipe.textDimensions("o", options).width : 0)
  );
}

/**
 * Draws on one 400 x 400 page and returns the runs it drew.
 * @param {string} name - Output file name without extension.
 * @param {function(Recipe): void} draw - Draws on the page.
 * @returns {Promise<Array<{text: string, x: number, y: number}>>} The drawn runs.
 */
async function drawRuns(name, draw) {
  var Recipe = await getRecipe();
  var recipe = new Recipe({ compress: false }).createPage(400, 400);
  draw(recipe);
  var bytes = recipe.endPage().endPDF();
  writeOutput(name, bytes);
  return drawnRuns(bytes);
}

describe("Text - Continued", function () {
  it("Simple text segmentation", async function () {
    var Recipe = await getRecipe();
    var segments = [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam in " +
        "suscipit purus. Vestibulum ante ipsum primis in faucibus ",
      "orci luctus ",
      "et ultrices posuere cubilia Curae; Vivamus nec hendrerit felis.",
    ];
    var recipe = new Recipe({ compress: false })
      .createPage("letter")
      .text(segments[0], 72, 72, {
        flow: true,
        textBox: { width: 300, textAlign: "justify" },
      })
      .text(segments[1], { color: "red", hilite: true })
      .text(segments[2], { color: "green", hilite: false })
      .text("", { flow: false })
      .text("This is a text box with a padding of 4, ", 72, 300, {
        flow: true,
        hilite: true,
        textBox: { padding: 4, width: 200, textAlign: "center" },
      })
      .text("with round box corners ", { color: "red", hilite: false })
      .movedown(2)
      .text("after a movedown(2).", { color: "blue" })
      .text("", {
        flow: false,
        textBox: { style: { lineWidth: 1, stroke: "red", borderRadius: true } },
      });
    var bytes = recipe.endPage().endPDF();
    writeOutput("continued-text", bytes);
    var runs = drawnRuns(bytes);
    assert.equal(
      runs
        .map((run) => run.text)
        .join(" ")
        .replace(/\s+/g, " "),
      [
        ...segments,
        "This is a text box with a padding of 4, with round box corners after a movedown(2).",
      ]
        .join(" ")
        .replace(/\s+/g, " "),
      "every run of both flows is drawn once, in order",
    );
  });

  // Issue #888: mirrors the native flow assertions in
  // packages/native-with-source/tests/recipe/text-continued.js.
  describe("flow", function () {
    var flowOptions = { flow: true, font: "arial", textBox: { width: 300 } };

    it("continues a flowed run on the line where the previous one ended", async function () {
      var helloAdvance;
      var runs = await drawRuns("continued-flow-line", (recipe) => {
        helloAdvance = runAdvance(recipe, "Hello ", flowOptions);
        recipe
          .text("Hello ", 20, 20, flowOptions)
          .text("world again", flowOptions)
          .text("", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Hello ", "world again"],
      );
      assert.ok(Math.abs(runs[0].x - 20) < 0.01);
      assert.equal(runs[1].y, runs[0].y);
      assert.ok(
        Math.abs(runs[1].x - (runs[0].x + helloAdvance)) < 0.01,
        `"world" starts at ${runs[1].x}`,
      );
    });

    it("places a right-aligned line's runs as a left-aligned line's", async function () {
      var helloAdvance;
      var runs = await drawRuns("continued-flow-right", (recipe) => {
        helloAdvance = runAdvance(recipe, "Hello ", flowOptions);
        recipe
          .text("Hello ", 20, 20, {
            ...flowOptions,
            textBox: { width: 300, textAlign: "right" },
          })
          .text("world", {})
          .text("", { flow: false });
      });
      assert.ok(Math.abs(runs[1].x - runs[0].x - helloAdvance) < 0.01);
    });

    it("puts runs of different sizes on one baseline inside the box", async function () {
      var bigAscent;
      var runs = await drawRuns("continued-flow-sizes", (recipe) => {
        bigAscent = recipe.textDimensions("Big", {
          font: "arial",
          size: 20,
        }).yMax;
        recipe
          .text("Small ", 20, 20, { flow: true, font: "arial", size: 10 })
          .text("Big", { size: 20 })
          .text("", { flow: false });
      });
      assert.equal(runs[1].y, runs[0].y);
      // The box starts 20 points below the top of the 400-point page.
      assert.ok(runs[1].y + bigAscent <= 380.01);
    });

    it("keeps runs without a space between them together", async function () {
      var runs = await drawRuns("continued-flow-no-space", (recipe) => {
        recipe
          .text("Hello", 20, 20, flowOptions)
          .text("world", flowOptions)
          .text("", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Hello", "world"],
      );
      assert.equal(runs[1].y, runs[0].y);
      assert.ok(runs[1].x > runs[0].x);
    });

    it("keeps each run's own style when a later run changes it", async function () {
      var runs = await drawRuns("continued-flow-run-style", (recipe) => {
        recipe
          .text("Plain ", 20, 20, flowOptions)
          .text("red", { color: "#ff0000" })
          .text("", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Plain ", "red"],
      );
      assert.equal(runs[1].color, "1 0 0");
      assert.notEqual(runs[0].color, "1 0 0");
    });

    it("measures each run's character spacing when wrapping a flow", async function () {
      var runs = await drawRuns("continued-flow-char-space", (recipe) => {
        recipe
          .text("Spaced letters wrap the same ", 20, 20, {
            flow: true,
            font: "arial",
            charSpace: 3,
            textBox: { width: 150 },
          })
          .text("way in a flow as in one call.", {})
          .text("", { flow: false });
      });
      // Native's line breaks for the same text in a single text() call.
      assert.deepEqual(
        runs.map((run) => run.text.trim()),
        ["Spaced letters", "wrap the same", "way in a flow as", "in one call."],
      );
    });

    it("wraps flowed runs together inside the shared text box", async function () {
      var runs = await drawRuns("continued-flow-wrap", (recipe) => {
        recipe
          .text("Hello ", 20, 20, {
            flow: true,
            font: "arial",
            textBox: { width: 80 },
          })
          .text("world again and again and again", { flow: true })
          .text("", { flow: false });
      });
      assert.equal(runs[0].text, "Hello ");
      assert.equal(runs[1].text, "world");
      assert.equal(runs[1].y, runs[0].y);
      var wrapped = runs.slice(2);
      assert.deepEqual(
        wrapped.map((run) => run.text.trim()),
        ["again and", "again and", "again"],
      );
      wrapped.forEach((run, index) => {
        assert.ok(Math.abs(run.x - 20) < 0.01);
        assert.ok(run.y < (index ? wrapped[index - 1].y : runs[0].y));
      });
    });

    it("continues the flow in calls without coordinates until flow: false", async function () {
      var runs = await drawRuns("continued-flow-default", (recipe) => {
        recipe
          .text("Hello ", 20, 20, flowOptions)
          .text("world ", {})
          .text("end", { flow: false })
          .text("Next box", 20, 100, { font: "arial" });
      });
      assert.deepEqual(
        runs.map((run) => run.text.trim()),
        ["Hello", "world", "end", "Next box"],
      );
      assert.equal(runs[1].y, runs[0].y);
      assert.equal(runs[2].y, runs[0].y);
      assert.ok(runs[2].x > runs[1].x);
      assert.ok(Math.abs(runs[3].x - 20) < 0.01);
      assert.ok(runs[3].y < runs[0].y - 60);
    });

    it("aligns the runs of one line as one line", async function () {
      var runs = await drawRuns("continued-flow-center", (recipe) => {
        recipe
          .text("Hello ", 20, 20, {
            flow: true,
            font: "arial",
            textBox: { width: 300, textAlign: "center" },
          })
          .text("world", {})
          .text("", { flow: false });
      });
      assert.equal(runs[1].y, runs[0].y);
      // Centering "Hello world" in a 300pt box starts it near x = 135.
      assert.ok(runs[0].x >= 120 && runs[0].x <= 160, String(runs[0].x));
      assert.ok(runs[1].x > runs[0].x + 25);
    });

    it("moves a flow down a whole line with movedown()", async function () {
      var coords;
      var runs = await drawRuns("continued-flow-movedown", (recipe) => {
        recipe.text("Hello", 20, 20, flowOptions);
        // The flow is laid out when it ends, so this is still its origin.
        coords = recipe.movedown(1, true);
        recipe
          .text("world", {})
          .movedown(2)
          .text("again", {})
          .text("", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Hello", "world", "again"],
      );
      runs.forEach((run) => assert.ok(Math.abs(run.x - 20) < 0.01));
      var lineHeight = runs[0].y - runs[1].y;
      assert.ok(lineHeight > 10);
      assert.deepEqual(coords, [20, 20]);
      assert.ok(Math.abs(runs[1].y - runs[2].y - 2 * lineHeight) < 0.01);
    });

    it("keeps the spaces that start a flowed line", async function () {
      var start = await drawRuns("continued-flow-leading-space", (recipe) => {
        recipe
          .text("   Indented", 50, 50, flowOptions)
          .text("", { flow: false });
      });
      assert.deepEqual(
        start.map((run) => run.text),
        ["   Indented"],
      );
      var runs = await drawRuns(
        "continued-flow-leading-space-line",
        (recipe) => {
          recipe
            .text("Line one", 50, 50, flowOptions)
            .movedown()
            .text("   Again", {})
            .text("", { flow: false });
        },
      );
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Line one", "   Again"],
      );
      assert.ok(runs[1].y < runs[0].y);
    });

    // Wasm only: native skips text() without an active page, while Wasm
    // throws for any text() call there; a flow must not be held for a
    // later page.
    it("rejects a flow started without an active page", async function () {
      var Recipe = await getRecipe();
      assert.throws(
        () => new Recipe().text("X", 50, 50, flowOptions),
        /A page is required for coordinates/,
      );
      var recipe = new Recipe().createPage(200, 200).endPage();
      assert.throws(
        () => recipe.text("X", 50, 50, flowOptions),
        /A page is required for coordinates/,
      );
      var bytes = recipe
        .createPage(200, 200)
        .text("Y", 20, 20, { font: "arial" })
        .endPage()
        .endPDF();
      writeOutput("continued-flow-no-page", bytes);
      assert.doesNotMatch(Buffer.from(bytes).toString("latin1"), /\(X\) Tj/);
    });

    it("rejects an invalid run at its call and keeps the flow", async function () {
      var runs = await drawRuns("continued-flow-invalid-run", (recipe) => {
        recipe.text("x", 20, 20, flowOptions);
        assert.throws(() => recipe.text("y", { charSpace: Infinity }), {
          name: "TypeError",
          message: "charSpace must be a finite number",
        });
        recipe.text("z", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["x", "z"],
      );
      assert.equal(runs[1].y, runs[0].y);
    });

    // Wasm only: native throws a TypeError for an empty flow (#889).
    it("measures an empty flow with its own font", async function () {
      var Recipe = await createRecipe({ defaultFont: false });
      Recipe.registerFont(
        "arial",
        new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
      );
      var recipe = new Recipe().createPage(400, 400);
      recipe
        .text("", 20, 20, { flow: true, font: "arial", size: 30 })
        .text("", { flow: false });
      var flowY = recipe.movedown(0, true)[1];
      recipe.text("", 20, 20, { font: "arial", size: 30 });
      assert.equal(flowY, recipe.movedown(0, true)[1]);
      writeOutput("continued-flow-empty", recipe.endPage().endPDF());
    });

    it("keeps per-run markup annotations and links", async function () {
      var Recipe = await getRecipe();
      var bytes = new Recipe({ compress: false })
        .createPage(400, 400)
        .text("Plain ", 20, 20, flowOptions)
        .text("marked", { highlight: true, link: "https://example.com" })
        .text(" plain", { highlight: false, link: undefined })
        .text("wavy", { squiggly: true })
        .text("", { flow: false })
        .endPage()
        .endPDF();
      writeOutput("continued-flow-markup", bytes);
      var output = Buffer.from(bytes).toString("latin1");
      assert.equal(output.match(/\/Subtype \/Highlight/g)?.length, 1);
      assert.equal(output.match(/\/Subtype \/Link/g)?.length, 1);
      assert.equal(output.match(/\/Subtype \/Squiggly/g)?.length, 1);
    });

    // Divergence: native currently drops a flow that never ends; Wasm draws
    // it when the page ends, so no text is lost silently.
    it("draws a flow that never ends when the page ends", async function () {
      var runs = await drawRuns("continued-flow-unended", (recipe) => {
        recipe.text("Hello ", 20, 20, flowOptions).text("world", {});
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Hello ", "world"],
      );
      assert.equal(runs[1].y, runs[0].y);
    });
  });
});
