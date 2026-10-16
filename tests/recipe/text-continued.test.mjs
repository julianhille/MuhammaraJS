import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { annotations } from "../support/pdf.mjs";
import { drawn, drawnRuns, drawRuns, runAdvance } from "../support/flow.mjs";

/**
 * Assert that two numbers are within a tolerance.
 * @param {number} actual - The measured value.
 * @param {number} expected - The expected value.
 * @param {number} [delta=0.01] - The tolerance.
 * @param {string} [message] - What is compared.
 * @returns {void}
 */
function close(actual, expected, delta = 0.01, message) {
  assert.ok(
    Math.abs(actual - expected) <= delta,
    message || `${actual} is not within ${delta} of ${expected}`,
  );
}

describeEnds("Text - Continued", function (end) {
  /**
   * Draw on one 400 x 400 page and return the runs it drew.
   * @param {string} name - Output name suffix.
   * @param {function(object): void} draw - Draws on the page.
   * @returns {Array<{text: string, x: number, y: number, color: string}>}
   *   The drawn runs.
   */
  function runsOf(name, draw) {
    return drawRuns(end, `text-continued-${name}`, draw);
  }

  /**
   * Draw on one 400 x 400 page and return the PDF.
   * @param {string} name - Output name suffix.
   * @param {function(object): void} draw - Draws on the page.
   * @returns {Uint8Array} The PDF.
   */
  function pdfOf(name, draw) {
    var recipe = end.newRecipe().createPage(400, 400);
    draw(recipe);
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, `text-continued-${name}`, bytes);
    return bytes;
  }

  it("Simple text segmentation", function () {
    var segments = [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam in " +
        "suscipit purus. Vestibulum ante ipsum primis in faucibus ",
      "orci luctus ",
      "et ultrices posuere cubilia Curae; Vivamus nec hendrerit felis.",
    ];
    var bytes = end
      .newRecipe()
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
      })
      .text("We can still handle rotation along", 350, 375, {
        hilite: { opacity: 0.9 },
        rotation: -30,
        flow: true,
        textBox: {
          padding: 5,
          width: 100,
          textAlign: "center",
          style: { stroke: "black", fill: "#9de3f2", borderRadius: true },
        },
      })
      .text(" with text background fill coloring.", { hilite: false })
      .text("", { flow: false })
      .endPage()
      .endPDF();
    writeOutput(end, "text-continued-segmentation", bytes);
    assert.equal(
      drawnRuns(end, bytes)
        .map((run) => run.text)
        .join(" ")
        .replace(/\s+/g, " "),
      [
        ...segments,
        "This is a text box with a padding of 4, with round box corners after a movedown(2).",
        "We can still handle rotation along with text background fill coloring.",
      ]
        .join(" ")
        .replace(/\s+/g, " "),
      "every run of every flow is drawn once, in order",
    );
  });

  // Issue #888.
  describe("flow", function () {
    var flowOptions = { flow: true, font: "arial", textBox: { width: 300 } };

    it("continues a flowed run on the line where the previous one ended", function () {
      var helloAdvance;
      var runs = runsOf("flow-line", (recipe) => {
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
      close(runs[0].x, 20);
      assert.equal(runs[1].y, runs[0].y);
      close(runs[1].x, runs[0].x + helloAdvance);
    });

    it("places a right-aligned line's runs as a left-aligned line's", function () {
      var helloAdvance;
      var runs = runsOf("flow-right", (recipe) => {
        helloAdvance = runAdvance(recipe, "Hello ", flowOptions);
        recipe
          .text("Hello ", 20, 20, {
            ...flowOptions,
            textBox: { width: 300, textAlign: "right" },
          })
          .text("world", {})
          .text("", { flow: false });
      });
      close(runs[1].x - runs[0].x, helloAdvance);
    });

    it("puts runs of different sizes on one baseline inside the box", function () {
      var bigAscent;
      var runs = runsOf("flow-sizes", (recipe) => {
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

    it("sizes each line of a flow by its own runs", function () {
      var flowRuns = runsOf("flow-line-heights", (recipe) => {
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
      var plainRuns = runsOf("flow-line-heights-plain", (recipe) => {
        recipe.text("Small small small", 20, 20, { font: "arial", size: 10 });
      });
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
      var empty = runsOf("flow-line-heights-empty", (recipe) => {
        recipe
          .text("Small small small", 20, 20, small)
          .text("", { size: 20, flow: false });
      });
      var space = runsOf("flow-line-heights-space", (recipe) => {
        recipe
          .text("Small small small", 20, 20, small)
          .text(" Big", { size: 20, flow: false });
      });
      assert.equal(empty[0].y, plainRuns[0].y);
      assert.deepEqual(
        space.map((run) => run.text),
        ["Small small small", "Big"],
      );
      assert.equal(space[0].y, plainRuns[0].y);
    });

    it("moves down the full height of a line with mixed sizes", function () {
      var mixedCoords;
      var bigCoords;
      runsOf("flow-mixed-movedown", (recipe) => {
        recipe
          .text("Small ", 20, 20, { flow: true, font: "arial", size: 10 })
          .text("Big", { size: 20 })
          .text("", { flow: false });
        mixedCoords = recipe.movedown(1, true);
      });
      runsOf("flow-big-movedown", (recipe) => {
        recipe.text("Big", 20, 20, { font: "arial", size: 20 });
        bigCoords = recipe.movedown(1, true);
      });
      assert.deepEqual(mixedCoords, bigCoords);
    });

    it("keeps runs without a space between them together", function () {
      var runs = runsOf("flow-no-space", (recipe) => {
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

    it("keeps each run's own style when a later run changes it", function () {
      var runs = runsOf("flow-run-style", (recipe) => {
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

    it("rotates only the runs that set rotation", function () {
      /**
       * Draw a flow and list the runs turned by 30 degrees.
       * @param {string} name - Output name suffix.
       * @param {function(object): void} draw - Draws the flow.
       * @returns {string[]} The text of every turned run.
       */
      var turned = (name, draw) =>
        runsOf(name, draw)
          .filter(
            (run) =>
              Math.abs(run.matrix[0] - Math.cos(Math.PI / 6)) < 1e-5 &&
              Math.abs(Math.abs(run.matrix[1]) - 0.5) < 1e-5,
          )
          .map((run) => run.text.trim());
      assert.deepEqual(
        turned("flow-rotated-run", (recipe) => {
          recipe
            .text("Plain ", 20, 20, flowOptions)
            .text("turned ", { rotation: 30 })
            .text("plain", { rotation: 0, flow: false });
        }),
        ["turned"],
      );
      assert.deepEqual(
        turned("flow-rotated-end", (recipe) => {
          recipe
            .text("Plain ", 20, 20, flowOptions)
            .text("more ", {})
            .text("turned", { rotation: 30, flow: false });
        }),
        ["turned"],
      );
    });

    it("measures each run's character spacing when wrapping a flow", function () {
      var runs = runsOf("flow-char-space", (recipe) => {
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
      // The line breaks of the same text in a single text() call.
      assert.deepEqual(
        runs.map((run) => run.text.trim()),
        ["Spaced letters", "wrap the same", "way in a flow as", "in one call."],
      );
    });

    it("wraps flowed runs together inside the shared text box", function () {
      var runs = runsOf("flow-wrap", (recipe) => {
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
        close(run.x, 20);
        assert.ok(run.y < (index ? wrapped[index - 1].y : runs[0].y));
      });

      // Fitting a run counts the space after every run before it that ends
      // with one, as drawing does.
      var spaced = runsOf("flow-wrap-spaces", (recipe) => {
        recipe
          .text("alpha ", 20, 20, { ...flowOptions, textBox: { width: 120 } })
          .text("bravo ", {})
          .text("charlie delta", { flow: false });
      });
      assert.deepEqual(
        spaced.map((run) => run.text),
        ["alpha ", "bravo", "charlie delta"],
      );
      close(spaced[2].x, 20);
      assert.ok(spaced[2].y < spaced[0].y);

      // A wrapped line starts with its first word, without the spaces that
      // start its run, and the line before it ends without its spaces.
      var leading = runsOf("flow-wrap-leading-space", (recipe) => {
        recipe
          .text("foxtrot", 20, 20, {
            ...flowOptions,
            size: 23,
            textBox: { width: 114 },
          })
          .text("hotel ", {})
          .text(" charlie", {})
          .text("", { flow: false });
      });
      assert.deepEqual(
        leading.map((run) => run.text),
        ["foxtrot", "hotel", "charlie"],
      );
      close(leading[2].x, 20);
      var centered = runsOf("flow-wrap-center", (recipe) => {
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

    it("continues the flow in calls without coordinates until flow: false", function () {
      var runs = runsOf("flow-default", (recipe) => {
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
      close(runs[3].x, 20);
      assert.ok(runs[3].y < runs[0].y - 60);
    });

    it("aligns the runs of one line as one line", function () {
      var runs = runsOf("flow-center", (recipe) => {
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

    it("gives every gap of a justified line one width across run sizes", function () {
      var ends = {};
      var runs = runsOf("flow-justify-sizes", (recipe) => {
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
      gaps.forEach((gap) => close(gap, gaps[0], 0.01, String(gaps)));
      var last = line[line.length - 1];
      close(last.x + ends[last.text], 18 + 220);
    });

    it("keeps the spaces that start a flowed line", function () {
      var start = runsOf("flow-leading-space", (recipe) => {
        recipe
          .text("   Indented", 50, 50, flowOptions)
          .text("", { flow: false });
      });
      assert.deepEqual(
        start.map((run) => run.text),
        ["   Indented"],
      );
      var runs = runsOf("flow-leading-space-line", (recipe) => {
        recipe
          .text("Line one", 50, 50, flowOptions)
          .movedown()
          .text("   Again", {})
          .text("", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Line one", "   Again"],
      );
      assert.ok(runs[1].y < runs[0].y);
    });

    // A flow must not be held for a later page.
    it("rejects a flow started without an active page", function () {
      var noPage =
        /No page is active; call createPage\(\) or editPage\(\) first/;
      assert.throws(
        () => end.newRecipe().text("X", 50, 50, flowOptions),
        noPage,
      );
      var recipe = end.newRecipe().createPage(200, 200).endPage();
      assert.throws(() => recipe.text("X", 50, 50, flowOptions), noPage);
      var bytes = recipe
        .createPage(200, 200)
        .text("Y", 20, 20, { font: "arial" })
        .endPage()
        .endPDF();
      writeOutput(end, "text-continued-flow-no-page", bytes);
      assert.deepEqual(
        drawnRuns(end, bytes, 1).map((run) => run.text),
        ["Y"],
      );
      assert.deepEqual(drawnRuns(end, bytes, 0), []);
    });

    it("rejects an invalid run at its call and keeps the flow", function () {
      var runs = runsOf("flow-invalid-run", (recipe) => {
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
      var open = runsOf("flow-invalid-end", (recipe) => {
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

    it("keeps the flow open when a call with coordinates is rejected", function () {
      var runs = runsOf("flow-invalid-positioned", (recipe) => {
        recipe.text("x ", 20, 20, flowOptions);
        assert.throws(
          () =>
            recipe.text("y", 20, 100, { ...flowOptions, charSpace: Infinity }),
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
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["x ", "z"],
      );
      assert.equal(runs[1].y, runs[0].y);
      assert.ok(runs[1].x > runs[0].x);
    });

    it("moves a flow down a whole line with movedown()", function () {
      var coords;
      var runs = runsOf("flow-movedown", (recipe) => {
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
      runs.forEach((run) => close(run.x, 20));
      var lineHeight = runs[0].y - runs[1].y;
      assert.ok(lineHeight > 10);
      assert.deepEqual(coords, [20, 20]);
      close(runs[1].y - runs[2].y, 2 * lineHeight);

      // A movedown() that ends the flow moves the next text below its lines.
      var after = runsOf("flow-movedown-end", (recipe) => {
        recipe
          .text("Hello", 20, 20, flowOptions)
          .movedown(2)
          .text("", { flow: false })
          .text("again", { font: "arial", flow: false });
      });
      close(after[0].y - after[1].y, 2 * lineHeight);
    });

    it("measures an empty flow with its own font", function () {
      var recipe = end.newRecipe().createPage(400, 400);
      recipe
        .text("", 20, 20, { flow: true, font: "arial", size: 30 })
        .text("", { flow: false });
      var flowY = recipe.movedown(0, true)[1];
      recipe.text("", 20, 20, { font: "arial", size: 30 });
      assert.equal(flowY, recipe.movedown(0, true)[1]);
      writeOutput(end, "text-continued-flow-empty", recipe.endPage().endPDF());
    });

    it("starts the line of an empty flow with the next run", function () {
      var runs = runsOf("flow-empty-start", (recipe) => {
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
      [
        [28, 14],
        [14, 28],
      ].forEach(([emptySize, size]) => {
        var sized = runsOf(`flow-empty-start-${emptySize}`, (recipe) => {
          recipe
            .text("", 20, 20, { ...flowOptions, size: emptySize })
            .text("Hello", { size })
            .text("", { flow: false })
            .text("Hello", 200, 20, { font: "arial", size });
        });
        assert.equal(sized[0].y, sized[1].y);
      });
    });

    // Issue #889: no flowed text is dropped.
    it("draws a flow that never ends when the page ends", function () {
      var runs = runsOf("flow-unended", (recipe) => {
        recipe.text("Hello ", 20, 20, flowOptions).text("world", {});
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["Hello ", "world"],
      );
      assert.equal(runs[1].y, runs[0].y);
    });

    it("links only a linked run's text when the page ends the flow", function () {
      var bytes = pdfOf("flow-link", (recipe) =>
        recipe
          .text("Hello ", 20, 20, flowOptions)
          .text("world", { link: "https://example.com" }),
      );
      var rects = annotations(end, bytes)
        .filter((annotation) => annotation.Subtype === "Link")
        .map((annotation) => annotation.Rect);
      assert.equal(rects.length, 1);
      assert.ok(rects[0][2] > rects[0][0]);
    });

    it("keeps per-run markup annotations and links in a flow", function () {
      var bytes = pdfOf("flow-markup", (recipe) =>
        recipe
          .text("Plain ", 20, 20, flowOptions)
          .text("marked", { highlight: true, link: "https://example.com" })
          .text(" plain", { highlight: false, link: undefined })
          .text("wavy", { squiggly: true })
          .text("", { flow: false }),
      );
      var subtypes = annotations(end, bytes).map(
        (annotation) => annotation.Subtype,
      );
      ["Highlight", "Link", "Squiggly"].forEach((subtype) =>
        assert.equal(
          subtypes.filter((name) => name === subtype).length,
          1,
          subtype,
        ),
      );
    });

    it("draws an open flow before a call with coordinates", function () {
      var runs = runsOf("flow-then-positioned", (recipe) => {
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

    it("draws an open flow before a table", function () {
      var runs = runsOf("flow-then-table", (recipe) => {
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

    it("draws an HTML flow that is not ended", function () {
      var runs = runsOf("flow-html-unended", (recipe) => {
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

    it("continues the line with HTML runs and ends after them", function () {
      var runs = runsOf("flow-html-runs", (recipe) => {
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
      var ended = runsOf("flow-html-runs-ended", (recipe) => {
        spaceAdvance = runAdvance(recipe, " ", flowOptions);
        recipe
          .text("Plain ", 20, 20, flowOptions)
          .text("<b>bold</b> <i>italic</i>", { html: true, flow: false });
      });
      assert.deepEqual(
        ended.map((run) => run.text),
        ["Plain ", "bold", " ", "italic"],
      );
      close(ended[3].x - ended[2].x, spaceAdvance);

      // HTML without text keeps the runs before it, also when it ends the flow.
      var empty = runsOf("flow-html-runs-empty", (recipe) => {
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
      var spans = runsOf("flow-html-spans", (recipe) => {
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

    it("moves an empty flow down with movedown()", function () {
      var runs = runsOf("flow-empty-movedown", (recipe) => {
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
      assert.ok(runs[1].y < runs[0].y);
      // B is one line below the empty line that starts 80pt below Hello's.
      close(runs[0].y - runs[2].y, 80 + runs[0].y - runs[1].y);
    });

    it("ends the line with movedown(0)", function () {
      var runs = runsOf("flow-movedown-zero", (recipe) => {
        recipe
          .text("Hello ", 20, 20, flowOptions)
          .movedown(0)
          .text("world", {})
          .text("", { flow: false });
      });
      assert.ok(runs[1].y < runs[0].y);
      close(runs[1].x, 20);
    });

    it("moves down below a flow whose last line is the tallest", function () {
      var runs = runsOf("flow-taller-last-line", (recipe) => {
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

    it("keeps the cursor out of a box's vertical alignment", function () {
      var aligned = runsOf("cursor-vertical-align", (recipe) => {
        recipe
          .text("A\nB", 20, 20, {
            font: "arial",
            textBox: { width: 100, height: 100, textAlign: "left center" },
          })
          .text("next", { font: "arial", flow: false });
      });
      var plain = runsOf("cursor-no-align", (recipe) => {
        recipe
          .text("A\nB", 20, 20, { font: "arial", textBox: { width: 100 } })
          .text("next", { font: "arial", flow: false });
      });
      assert.equal(aligned[2].y, plain[2].y);
    });

    it("keeps the spaces between runs in the middle of a flow", function () {
      var oneAdvance;
      var twoAdvance;
      var runs = runsOf("flow-middle-spaces", (recipe) => {
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
      close(runs[1].x - runs[0].x, oneAdvance);
      close(runs[2].x - runs[1].x, twoAdvance);
      assert.ok(runs[3].x > runs[2].x);
    });

    it("ends the line at line breaks that end a run", function () {
      var runs = runsOf("flow-trailing-breaks", (recipe) => {
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
      close(runs[1].y - runs[2].y, 2 * lineHeight);

      // HTML line breaks and line feeds end the line the same way, also when
      // the next run starts with one, and the cursor moves past them.
      var html = runsOf("flow-trailing-html-breaks", (recipe) => {
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
      });
      assert.deepEqual(
        html.map((run) => run.text),
        ["alpha", "bravo", "charlie", "delta", "echo", "one", "two"],
      );
      var steps = html.slice(1, 5).map((run, index) => html[index].y - run.y);
      assert.deepEqual(
        steps.map((step) => Math.round(step / lineHeight)),
        [2, 2, 0, 1],
      );
      close(html[5].y - html[6].y, 2 * lineHeight);
    });

    it("aligns a flow ended with empty text as one ended with text", function () {
      /**
       * Draw a right-aligned flow and end it.
       * @param {object} recipe - The Recipe.
       * @param {function(object): void} ending - Ends the flow.
       * @returns {void}
       */
      var draw = (recipe, ending) => {
        recipe
          .text("delta ", 20, 20, {
            ...flowOptions,
            textBox: { width: 300, textAlign: "right" },
          })
          .text("lima ", {});
        ending(recipe);
      };
      var empty = runsOf("flow-right-empty-end", (recipe) =>
        draw(recipe, (r) => r.text("", { flow: false })),
      );
      var page = runsOf("flow-right-page-end", (recipe) =>
        draw(recipe, () => {}),
      );
      var text = runsOf("flow-right-text-end", (recipe) => {
        recipe
          .text("delta ", 20, 20, {
            ...flowOptions,
            textBox: { width: 300, textAlign: "right" },
          })
          .text("lima ", { flow: false });
      });
      // Runs of only spaces at the end of the flow add no space to the line,
      // nor does an HTML element's trailing space.
      var spaces = runsOf("flow-right-spaces-end", (recipe) =>
        draw(recipe, (r) => r.text("  ", {}).text(" ", { flow: false })),
      );
      var html = runsOf("flow-right-html-end", (recipe) => {
        recipe
          .text("delta ", 20, 20, {
            ...flowOptions,
            textBox: { width: 300, textAlign: "right" },
          })
          .text("<u>lima</u> ", { html: true, flow: false });
      });
      /**
       * The start x of every run.
       * @param {Array<{x: number}>} runs - The runs.
       * @returns {number[]} Their x.
       */
      var xs = (runs) => runs.map((run) => run.x);
      assert.deepEqual(xs(empty), xs(text));
      assert.deepEqual(xs(page), xs(text));
      assert.deepEqual(xs(spaces), xs(text));
      assert.deepEqual(xs(html), xs(text));
    });

    it("wraps where one run ends and the next begins", function () {
      var runs = runsOf("flow-run-boundary-wrap", (recipe) => {
        recipe
          .text("aaa bbb", 20, 20, {
            ...flowOptions,
            size: 30,
            textBox: { width: 150 },
          })
          .text("ccc", {})
          .text("", { flow: false });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["aaa bbb", "ccc"],
      );
      assert.ok(runs[1].y < runs[0].y);
      assert.equal(runs[1].x, 20);

      // An HTML run whose first word does not fit starts the next line, and
      // its later elements follow it there.
      var html = runsOf("flow-run-boundary-wrap-html", (recipe) => {
        recipe
          .text("alpha bravo charlie ", 20, 20, {
            ...flowOptions,
            textBox: { width: 120 },
          })
          .text("delta <b>echo</b>", { html: true, flow: false });
      });
      assert.deepEqual(
        html.map((run) => run.text),
        ["alpha bravo charlie", "delta ", "echo"],
      );
      assert.equal(html[1].x, 20);
      assert.ok(html[1].y < html[0].y);
      assert.equal(html[2].y, html[1].y);
    });

    it("starts a new line for a run that opens with a block element", function () {
      var runs = runsOf("flow-html-block", (recipe) => {
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

      var div = runsOf("flow-html-div", (recipe) => {
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

    it("starts a new line for an HTML run after a closed block element", function () {
      var runs = runsOf("flow-html-block-end", (recipe) => {
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
      // movedown() after a closed block adds no blank line. Arial has one
      // face here, so every line is as tall as the first.
      close(runs[1].y - runs[2].y, lineHeight);
      close(runs[2].y - runs[3].y, lineHeight);

      // A run without text in between does not change that.
      var between = runsOf("flow-html-block-end-empty", (recipe) => {
        recipe
          .text("<p>alpha</p>", 20, 20, { ...flowOptions, html: true })
          .text("", {})
          .text("bravo", { flow: false });
      });
      assert.deepEqual(
        between.map((run) => run.text),
        ["alpha", "bravo"],
      );
      assert.equal(between[1].x, 20);
      assert.ok(between[1].y < between[0].y);
    });

    it("collapses an HTML run's first space into the space before it", function () {
      var alphaAdvance;
      var runs = runsOf("flow-html-space", (recipe) => {
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
      close(runs[1].x - runs[0].x, alphaAdvance);

      // After a word, the space stays, as a run of its own before an element.
      var kept = runsOf("flow-html-space-kept", (recipe) => {
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

    it("adds up line ends and ignores movedown(0) after one", function () {
      /**
       * Draw two runs with line ends between them.
       * @param {string} name - Output name suffix.
       * @param {function(object): void} moves - Ends lines.
       * @returns {Array<object>} The runs.
       */
      var draw = (name, moves) =>
        runsOf(name, (recipe) => {
          recipe.text("a", 20, 20, flowOptions);
          moves(recipe);
          recipe.text("b", {}).text("", { flow: false });
        });
      var twice = draw("flow-movedown-twice", (r) => r.movedown().movedown());
      var two = draw("flow-movedown-two", (r) => r.movedown(2));
      var broken = draw("flow-break-movedown", (r) =>
        r.text("\n", {}).movedown(),
      );
      var zero = draw("flow-movedown-zero-after", (r) =>
        r.movedown().movedown(0),
      );
      var one = draw("flow-movedown-one", (r) => r.movedown());
      assert.equal(twice[1].y, two[1].y);
      assert.equal(broken[1].y, two[1].y);
      assert.equal(zero[1].y, one[1].y);
    });

    it("gives a blank line the height of the line after it", function () {
      /**
       * The distance from the first line to the BIG line.
       * @param {string} name - Output name suffix.
       * @param {string} first - The first run.
       * @returns {number} The distance.
       */
      var gap = (name, first) => {
        var runs = runsOf(name, (recipe) => {
          recipe
            .text(first, 20, 20, { ...flowOptions, size: 8 })
            .text("BIG", { size: 30 })
            .text("", { flow: false });
        });
        return runs[0].y - runs[1].y;
      };
      var withBlank = gap("flow-blank-height", "small\n\n");
      var withoutBlank = gap("flow-no-blank", "small\n");
      // The blank line is as tall as the 30-point line, not the 8-point one.
      assert.ok(withBlank - withoutBlank > 20);
    });

    it("lays out each flowed run after the flow's open line only", function () {
      var runs = runsOf("flow-open-line", (recipe) => {
        var options = { font: "arial", size: 12 };
        recipe.text("start ", 20, 20, {
          ...options,
          flow: true,
          textBox: { width: 200, textAlign: "justify" },
        });
        for (var index = 0; index < 200; ++index) {
          recipe.text(index % 3 ? "word " : "longer ", options);
        }
        recipe.text("", { flow: false });
      });
      assert.equal(runs.length, 201);
      assert.match(runs.map((run) => run.text).join(""), /^start /);
      var lines = new Set(runs.map((run) => run.y));
      assert.ok(lines.size > 10);
    });

    it("starts a <br> run on the line after a wrapped HTML run", function () {
      var runs = runsOf("flow-html-br", (recipe) => {
        recipe
          .text("<b>The quick brown fox jumps over the lazy dog</b> ", 20, 20, {
            ...flowOptions,
            html: true,
            textBox: { width: 200 },
          })
          .text("<br>Next line", { html: true })
          .text("", { flow: false });
      });
      var ys = [...new Set(runs.map((run) => run.y))];
      // No blank line comes before the line the <br> starts. Arial has one
      // face here, so the bold lines are as tall as the regular one.
      close(ys[0] - ys[1], ys[1] - ys[2], 0.01, JSON.stringify(ys));
    });

    it("keeps a justified flowed paragraph's last line unjustified before an empty run", function () {
      /**
       * Draw the paragraph as a flow, with or without an empty run after it.
       * @param {string} name - Output name suffix.
       * @param {boolean} empty - Whether an empty run ends the paragraph.
       * @returns {Array<{text: string, x: number, y: number}>} The runs.
       */
      var draw = (name, empty) =>
        runsOf(name, (recipe) => {
          recipe.text(
            "<p>aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp</p>",
            20,
            20,
            {
              ...flowOptions,
              html: true,
              textBox: { width: 200, textAlign: "justify" },
            },
          );
          if (empty) recipe.text("", { flow: true });
          recipe.text("", { flow: false });
        });
      assert.deepEqual(
        draw("flow-justify-empty", true),
        draw("flow-justify", false),
      );
    });

    it("flows calls without coordinates unless they pass flow: false", function () {
      var runs = runsOf("flow-implicit", (recipe) => {
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
      assert.ok(lineHeight >= 10 && lineHeight <= 20);
      close(runs[2].y - runs[3].y, lineHeight);
    });
  });

  it("ends the line at a trailing line feed instead of drawing it", function () {
    /**
     * Draw HTML in Arial.
     * @param {string} text - The HTML.
     * @returns {Array<object>} The runs.
     */
    var html = (text) =>
      runsOf("trailing-line-feed", (recipe) =>
        recipe.text(text, 20, 20, { font: "arial", html: true }),
      );
    var [bravo, x] = html("bravo\n<b>x</b>");
    assert.equal(bravo.text, "bravo");
    assert.equal(x.text, "x");
    assert.ok(x.y < bravo.y);
    assert.deepEqual(
      html("<p>bravo\n</p><p>x</p>").map((run) => run.text),
      ["bravo", "x"],
    );
    // Also when the line feed ends a nested inline element.
    var [a, c] = html("<i><b>a\n</b></i>c");
    assert.ok(c.y < a.y);
  });

  it("shortens a flow that overflows its box and drops the rest", function () {
    // As one call does, trim drops the word that does not fit and clip keeps
    // it, cut at the box edge.
    [
      ["trim", "alpha bravo"],
      ["clip", "alpha bravo charlie "],
    ].forEach(([wrap, line]) => {
      var runs = runsOf(`flow-${wrap}`, (recipe) =>
        recipe
          .text("alpha bravo ", 20, 20, {
            font: "arial",
            flow: true,
            textBox: { width: 80, wrap },
          })
          .text("charlie delta echo ", {})
          .text("fox golf", { flow: false }),
      );
      assert.deepEqual(
        runs.map((run) => run.text),
        [line],
      );
    });
    // A run that continues a line ends it with the ellipsis, without throwing.
    var runs = runsOf("flow-ellipsis", (recipe) =>
      recipe
        .text("delta ", 20, 20, {
          flow: true,
          font: "arial",
          size: 25,
          textBox: { width: 78, wrap: "ellipsis" },
        })
        .text("hotel", { flow: false }),
    );
    assert.equal(runs.length, 1);
    assert.match(runs[0].text, /^delta./);
    // A line the flow moves down to is drawn again.
    var below = runsOf("flow-trim-movedown", (recipe) =>
      recipe
        .text("alpha bravo ", 20, 20, {
          font: "arial",
          flow: true,
          textBox: { width: 80, wrap: "trim" },
        })
        .text("charlie ", {})
        .movedown()
        .text("next line", { flow: false }),
    );
    assert.deepEqual(
      below.map((run) => run.text),
      ["alpha bravo", "next line"],
    );
    // So does the line after a trailing line feed.
    var afterBreak = runsOf("flow-trim-line-feed", (recipe) =>
      recipe
        .text("alpha bravo ", 20, 20, {
          font: "arial",
          flow: true,
          textBox: { width: 80, wrap: "trim" },
        })
        .text("charlie\n", {})
        .text("next line", { flow: false }),
    );
    assert.deepEqual(
      afterBreak.map((run) => run.text),
      ["alpha bravo", "next line"],
    );
    // An ellipsized flow is cut where the same text in one call is.
    /**
     * The texts of the runs a drawing makes.
     * @param {string} name - Output name suffix.
     * @param {function(object): void} draw - Draws.
     * @returns {string[]} The texts.
     */
    var cut = (name, draw) => runsOf(name, draw).map((run) => run.text);
    var E = { font: "arial", textBox: { width: 80, wrap: "ellipsis" } };
    assert.deepEqual(
      cut("flow-ellipsis-runs", (recipe) =>
        recipe
          .text("alpha bravo ", 20, 20, { ...E, flow: true })
          .text("charlie delta echo ", {})
          .text("fox golf", { flow: false }),
      ),
      cut("flow-ellipsis-one", (recipe) =>
        recipe.text("alpha bravo charlie delta echo fox golf", 20, 20, E),
      ),
    );
    var D = {
      font: "arial",
      size: 25,
      textBox: { width: 78, wrap: "ellipsis" },
    };
    assert.deepEqual(
      cut("flow-ellipsis-word", (recipe) =>
        recipe
          .text("delta ", 20, 20, { ...D, flow: true })
          .text("hotel", { flow: false }),
      ),
      cut("flow-ellipsis-word-one", (recipe) =>
        recipe.text("delta hotel", 20, 20, D),
      ),
    );
  });

  it("continues the open line up to a line break in a flowed run", function () {
    var [foxtrot, golf, mike] = runsOf("flow-line-break", (recipe) =>
      recipe
        .text("foxtrot", 20, 20, {
          flow: true,
          font: "arial",
          textBox: { width: 200 },
        })
        .text("golf\nmike", { flow: false }),
    );
    assert.equal(golf.y, foxtrot.y);
    assert.ok(golf.x > foxtrot.x);
    assert.equal(mike.x, foxtrot.x);
    assert.ok(mike.y < foxtrot.y);
  });

  it("keeps the spaces that start a flowed line before movedown()", function () {
    var [indented, x] = runsOf("flow-indent-movedown", (recipe) =>
      recipe
        .text("   Indented", 50, 50, { flow: true, font: "arial" })
        .movedown()
        .text("x", {})
        .text("", { flow: false }),
    );
    assert.equal(indented.text, "   Indented");
    assert.equal(x.x, 50);
    // Right-aligned lines that end with a line break keep them too.
    var [right] = runsOf("right-leading-spaces", (recipe) =>
      recipe.text("   right\n   two", 20, 20, {
        font: "arial",
        textBox: { width: 200, textAlign: "right" },
      }),
    );
    assert.equal(right.text, "   right");
  });

  it("aligns the runs of one flowed line as one line", function () {
    var flow = { flow: true, font: "arial", textBox: { width: 300 } };
    /**
     * Draw a flow that starts with "alpha ".
     * @param {string} name - Output name suffix.
     * @param {function(object): void} draw - Continues the flow.
     * @returns {Array<object>} The runs.
     */
    var place = (name, draw) =>
      runsOf(name, (recipe) => draw(recipe.text("alpha ", 20, 20, flow)));
    /**
     * The start x of every run, to two decimals.
     * @param {Array<{x: number}>} runs - The runs.
     * @returns {number[]} Their x.
     */
    var xs = (runs) => runs.map((run) => Math.round(run.x * 100) / 100);
    // Only the second run centers: both runs move together.
    var centered = place("flow-align-a", (recipe) =>
      recipe
        .text("bravo", { textBox: { textAlign: "center" } })
        .text("", { flow: false }),
    );
    assert.deepEqual(xs(centered), [132.23, 173.28]);
    // The call that ends the flow sets the alignment of the last line.
    var ending = place("flow-align-c", (recipe) =>
      recipe
        .text("bravo", {})
        .text("", { flow: false, textBox: { textAlign: "center" } }),
    );
    assert.deepEqual(xs(ending), [132.23, 173.28]);
    // A later run that switches back to left leaves no overlap.
    var left = runsOf("flow-align-b", (recipe) =>
      recipe
        .text("alpha ", 20, 20, {
          ...flow,
          textBox: { width: 300, textAlign: "center" },
        })
        .text("bravo", { textBox: { textAlign: "left" } })
        .text("", { flow: false }),
    );
    assert.deepEqual(xs(left), [20, 61.05]);
    // The call that ends the flow aligns every line of it.
    var lines = runsOf("flow-align-lines", (recipe) =>
      recipe
        .text("alpha ", 20, 20, flow)
        .movedown()
        .text("bravo", { textBox: { textAlign: "center" } })
        .text("", { flow: false }),
    );
    lines.forEach((run) => assert.ok(run.x > 100));
    // It sets the vertical alignment as well.
    var bottom = runsOf("flow-align-vertical", (recipe) =>
      recipe
        .text("alpha ", 20, 20, {
          ...flow,
          textBox: { width: 300, height: 200 },
        })
        .text("bravo", { flow: false, textBox: { textAlign: "left bottom" } }),
    );
    assert.ok(bottom[0].y < 200);
  });

  it("wraps the HTML text that follows an inline element at the box edge", function () {
    var runs = runsOf("html-inline-wrap", (recipe) =>
      recipe.text(
        "<p>the quick <u>brown</u> fox jumps over the lazy dog and again over the dog</p>",
        20,
        20,
        { html: true, font: "arial", size: 12, textBox: { width: 200 } },
      ),
    );
    var firstLine = runs.filter((run) => run.y === runs[0].y);
    assert.ok(
      !firstLine
        .map((run) => run.text)
        .join("")
        .includes("dog"),
    );
    // Justified HTML stays inside the box, too.
    var justified = runsOf("html-justify-inline", (recipe) =>
      recipe.text("aa bb cc <b>dd</b> ee ff gg hh ii jj kk", 20, 20, {
        html: true,
        font: "arial",
        textBox: { width: 100, textAlign: "justify" },
      }),
    );
    justified
      .filter((run) => run.y === justified[0].y)
      .forEach((run) => assert.ok(run.x < 120));
    // The text after an inline element that wrapped continues its line.
    /**
     * Draw HTML in Arial and list its runs.
     * @param {string} name - Output name suffix.
     * @param {string} html - The HTML.
     * @param {object} textBox - The text box.
     * @returns {Array<[string, number]>} Text and y of every run.
     */
    var lineOf = (name, html, textBox) =>
      runsOf(name, (recipe) =>
        recipe.text(html, 20, 20, { html: true, font: "arial", textBox }),
      ).map((run) => [run.text, run.y]);
    var wrapped = lineOf(
      "html-wrapped-inline",
      "<p>aaaa bbbb cccc <b>dddd eeee</b> ffff gg</p>",
      { width: 100 },
    );
    assert.equal(wrapped[2][1], wrapped[1][1]);
    // A list item starts its own line, with its marker.
    assert.equal(
      lineOf(
        "html-list-items",
        "<ul><li>aa bb cc dd ee ff</li><li>xxxx yyyy zzzz</li></ul>",
        { width: 100 },
      )[2][0].trim(),
      "* xxxx yyyy",
    );
    // Clipped HTML keeps the spaces between its runs.
    assert.equal(
      lineOf("html-clip-spaces", "aa <b>bb</b> cc dd ee ff", {
        width: 60,
        wrap: "clip",
      })
        .map(([text]) => text)
        .join(""),
      "aa bb cc dd ",
    );
    // A list item's later runs are not indented again.
    var item = lineOf(
      "html-list-inline",
      "<ol><li>aa <b>bb</b> cc dd ee ff gg hh ii jj</li></ol>",
      { width: 100 },
    );
    assert.deepEqual(
      item.filter(([, y]) => y === item[0][1]).map(([text]) => text),
      ["      1. aa ", "bb", " cc"],
    );
    // Ellipsized HTML is cut as plain text is, inside the box.
    /**
     * The text an ellipsized box draws.
     * @param {string} name - Output name suffix.
     * @param {string} html - The HTML.
     * @returns {string} The drawn text.
     */
    var ellipsized = (name, html) =>
      lineOf(name, html, { width: 60, wrap: "ellipsis" })
        .map(([text]) => text)
        .join("");
    assert.equal(
      ellipsized("html-ellipsis", "aa bb <b>cc</b> dd ee ff"),
      ellipsized("plain-ellipsis", "aa bb cc dd ee ff"),
    );
  });

  it("justifies a flow line by line and leaves its last line left-aligned", function () {
    var J = {
      flow: true,
      font: "arial",
      textBox: { width: 269, textAlign: "justify" },
    };
    // The last line stays at the left, also when its first run starts with a space.
    var last = runsOf("flow-justify-last", (recipe) =>
      recipe.text(" india ", 20, 20, J).text("golf", { flow: false }),
    );
    assert.deepEqual(
      last.map((run) => run.x.toFixed(2)),
      ["20.00", "60.25"],
    );
    // Runs that start with a space get gaps as wide as the others, so no
    // word comes close to the next one.
    var wordEnd = {};
    var wide = runsOf("flow-justify-space", (recipe) => {
      ["alpha", "bravo"].forEach((word) => {
        wordEnd[word] = recipe.textDimensions(word, { font: "arial" }).xMax;
      });
      recipe
        .text(" alpha", 20, 20, {
          ...J,
          textBox: { width: 150, textAlign: "justify" },
        })
        .text(" bravo charlie", {})
        .text("lima delta echo foxtrot golf", { flow: false });
    });
    var [alpha, bravo, charlie] = wide;
    var gaps = [
      bravo.x - alpha.x - wordEnd.alpha,
      charlie.x - bravo.x - wordEnd.bravo,
    ];
    // Words keep the width of the space they end with.
    close(gaps[1], gaps[0], 1);
  });

  it("lays out bold and italic HTML runs with the face they are drawn in", function () {
    var html = runsOf("html-bold-measure", (recipe) =>
      recipe.text("<b>bold</b> next", 20, 20, { font: "arial", html: true }),
    );
    var flow = runsOf("flow-bold-measure", (recipe) =>
      recipe
        .text("bold", 20, 20, {
          font: "arial",
          bold: true,
          flow: true,
          textBox: { width: 300 },
        })
        .text(" next", { bold: false, flow: false }),
    );
    close(html[1].x, flow[1].x);
    // Its baseline and line spacing come from the bold face too.
    /**
     * Draw text in an 80-point box.
     * @param {string} name - Output name suffix.
     * @param {string} text - The text.
     * @param {object} options - Text options.
     * @returns {Array<[number, number]>} Position of every run.
     */
    var wrap = (name, text, options) =>
      runsOf(name, (recipe) =>
        recipe.text(text, 20, 20, { ...options, textBox: { width: 80 } }),
      ).map((run) => [run.x, run.y]);
    assert.deepEqual(
      wrap("html-bold-lines", "<b>wwww wwww wwww</b>", { html: true }),
      wrap("bold-lines", "wwww wwww wwww", { bold: true }),
    );
    // Where the default font's faces differ, " next" starts apart: see the
    // native spec; the Wasm default font has one face.
  });

  describe("layout", function () {
    it("puts the first baseline one ascent below y", function () {
      var runs = runsOf("layout-first-baseline", (recipe) =>
        recipe.text("Hello", 20, 20, { font: "arial" }),
      );
      close(runs[0].y, 369.81, 0.05);
    });

    it("keeps the padding when aligning text to the bottom or center", function () {
      /**
       * The baseline of an aligned box's text.
       * @param {string} name - Output name suffix.
       * @param {string} textAlign - The alignment.
       * @param {number|number[]} padding - The padding.
       * @returns {number} The baseline y.
       */
      var baseline = (name, textAlign, padding) =>
        runsOf(name, (recipe) =>
          recipe.text("alpha", 20, 20, {
            font: "arial",
            textBox: { width: 200, height: 100, padding, textAlign },
          }),
        )[0].y;
      var bottom =
        baseline("layout-bottom-padding", "left bottom", 10) -
        baseline("layout-bottom-plain", "left bottom", 0);
      close(bottom, 10, 0.01, `bottom moved ${bottom}`);
      var center =
        baseline("layout-center-padding", "left center", [30, 0, 0, 0]) -
        baseline("layout-center-plain", "left center", 0);
      close(center, -15, 0.01, `center moved ${center}`);
    });

    it("right-aligns inside the padded box", function () {
      /**
       * The start x of right-aligned text.
       * @param {string} name - Output name suffix.
       * @param {number} padding - The padding.
       * @returns {number} The x.
       */
      var place = (name, padding) =>
        runsOf(name, (recipe) =>
          recipe.text("charlie delta", 20, 20, {
            font: "arial",
            textBox: { width: 150, padding, textAlign: "right" },
          }),
        )[0].x;
      var shift =
        place("layout-right-plain", 0) - place("layout-right-padded", 4);
      // Right-aligned text moves left by the right padding alone.
      close(shift, 4, 0.01, `shift was ${shift}`);
    });

    it("aligns text in a box grown to minHeight as in one with that height", function () {
      ["left bottom", "left center"].forEach((textAlign) => {
        var grown = runsOf("layout-min-height", (recipe) =>
          recipe.text("alpha", 20, 20, {
            font: "arial",
            textBox: { width: 200, minHeight: 100, textAlign },
          }),
        );
        var fixed = runsOf("layout-height", (recipe) =>
          recipe.text("alpha", 20, 20, {
            font: "arial",
            textBox: { width: 200, height: 100, textAlign },
          }),
        );
        close(grown[0].y, fixed[0].y, 0.01, textAlign);
      });
    });

    it("hilites the line box of every run", function () {
      var { rects } = drawn(
        end,
        pdfOf("layout-hilite", (recipe) =>
          recipe
            .text("alpha ", 20, 20, {
              flow: true,
              font: "arial",
              hilite: true,
              textBox: { width: 300 },
            })
            .text("bravo", { flow: false }),
        ),
      );
      // Both runs share one top and one height (13.13 at 14 pt).
      assert.equal(rects.length, 2);
      close(rects[0].height, rects[1].height);
      close(rects[0].y, rects[1].y);
    });
  });
});
