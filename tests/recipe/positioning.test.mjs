import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { bounds, clockwise, paths } from "../support/geometry.mjs";

var LETTER_HEIGHT = 792;
var GREEN = [0, 1, 0];
var col = [0, 90, 205, 320, 435];
var row = [0, 90, 205, 320, 435, 550];
var wid = [80, 195];
var hgt = [80];

/**
 * A Recipe point on a letter page in PDF coordinates.
 * @param {number} x - The Recipe x.
 * @param {number} y - The Recipe y.
 * @returns {number[]} The PDF [x, y].
 */
function pdf(x, y) {
  return [x, LETTER_HEIGHT - y];
}

/**
 * Draw green cut marks around a frame.
 * @param {object} recipe - The Recipe.
 * @param {number} left - The frame left.
 * @param {number} top - The frame top.
 * @param {number} width - The frame width.
 * @param {number} height - The frame height.
 * @returns {void}
 */
function frame(recipe, left, top, width, height) {
  var cut = 8;
  var options = { color: "#00ff00", width: 1 };
  var bottom = top + height;
  var right = left + width;
  recipe.line(
    [
      [left - cut, top],
      [right + cut, top],
    ],
    options,
  );
  recipe.line(
    [
      [left - cut, bottom],
      [right + cut, bottom],
    ],
    options,
  );
  recipe.line(
    [
      [left, top - cut],
      [left, bottom + cut],
    ],
    options,
  );
  recipe.line(
    [
      [right, top - cut],
      [right, bottom + cut],
    ],
    options,
  );
}

/**
 * Mark a rotation origin with a small red circle.
 * @param {object} recipe - The Recipe.
 * @param {number} cx - The Recipe x.
 * @param {number} cy - The Recipe y.
 * @returns {void}
 */
function markOrigin(recipe, cx, cy) {
  recipe.circle(cx, cy, 5, { stroke: "#ff0000", width: 1 });
}

/**
 * The triangle drawn into a frame.
 * @param {number} left - The frame left.
 * @param {number} top - The frame top.
 * @returns {number[][]} Recipe vertices.
 */
function triangle(left, top) {
  return [
    [left + wid[0] / 2, top],
    [left + wid[0], top + hgt[0]],
    [left, top + hgt[0]],
  ];
}

/**
 * The paths that are no green cut mark.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {object[]} The shape paths in painting order.
 */
function shapes(end, bytes) {
  return paths(end, bytes).filter(
    (path) => path.stroke.values.join() !== GREEN.join(),
  );
}

/**
 * Assert that two point lists hold the same points, in any order, within
 * 0.01 pt.
 * @param {number[][]} actual - The drawn points.
 * @param {number[][]} expected - The expected points.
 * @returns {void}
 */
function assertSamePoints(actual, expected) {
  var key = (point) => point.map((value) => value.toFixed(2)).join(" ");
  var unique = (points) => [...new Set(points.map(key))].sort();
  assert.deepEqual(unique(actual), unique(expected));
}

/**
 * The center of the anchors of a closed curve, such as an ellipse.
 * @param {number[][]} anchors - The anchors; the last repeats the first.
 * @returns {number[]} The [x, y] center.
 */
function center(anchors) {
  var points = anchors.slice(1);
  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
  ];
}

/**
 * The corners of a Recipe rectangle stroked with a line width, inset so the
 * stroke stays inside the rectangle, in PDF coordinates.
 * @param {number} left - The Recipe left.
 * @param {number} top - The Recipe top.
 * @param {number} width - The width.
 * @param {number} height - The height.
 * @param {number} lineWidth - The line width.
 * @returns {number[][]} The PDF corners.
 */
function insetCorners(left, top, width, height, lineWidth) {
  var inset = lineWidth / 2;
  return [
    pdf(left + inset, top + inset),
    pdf(left + width - inset, top + inset),
    pdf(left + width - inset, top + height - inset),
    pdf(left + inset, top + height - inset),
  ];
}

describeEnds("Graphic Object Positioning", function (end) {
  it("keeps rectangle, circle and ellipse strokes inside their frames", function () {
    var recipe = end.newRecipe({ colorspace: "rgb" });
    recipe.createPage("letter");
    for (var i = 1; i <= 4; i++) {
      frame(recipe, col[1], row[i], wid[0], hgt[0]);
      frame(recipe, col[2], row[i], wid[0], hgt[0]);
      frame(recipe, col[3], row[i], wid[0], hgt[0]);
      frame(recipe, col[4], row[i], wid[0], hgt[0]);
    }
    frame(recipe, col[1], row[5], wid[1], hgt[0]);
    frame(recipe, col[3], row[5], wid[1], hgt[0]);
    var widths = [1, 2, 3, 5];
    widths.forEach((width, index) =>
      recipe.rectangle(col[index + 1], row[1], wid[0], hgt[0], { width }),
    );
    widths.forEach((width, index) =>
      recipe.circle(
        col[index + 1] + wid[0] / 2,
        row[2] + hgt[0] / 2,
        wid[0] / 2,
        { width },
      ),
    );
    widths.forEach((width, index) =>
      recipe.polygon(triangle(col[index + 1], row[3]), { width }),
    );
    widths.forEach((width, index) =>
      recipe.line(
        [
          [col[index + 1], row[4]],
          [col[index + 1] + wid[0], row[4] + hgt[0]],
        ],
        { width },
      ),
    );
    var bytes = recipe
      .ellipse(
        col[1] + wid[1] / 2,
        row[5] + hgt[0] / 2,
        wid[1] / 2,
        hgt[0] / 2,
        { width: 1 },
      )
      .ellipse(
        col[3] + wid[1] / 2,
        row[5] + hgt[0] / 2,
        wid[1] / 2,
        hgt[0] / 2,
        { width: 5 },
      )
      .text(
        "Note, polygons and lines grow outside cut frames with line width",
        100,
        40,
        { font: "arial" },
      )
      .text("*", 80, 40, { font: "arial", color: "ff0000", fontSize: 32 })
      .text("*", col[1] - 20, row[3] + hgt[0] / 2, {
        font: "arial",
        color: "ff0000",
        fontSize: 32,
      })
      .text("*", col[1] - 20, row[4] + hgt[0] / 2, {
        font: "arial",
        color: "ff0000",
        fontSize: 32,
      })
      .endPage()
      .endPDF();
    writeOutput(end, "positioning", bytes);

    var drawn = shapes(end, bytes);
    assert.equal(drawn.length, 18);
    var [rectangles, circles, polygons, lines] = [0, 4, 8, 12].map((start) =>
      drawn.slice(start, start + 4),
    );
    widths.forEach((width, index) => {
      var left = col[index + 1];
      var inset = width / 2;
      // The stroke's outer edge lies on the frame.
      assert.equal(rectangles[index].lineWidth, width);
      assert.deepEqual(
        bounds(rectangles[index].points),
        bounds(insetCorners(left, row[1], wid[0], hgt[0], width)),
      );
      assert.deepEqual(
        bounds(circles[index].points),
        bounds([
          pdf(left + inset, row[2] + inset),
          pdf(left + wid[0] - inset, row[2] + hgt[0] - inset),
        ]),
      );
      // Polygons and lines run through their points; the stroke is centered.
      assertSamePoints(
        polygons[index].anchors,
        triangle(left, row[3]).map(([x, y]) => pdf(x, y)),
      );
      assert.deepEqual(lines[index].anchors, [
        pdf(left, row[4]),
        pdf(left + wid[0], row[4] + hgt[0]),
      ]);
    });
    [
      [drawn[16], col[1], 1],
      [drawn[17], col[3], 5],
    ].forEach(([ellipse, left, width]) =>
      assert.deepEqual(
        bounds(ellipse.points),
        bounds(insetCorners(left, row[5], wid[1], hgt[0], width)),
      ),
    );
  });

  it("turns shapes clockwise around their default or given rotation origin", function () {
    var recipe = end.newRecipe({ colorspace: "rgb" });
    var defOrigColor = "#ff00ff";
    recipe.createPage("letter");
    for (var i = 1; i <= 2; i++) {
      frame(recipe, col[1], row[i], wid[0], hgt[0]);
      frame(recipe, col[2], row[i], wid[0], hgt[0]);
      frame(recipe, col[3], row[i], wid[0], hgt[0]);
      frame(recipe, col[4], row[i], wid[0], hgt[0]);
    }
    for (var j = 3; j <= 5; j++) {
      frame(recipe, col[1], row[j], wid[1], hgt[0]);
      frame(recipe, col[3], row[j], wid[1], hgt[0]);
    }
    var top = (r) => r;
    var lft = (c) => c;
    var rht = (c, w = wid[0]) => c + w;
    var btm = (r) => r + hgt[0];

    // Rectangles turn around their top-left corner by default (#923).
    var rectangleOrigins = [
      null,
      [lft(col[2]), top(row[1])],
      [rht(col[3]), top(row[1])],
      [rht(col[4]), btm(row[1])],
    ];
    rectangleOrigins.forEach((rotationOrigin, index) =>
      recipe.rectangle(col[index + 1], row[1], wid[0], hgt[0], {
        width: 1,
        rotation: 10,
        ...(rotationOrigin ? { rotationOrigin } : { stroke: defOrigColor }),
      }),
    );
    // Polygons turn around the center of their bounding box by default.
    var polygonOrigins = [
      null,
      [lft(col[2]), btm(row[2])],
      [lft(col[3]) + wid[0] / 2, top(row[2])],
      [rht(col[4]), btm(row[2])],
    ];
    polygonOrigins.forEach((rotationOrigin, index) =>
      recipe.polygon(triangle(col[index + 1], row[2]), {
        width: 1,
        rotation: 10,
        ...(rotationOrigin ? { rotationOrigin } : { stroke: defOrigColor }),
      }),
    );
    // Ellipses turn around their center by default.
    var ellipses = [
      [col[1], row[3], null],
      [col[3], row[3], [lft(col[3]), btm(row[3])]],
      [col[1], row[4], [rht(col[1], wid[1]), top(row[4])]],
      [col[3], row[4], [lft(col[3]), top(row[4])]],
      [col[1], row[5], [rht(col[1], wid[1]), btm(row[5])]],
    ];
    ellipses.forEach(([left, rowTop, rotationOrigin]) =>
      recipe.ellipse(
        left + wid[1] / 2,
        rowTop + hgt[0] / 2,
        wid[1] / 2,
        hgt[0] / 2,
        {
          width: 1,
          rotation: 10,
          ...(rotationOrigin ? { rotationOrigin } : { stroke: defOrigColor }),
        },
      ),
    );
    var defaultOrigins = [
      [lft(col[1]), top(row[1])],
      [lft(col[1]) + wid[0] / 2, top(row[2]) + hgt[0] / 2],
      [col[1] + wid[1] / 2, row[3] + hgt[0] / 2],
    ];
    [
      ...defaultOrigins,
      ...rectangleOrigins.slice(1),
      ...polygonOrigins.slice(1),
      ...ellipses.slice(1).map((ellipse) => ellipse[2]),
      [50, 40],
    ].forEach(([x, y]) => markOrigin(recipe, x, y));
    var bytes = recipe
      .text("Marks rotation origin.", 60, 45, { font: "arial" })
      .text("This color marks object with default rotation origin.", 200, 45, {
        font: "arial",
        color: defOrigColor,
      })
      .endPage()
      .endPDF();
    writeOutput(end, "positioning-rotation", bytes);

    var drawn = shapes(end, bytes);
    rectangleOrigins.forEach((origin, index) => {
      var pivot = pdf(...(origin || defaultOrigins[0]));
      assertSamePoints(
        drawn[index].anchors,
        insetCorners(col[index + 1], row[1], wid[0], hgt[0], 1).map((point) =>
          clockwise(point, pivot, 10),
        ),
      );
    });
    polygonOrigins.forEach((origin, index) => {
      var pivot = pdf(...(origin || defaultOrigins[1]));
      assertSamePoints(
        drawn[4 + index].anchors,
        triangle(col[index + 1], row[2]).map(([x, y]) =>
          clockwise(pdf(x, y), pivot, 10),
        ),
      );
    });
    ellipses.forEach(([left, rowTop, origin], index) => {
      var middle = pdf(left + wid[1] / 2, rowTop + hgt[0] / 2);
      var pivot = origin ? pdf(...origin) : middle;
      var expected = clockwise(middle, pivot, 10);
      var actual = center(drawn[8 + index].anchors);
      assert.ok(
        Math.abs(actual[0] - expected[0]) < 0.01 &&
          Math.abs(actual[1] - expected[1]) < 0.01,
        `ellipse ${index} centered at ${actual}, expected ${expected}`,
      );
    });
  });

  it("moves down from the page origin before any text is written", function () {
    var recipe = end.newRecipe().createPage("A4");
    assert.deepEqual(recipe.movedown(1, true), [0, 14]);
    writeOutput(end, "positioning-movedown", recipe.endPage().endPDF());
  });

  it("reports a missing page instead of failing to read its metadata", function () {
    var recipe = end.newRecipe();
    // Each end in its own words, as it always was.
    var noPage =
      end.name === "wasm"
        ? /A page is required for coordinates/
        : /No page is active/;
    assert.throws(
      () => recipe.link("https://example.test", 0, 0, 10, 10),
      noPage,
    );
    assert.throws(() => recipe.overlay(end.pdf("recipe/test2.pdf")), noPage);
    assert.throws(
      () =>
        recipe.polygon([
          [0, 0],
          [10, 10],
        ]),
      noPage,
    );
  });

  it("reports an unknown page number from pageInfo", function () {
    var recipe = end.newRecipe();
    // Native throws and Wasm returns null for a page it does not have, as
    // each always has.
    if (end.name === "wasm") assert.equal(recipe.pageInfo(3), null);
    else assert.throws(() => recipe.pageInfo(3), /Unknown page number: 3/);
  });

  // Merged from the Wasm position-parity spec: `position` is the path
  // cursor, written only by moveTo and lineTo, while text(), movedown() and
  // table() advance a separate text cursor.
  it("tracks only moveTo and lineTo in the path position", function () {
    var recipe = end.newRecipe().createPage(600, 800);
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    recipe.moveTo(11, 22);
    assert.deepEqual(recipe.position, { x: 11, y: 22 });
    recipe.lineTo(33, 44);
    assert.deepEqual(recipe.position, { x: 33, y: 44 });
    recipe.text("x", 55, 66, { font: "arial" });
    assert.deepEqual(
      recipe.position,
      { x: 33, y: 44 },
      "text() leaves the path position alone",
    );
    recipe.movedown(2);
    assert.deepEqual(
      recipe.position,
      { x: 33, y: 44 },
      "movedown() leaves the path position alone",
    );
    recipe.moveTo(77, 88);
    assert.deepEqual(recipe.position, { x: 77, y: 88 });
    recipe.lineTo(99, 110, { color: "#000000" });
    assert.deepEqual(
      recipe.position,
      { x: 99, y: 110 },
      "a painted lineTo moves the path position like an appended one",
    );
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "positioning-path-cursor", bytes);
    // Both lineTo() calls stroke from the path position.
    assert.deepEqual(
      paths(end, bytes).map((path) => path.anchors),
      [
        [
          [11, 778],
          [33, 756],
        ],
        [
          [77, 712],
          [99, 690],
        ],
      ],
    );
  });

  it("keeps the text cursor flowing while the path position rests", function () {
    var recipe = end.newRecipe().createPage(600, 800);
    recipe.moveTo(11, 22);
    recipe.text("first", 50, 60, { font: "arial", size: 10 });
    var [cursorX, cursorY] = recipe.movedown(0, true);
    assert.equal(cursorX, 50, "the text cursor keeps the text box origin");
    // The cursor stays on the drawn line, so movedown() moves to the next one.
    assert.equal(cursorY, 60, "the text cursor stays on the drawn line");
    var lineHeight = recipe.movedown(1, true)[1] - cursorY;
    assert.ok(lineHeight > 0);
    var [movedX, movedY] = recipe.movedown(2, true);
    assert.equal(movedX, 50);
    assert.ok(
      Math.abs(movedY - (cursorY + 3 * lineHeight)) < 0.01,
      "movedown advances whole line heights",
    );
    assert.deepEqual(recipe.position, { x: 11, y: 22 });
    writeOutput(end, "positioning-text-cursor", recipe.endPage().endPDF());
  });

  it("leaves the path position where the table found it", function () {
    var recipe = end.newRecipe().createPage(600, 800);
    recipe.moveTo(11, 22);
    recipe.table(30, 40, [{ a: "one", b: "two" }], {
      font: "arial",
      columns: [
        { text: "a", name: "a", width: 80 },
        { text: "b", name: "b", width: 80 },
      ],
    });
    assert.deepEqual(recipe.position, { x: 11, y: 22 });
    assert.ok(
      recipe.movedown(0, true)[1] > 40,
      "the text cursor drops below the table",
    );
    writeOutput(end, "positioning-table", recipe.endPage().endPDF());
  });

  it("restarts each new page at the origin", function () {
    var recipe = end.newRecipe().createPage(600, 800);
    recipe.moveTo(11, 22).endPage();
    recipe.createPage(600, 800);
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    writeOutput(end, "positioning-new-page", recipe.endPage().endPDF());
  });
});
