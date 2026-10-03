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

    it("sizes each line of a flow by its own runs", async function () {
      var flowRuns = await drawRuns("continued-flow-line-heights", (recipe) => {
        recipe
          .text("Small small small ", 20, 20, {
            flow: true,
            font: "arial",
            size: 10,
            textBox: { width: 90 },
          })
          .text("Big", { size: 20 })
          .text("", { flow: false });
      });
      var plainRuns = await drawRuns(
        "continued-flow-line-heights-plain",
        (recipe) => {
          recipe.text("Small small small", 20, 20, { font: "arial", size: 10 });
        },
      );
      assert.equal(flowRuns[0].y, plainRuns[0].y);
      assert.ok(flowRuns[1].y < flowRuns[0].y);

      // Runs without visible text do not size a line that has text: an
      // empty run, or the space before a word that wraps.
      var small = {
        flow: true,
        font: "arial",
        size: 10,
        textBox: { width: 90 },
      };
      var empty = await drawRuns(
        "continued-flow-line-heights-empty",
        (recipe) => {
          recipe
            .text("Small small small", 20, 20, small)
            .text("", { size: 20, flow: false });
        },
      );
      var space = await drawRuns(
        "continued-flow-line-heights-space",
        (recipe) => {
          recipe
            .text("Small small small", 20, 20, small)
            .text(" Big", { size: 20, flow: false });
        },
      );
      assert.equal(empty[0].y, plainRuns[0].y);
      assert.deepEqual(
        space.map((run) => run.text),
        ["Small small small", "Big"],
      );
      assert.equal(space[0].y, plainRuns[0].y);
    });

    it("moves down the full height of a line with mixed sizes", async function () {
      var Recipe = await getRecipe();
      var mixed = new Recipe().createPage(400, 400);
      mixed
        .text("Small ", 20, 20, { flow: true, font: "arial", size: 10 })
        .text("Big", { size: 20 })
        .text("", { flow: false });
      var big = new Recipe().createPage(400, 400);
      big.text("Big", 20, 20, { font: "arial", size: 20 });
      assert.deepEqual(mixed.movedown(1, true), big.movedown(1, true));
      mixed.endPage();
      big.endPage();
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

    it("rotates only the runs that set rotation", async function () {
      var Recipe = await getRecipe();
      /**
       * Draws a flow and counts the 30 degree rotations on its page.
       * @param {string} name - Output file name without extension.
       * @param {function(Recipe): void} draw - Draws the flow.
       * @returns {number} The number of rotation matrices.
       */
      var rotations = (name, draw) => {
        var recipe = new Recipe({ compress: false }).createPage(400, 400);
        draw(recipe);
        var bytes = recipe.endPage().endPDF();
        writeOutput(name, bytes);
        return (
          Buffer.from(bytes)
            .toString("latin1")
            .match(/0\.866025 -?0\.5 -?0\.5 0\.866025 \S+ \S+ cm/g)?.length ?? 0
        );
      };
      assert.equal(
        rotations("continued-flow-rotated-run", (recipe) => {
          recipe
            .text("Plain ", 20, 20, flowOptions)
            .text("turned ", { rotation: 30 })
            .text("plain", { rotation: 0, flow: false });
        }),
        1,
      );
      assert.equal(
        rotations("continued-flow-rotated-end", (recipe) => {
          recipe
            .text("Plain ", 20, 20, flowOptions)
            .text("more ", {})
            .text("turned", { rotation: 30, flow: false });
        }),
        1,
      );
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

      // Fitting a run counts the space after every run before it that ends
      // with one, as drawing does.
      var spaced = await drawRuns("continued-flow-wrap-spaces", (recipe) => {
        recipe
          .text("alpha ", 20, 20, { ...flowOptions, textBox: { width: 120 } })
          .text("bravo ", {})
          .text("charlie delta", { flow: false });
      });
      assert.deepEqual(
        spaced.map((run) => run.text),
        ["alpha ", "bravo", "charlie delta"],
      );
      assert.ok(Math.abs(spaced[2].x - 20) < 0.01);
      assert.ok(spaced[2].y < spaced[0].y);

      // A wrapped line starts with its first word, without the spaces that
      // start its run, and the line before it ends without its spaces.
      var leading = await drawRuns(
        "continued-flow-wrap-leading-space",
        (recipe) => {
          recipe
            .text("foxtrot", 20, 20, {
              ...flowOptions,
              size: 23,
              textBox: { width: 114 },
            })
            .text("hotel ", {})
            .text(" charlie", {})
            .text("", { flow: false });
        },
      );
      assert.deepEqual(
        leading.map((run) => run.text),
        ["foxtrot", "hotel", "charlie"],
      );
      assert.ok(Math.abs(leading[2].x - 20) < 0.01);
      var centered = await drawRuns("continued-flow-wrap-center", (recipe) => {
        recipe
          .text("juliet", 20, 20, {
            ...flowOptions,
            size: 18,
            textBox: { width: 113, textAlign: "center" },
          })
          .text(" delta ", {})
          .text(" mike lima", {})
          .text("", { flow: false });
      });
      assert.deepEqual(
        centered.map((run) => run.text),
        ["juliet", " delta", "mike lima"],
      );
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

      // A movedown() that ends the flow moves the next text below its lines.
      var after = await drawRuns("continued-flow-movedown-end", (recipe) => {
        recipe
          .text("Hello", 20, 20, flowOptions)
          .movedown(2)
          .text("", { flow: false })
          .text("again", { font: "arial", flow: false });
      });
      assert.ok(Math.abs(after[0].y - after[1].y - 2 * lineHeight) < 0.01);
    });

    it("gives every gap of a justified line one width across run sizes", async function () {
      var ends = {};
      var runs = await drawRuns("continued-flow-justify-sizes", (recipe) => {
        var big = { font: "arial", size: 25 };
        var small = { font: "arial", size: 8 };
        ["golf", "lima"].forEach((word) => {
          ends[`${word} `] = recipe.textDimensions(`${word} `, big).xMax;
        });
        ["fox", "delta", "papa", "kilo", "romeo", "oscar"].forEach((word) => {
          ends[`${word} `] = recipe.textDimensions(`${word} `, small).xMax;
        });
        // The line's last word is drawn without its space.
        ends.oscar = recipe.textDimensions("oscar", small).xMax;
        recipe
          .text("golf lima ", 18, 24, {
            ...big,
            flow: true,
            textBox: { width: 220, textAlign: "justify" },
          })
          .text("fox delta papa kilo romeo oscar charlie", {
            size: 8,
            flow: false,
          });
      });
      var line = runs.filter((run) => run.y === runs[0].y);
      assert.deepEqual(
        line.map((run) => run.text.trim()),
        ["golf", "lima", "fox", "delta", "papa", "kilo", "romeo", "oscar"],
      );
      var gaps = line
        .slice(1)
        .map((run, index) => run.x - line[index].x - ends[line[index].text]);
      gaps.forEach((gap) => assert.ok(Math.abs(gap - gaps[0]) < 0.01, gaps));
      var last = line[line.length - 1];
      assert.ok(Math.abs(last.x + ends[last.text] - (18 + 220)) < 0.01);
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

      // A rejected call that would end the flow leaves it open.
      var open = await drawRuns("continued-flow-invalid-end", (recipe) => {
        recipe.text("x", 20, 20, flowOptions);
        assert.throws(() => recipe.text("y", { size: -1, flow: false }), {
          name: "RangeError",
          message: "Text size must be a number greater than zero, received -1",
        });
      });
      assert.deepEqual(
        open.map((run) => run.text),
        ["x"],
      );
    });

    it("keeps the flow open when a call with coordinates is rejected", async function () {
      var runs = await drawRuns(
        "continued-flow-invalid-positioned",
        (recipe) => {
          recipe.text("x ", 20, 20, flowOptions);
          assert.throws(
            () =>
              recipe.text("y", 20, 100, {
                ...flowOptions,
                charSpace: Infinity,
              }),
            { name: "TypeError", message: "charSpace must be a finite number" },
          );
          assert.throws(
            () => recipe.text("y", 20, 100, { ...flowOptions, size: -1 }),
            {
              name: "RangeError",
              message:
                "Text size must be a number greater than zero, received -1",
            },
          );
          assert.throws(
            () => recipe.text("y", 20, 100, { ...flowOptions, rotation: NaN }),
            { name: "TypeError", message: "rotation must be a finite number" },
          );
          recipe.text("z", { flow: false });
        },
      );
      assert.deepEqual(
        runs.map((run) => run.text),
        ["x ", "z"],
      );
      assert.equal(runs[1].y, runs[0].y);
      assert.ok(runs[1].x > runs[0].x);
    });

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

    it("starts the line of an empty flow with the next run", async function () {
      var runs = await drawRuns("continued-flow-empty-start", (recipe) => {
        recipe
          .text("", 20, 20, flowOptions)
          .text("Hello", {})
          .text("", { flow: false })
          .text("Hello", 200, 20, { font: "arial" });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Hello", "Hello"],
      );
      assert.equal(runs[0].y, runs[1].y);

      // Nor does the empty run's size place that line.
      for (var [emptySize, size] of [
        [28, 14],
        [14, 28],
      ]) {
        var sized = await drawRuns(
          `continued-flow-empty-start-${emptySize}`,
          (recipe) => {
            recipe
              .text("", 20, 20, { ...flowOptions, size: emptySize })
              .text("Hello", { size })
              .text("", { flow: false })
              .text("Hello", 200, 20, { font: "arial", size });
          },
        );
        assert.equal(sized[0].y, sized[1].y);
      }
    });

    // Issue #889: no flowed text is dropped.
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

    it("links only a linked run's text when the page ends the flow", async function () {
      var Recipe = await getRecipe();
      var bytes = new Recipe({ compress: false })
        .createPage(400, 400)
        .text("Hello ", 20, 20, flowOptions)
        .text("world", { link: "https://example.com" })
        .endPage()
        .endPDF();
      writeOutput("continued-flow-link", bytes);
      var rects = [
        ...Buffer.from(bytes)
          .toString("latin1")
          .matchAll(/\/Subtype \/Link[^]*?\/Rect \[([^\]]*)\]/g),
      ].map((match) => match[1].trim().split(/\s+/).map(Number));
      assert.equal(rects.length, 1);
      assert.ok(rects[0][2] > rects[0][0]);
    });

    it("draws an open flow before a call with coordinates", async function () {
      var runs = await drawRuns("continued-flow-then-positioned", (recipe) => {
        recipe
          .text("Hello ", 20, 20, flowOptions)
          .text("world", {})
          .text("next", 20, 100, { font: "arial" });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Hello ", "world", "next"],
      );
      assert.equal(runs[1].y, runs[0].y);
      assert.ok(runs[2].y < runs[0].y - 50);
    });

    it("draws an open flow before a table", async function () {
      var runs = await drawRuns("continued-flow-then-table", (recipe) => {
        recipe
          .text("Hello ", 20, 20, flowOptions)
          .text("world", {})
          .table(20, 100, [{ cell: "cell" }], {
            columns: [{ name: "cell", text: "head", width: 80 }],
          });
      });
      assert.deepEqual(
        runs.slice(0, 2).map((run) => run.text),
        ["Hello ", "world"],
      );
      assert.equal(runs[1].y, runs[0].y);
      assert.ok(runs.some((run) => run.text === "cell"));
    });

    it("draws an HTML flow that is not ended", async function () {
      var runs = await drawRuns("continued-flow-html-unended", (recipe) => {
        recipe.text("<b>Hello</b> world", 20, 20, {
          ...flowOptions,
          html: true,
        });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Hello", " world"],
      );
    });

    it("continues the line with HTML runs and ends after them", async function () {
      var runs = await drawRuns("continued-flow-html-runs", (recipe) => {
        recipe
          .text("Plain ", 20, 20, flowOptions)
          .text("<b>bold</b> ", { html: true })
          .text("<i>italic</i>", {})
          .text("", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Plain ", "bold", " ", "italic"],
      );
      runs.forEach((run) => assert.equal(run.y, runs[0].y));

      // An HTML run that ends the flow keeps the space between its elements.
      var spaceAdvance;
      var ended = await drawRuns("continued-flow-html-runs-ended", (recipe) => {
        spaceAdvance = runAdvance(recipe, " ", flowOptions);
        recipe
          .text("Plain ", 20, 20, flowOptions)
          .text("<b>bold</b> <i>italic</i>", { html: true, flow: false });
      });
      assert.deepEqual(
        ended.map((run) => run.text),
        ["Plain ", "bold", " ", "italic"],
      );
      assert.ok(Math.abs(ended[3].x - ended[2].x - spaceAdvance) < 0.01);

      // HTML without text keeps the runs before it, also when it ends the flow.
      var empty = await drawRuns("continued-flow-html-runs-empty", (recipe) => {
        recipe
          .text("Plain ", 20, 20, flowOptions)
          .text("<i></i>", { html: true })
          .text("end", { html: false })
          .text("<p></p>", { html: true, flow: false });
      });
      assert.deepEqual(
        empty.map((run) => run.text),
        ["Plain ", "end"],
      );
      assert.equal(empty[1].y, empty[0].y);

      // Elements with the same styles stay runs of their own.
      var spans = await drawRuns("continued-flow-html-spans", (recipe) => {
        recipe
          .text("<span>kilo</span> <span>lima</span>", 20, 20, {
            ...flowOptions,
            html: true,
          })
          .text("", { flow: false });
      });
      assert.deepEqual(
        spans.map((run) => run.text),
        ["kilo", " ", "lima"],
      );
    });

    it("moves an empty flow down with movedown()", async function () {
      var runs = await drawRuns("continued-flow-empty-movedown", (recipe) => {
        recipe
          .text("Hello", 20, 20, flowOptions)
          .text("", {})
          .movedown()
          .text("A", {})
          .text("", { flow: false })
          .text("", 20, 100, flowOptions)
          .movedown()
          .text("B", {})
          .text("", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Hello", "A", "B"],
      );
      // B is one line below the empty line that starts 80pt below Hello's.
      assert.ok(
        Math.abs(runs[0].y - runs[2].y - (80 + runs[0].y - runs[1].y)) < 0.01,
      );
      assert.ok(runs[1].y < runs[0].y);
    });

    it("ends the line with movedown(0)", async function () {
      var runs = await drawRuns("continued-flow-movedown-zero", (recipe) => {
        recipe
          .text("Hello ", 20, 20, flowOptions)
          .movedown(0)
          .text("world", {})
          .text("", { flow: false });
      });
      assert.ok(runs[1].y < runs[0].y);
      assert.ok(Math.abs(runs[1].x - 20) < 0.01);
    });

    it("moves down below a flow whose last line is the tallest", async function () {
      var runs = await drawRuns("continued-flow-taller-last-line", (recipe) => {
        recipe
          .text("small", 20, 20, { flow: true, font: "arial", size: 10 })
          .movedown()
          .text("BIG", { size: 30 })
          .text("", { flow: false })
          .movedown()
          .text("next", { font: "arial", size: 10, flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["small", "BIG", "next"],
      );
      // "next" starts below the baseline of the 30-point line.
      assert.ok(runs[2].y < runs[1].y - 5);
    });

    it("keeps the cursor out of a box's vertical alignment", async function () {
      var aligned = await drawRuns(
        "continued-cursor-vertical-align",
        (recipe) => {
          recipe
            .text("A\nB", 20, 20, {
              font: "arial",
              textBox: { width: 100, height: 100, textAlign: "left center" },
            })
            .text("next", { font: "arial", flow: false });
        },
      );
      var plain = await drawRuns("continued-cursor-no-align", (recipe) => {
        recipe
          .text("A\nB", 20, 20, { font: "arial", textBox: { width: 100 } })
          .text("next", { font: "arial", flow: false });
      });
      assert.equal(aligned[2].y, plain[2].y);
    });

    it("keeps the spaces between runs in the middle of a flow", async function () {
      var oneAdvance;
      var twoAdvance;
      var runs = await drawRuns("continued-flow-middle-spaces", (recipe) => {
        oneAdvance = runAdvance(recipe, "one ", flowOptions);
        twoAdvance = runAdvance(recipe, "two ", flowOptions);
        recipe
          .text("one ", 20, 20, flowOptions)
          .text("two ", {})
          .text("   ", {})
          .text("three", {})
          .text("", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["one ", "two ", "   ", "three"],
      );
      assert.ok(Math.abs(runs[1].x - runs[0].x - oneAdvance) < 0.01);
      assert.ok(Math.abs(runs[2].x - runs[1].x - twoAdvance) < 0.01);
      assert.ok(runs[3].x > runs[2].x);
    });

    it("ends the line at line breaks that end a run", async function () {
      var runs = await drawRuns("continued-flow-trailing-breaks", (recipe) => {
        recipe
          .text("Hello\n", 20, 20, flowOptions)
          .text("world ", {})
          .text("\n\n", {})
          .text("again", {})
          .text("", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Hello", "world", "again"],
      );
      var lineHeight = runs[0].y - runs[1].y;
      assert.equal(runs[1].x, runs[0].x);
      assert.ok(Math.abs(runs[1].y - runs[2].y - 2 * lineHeight) < 0.01);

      // HTML line breaks and line feeds end the line the same way, also when
      // the next run starts with one, and the cursor moves past them.
      var html = await drawRuns(
        "continued-flow-trailing-html-breaks",
        (recipe) => {
          recipe
            .text("alpha<br><br>", 20, 20, { ...flowOptions, html: true })
            .text("bravo<br>", {})
            .text("<br>charlie", {})
            .text("delta\n", {})
            .text("echo", {})
            .text("", { flow: false })
            .text("<br>", 20, 200, { ...flowOptions, html: true, flow: false })
            .text("one<br><br>", 20, 250, { font: "arial", html: true })
            .text("two", { font: "arial", flow: false });
        },
      );
      assert.deepEqual(
        html.map((run) => run.text),
        ["alpha", "bravo", "charlie", "delta", "echo", "one", "two"],
      );
      var steps = html.slice(1, 5).map((run, index) => html[index].y - run.y);
      assert.deepEqual(
        steps.map((step) => Math.round(step / lineHeight)),
        [2, 2, 0, 1],
      );
      assert.ok(Math.abs(html[5].y - html[6].y - 2 * lineHeight) < 0.01);
    });

    it("aligns a flow ended with empty text as one ended with text", async function () {
      var draw = (recipe, ending) => {
        recipe
          .text("delta ", 20, 20, {
            ...flowOptions,
            textBox: { width: 300, textAlign: "right" },
          })
          .text("lima ", {});
        ending(recipe);
      };
      var empty = await drawRuns("continued-flow-right-empty-end", (recipe) =>
        draw(recipe, (r) => r.text("", { flow: false })),
      );
      var page = await drawRuns("continued-flow-right-page-end", (recipe) =>
        draw(recipe, () => {}),
      );
      var text = await drawRuns("continued-flow-right-text-end", (recipe) => {
        recipe
          .text("delta ", 20, 20, {
            ...flowOptions,
            textBox: { width: 300, textAlign: "right" },
          })
          .text("lima ", { flow: false });
      });
      // Runs of only spaces at the end of the flow add no space to the line,
      // nor does an HTML element's trailing space.
      var spaces = await drawRuns("continued-flow-right-spaces-end", (recipe) =>
        draw(recipe, (r) => r.text("  ", {}).text(" ", { flow: false })),
      );
      var html = await drawRuns("continued-flow-right-html-end", (recipe) => {
        recipe
          .text("delta ", 20, 20, {
            ...flowOptions,
            textBox: { width: 300, textAlign: "right" },
          })
          .text("<u>lima</u> ", { html: true, flow: false });
      });
      assert.deepEqual(
        empty.map((run) => run.x),
        text.map((run) => run.x),
      );
      assert.deepEqual(
        page.map((run) => run.x),
        text.map((run) => run.x),
      );
      assert.deepEqual(
        spaces.map((run) => run.x),
        text.map((run) => run.x),
      );
      assert.deepEqual(
        html.map((run) => run.x),
        text.map((run) => run.x),
      );
    });

    it("wraps where one run ends and the next begins", async function () {
      var runs = await drawRuns(
        "continued-flow-run-boundary-wrap",
        (recipe) => {
          recipe
            .text("aaa bbb", 20, 20, {
              ...flowOptions,
              size: 30,
              textBox: { width: 150 },
            })
            .text("ccc", {})
            .text("", { flow: false });
        },
      );
      assert.deepEqual(
        runs.map((run) => run.text),
        ["aaa bbb", "ccc"],
      );
      assert.ok(runs[1].y < runs[0].y);
      assert.equal(runs[1].x, 20);

      // An HTML run whose first word does not fit starts the next line, and
      // its later elements follow it there.
      var html = await drawRuns(
        "continued-flow-run-boundary-wrap-html",
        (recipe) => {
          recipe
            .text("alpha bravo charlie ", 20, 20, {
              ...flowOptions,
              textBox: { width: 120 },
            })
            .text("delta <b>echo</b>", { html: true, flow: false });
        },
      );
      assert.deepEqual(
        html.map((run) => run.text),
        ["alpha bravo charlie", "delta ", "echo"],
      );
      assert.equal(html[1].x, 20);
      assert.ok(html[1].y < html[0].y);
      assert.equal(html[2].y, html[1].y);
    });

    it("starts a new line for a run that opens with a block element", async function () {
      var runs = await drawRuns("continued-flow-html-block", (recipe) => {
        recipe
          .text("hotel", 20, 20, { ...flowOptions, html: true })
          .text("<p>romeo</p>", {})
          .text("", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["hotel", "romeo"],
      );
      assert.ok(runs[1].y < runs[0].y);

      var div = await drawRuns("continued-flow-html-div", (recipe) => {
        recipe
          .text("lima", 20, 20, flowOptions)
          .text("<div>echo</div>", { html: true, flow: false });
      });
      assert.deepEqual(
        div.map((run) => run.text),
        ["lima", "echo"],
      );
      assert.equal(div[1].x, 20);
      assert.ok(div[1].y < div[0].y);
    });

    it("starts a new line for an HTML run after a closed block element", async function () {
      var runs = await drawRuns("continued-flow-html-block-end", (recipe) => {
        recipe
          .text("<p>alpha</p>", 20, 20, { ...flowOptions, html: true })
          .text("<b>bravo</b>", {})
          .movedown()
          .text("<div>one</div>", {})
          .text("<i>two</i>", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["alpha", "bravo", "one", "two"],
      );
      var lineHeight = runs[0].y - runs[1].y;
      assert.ok(lineHeight > 5);
      assert.equal(runs[1].x, runs[0].x);
      // movedown() after a closed block adds no blank line.
      assert.ok(Math.abs(runs[1].y - runs[2].y - lineHeight) < 0.01);
      assert.ok(Math.abs(runs[2].y - runs[3].y - lineHeight) < 0.01);

      // A run without text in between does not change that.
      var between = await drawRuns(
        "continued-flow-html-block-end-empty",
        (recipe) => {
          recipe
            .text("<p>alpha</p>", 20, 20, { ...flowOptions, html: true })
            .text("", {})
            .text("bravo", { flow: false });
        },
      );
      assert.deepEqual(
        between.map((run) => run.text),
        ["alpha", "bravo"],
      );
      assert.equal(between[1].x, 20);
      assert.ok(between[1].y < between[0].y);
    });

    it("collapses an HTML run's first space into the space before it", async function () {
      var alphaAdvance;
      var runs = await drawRuns("continued-flow-html-space", (recipe) => {
        alphaAdvance = runAdvance(recipe, "alpha ", flowOptions);
        recipe
          .text("alpha ", 20, 20, flowOptions)
          .text(" oscar", { html: true })
          .text("", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["alpha ", "oscar"],
      );
      assert.ok(Math.abs(runs[1].x - runs[0].x - alphaAdvance) < 0.01);

      // After a word, the space stays, as a run of its own before an element.
      var kept = await drawRuns("continued-flow-html-space-kept", (recipe) => {
        recipe
          .text("hotel", 20, 20, flowOptions)
          .text(" india", { html: true })
          .text(" <u>oscar</u>", {})
          .text("", { flow: false });
      });
      assert.deepEqual(
        kept.map((run) => run.text),
        ["hotel", " india", " ", "oscar"],
      );
    });

    it("adds up line ends and ignores movedown(0) after one", async function () {
      var draw = (name, moves) =>
        drawRuns(name, (recipe) => {
          recipe.text("a", 20, 20, flowOptions);
          moves(recipe);
          recipe.text("b", {}).text("", { flow: false });
        });
      var twice = await draw("continued-flow-movedown-twice", (r) =>
        r.movedown().movedown(),
      );
      var two = await draw("continued-flow-movedown-two", (r) => r.movedown(2));
      var broken = await draw("continued-flow-break-movedown", (r) =>
        r.text("\n", {}).movedown(),
      );
      var zero = await draw("continued-flow-movedown-zero-after", (r) =>
        r.movedown().movedown(0),
      );
      var one = await draw("continued-flow-movedown-one", (r) => r.movedown());
      assert.equal(twice[1].y, two[1].y);
      assert.equal(broken[1].y, two[1].y);
      assert.equal(zero[1].y, one[1].y);
    });

    it("gives a blank line the height of the line after it", async function () {
      var gap = async (name, first) => {
        var runs = await drawRuns(name, (recipe) => {
          recipe
            .text(first, 20, 20, { ...flowOptions, size: 8 })
            .text("BIG", { size: 30 })
            .text("", { flow: false });
        });
        return runs[0].y - runs[1].y;
      };
      var withBlank = await gap("continued-flow-blank-height", "small\n\n");
      var withoutBlank = await gap("continued-flow-no-blank", "small\n");
      // The blank line is as tall as the 30-point line, not the 8-point one.
      assert.ok(withBlank - withoutBlank > 20);
    });

    it("flows calls without coordinates unless they pass flow: false", async function () {
      var runs = await drawRuns("continued-flow-implicit", (recipe) => {
        recipe
          .text("Hello ", { font: "arial" })
          .text("world", {})
          .text("", { flow: false })
          .movedown()
          .text("one", { font: "arial", flow: false })
          .movedown()
          .text("two", { font: "arial", flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Hello ", "world", "one", "two"],
      );
      assert.equal(runs[1].y, runs[0].y);
      // movedown() after a text box moves one line, as within a box.
      var lineHeight = runs[0].y - runs[2].y;
      assert.ok(lineHeight > 10 && lineHeight < 20);
      assert.ok(Math.abs(runs[2].y - runs[3].y - lineHeight) < 0.01);
    });
  });
});
