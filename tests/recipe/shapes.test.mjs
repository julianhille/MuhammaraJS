import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { annotations, textRuns } from "../support/pdf.mjs";
import {
  bounds,
  clockwise,
  fills,
  paths,
  rounded,
} from "../support/geometry.mjs";

var LETTER_HEIGHT = 792;

/**
 * Whether a path is a polygon: straight segments only.
 * @param {object} path - A painted path.
 * @returns {boolean} True for moveto and lineto segments only.
 */
function isPolygon(path) {
  return path.ops.every((op) => op === "m" || op === "l");
}

/**
 * Whether a path is a circle drawn by `circle()`: four Bézier quarters.
 * @param {object} path - A painted path.
 * @returns {boolean} True for a closed path of four curves.
 */
function isCircle(path) {
  return path.ops.filter((op) => op === "c").length === 4;
}

/**
 * Assert that every point lies on a circle, within 0.01 pt.
 * @param {number[][]} points - The points.
 * @param {number[]} center - The PDF [x, y] center.
 * @param {number} radius - The radius.
 * @param {string} message - What is checked.
 * @returns {void}
 */
function assertOnCircle(points, center, radius, message) {
  points.forEach((point) => {
    var distance = Math.hypot(point[0] - center[0], point[1] - center[1]);
    assert.ok(
      Math.abs(distance - radius) < 0.01,
      `${message}: ${point} is ${distance} from ${center}, not ${radius}`,
    );
  });
}

/**
 * The distinct points of a list, rounded to 1/100 pt, sorted.
 * @param {number[][]} points - The points.
 * @returns {string[]} The points as "x y" keys.
 */
function distinct(points) {
  return [
    ...new Set(points.map((point) => point.map((v) => v.toFixed(2)).join(" "))),
  ].sort();
}

describeEnds("Regular Polygons, Stars, Arrows", function (end) {
  it("adds N sided regular polygons inside their circumscribed circle", function () {
    var rota = { stroke: "#ff0000", opacity: 0.3, rotation: 45, debug: 1 };
    var nops = { stroke: "#ff0000", opacity: 0.3, rotation: 0, debug: 1 };
    var ngons = [
      [200, 100, 3, nops],
      [200, 100, 3, rota],
      [300, 100, 4, nops],
      [300, 100, 4, rota],
      [400, 100, 5, nops],
      [400, 100, 5, rota],
      [200, 220, 6, nops],
      [200, 220, 6, { opacity: 0.3, rotation: 30, debug: 1 }],
      [300, 220, 7, nops],
      [300, 220, 7, rota],
      [400, 220, 8, nops],
      [400, 220, 8, rota],
      [200, 340, 50, nops], // basically a circle at this point
      [200, 340, 50, rota],
    ];
    var recipe = end.newRecipe().createPage("letter");
    ngons.forEach(([cx, cy, sides, options]) =>
      recipe.n_gon(cx, cy, 50, sides, options),
    );
    var bytes = recipe
      .text(
        "All polygon vertices should be inside reference circle.",
        150,
        650,
        { font: "arial" },
      )
      .endPage()
      .endPDF();
    writeOutput(end, "shapes-n-gons", bytes);
    var polygons = paths(end, bytes).filter(isPolygon);
    assert.equal(polygons.length, ngons.length);
    polygons.forEach((polygon, index) => {
      var [cx, cy, sides] = ngons[index];
      assert.equal(distinct(polygon.anchors).length, sides);
      // Rotated or not, every vertex lies on the circumscribed circle, inset
      // by half the default line width of 2 so the stroke stays inside it.
      assertOnCircle(
        polygon.anchors,
        [cx, LETTER_HEIGHT - cy],
        49,
        `n_gon ${index}`,
      );
    });
  });

  it("adds N pointed stars with every point on their circle", function () {
    // A filled star reaches its radius; a stroked one is inset by half the
    // default line width of 2 so the stroke stays inside it, as n_gon() does.
    var stars = [
      [300, 340, 5, { fill: "#0000ff" }],
      [400, 340, 6, { fill: "#0000ff", opacity: 0.3, rotation: 30 }],
      [200, 450, 7, undefined],
      [300, 450, 8, { fill: "#0000ff", opacity: 0.3 }],
      [400, 450, 9, { fill: "#0000ff", opacity: 0.3 }],
      [200, 560, 10, { fill: "#0000ff", opacity: 0.3 }],
      [300, 560, 11, { fill: "#0000ff", opacity: 0.3 }],
      [400, 560, 40, undefined],
    ];
    var recipe = end.newRecipe().createPage("letter");
    stars.forEach(([cx, cy, points, options]) =>
      points === 5
        ? recipe.star(cx, cy, 50, options)
        : recipe.star(cx, cy, 50, points, options),
    );
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "shapes-stars", bytes);
    var drawn = paths(end, bytes);
    stars.forEach(([cx, cy, points]) => {
      var center = [cx, LETTER_HEIGHT - cy];
      var own = drawn.filter((path) => {
        var box = bounds(path.points);
        return (
          Math.abs((box.left + box.right) / 2 - center[0]) < 50 &&
          Math.abs((box.bottom + box.top) / 2 - center[1]) < 50
        );
      });
      var vertices = own.flatMap((path) => path.anchors);
      assert.equal(distinct(vertices).length, points, `${points} points`);
      assertOnCircle(
        vertices,
        center,
        own.every(fills) ? 50 : 49,
        `star of ${points}`,
      );
    });
  });

  // Merged from the Wasm shape parity spec, which recorded the polygon()
  // calls; this asserts the drawn polygons instead.
  it("uses odd and even star traversals", function () {
    var draw = (points, options) =>
      paths(
        end,
        end
          .newRecipe()
          .createPage(200, 200)
          .star(100, 100, 10, points, options)
          .endPage()
          .endPDF(),
      ).filter(fills);
    // A five-pointed star is one polygon through every second vertex.
    var five = draw(5, { fill: "#000" });
    assert.equal(five.length, 1);
    assert.deepEqual(
      five[0].anchors.map((point) => Math.round(200 - point[1])),
      [90, 108, 97, 97, 108, 90],
    );
    // A six-pointed star is two triangles, turned by 30 and 90 degrees.
    var six = draw(6, { fill: "#000", rotation: 30 });
    assert.equal(six.length, 2, "six-point stars are two rotated triangles");
    var center = [100, 100];
    var triangle = [0, 120, 240].map((angle) =>
      clockwise([100, 110], center, angle),
    );
    [30, 90].forEach((rotation, index) =>
      assert.deepEqual(
        distinct(six[index].anchors),
        distinct(triangle.map((point) => clockwise(point, center, rotation))),
      ),
    );
    // An eight-pointed star is one polygon of eight points.
    var eight = draw(8, { fill: "#000" });
    assert.equal(eight.length, 1);
    assert.equal(distinct(eight[0].anchors).length, 8);
  });

  it("draws the anatomy of an arrow", function () {
    var recipe = end.newRecipe();
    var text = (value, x, y, options = {}) =>
      recipe.text(value, x, y, { font: "arial", ...options });
    recipe.createPage("letter");
    text("Anatomy of an Arrow", 250, 20, { size: 20, bold: true });
    recipe.arrow(72, 100);
    text("arrow( x, y )", 54, 60, { color: "#000000", bold: true });
    text("Default arrow", 100, 95);
    var [cx, cy] = [390, 200];
    var sw = 100;
    var hw = 100;
    var sl = 100;
    var hl = 100;
    recipe
      .circle(cx, cy, hw, { color: "green", width: 0.5 })
      .arrow(cx, cy, { shaft: sw, head: hw });
    text("(x,y)", cx - 22, cy - 15, { size: 9, color: "#000000", bold: true });
    recipe
      .line(
        [
          [cx - sl + 5, cy],
          [cx, cy],
        ],
        { color: "red", width: 1, dash: [10, 3] },
      )
      .line(
        [
          [cx, cy - sw / 2],
          [cx, cy + sw / 2],
        ],
        { color: "red", width: 1, dash: [10, 3] },
      )
      .line(
        [
          [cx - 5, cy],
          [cx + 5, cy],
        ],
        { width: 1.5, lineCap: "butt", color: "#000000" },
      )
      .line(
        [
          [cx, cy - 5],
          [cx, cy + 5],
        ],
        { width: 1.5, lineCap: "butt", color: "#000000" },
      );
    text("shaft", cx - 60, cy - sw / 2 - 15, { color: "#ff00ff" });
    text("arrowhead", cx + 15, cy - 5);
    text("width", cx - 175, cy - 5);
    recipe
      .line(
        [
          [cx - 120, cy - 50],
          [cx - 125, cy - 50],
          [cx - 125, cy + 50],
          [cx - 120, cy + 50],
        ],
        { width: 0.5, lineCap: "butt", color: "#ff00ff" },
      )
      .line(
        [
          [cx - 120, cy - sw],
          [cx - 130, cy - sw],
          [cx - 130, cy + sw],
          [cx - 120, cy + sw],
        ],
        { width: 0.5, lineCap: "butt" },
      )
      .line(
        [
          [cx - 115, cy - sw],
          [cx - 5, cy - sw],
        ],
        { width: 0.5, lineCap: "butt", dash: [4], dashPhase: 6 },
      );
    text("length", cx - 15, cy + sw + 30);
    recipe
      .line(
        [
          [cx - sl, cy + sw + 10],
          [cx - sl, cy + sw + 20],
          [cx, cy + sw + 20],
          [cx, cy + sw + 10],
        ],
        { width: 0.5, lineCap: "butt", color: "#ff00ff" },
      )
      .line(
        [
          [cx, cy + sw + 20],
          [cx + sl, cy + sw + 20],
          [cx + sl, cy + sw + 10],
        ],
        { width: 0.5, lineCap: "butt" },
      )
      .line(
        [
          [cx - sw, cy - 5],
          [cx - sw, cy + 5],
        ],
        { width: 2, lineCap: "butt", color: "#ffffff" },
      )
      .circle(cx - sw, cy, 3, { color: "red" })
      .arrow(cx - sw - 4, cy + 5, {
        shaft: [50, 0.5],
        head: [10, 4],
        fill: "#000000",
        at: "head",
        rotation: -45,
      });
    text('"tail"', cx - 175, cy + 50, { color: "#000000" });
    recipe.arrow(cx + hl + 3, cy, {
      shaft: [15, 0.5],
      head: [10, 4],
      fill: "#000000",
      at: "head",
      rotation: 180,
    });
    text('"head"', cx + sl + 35, cy - 5, { color: "#000000" });

    var uh = 360;
    var ux = 72;
    var uop = { size: 10, color: "#000000", textBox: { width: 500 } };
    text("Usage: recipe.arrow( x, y, [options] );", ux, uh, {
      bold: true,
      size: 10,
      color: "#000000",
    });
    [
      "{number} x - x coordinate at center of the arrow which is also its rotation point",
      "{number} y - y coordinate at center of the arrow which is also its rotation point",
      "{number|number[ ]} [options.head=[10,10,0] - length, width and baseoffset of head of arrow.",
      "{number|number[ ]} [options.shaft=10] - length & width of shaft of arrow.",
      '{string} [options.at] - position and/or rotate at "head" or "tail" of arrow',
      "{boolean} [options.double=false] - indicate double headed arrow production",
    ].forEach((line, index) => text(line, ux + 10, uh + 15 * (index + 1), uop));
    text(
      "Note that the circumscribed circle is for illustrative purposes and only naturally occurs when the shaft length is equal to arrowhead length, which is a property of the default arrow.",
      ux + 100,
      uh + 115,
      { color: "#961d17", textBox: { width: 300, textAlign: "justify" } },
    );
    text("Examples:", 54, 135, { color: "#000000", bold: true });
    recipe
      .arrow(72, 180, { head: 20, fill: "def" })
      .arrow(110, 180, { head: 20, shaft: 0, fill: "def" }) // arrow head only, no shaft
      .arrow(140, 180, { fill: "red" })
      .arrow(160, 180, { fill: "red", rotation: 180 })
      .arrow(160, 205, {
        head: [10, 10],
        type: "dart",
        shaft: [20, 2],
        fill: "#000000",
      })
      .arrow(160, 215, {
        head: [10, 10, -5],
        shaft: [20, 2],
        fill: "#000000",
        rotation: 180,
        at: "tail",
      });
    text('position\nand rotate\nat "tail"', 40, 270, {
      size: 9,
      textBox: { width: 50, textAlign: "center" },
    });
    text('position\nand rotate\nat "head"', 135, 250, {
      size: 9,
      textBox: { width: 50, textAlign: "center" },
    });
    [0, 22.5, 45, 67.5, 90].forEach((rotation, index) =>
      recipe.arrow(54, 220, {
        head: [10, 4],
        shaft: [index % 2 ? 30 : 20, 0.5],
        fill: index % 2 ? "#ff0000" : "#000000",
        rotation,
        at: "tail",
      }),
    );
    [-90, -180, 45].forEach((rotation, index) =>
      recipe.arrow(130, 240, {
        head: [10, 4],
        shaft: [20, 0.5],
        fill: "#000000",
        rotation,
        at: "head",
        debug: index === 0,
      }),
    );
    [45, -45].forEach((rotation) =>
      recipe.arrow(130, 310, {
        head: [10, 3],
        shaft: [30, 0.5],
        double: true,
        fill: "#000000",
        rotation,
      }),
    );
    text("double: true", 140, 305, { size: 9 });

    var x = 100;
    var y = 600;
    recipe
      .arrow(x, y - 20, {
        head: [10, 3],
        shaft: [100, 0.5],
        fill: "#000000",
        double: true,
        debug: true,
      })
      .arrow(x + 5, y, {
        head: [10, 3],
        shaft: [100, 0.5],
        fill: "#000000",
        debug: true,
      })
      .line(
        [
          [x - 50, y - 3],
          [x - 50, y - 16],
        ],
        { width: 0.3, color: "red" },
      )
      .line(
        [
          [x + 50, y - 3],
          [x + 50, y - 16],
        ],
        { width: 0.3, color: "red" },
      );
    text("center differs between single & double headed arrows", 50, y - 60, {
      size: 9,
      textBox: { width: 100, textAlign: "center" },
    });
    x = 306;
    [
      [y - 40, { at: "head" }],
      [y - 20, {}],
      [y, { at: "tail" }],
      [y + 10, { at: "tail", double: true }],
    ].forEach(([arrowY, options]) =>
      recipe.arrow(x, arrowY, {
        head: [10, 3],
        shaft: [100, 0.5],
        fill: "#000000",
        debug: true,
        ...options,
      }),
    );
    text('@ "head"', x + 10, y - 45, { size: 10 });
    text("@ center (default)", x + 65, y - 25, { size: 10 });
    text('@ "tail"', x + 120, y - 5, { size: 10 });
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "shapes-arrow-anatomy", bytes);

    var drawn = paths(end, bytes);
    drawn.forEach((path) =>
      path.points.flat().forEach((value) => assert.ok(Number.isFinite(value))),
    );
    // The anatomy arrow, shaft and head 100 long, reaches from the left to
    // the right of the circle drawn around (x, y): its tip at (x + 100, y),
    // its tail at x - 100.
    var anatomy = drawn.find((path) => {
      var box = bounds(path.points);
      return isPolygon(path) && box.right === cx + 100 && box.left === cx - 100;
    });
    assert.ok(anatomy, "the anatomy arrow spans its circle");
    assert.deepEqual(rounded([anatomy.anchors[0]]), [
      [cx + 100, LETTER_HEIGHT - cy],
    ]);
    assert.ok(textRuns(end, bytes).some((run) => run.text.includes("Anatomy")));
  });

  it("places an arrow at its head, tail or center", function () {
    var draw = (options) =>
      paths(
        end,
        end
          .newRecipe()
          .createPage(300, 100)
          .arrow(100, 50, {
            head: [20, 10],
            shaft: [30, 4],
            fill: "#000000",
            ...options,
          })
          .endPage()
          .endPDF(),
      ).filter(isPolygon)[0];
    // The tip is at (x, y) for "head"; the tail edge at x for "tail".
    assert.deepEqual(rounded([draw({ at: "head" }).anchors[0]]), [[100, 50]]);
    var tail = draw({ at: "tail" });
    assert.equal(bounds(tail.points).left, 100);
    assert.ok(
      rounded(tail.anchors).some((point) => point.join() === "100,48"),
      "the tail corner is half a shaft width below y",
    );
    // Without "at", single and double arrows center on x.
    var single = bounds(draw({}).points);
    assert.deepEqual([single.left, single.right], [75, 125]);
    var double = bounds(draw({ double: true }).points);
    assert.deepEqual([double.left, double.right], [65, 135]);
    // A double arrow at its tail starts its second head at x.
    assert.equal(bounds(draw({ double: true, at: "tail" }).points).left, 100);
  });

  it("anchors arrows at their head or tail and retains detailed debug geometry", function () {
    var bytes = end
      .newRecipe()
      .createPage(200, 100)
      .arrow(100, 50, {
        head: [20, 10],
        shaft: [30, 4],
        at: "head",
        rotation: 45,
        debug: 2,
      })
      .endPage()
      .endPDF();
    writeOutput(end, "shapes-arrow-debug", bytes);
    var drawn = paths(end, bytes);
    // Turning at the head keeps the tip on (x, y).
    var arrow = drawn.find(isPolygon);
    assert.deepEqual(rounded([arrow.anchors[0]]), [[100, 50]]);
    // The drop point and eight labelled reference points.
    var circles = drawn.filter(isCircle);
    assert.equal(circles.length, 9);
    // The drop point is marked at (x, y), PDF y 50 on a 100 pt page.
    assert.ok(
      circles.some((circle) => {
        var box = bounds(circle.points);
        return (
          (box.left + box.right) / 2 === 100 &&
          (box.bottom + box.top) / 2 === 50
        );
      }),
    );
    assert.deepEqual(
      textRuns(end, bytes)
        .map((run) => run.text)
        .sort(),
      ["E", "K", "T", "bl", "br", "i", "tl", "tr"],
    );
  });

  it("draws the same line from four numbers as from coordinate pairs", function () {
    var draw = (name, drawLine) => {
      var bytes = drawLine(end.newRecipe().createPage(200, 200))
        .endPage()
        .endPDF();
      writeOutput(end, name, bytes);
      return paths(end, bytes);
    };
    var options = { stroke: "#ff0000", lineWidth: 2 };
    var pairs = draw("shapes-line-pairs", (recipe) =>
      recipe.line(
        [
          [10, 20],
          [110, 120],
        ],
        options,
      ),
    );
    var numbers = draw("shapes-line-numbers", (recipe) =>
      recipe.line(10, 20, 110, 120, options),
    );
    assert.deepEqual(numbers, pairs);
    assert.deepEqual(numbers[0].anchors, [
      [10, 180],
      [110, 80],
    ]);
  });

  it("leaves the polygon coordinates it is given unchanged", function () {
    var coordinates = [
      [0, 0],
      [10, 0],
      [5, 5],
    ];
    end.newRecipe().createPage(50, 50).polygon(coordinates).endPage().endPDF();
    assert.deepEqual(coordinates, [
      [0, 0],
      [10, 0],
      [5, 5],
    ]);
  });

  it('centers shapes and their links at "center" coordinates', function () {
    var bytes = end
      .newRecipe()
      .createPage(200, 200)
      .circle("center", "center", 10, { link: "https://circle.test" })
      .ellipse("center", "center", 20, 10, { link: "https://ellipse.test" })
      .arc("center", "center", 10, 0, 90, { link: "https://arc.test" })
      .endPage()
      .endPDF();
    writeOutput(end, "shapes-center", bytes);
    assert.deepEqual(
      annotations(end, bytes).map((annotation) => annotation.Rect),
      [
        [90, 90, 110, 110],
        [80, 90, 120, 110],
        [90, 90, 110, 110],
      ],
    );
    var [circle, ellipse, arc] = paths(end, bytes);
    // Strokes are inset by half the default width of 2.
    assert.deepEqual(bounds(circle.points), {
      left: 91,
      bottom: 91,
      right: 109,
      top: 109,
    });
    assert.deepEqual(bounds(ellipse.points), {
      left: 81,
      bottom: 91,
      right: 119,
      top: 109,
    });
    assert.deepEqual(rounded([arc.anchors[0], arc.anchors.at(-1)]), [
      [109, 100],
      [100, 91],
    ]);
  });
});
