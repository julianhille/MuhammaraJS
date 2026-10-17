import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { textRuns } from "../support/pdf.mjs";
import { clockwise, paths } from "../support/geometry.mjs";

var LETTER_HEIGHT = 792;
var BLUE = "0,0,1";

/**
 * The triangles a page paints in blue, as Recipe-coordinate vertices in
 * drawing order: B (left of the base), C (apex), A (right of the base).
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} height - The page height.
 * @returns {Array<{B: number[], C: number[], A: number[]}>} The triangles.
 */
function blueTriangles(end, bytes, height) {
  return paths(end, bytes)
    .filter(
      (path) =>
        path.ops.join() === "m,l,l,l" &&
        (path.stroke.values.join() === BLUE ||
          path.fill.values.join() === BLUE),
    )
    .map((path) => {
      var [B, C, A] = path.anchors.map(([x, y]) => [x, height - y]);
      return { B, C, A };
    });
}

/**
 * The distance between two points.
 * @param {number[]} p - The first point.
 * @param {number[]} q - The second point.
 * @returns {number} The distance.
 */
function distance(p, q) {
  return Math.hypot(q[0] - p[0], q[1] - p[1]);
}

/**
 * The angle at a vertex, in degrees.
 * @param {number[]} vertex - The vertex.
 * @param {number[]} p - One neighbour.
 * @param {number[]} q - The other neighbour.
 * @returns {number} The angle.
 */
function angle(vertex, p, q) {
  var a = Math.atan2(p[1] - vertex[1], p[0] - vertex[0]);
  var b = Math.atan2(q[1] - vertex[1], q[0] - vertex[0]);
  var degrees = Math.abs(((a - b) * 180) / Math.PI);
  return degrees > 180 ? 360 - degrees : degrees;
}

/**
 * The distance from a point to the line through two points.
 * @param {number[]} point - The point.
 * @param {number[]} p - A point of the line.
 * @param {number[]} q - Another point of the line.
 * @returns {number} The distance.
 */
function toLine(point, p, q) {
  return (
    Math.abs(
      (q[0] - p[0]) * (p[1] - point[1]) - (p[0] - point[0]) * (q[1] - p[1]),
    ) / distance(p, q)
  );
}

/**
 * Assert that two numbers or points are within 0.01 of each other.
 * @param {number|number[]} actual - The drawn value.
 * @param {number|number[]} expected - The expected value.
 * @param {string} message - What is compared.
 * @returns {void}
 */
function assertClose(actual, expected, message) {
  [actual]
    .flat()
    .forEach((value, index) =>
      assert.ok(
        Math.abs(value - [expected].flat()[index]) < 0.01,
        `${message}: ${actual} is not ${expected}`,
      ),
    );
}

/**
 * Assert the side lengths of a triangle: a = BC, b = AC, c = AB.
 * @param {{A: number[], B: number[], C: number[]}} triangle - The triangle.
 * @param {number[]} sides - The expected [a, b, c].
 * @param {string} message - Which triangle.
 * @returns {void}
 */
function assertSides({ A, B, C }, sides, message) {
  assertClose(
    [distance(B, C), distance(A, C), distance(A, B)],
    sides,
    `${message} sides`,
  );
}

describeEnds("Triangles", function (end) {
  it("draws SSS, SAS and ASA triangles at their reference points", function () {
    var x = 50;
    var y = 100;
    var txtOps = { font: "arial", color: "#000000", size: 10 };
    var guide = { color: "#aa", width: 0.5, opacity: 0.5 };
    var recipe = end.newRecipe().createPage("letter");
    recipe
      .line(
        [
          [50, y],
          [550, y],
        ],
        guide,
      )
      .line(
        [
          [x, 50],
          [x, 700],
        ],
        guide,
      )
      .triangle(x, y, [90, 60, 80], { width: 0.5, color: "blue", debug: true })
      .text('"SSS", (a,b,c)', x + 15, y + 21, txtOps)
      .triangle(x + 200, y, [90, 60, 80], {
        width: 0.5,
        position: "b",
        flipY: true,
        color: "blue",
        debug: true,
      })
      .text("flipY", x + 140, y + 21, txtOps)
      .triangle(x + 250, y, [90, 60, 80], {
        width: 0.5,
        position: "b",
        color: "blue",
        debug: true,
        rotation: -20,
      })
      .text("rotation: -20", x + 260, y + 21, txtOps)
      .triangle(x + 380, y, [90, 60, 80], {
        width: 0.5,
        position: "b",
        fill: "blue",
        debug: true,
      });
    y = 250;
    var sas = [90, 90, 90];
    recipe
      .line(
        [
          [50, y],
          [550, y],
        ],
        guide,
      )
      .triangle(x, y, sas, {
        traitID: "sas",
        width: 0.5,
        color: "blue",
        debug: true,
      })
      .text(`"SAS", (${sas[0]}, ${sas[1]}, ${sas[2]})`, x + 15, y + 21, txtOps)
      .text("(a,  <C,  b)", x + 50, y + 38, txtOps)
      .triangle(x + 200, y, [50, 90, 50], {
        traitID: "sas",
        position: "b",
        rotation: -90,
        width: 0.5,
        color: "blue",
        debug: true,
      })
      .text("rotation: -90", x + 165, y + 21, txtOps)
      .triangle(x + 300, y, [50, 20, 60], {
        traitID: "sas",
        position: "b",
        width: 0.5,
        color: "blue",
        debug: true,
      })
      .triangle(x + 380, y, [50, 20, 60], {
        traitID: "sas",
        position: "b",
        width: 0.5,
        color: "blue",
        flipX: true,
        debug: true,
      })
      .text("flipX", x + 380, y - 30, txtOps);
    y = 400;
    var asa = [90, 150, 20];
    recipe
      .line(
        [
          [50, y],
          [550, y],
        ],
        guide,
      )
      .triangle(x, y, asa, {
        traitID: "asa",
        width: 0.5,
        color: "blue",
        debug: true,
      })
      .text(`"ASA", (${asa[0]}, ${asa[1]}, ${asa[2]})`, x + 15, y + 21, txtOps)
      .text("(<B,  c,  <A)", x + 50, y + 38, txtOps)
      .triangle(x + 200, y, [40, 80, 50], {
        traitID: "asa",
        width: 0.5,
        color: "blue",
        debug: true,
      })
      .triangle(x + 350, y, [40, 80, 50], {
        traitID: "asa",
        width: 0.5,
        position: "c",
        flipX: true,
        color: "blue",
        debug: true,
      })
      .text('position: "C"\nand flipX', x + 340, y + 21, txtOps)
      .triangle(x + 450, y, [40, 80, 50], {
        traitID: "asa",
        width: 0.5,
        position: "c",
        flipX: true,
        rotation: 45,
        color: "blue",
        debug: true,
      })
      .text('position: "C"\nand flipX\nrotation: 45', x + 450, y + 21, txtOps);
    y = 550;
    recipe
      .line(
        [
          [50, y],
          [550, y],
        ],
        guide,
      )
      .triangle(x, y, [40, 40, 40], {
        traitID: "sas",
        position: "a",
        width: 0.5,
        color: "blue",
        debug: true,
      })
      .text('position: "A"', x + 20, y - 63, txtOps)
      .arrow(x + 34, y - 48, {
        head: [10, 5],
        shaft: [40, 0.5],
        fill: "#000000",
        rotation: 125,
        at: "tail",
      })
      .triangle(x + 100, y, [40, 60, 40], {
        traitID: "sas",
        position: "centroid",
        width: 0.5,
        color: "blue",
        debug: true,
      })
      .text('position:\n"centroid"', x + 80, y + 35, txtOps)
      .triangle(x + 200, y, [70, 60, 50], {
        traitID: "sas",
        position: "circumcenter",
        width: 0.5,
        color: "blue",
        debug: true,
      })
      .text('position:\n"circumcenter"', x + 175, y + 45, txtOps)
      .triangle(x + 320, y, [70, 60, 50], {
        traitID: "sas",
        position: "incenter",
        width: 0.5,
        color: "blue",
        debug: true,
      })
      .text('position:\n"incenter"', x + 295, y + 45, txtOps)
      .triangle(x + 420, y, [70, 60, 50], {
        traitID: "sas",
        position: "incenter",
        rotation: 30,
        width: 0.5,
        color: "blue",
        debug: true,
      })
      .text('position:\n"incenter"\nrotation:30', x + 395, y + 45, txtOps);
    y = 700;
    var bytes = recipe
      .line(
        [
          [50, y],
          [550, y],
        ],
        guide,
      )
      .rectangle(x, y - 59, 51, 59, {
        width: 1,
        rotation: 15,
        color: "green",
        dash: [3],
        rotationOrigin: [x + 24.5, y - 29.5],
      })
      .circle(x + 24.5, y - 29.5, 2, { fill: "green", width: 1 })
      .circle(x, y, 2, { color: "red", width: 0.5 })
      .triangle(x, y, [70, 60, 50], {
        traitID: "sss",
        rotation: 15,
        width: 0.5,
        color: "blue",
      })
      .text(
        "NOTE: When no position point specified\nrotation occurs around bounding box center,\nnot at the given x,y coordinate.",
        x + 80,
        y - 50,
        { font: "arial", color: "red" },
      )
      .text("rotation: 15", x, y + 21, txtOps)
      .endPage()
      .endPDF();
    writeOutput(end, "triangle-traits", bytes);

    var drawn = blueTriangles(end, bytes, LETTER_HEIGHT);
    assert.equal(drawn.length, 18);
    var [sss, flipY, turned, filled] = drawn;
    // SSS: B at (x, y), side c along the base, the apex above it.
    assert.deepEqual(sss.B, [50, 100]);
    assertSides(sss, [90, 60, 80], "SSS");
    assertClose(sss.A, [130, 100], "SSS A");
    assert.ok(sss.C[1] < 100, "the apex is above the base");
    // flipY mirrors the triangle to the left of B.
    assert.deepEqual(flipY.B, [250, 100]);
    assertClose(flipY.A, [170, 100], "flipY A");
    assertSides(flipY, [90, 60, 80], "flipY");
    // A position point is also the rotation origin; -20 turns
    // counter-clockwise.
    assertClose(turned.B, [300, 100], "turned B");
    var turnedA = clockwise([380, LETTER_HEIGHT - 100], [300, 692], -20);
    assertClose(turned.A, [turnedA[0], LETTER_HEIGHT - turnedA[1]], "turned A");
    assert.deepEqual(filled.B, [430, 100]);
    assertSides(filled, [90, 60, 80], "filled");

    var [sasRight, sasTurned, sasNarrow, sasFlipped] = drawn.slice(4, 8);
    // SAS: sides a and b with the angle C between them.
    assertSides(sasRight, [90, 90, Math.hypot(90, 90)], "SAS");
    assertClose(angle(sasRight.C, sasRight.A, sasRight.B), 90, "SAS angle C");
    assertClose(sasTurned.B, [250, 250], "SAS turned B");
    assertClose(angle(sasTurned.C, sasTurned.A, sasTurned.B), 90, "angle C");
    assertClose(angle(sasNarrow.C, sasNarrow.A, sasNarrow.B), 20, "angle C");
    // flipX mirrors the apex below the base.
    assert.ok(sasFlipped.C[1] > 250, "flipX puts the apex below the base");
    assertClose(angle(sasFlipped.C, sasFlipped.A, sasFlipped.B), 20, "angle");

    var [asaWide, asaSmall, asaAtC, asaAtCTurned] = drawn.slice(8, 12);
    // ASA: angle B, side c and angle A.
    [
      [asaWide, [90, 150, 20]],
      [asaSmall, [40, 80, 50]],
      [asaAtC, [40, 80, 50]],
      [asaAtCTurned, [40, 80, 50]],
    ].forEach(([triangle, [angleB, sideC, angleA]], index) => {
      assertClose(
        angle(triangle.B, triangle.A, triangle.C),
        angleB,
        `ASA ${index} angle B`,
      );
      assertClose(distance(triangle.A, triangle.B), sideC, `ASA ${index} c`);
      assertClose(
        angle(triangle.A, triangle.B, triangle.C),
        angleA,
        `ASA ${index} angle A`,
      );
    });
    assert.deepEqual(asaWide.B, [50, 400]);
    assertClose(asaAtC.C, [400, 400], "ASA C");
    // flipX turns the triangle upside down: the base above its apex.
    assert.ok(asaAtC.A[1] < 400, "flipX puts the base above C");
    assertClose(asaAtCTurned.C, [500, 400], "turned ASA C");

    var [atA, atCentroid, atCircumcenter, atIncenter, atIncenterTurned] =
      drawn.slice(12, 17);
    assertClose(atA.A, [50, 550], "position A");
    var centroid = [0, 1].map(
      (axis) =>
        (atCentroid.A[axis] + atCentroid.B[axis] + atCentroid.C[axis]) / 3,
    );
    assertClose(centroid, [150, 550], "centroid");
    var circumradius = distance(atCircumcenter.A, [250, 550]);
    [atCircumcenter.B, atCircumcenter.C].forEach((vertex) =>
      assertClose(distance(vertex, [250, 550]), circumradius, "circumcenter"),
    );
    [
      [atIncenter, [370, 550]],
      [atIncenterTurned, [470, 550]],
    ].forEach(([triangle, center]) => {
      var inradius = toLine(center, triangle.A, triangle.B);
      assertClose(toLine(center, triangle.B, triangle.C), inradius, "incenter");
      assertClose(toLine(center, triangle.A, triangle.C), inradius, "incenter");
    });

    // Without a position, the triangle turns around the center of its
    // bounding box, not around (x, y).
    var [boxTurned] = drawn.slice(17);
    var apex = [50 + 38, 700 - Math.sqrt(70 * 70 - 38 * 38)];
    var upright = [[50, 700], apex, [100, 700]];
    var pivot = [75, (700 + apex[1]) / 2];
    var expected = upright.map(([px, py]) => {
      var [tx, ty] = clockwise(
        [px, LETTER_HEIGHT - py],
        [pivot[0], LETTER_HEIGHT - pivot[1]],
        15,
      );
      return [tx, LETTER_HEIGHT - ty];
    });
    assertClose(boxTurned.B, expected[0], "box turned B");
    assertClose(boxTurned.C, expected[1], "box turned C");
    assertClose(boxTurned.A, expected[2], "box turned A");
  });

  // Merged from the Wasm shape parity spec, which recorded the polygon()
  // calls; this asserts the drawn triangles instead.
  it("positions and flips triangles at every native reference point", function () {
    var draw = (options) => {
      var bytes = end
        .newRecipe()
        .createPage(200, 200)
        .triangle(100, 100, [30, 40, 50], { color: "blue", ...options })
        .endPage()
        .endPDF();
      return { bytes, triangle: blueTriangles(end, bytes, 200)[0] };
    };
    assertClose(draw({ position: "a" }).triangle.A, [100, 100], "A");
    assertClose(draw({ position: "b" }).triangle.B, [100, 100], "B");
    assertClose(draw({ position: "c" }).triangle.C, [100, 100], "C");
    var { A, B, C } = draw({ position: "centroid" }).triangle;
    assertClose(
      [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3],
      [100, 100],
      "centroid",
    );
    var flipped = draw({ flipX: true, flipY: true, debug: true });
    writeOutput(end, "triangle-flipped-debug", flipped.bytes);
    assertClose(flipped.triangle.B, [100, 100], "flipped B");
    // flipX puts the apex below, flipY puts A left of B.
    assert.ok(flipped.triangle.C[1] > 100);
    assert.ok(flipped.triangle.A[0] < 100);
    // Debug draws the anchor and the incircle, and labels vertices and sides.
    var circles = paths(end, flipped.bytes).filter(
      (path) => path.ops.filter((op) => op === "c").length === 4,
    );
    assert.equal(circles.length, 2, "debug includes anchor and incircle");
    assert.deepEqual(
      textRuns(end, flipped.bytes)
        .map((run) => run.text)
        .sort(),
      ["A", "B", "C", "a", "b", "c"],
    );
  });
});
