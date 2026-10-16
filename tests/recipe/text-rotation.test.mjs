// Merges packages/native-with-source/tests/recipe/text-rotation.js, the Wasm
// tests/recipe/text-rotation.test.mjs and the rotated-link case of the native
// text.js. Rotation is asserted on where the text lands on the page, not on
// the `cm` operators an end writes for it.
import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { annotations } from "../support/pdf.mjs";
import { clipBounds, placedRuns, turnClockwise } from "../support/text.mjs";

var CLOCKWISE_30 = [0.866025, -0.5, 0.5, 0.866025];

/**
 * Assert a matrix turns by a clockwise angle: [cos -sin sin cos].
 * @param {number[]} matrix - The placing matrix.
 * @param {number} degrees - The clockwise angle.
 * @returns {void}
 */
function assertTurned(matrix, degrees) {
  var radians = (degrees * Math.PI) / 180;
  var expected = [
    Math.cos(radians),
    -Math.sin(radians),
    Math.sin(radians),
    Math.cos(radians),
  ];
  matrix
    .slice(0, 4)
    .forEach((value, index) =>
      assert.ok(
        Math.abs(value - expected[index]) < 1e-5,
        `${degrees}: ${matrix} is not ${expected}`,
      ),
    );
}

/**
 * Assert a point is where another lands when turned around a pivot.
 * @param {object} run - The turned run.
 * @param {object} upright - The same run drawn without rotation.
 * @param {number[]} pivot - The PDF pivot.
 * @param {number} degrees - The clockwise angle.
 * @returns {void}
 */
function assertTurnedAround(run, upright, pivot, degrees) {
  var [x, y] = turnClockwise([upright.x, upright.y], pivot, degrees);
  assert.ok(Math.abs(run.x - x) < 0.01, `x ${run.x} is not ${x}`);
  assert.ok(Math.abs(run.y - y) < 0.01, `y ${run.y} is not ${y}`);
}

/**
 * Assert a run is clipped by a box that turns with it.
 * @param {object} run - The run.
 * @param {number} width - The clip width.
 * @returns {void}
 */
function assertTurnedClip(run, width) {
  var clip = run.clips.find((corners) => {
    var [[x1, y1], [x2, y2]] = corners;
    return Math.abs(Math.hypot(x2 - x1, y2 - y1) - width) < 0.01;
  });
  assert.ok(clip, `a ${width} point clip: ${JSON.stringify(run.clips)}`);
  var [[x1, y1], [x2, y2]] = clip;
  // Its bottom edge runs along the turned baseline, not upright.
  assert.ok(Math.abs((x2 - x1) / width - CLOCKWISE_30[0]) < 1e-5);
  assert.ok(Math.abs((y2 - y1) / width - CLOCKWISE_30[1]) < 1e-5);
}

describeEnds("Recipe text rotation", function (end) {
  it("draws text at every rotation", function () {
    var recipe = end.openRecipe("recipe/test.pdf");
    var pages = recipe.metadata.pages;
    var angles = [
      0, 0, 1, 45, -45, 90, 135, -135, 180, 270, 360, -90, -180, -270, -360,
      450,
    ];
    for (var i = 1; i <= pages; i++) {
      var angle = angles[i] || 0;
      recipe
        .editPage(i)
        .circle("center", 300, 10, { stroke: "#0032FF" })
        .text(`${angle} ROTATION pjqy`, "center", 300, {
          bold: true,
          size: 80,
          color: "#0000FF",
          align: "center center",
          rotation: angle,
          opacity: 0.25,
        })
        .circle("center", "center", 10, { stroke: "#0032FF" })
        .text(`${angle} ROTATION pjqy`, "center", "center", {
          bold: true,
          size: 80,
          color: "#0000FF",
          align: "center center",
          rotation: angle,
          opacity: 0.5,
        })
        .circle("center", 500, 10, { stroke: "#0032FF" })
        .text(`${angle} ROTATION pjqy`, "center", 500, {
          bold: true,
          size: 80,
          color: "#0000FF",
          align: "center center",
          rotation: angle,
        })
        .endPage();
    }
    var bytes = recipe.endPDF();
    writeOutput(end, "text-rotation", bytes);
    for (var index = 0; index < pages; index++) {
      var angle = angles[index + 1] || 0;
      var runs = placedRuns(end, bytes, index).filter(
        (run) => run.text === `${angle} ROTATION pjqy`,
      );
      assert.equal(runs.length, 3, `page ${index + 1}`);
      runs.forEach((run) => assertTurned(run.matrix, angle));
    }
  });

  it("turns text clockwise around its position", function () {
    /**
     * Draw "alpha" at Recipe (100, 100) and return its run.
     * @param {object} options - Extra text options.
     * @returns {object} The placed run.
     */
    var draw = (options) =>
      placedRuns(
        end,
        end
          .newRecipe()
          .createPage(400, 400)
          .text("alpha", 100, 100, { font: "arial", ...options })
          .endPage()
          .endPDF(),
      )[0];
    var upright = draw({});
    var turned = draw({ rotation: 30 });
    assertTurned(turned.matrix, 30);
    // Recipe (100, 100) is PDF (100, 300) on a 400 point high page.
    assertTurnedAround(turned, upright, [100, 300], 30);
    // Opacity, which may draw differently, turns the same way.
    var faded = draw({ rotation: 30, opacity: 0.5 });
    assert.deepEqual(faded.matrix, turned.matrix);
  });

  it("turns every line around the text position, before alignment", function () {
    /**
     * Draw the wrapped, centered text and return its runs.
     * @param {number} rotation - The clockwise rotation.
     * @returns {object[]} The placed runs that show text.
     */
    var draw = (rotation) => {
      var bytes = end
        .newRecipe()
        .createPage(400, 400)
        .text("alpha beta gamma delta", 200, 100, {
          font: "arial",
          rotation,
          align: "center center",
          textBox: { width: 60 },
        })
        .endPage()
        .endPDF();
      writeOutput(end, `text-rotation-lines-${rotation}`, bytes);
      return placedRuns(end, bytes).filter((run) => run.text.trim());
    };
    var upright = draw(0);
    var turned = draw(30);
    assert.ok(turned.length > 1, "the text wraps onto several lines");
    assert.equal(turned.length, upright.length);
    // Each line turns around the same pivot instead of its own baseline, so
    // the lines stay one block.
    turned.forEach((run, index) => {
      assertTurned(run.matrix, 30);
      assertTurnedAround(run, upright[index], [200, 300], 30);
    });
  });

  it("turns a clipped line's clip box with its text", function () {
    var bytes = end
      .newRecipe()
      .createPage(400, 400)
      .text("alpha beta gamma", 100, 100, {
        font: "arial",
        rotation: 30,
        textBox: { width: 60, height: 20, wrap: "clip" },
      })
      .endPage()
      .endPDF();
    writeOutput(end, "text-rotation-clip", bytes);
    var runs = placedRuns(end, bytes);
    assert.equal(runs.length, 1);
    assertTurned(runs[0].matrix, 30);
    assertTurnedClip(runs[0], 60);
  });

  it("turns a flowed clipped line's clip box with its text", function () {
    var bytes = end
      .newRecipe()
      .createPage(400, 400)
      // Without coordinates the call flows and starts at the page margins,
      // Recipe (72, 72), which is PDF (72, 328).
      .text("alpha beta gamma", {
        font: "arial",
        rotation: 30,
        textBox: { width: 60, wrap: "clip" },
      })
      .endPage()
      .endPDF();
    writeOutput(end, "text-rotation-flow-clip", bytes);
    var runs = placedRuns(end, bytes);
    assert.equal(runs.length, 1);
    assertTurned(runs[0].matrix, 30);
    // The clip is turned with the text, around the flow's start, not upright.
    assertTurnedClip(runs[0], 60);
    runs[0].clips.forEach((clip) => {
      var [[x1, y1], [x2, y2]] = clip;
      assert.notEqual(y1, y2, "no upright clip");
      assert.notEqual(x1, x2);
    });
    var top = runs[0].clips.map(clipBounds).map((bounds) => bounds.top);
    assert.ok(
      top.some((value) => Math.abs(value - 328) < 0.01),
      JSON.stringify(top),
    );
  });

  it("keeps the link of rotated clipped text", function () {
    var rects = [true, false].map((flow) => {
      var recipe = end.newRecipe().createPage(400, 400);
      var options = {
        font: "arial",
        rotation: 90,
        link: "https://example.com",
        textBox: { width: 60, wrap: "clip" },
      };
      if (flow) recipe.text("alpha bravo charlie", options);
      else recipe.text("alpha bravo charlie", 100, 100, options);
      var bytes = recipe.endPage().endPDF();
      writeOutput(end, `text-rotation-link-clip-${flow}`, bytes);
      var links = annotations(end, bytes).filter(
        (annotation) => annotation.Subtype === "Link",
      );
      assert.equal(links.length, 1, `flow ${flow} keeps its link`);
      return links[0].Rect;
    });
    // Turned a quarter clockwise around the text's top-left corner, the line
    // runs down from it, and the clip ends it 60 points below.
    var [left, bottom, right, top] = rects[1];
    assert.ok(right <= 100 && left < right, `x ${left}..${right}`);
    assert.ok(top <= 300 && bottom >= 240 - 0.001, `y ${bottom}..${top}`);
    assert.ok(rects[0][1] >= 328 - 60 - 0.001, "the flowed link is clipped");
  });

  it("turns a text link with its text", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    var width = recipe.textDimensions("alpha", { font: "arial" }).xMax;
    var bytes = recipe
      .text("alpha", 100, 300, {
        font: "arial",
        rotation: 30,
        link: "https://example.com",
      })
      .endPage()
      .endPDF();
    writeOutput(end, "text-rotation-link", bytes);
    var [left, bottom, right, top] = annotations(end, bytes)[0].Rect;
    // The rectangle bounds the text's box turned clockwise around its
    // top-left corner, PDF (100, 100): the corner stays the top, the text
    // swings down to the right and its height to the left, never above it.
    var height = (100 - left) / 0.5;
    assert.ok(height > 0, `left ${left} is left of the pivot`);
    assert.ok(Math.abs(top - 100) < 0.01, `top ${top}`);
    assert.ok(Math.abs(right - (100 + 0.866025 * width)) < 0.01, `right`);
    assert.ok(
      Math.abs(bottom - (100 - 0.5 * width - 0.866025 * height)) < 0.01,
      `bottom ${bottom}`,
    );
  });
});
