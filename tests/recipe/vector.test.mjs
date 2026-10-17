import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { drawnContent, info, withReader } from "../support/pdf.mjs";
import {
  bounds,
  clockwise,
  fills,
  outsideClips,
  painted,
  paths,
  rounded,
  strokes,
} from "../support/geometry.mjs";

var STROKE_OPTIONS = { fill: "#000000", stroke: "#ff0000", lineWidth: 10 };

/**
 * Assert that two numbers are within 0.01 of each other.
 * @param {number} actual - The drawn value.
 * @param {number} expected - The expected value.
 * @param {string} [message] - What is compared.
 * @returns {void}
 */
function assertClose(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 0.01,
    `${message || "value"}: ${actual} is not ${expected}`,
  );
}

/**
 * Assert that two point lists match point by point within 0.01 pt.
 * @param {number[][]} actual - The drawn points.
 * @param {number[][]} expected - The expected points.
 * @returns {void}
 */
function assertPoints(actual, expected) {
  assert.equal(actual.length, expected.length, "point count");
  expected.forEach((point, index) => {
    assertClose(actual[index][0], point[0], `x of point ${index}`);
    assertClose(actual[index][1], point[1], `y of point ${index}`);
  });
}

/**
 * Assert that a fill and a stroke path paint a page, the fill covering the
 * shape and the stroke inset by half its width so it stays inside it.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} pageIndex - The zero-based page.
 * @param {function(object, object): void} check - Checks the fill and stroke.
 * @returns {void}
 */
function assertFillAndInsetStroke(end, bytes, pageIndex, check) {
  var drawn = paths(end, bytes, pageIndex);
  assert.equal(drawn.length, 2, `page ${pageIndex} paints a fill and a stroke`);
  var fill = drawn.find((path) => path.paint === "f");
  var stroke = drawn.find((path) => path.paint === "S");
  assert.ok(fill && stroke, `page ${pageIndex} fills and strokes separately`);
  assert.equal(stroke.lineWidth, 10);
  drawn.forEach((path) => assert.deepEqual(outsideClips(path), []));
  check(fill, stroke);
}

/**
 * The checks of the inset strokes on pages 1 to 6 of the inset specs: a
 * rectangle, a rounded rectangle, a circle, an ellipse, an arc and a pie.
 * @type {Array<function(object, object): void>}
 */
var INSET_CHECKS = [
  (fill, stroke) => {
    assert.deepEqual(bounds(fill.points), {
      left: 0,
      bottom: 0,
      right: 100,
      top: 60,
    });
    assert.deepEqual(bounds(stroke.points), {
      left: 5,
      bottom: 5,
      right: 95,
      top: 55,
    });
  },
  (fill, stroke) => {
    assert.deepEqual(bounds(fill.points), {
      left: 0,
      bottom: 0,
      right: 100,
      top: 60,
    });
    assert.deepEqual(bounds(stroke.points), {
      left: 5,
      bottom: 5,
      right: 95,
      top: 55,
    });
    // The outline ends where it starts.
    assert.deepEqual(
      rounded([stroke.anchors[0]]),
      rounded([stroke.anchors.at(-1)]),
    );
  },
  (fill, stroke) => {
    assert.deepEqual(bounds(fill.points), {
      left: 0,
      bottom: 0,
      right: 80,
      top: 80,
    });
    assert.deepEqual(bounds(stroke.points), {
      left: 5,
      bottom: 5,
      right: 75,
      top: 75,
    });
  },
  (fill, stroke) => {
    assert.deepEqual(bounds(fill.points), {
      left: 0,
      bottom: 0,
      right: 80,
      top: 40,
    });
    assert.deepEqual(bounds(stroke.points), {
      left: 5,
      bottom: 5,
      right: 75,
      top: 35,
    });
  },
  (fill, stroke) => {
    // arc(40, 40, 40, 0, 90) runs clockwise from 3 to 6 o'clock.
    assert.deepEqual(rounded([fill.anchors[0], fill.anchors.at(-1)]), [
      [80, 40],
      [40, 0],
    ]);
    assert.deepEqual(rounded([stroke.anchors[0], stroke.anchors.at(-1)]), [
      [75, 40],
      [40, 5],
    ]);
  },
  (fill, stroke) => {
    // A pie starts at its center.
    assert.deepEqual(rounded(fill.anchors.slice(0, 2)), [
      [40, 40],
      [80, 40],
    ]);
    assert.deepEqual(rounded(fill.anchors.slice(-1)), [[40, 0]]);
    assert.deepEqual(rounded(stroke.anchors.slice(0, 2)), [
      [40, 40],
      [75, 40],
    ]);
    assert.deepEqual(rounded(stroke.anchors.slice(-1)), [[40, 5]]);
    assert.ok(stroke.closed, "the pie stroke is closed");
  },
];

describeEnds("Vector", function (end) {
  it("adds vectors to an edited page", function () {
    var recipe = end.openRecipe("recipe/test.pdf");
    var { width, height } = recipe.pageInfo(1);
    recipe
      .editPage(1)
      .rectangle(0, 0, width, height, {
        color: [255, 0, 0],
        opacity: 0.1,
      })
      .rectangle(500, 50, 50, 50, {
        fill: [255, 0, 0],
        skewY: -20,
      })
      .rectangle(500, 50, 50, 50, {
        color: [255, 0, 255],
        opacity: 0.2,
      })
      .rectangle(500, 150, 50, 50, {
        color: [255, 0, 255],
        opacity: 0.4,
      })
      .rectangle(500, 250, 50, 50, {
        fill: [255, 0, 255],
        opacity: 0.6,
        skewX: 10,
      })
      .rectangle(500, 250, 50, 50, {
        color: [255, 0, 255],
        opacity: 0.6,
      })
      .rectangle(500, 350, 50, 50, {
        color: "#3252d3",
        stroke: "#084323",
        lineWidth: 10,
        dash: [5, 5],
      })
      .rectangle(500, 450, 50, 50, {
        color: [255, 0, 255],
        opacity: 0.6,
      })
      .rectangle(475, 475, 50, 50, {
        opacity: 0.3,
        fill: [255, 0, 0],
        stroke: [255, 0, 255],
      })
      .rectangle(475, 475, 50, 50, {
        opacity: 0.3,
        lineWidth: 5,
        fill: [255, 255, 255],
        stroke: [255, 0, 255],
      })
      .rectangle(525, 475, 50, 50, {
        opacity: 0.8,
        lineWidth: 3,
        stroke: [255, 0, 255],
        dash: [5, 5],
      })
      .circle("center", 150, 60, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .circle("center", 150, 30, {
        stroke: "#0032FF",
        dash: [5, 5],
      })
      .circle(400, 250, 20, { color: "#00ff00" })
      .circle(400, 250, 20, { skewX: 30 })
      .circle(400, 250, 20, { skewY: -20 })
      .ellipse(100, 650, 30, 10)
      .ellipse(100, 650, 30, 10, {
        skewY: 30,
        fill: "#00ff00",
        opacity: 0.2,
        stroke: "#ff0000",
        width: 1,
      })
      .rectangle(10, 320, 80, 100, { borderRadius: 5 })
      .rectangle(15, 325, 70, 90, { borderRadius: [5, 10], stroke: "#00ff00" })
      .rectangle(20, 330, 60, 80, {
        borderRadius: [20, 10, 5],
        fill: "#ff00ff",
      })
      .polygon(
        [
          [0, 0],
          [0, 300],
          [200, 300],
        ],
        { fill: "#000000", stroke: "#00ff00", opacity: 0.2 },
      )
      .polygon(
        [
          [100, 300],
          [200, 300],
          [100, 100],
        ],
        { fill: "#ff0000", stroke: "#ff0000", opacity: 0.5 },
      )
      .polygon(
        [
          [60, 60],
          [60, 300],
          [200, 300],
        ],
        { fill: "#00d2ff", stroke: "#033002", opacity: 0.35, dash: [12, 12] },
      )
      .polygon(
        [
          [300, 300],
          [450, 600],
          [150, 600],
        ],
        { fill: "#0000ff", stroke: "#0000ff", opacity: 0 },
      )
      .polygon(
        [
          [300, 300],
          [450, 600],
          [150, 600],
        ],
        { stroke: "#ff0000", skewY: 20 },
      )
      .polygon(
        [
          [250, 650],
          [350, 680],
          [300, 700],
          [550, 700],
          [580, 750],
          [250, 750],
        ],
        { fill: "#0000ff", stroke: "#0000ff", opacity: 0.75 },
      )
      .line(
        [
          [20, 20],
          [60, 20],
          [60, 40],
          [80, 60],
          [0, 60],
          [20, 40],
        ],
        { lineWidth: 10, dash: [0, 0] },
      );
    var x = 175;
    var y = 11;
    var h = 20;
    recipe
      .text("lineCaps:", 100, 5 + h, { font: "arial" })
      .line(
        [
          [x, y],
          [x + 20, y],
        ],
        { lineWidth: 10, lineCap: "butt" },
      )
      .text("butt", x + 30, 5, { font: "arial", color: "red" })
      .line(
        [
          [x, y + 20],
          [x + 20, y + 20],
        ],
        { lineWidth: 10, lineCap: "round" },
      )
      .text("round", x + 30, 5 + h, { font: "arial", color: "green" })
      .line(
        [
          [x, y + 40],
          [x + 20, y + 40],
        ],
        { lineWidth: 10, lineCap: "square" },
      )
      .text("square", x + 30, 5 + 2 * h, { font: "arial", color: "red" });
    x = 300;
    y = 10;
    var bytes = recipe
      .polygon(
        [
          [x, y + 10],
          [x + 20, y + 30],
          [x, y + 50],
        ],
        { lineWidth: 8, lineJoin: "miter", miterLimit: 3 },
      )
      .text("miter", x - 3, 70, { font: "arial", rotation: -45, color: "red" })
      .polygon(
        [
          [x + 40, y + 10],
          [x + 60, y + 30],
          [x + 40, y + 50],
        ],
        { lineWidth: 8, lineJoin: "round" },
      )
      .text("round", x + 37, 70, {
        font: "arial",
        rotation: -45,
        color: "green",
      })
      .polygon(
        [
          [x + 80, y + 10],
          [x + 100, y + 30],
          [x + 80, y + 50],
        ],
        { lineWidth: 8, lineJoin: "bevel" },
      )
      .text("bevel", x + 77, 70, { font: "arial", rotation: -45, color: "red" })
      .text(":lineJoins", 415, 33, { font: "arial" })
      .endPage()
      .endPDF();
    writeOutput(end, "vector-add-vectors", bytes);

    var drawn = paths(end, bytes);
    var at = (rx, ry) => [rx, height - ry];
    var startingAt = (point) =>
      drawn.filter(
        (path) => rounded([path.anchors[0]])[0].join() === point.join(),
      );
    // The page-sized rectangle strokes inside the page at 10% opacity.
    var frame = drawn.find((path) => path.strokeAlpha === 0.1 && strokes(path));
    assert.deepEqual(bounds(frame.points), {
      left: 1,
      bottom: 1,
      right: width - 1,
      top: height - 1,
    });
    // skewY shears the filled square sideways by 50 * tan(20°).
    var sheared = drawn.find(
      (path) => fills(path) && path.fill.values.join() === "1,0,0",
    );
    var box = bounds(sheared.points);
    assertClose(box.right - box.left, 50 + 50 * Math.tan(Math.PI / 9), "shear");
    assertClose(box.top - box.bottom, 50, "sheared height");
    // An opacity of 0 paints an invisible polygon.
    assert.ok(
      drawn.some(
        (path) =>
          fills(path) &&
          path.fillAlpha === 0 &&
          path.fill.values.join() === "0,0,1",
      ),
    );
    // A [0, 0] dash draws a solid line.
    var [polyline] = startingAt(at(20, 20));
    assert.deepEqual(polyline.dash, [[], 0]);
    assert.equal(polyline.anchors.length, 6);
    // Line caps butt, round and square.
    assert.deepEqual(
      [0, 20, 40].map((dy) => startingAt(at(175, 11 + dy))[0].lineCap),
      [0, 1, 2],
    );
    // Line joins miter (with its limit), round and bevel.
    var joins = [0, 40, 80].map((dx) => startingAt(at(300 + dx, 20))[0]);
    assert.deepEqual(
      joins.map((path) => path.lineJoin),
      [0, 1, 2],
    );
    assert.equal(joins[0].miterLimit, 3);
    joins.forEach((path) => assert.equal(path.lineWidth, 8));
  });

  it("creates vector shapes, transforms, and images", function () {
    var bytes = end
      .newRecipe()
      .info({ title: "Browser Recipe", author: "Muhammara" })
      .custom("TestKey", "TestValue")
      .createPage(595, 842)
      .setPageBox(end.muhammara.ePDFPageBoxCropBox, 10, 10, 585, 832)
      .rotate(90)
      .lineStyle({ width: 3, cap: 1, join: 1, dash: [6, 3] })
      .opacity(0.5)
      .rectangle(260, 180, 80, 40, {
        stroke: "#dc2626",
        rotation: 15,
        rotationOrigin: [300, 200],
      })
      .opacity(1)
      .rectangle(20, 20, 100, 50, { fill: "#dbeafe" })
      .rectangle(140, 20, 100, 50, { fill: "#fecaca", borderRadius: 12 })
      .circle(200, 100, 30, { stroke: "#2563eb" })
      .line(20, 200, 300, 200, { stroke: "#111827" })
      .line(
        [
          [20, 220],
          [300, 220],
        ],
        { stroke: "red" },
      )
      .line(
        [
          [20, 240],
          [100, 260],
          [180, 240],
          [260, 260],
        ],
        { stroke: "#7c3aed", lineWidth: 2 },
      )
      .polygon(
        [
          [50, 350],
          [100, 390],
          [150, 350],
        ],
        { fill: "#facc15" },
      )
      .ellipse(250, 370, 40, 20, { stroke: "#16a34a" })
      .arc(350, 370, 30, 0, 270, { stroke: "#9333ea" })
      .pie(400, 370, 30, 20, 220, { fill: "#fb923c" })
      .n_gon(450, 370, 30, 6, { fill: "#f97316" })
      .star(520, 370, 30, { stroke: "#0891b2" })
      .arrow(100, 460, { head: [30, 30], shaft: [80, 12], fill: "#4f46e5" })
      .arrow(300, 460, {
        head: 24,
        shaft: [70, 12],
        double: true,
        stroke: "#0f766e",
      })
      .triangle(400, 480, [60, 70, 80], { fill: "#f43f5e" })
      .triangle(500, 480, [45, 80, 60], {
        traitID: "sas",
        stroke: "#1d4ed8",
      })
      .image(end.image("images/png/pnglogo-grr.png"), 400, 450, { width: 100 })
      .endPage()
      .endPDF();
    writeOutput(end, "vector-shapes", bytes);

    assert.equal(Buffer.from(bytes.slice(0, 8)).toString(), "%PDF-1.7");
    assert.match(Buffer.from(bytes).toString("latin1"), /%%EOF\s*$/);
    var metadata = info(end, bytes);
    assert.equal(metadata.Title, "Browser Recipe");
    assert.equal(metadata.TestKey, "TestValue");
    var page = withReader(end, bytes, (reader) => {
      var dictionary = reader.parsePageDictionary(0);
      return {
        cropBox: reader
          .queryDictionaryObject(dictionary, "CropBox")
          .toPDFArray()
          .toJSArray()
          .map((value) => value.value),
        rotate: reader.queryDictionaryObject(dictionary, "Rotate").value,
      };
    });
    assert.deepEqual(page, { cropBox: [10, 10, 585, 832], rotate: 90 });
    var items = painted(end, bytes);
    var [dashed] = items;
    // The line style and opacity apply to the next shape.
    assert.equal(dashed.kind, "path");
    assert.equal(dashed.strokeAlpha, 0.5);
    assert.equal(dashed.lineWidth, 3);
    assert.deepEqual(dashed.dash, [[6, 3], 0]);
    assert.ok(
      items
        .slice(1)
        .every((item) => item.kind !== "path" || item.fillAlpha === 1),
      "opacity(1) restores opaque fills",
    );
    var images = items.filter((item) => item.kind === "image");
    assert.equal(images.length, 1);
    assertClose(bounds(images[0].points).left, 400, "image left");
    assertClose(
      bounds(images[0].points).right - bounds(images[0].points).left,
      100,
      "image width",
    );
  });

  it("closes pie wedges", function () {
    var bytes = end
      .newRecipe()
      .createPage(200, 200)
      .pie(100, 100, 50, 20, 220, { stroke: "#000000" })
      .endPage()
      .endPDF();
    writeOutput(end, "vector-pie-wedges", bytes);
    var [wedge] = paths(end, bytes);
    assert.equal(wedge.paint, "S");
    assert.ok(wedge.closed, "the wedge path is closed back to its center");
    assert.deepEqual(rounded([wedge.anchors[0]]), [[100, 100]]);
  });

  it("insets vector strokes within the requested bounds", function () {
    var inheritedOptions = Object.create(STROKE_OPTIONS);
    Object.defineProperty(inheritedOptions, "unused", {
      enumerable: true,
      get() {
        throw new Error("Unused option getter must not be evaluated");
      },
    });
    var bytes = end
      .newRecipe()
      .createPage(100, 60)
      .rectangle(0, 0, 100, 60, inheritedOptions)
      .endPage()
      .createPage(100, 60)
      .rectangle(0, 0, 100, 60, { ...STROKE_OPTIONS, borderRadius: 10 })
      .endPage()
      .createPage(80, 80)
      .circle(40, 40, 40, STROKE_OPTIONS)
      .endPage()
      .createPage(80, 40)
      .ellipse(40, 20, 40, 20, STROKE_OPTIONS)
      .endPage()
      .createPage(80, 80)
      .arc(40, 40, 40, 0, 90, STROKE_OPTIONS)
      .endPage()
      .createPage(80, 80)
      .pie(40, 40, 40, 0, 90, STROKE_OPTIONS)
      .endPage()
      .createPage(100, 60)
      .rectangle(0, 0, 100, 60, { stroke: "#ff0000", lineWidth: 10 })
      .endPage()
      .endPDF();
    writeOutput(end, "vector-inset-strokes", bytes);
    INSET_CHECKS.forEach((check, pageIndex) =>
      assertFillAndInsetStroke(end, bytes, pageIndex, check),
    );
    var strokeOnly = paths(end, bytes, 6);
    assert.equal(strokeOnly.length, 1);
    assert.equal(strokeOnly[0].paint, "S");
    assert.equal(strokeOnly[0].lineWidth, 10);
    assert.deepEqual(bounds(strokeOnly[0].points), {
      left: 5,
      bottom: 5,
      right: 95,
      top: 55,
    });
  });

  it("insets vector strokes while editing an existing page", function () {
    var source = end
      .newRecipe()
      .createPage(100, 60)
      .endPage()
      .createPage(100, 60)
      .endPage()
      .createPage(80, 80)
      .endPage()
      .createPage(80, 40)
      .endPage()
      .createPage(80, 80)
      .endPage()
      .createPage(80, 80)
      .endPage()
      .endPDF();
    var bytes = end
      .openRecipe(source)
      .editPage(1)
      .rectangle(0, 0, 100, 60, STROKE_OPTIONS)
      .endPage()
      .editPage(2)
      .rectangle(0, 0, 100, 60, { ...STROKE_OPTIONS, borderRadius: 10 })
      .endPage()
      .editPage(3)
      .circle(40, 40, 40, STROKE_OPTIONS)
      .endPage()
      .editPage(4)
      .ellipse(40, 20, 40, 20, STROKE_OPTIONS)
      .endPage()
      .editPage(5)
      .arc(40, 40, 40, 0, 90, STROKE_OPTIONS)
      .endPage()
      .editPage(6)
      .pie(40, 40, 40, 0, 90, STROKE_OPTIONS)
      .endPage()
      .endPDF();
    writeOutput(end, "vector-inset-strokes-edited", bytes);
    INSET_CHECKS.forEach((check, pageIndex) =>
      assertFillAndInsetStroke(end, bytes, pageIndex, check),
    );
  });

  it("keeps thick inset strokes concentric and non-inverted", function () {
    var thick = { fill: "#000000", stroke: "#ff0000", lineWidth: 30 };
    var bytes = end
      .newRecipe()
      .createPage(80, 40)
      .ellipse(40, 20, 40, 20, STROKE_OPTIONS)
      .endPage()
      .createPage(100, 60)
      .rectangle(0, 0, 100, 60, { ...STROKE_OPTIONS, borderRadius: 10 })
      .endPage()
      .createPage(20, 20)
      .circle(10, 10, 10, thick)
      .endPage()
      .createPage(20, 20)
      .arc(10, 10, 10, 0, 90, thick)
      .endPage()
      .endPDF();
    writeOutput(end, "vector-thick-inset-strokes", bytes);
    var stroke = (pageIndex) => paths(end, bytes, pageIndex).find(strokes);
    // The inset ellipse keeps its center: radii 35 and 15 around (40, 20).
    var k = 0.551784;
    assertPoints(stroke(0).points.slice(0, 4), [
      [5, 20],
      [5, 20 - 15 * k],
      [40 - 35 * k, 5],
      [40, 5],
    ]);
    // The inset rounded rectangle keeps concentric corners of radius 5.
    var corners = rounded(stroke(1).anchors).map((point) => point.join());
    [
      [10, 5],
      [90, 5],
      [95, 10],
      [95, 50],
      [90, 55],
      [10, 55],
      [5, 50],
      [5, 10],
    ].forEach((point) =>
      assert.ok(corners.includes(point.join()), `corner point ${point}`),
    );
    [2, 3].forEach((pageIndex) => {
      // An over-wide stroke collapses the path onto the center point.
      var points = rounded(stroke(pageIndex).points);
      assert.ok(points.length > 0);
      assert.deepEqual(
        [...new Set(points.map((point) => point.join()))],
        ["10,10"],
      );
    });
  });

  it("strokes every line segment, and no empty one, on an edited page", function () {
    var source = end.newRecipe().createPage(200, 200).endPage().endPDF();
    var bytes = end
      .openRecipe(source)
      .editPage(1)
      .line(
        [
          [20, 20],
          [180, 20],
          [180, 100],
        ],
        { stroke: "#ff0000", lineWidth: 6 },
      )
      .endPage()
      .endPDF();
    writeOutput(end, "vector-line-edit", bytes);
    // One path through every point.
    var drawn = paths(end, bytes);
    assert.equal(drawn.length, 1);
    assert.deepEqual(drawn[0].anchors, [
      [20, 180],
      [180, 180],
      [180, 100],
    ]);
    assert.equal(drawn[0].lineWidth, 6);
  });

  it("strokes a Separation line through every point as one path", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(200, 200)
      .chroma("Spot", [255, 128, 0], "separation")
      .line(
        [
          [20, 20],
          [180, 20],
          [180, 100],
        ],
        { stroke: "Spot", colorspace: "separation" },
      )
      .endPage()
      .endPDF();
    writeOutput(end, "vector-line-separation", bytes);
    // One path selects the ink once, instead of one per segment.
    var drawn = paths(end, bytes);
    assert.equal(drawn.length, 1);
    assert.deepEqual(drawn[0].stroke, {
      space: "Separation:Spot",
      values: [1],
    });
    assert.deepEqual(drawn[0].anchors, [
      [20, 180],
      [180, 180],
      [180, 100],
    ]);
    assert.deepEqual(outsideClips(drawn[0]), []);
  });

  it("throws for a rotation that is no finite number before drawing", function () {
    var recipe = end.newRecipe().createPage(200, 200);
    ["none", NaN, Infinity, {}].forEach((rotation) => {
      assert.throws(
        () => recipe.rectangle(20, 20, 40, 30, { fill: "#000000", rotation }),
        { name: "TypeError", message: "rotation must be a finite number" },
      );
      assert.throws(
        () =>
          recipe.polygon(
            [
              [100, 20],
              [140, 20],
              [120, 60],
            ],
            { fill: "#000000", rotation },
          ),
        { name: "TypeError", message: "rotation must be a finite number" },
      );
    });
    // A numeric string is its number, and null is no rotation.
    var bytes = recipe
      .rectangle(20, 20, 40, 30, { fill: "#000000", rotation: "30" })
      .rectangle(20, 20, 40, 30, { fill: "#000000", rotation: null })
      .endPage()
      .endPDF();
    var [turned, upright] = paths(end, bytes);
    var corners = [
      [20, 180],
      [60, 180],
      [60, 150],
      [20, 150],
    ];
    assert.deepEqual(bounds(upright.points), bounds(corners));
    assert.deepEqual(
      bounds(turned.points),
      bounds(corners.map((point) => clockwise(point, [20, 180], 30))),
    );
  });

  it("turns rotated shapes clockwise on the page", function () {
    // A positive rotation turns clockwise; on a 400 pt page Recipe y is PDF
    // 400 - y.
    var draw = (shape) => {
      var recipe = end.newRecipe({ compress: false }).createPage(400, 400);
      shape(recipe);
      return paths(end, recipe.endPage().endPDF());
    };
    // A rectangle turns around its top-left corner (#923).
    var [rectangle] = draw((recipe) =>
      recipe.rectangle(100, 100, 50, 20, { fill: "#000000", rotation: 30 }),
    );
    assertPoints(
      rectangle.anchors,
      [
        [100, 280],
        [150, 280],
        [150, 300],
        [100, 300],
      ].map((point) => clockwise(point, [100, 300], 30)),
    );
    // A circle turns around its center, so it covers the same disc.
    var [circle] = draw((recipe) =>
      recipe.circle(100, 100, 20, { fill: "#000000", rotation: 30 }),
    );
    circle.anchors.forEach((point) =>
      assertClose(Math.hypot(point[0] - 100, point[1] - 300), 20, "radius"),
    );
    // A polygon turns around the center of its bounding box, (125, 110) or
    // PDF (125, 290).
    var [polygon] = draw((recipe) =>
      recipe.polygon(
        [
          [100, 100],
          [150, 100],
          [150, 120],
        ],
        { fill: "#000000", rotation: 30 },
      ),
    );
    assertPoints(
      polygon.anchors,
      [
        [100, 300],
        [150, 300],
        [150, 280],
        [100, 300],
      ].map((point) => clockwise(point, [125, 290], 30)),
    );
  });

  it("turns a stroked circle around its center", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(400, 400)
      .circle(100, 100, 40, { stroke: "#0000ff", rotation: 20 })
      .endPage()
      .endPDF();
    writeOutput(end, "vector-rotated-circle", bytes);
    // Its placing matrix used to have nan offsets (#922).
    assert.doesNotMatch(drawnContent(end, bytes), /nan/i);
    var [circle] = paths(end, bytes);
    // The stroke is inset by half the default width of 2.
    circle.anchors.forEach((point) =>
      assertClose(Math.hypot(point[0] - 100, point[1] - 300), 39, "radius"),
    );
  });

  it("turns a line clockwise around its first point", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(400, 400)
      .line(
        [
          [100, 200],
          [200, 200],
        ],
        { stroke: "#000000", rotation: 30 },
      )
      .endPage()
      .endPDF();
    var [line] = paths(end, bytes);
    assertPoints(line.anchors, [
      [100, 200],
      clockwise([200, 200], [100, 200], 30),
    ]);
  });

  it("does not turn lineTo(), as in the releases before line() did", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(400, 400)
      .moveTo(100, 200)
      .lineTo(200, 200, { stroke: "#000000", rotation: 90 })
      .endPage()
      .endPDF();
    assert.deepEqual(paths(end, bytes)[0].anchors, [
      [100, 200],
      [200, 200],
    ]);
  });

  it("turns a Separation line and shows it whole", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(400, 400)
      .line(
        [
          [100, 200],
          [200, 200],
        ],
        {
          stroke: "#ff0000",
          colorspace: "separation",
          colorName: "Spot",
          rotation: 30,
        },
      )
      .endPage()
      .endPDF();
    writeOutput(end, "vector-rotated-separation-line", bytes);
    var [line] = paths(end, bytes);
    assert.equal(line.stroke.space, "Separation:Spot");
    assertPoints(line.anchors, [
      [100, 200],
      clockwise([200, 200], [100, 200], 30),
    ]);
    // Nothing of the turned line is clipped away.
    assert.deepEqual(outsideClips(line), []);
  });

  it("draws nothing for a line with fewer than two points", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(200, 200)
      .line([])
      .line([[20, 20]])
      .endPage()
      .endPDF();
    writeOutput(end, "vector-line-too-few-points", bytes);
    assert.deepEqual(painted(end, bytes), []);
  });

  it("rejects a side or point count that is not finite or too large", function () {
    var recipe = end.newRecipe().createPage(200, 200);
    for (var count of [Infinity, NaN, 1e9, 100001]) {
      assert.throws(
        () => recipe.n_gon(100, 100, 50, count),
        /^RangeError: n_gon sides must be a finite number no greater than 100000$/,
      );
      assert.throws(
        () => recipe.star(100, 100, 50, count),
        /^RangeError: star points must be a finite number no greater than 100000$/,
      );
    }
    var bytes = recipe
      .n_gon(100, 100, 50, 100000)
      .star(100, 100, 50, 7)
      .endPage()
      .endPDF();
    var [ngon, star] = paths(end, bytes);
    // The polygon closes back to its first vertex.
    assert.equal(ngon.anchors.length, 100001);
    assert.equal(star.anchors.length, 8);
  });

  it("treats null options like omitted options", function () {
    var recipe = end.newRecipe().createPage(200, 200);
    recipe
      .circle(50, 50, 10, null)
      .ellipse(50, 50, 10, 5, null)
      .arc(50, 50, 10, 0, 90, null)
      .rectangle(10, 10, 20, 20, null)
      .lineStyle(null)
      .polygon(
        [
          [1, 1],
          [5, 5],
          [1, 5],
        ],
        null,
      )
      .line(
        [
          [1, 1],
          [5, 5],
        ],
        null,
      )
      .line(1, 1, 5, 5, null)
      .line(null)
      .text("text", 10, 10, { font: "arial" });
    assert.ok(recipe.textDimensions("text", { font: "arial" }).width > 0);
    assert.throws(
      () => recipe.polygon(null),
      /^TypeError: A polygon needs at least one coordinate pair$/,
    );
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "vector-null-options", bytes);
    // Every shape but line(null) strokes in the default color.
    var drawn = paths(end, bytes);
    assert.equal(drawn.length, 7);
    drawn.forEach((path) =>
      assert.deepEqual(path.stroke, {
        space: "DeviceRGB",
        values: [0.090196, 0.466667, 0.819608],
      }),
    );
  });

  it("measures and writes text with null options in the default font", function () {
    var recipe = end.newRecipe().createPage(200, 200);
    recipe.text("text", 10, 10, null);
    assert.ok(recipe.textDimensions("text", null).width > 0);
    writeOutput(end, "vector-null-text-options", recipe.endPage().endPDF());
  });
});
