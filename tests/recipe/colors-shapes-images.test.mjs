import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { pageCount, withReader } from "../support/pdf.mjs";
import {
  bounds,
  clockwise,
  fills,
  painted,
  paths,
  rounded,
  strokes,
} from "../support/geometry.mjs";

/**
 * A DecimalColor component as the PDF writes it.
 * @param {number} value - The component, 0 to 255.
 * @returns {number} The component, 0 to 1.
 */
function unit(value) {
  return Math.round((value / 255) * 1e6) / 1e6;
}

/**
 * A PercentColor component as the PDF writes it.
 * @param {number} percent - The component, 0 to 100.
 * @returns {number} The component, 0 to 1.
 */
function percent(percent) {
  return unit(Math.round(percent * 2.55));
}

/**
 * Whether a painted color matches.
 * @param {{space: string, values: number[]}} color - The painted color.
 * @param {string} space - The color space, such as "DeviceRGB".
 * @param {number[]} values - The components.
 * @returns {boolean} True when space and components match within 2e-6.
 */
function isColor(color, space, values) {
  return (
    color.space === space &&
    color.values.length === values.length &&
    values.every((value, index) => Math.abs(color.values[index] - value) < 2e-6)
  );
}

/**
 * Whether a path is a polygon: straight segments only.
 * @param {object} path - A painted path.
 * @returns {boolean} True for moveto and lineto segments only.
 */
function isPolygon(path) {
  return path.ops.every((op) => op === "m" || op === "l");
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

/**
 * The media box of a page.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {number[]} The box.
 */
function mediaBox(end, bytes) {
  return withReader(end, bytes, (reader) =>
    reader
      .queryDictionaryObject(reader.parsePageDictionary(0), "MediaBox")
      .toPDFArray()
      .toJSArray()
      .map((value) => value.value),
  );
}

describeEnds("Recipe colors, shapes, and images", function (end) {
  it("writes normalized device colors and shared path state", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(300, 300)
      .chroma("brand", "%10,20,30")
      .rectangle(10, 10, 40, 30, { fill: "brand", opacity: 0.5 })
      .circle(80, 30, 15, {
        stroke: [0, 255, 0],
        colorspace: "rgb",
        lineCap: "round",
        lineJoin: "bevel",
        dash: [2, 1],
      })
      .ellipse(130, 30, 20, 10, { fill: "#7f" })
      .arc(190, 30, 15, 0, 180, { stroke: "%0,100,0,0", colorspace: "cmyk" })
      .n_gon(40, 100, 20, 5, { fill: "#ff0000", rotation: 20, skewX: 5 })
      .star(100, 100, 20, 6, { stroke: "#00ff00" })
      .arrow(170, 100, {
        type: "dart",
        head: [20, 30],
        shaft: [40, 10],
        fill: "#0000ff",
      })
      .triangle(230, 110, [30, 40, 50], { fill: "#123456" })
      .endPage()
      .endPDF();
    writeOutput(end, "colors-shapes-images-normalized-colors", bytes);
    assert.equal(pageCount(end, bytes), 1);
    assert.deepEqual(mediaBox(end, bytes), [0, 0, 300, 300]);
    var drawn = paths(end, bytes);
    var filled = (space, values) =>
      drawn.filter((path) => fills(path) && isColor(path.fill, space, values));
    var stroked = (space, values) =>
      drawn.filter(
        (path) => strokes(path) && isColor(path.stroke, space, values),
      );
    var [brand] = filled("DeviceRGB", [10, 20, 30].map(percent));
    assert.equal(brand.fillAlpha, 0.5);
    // The dashed circle strokes with round caps and bevel joins.
    var [circle] = stroked("DeviceRGB", [0, 1, 0]);
    assert.equal(circle.lineCap, 1);
    assert.equal(circle.lineJoin, 2);
    assert.deepEqual(circle.dash, [[2, 1], 0]);
    assert.equal(filled("DeviceGray", [unit(0x7f)]).length, 1);
    assert.equal(stroked("DeviceCMYK", [0, 1, 0, 0]).length, 1);
    assert.equal(filled("DeviceRGB", [1, 0, 0]).length, 1);
    // A six-pointed star is two triangles.
    assert.equal(stroked("DeviceRGB", [0, 1, 0]).length, 3);
    assert.equal(filled("DeviceRGB", [0, 0, 1]).length, 1);
    assert.equal(filled("DeviceRGB", [0x12, 0x34, 0x56].map(unit)).length, 1);
  });

  it("draws the gray and CMYK how-to colors", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(595, 842)
      .rectangle(72, 72, 100, 50, { fill: "#80" })
      .rectangle(200, 72, 100, 50, { fill: "#00ff0000" })
      .rectangle(328, 72, 100, 50, { fill: [0, 0, 0, 255] })
      .endPage()
      .endPDF();
    writeOutput(end, "colors-shapes-images-how-to-recipe", bytes);
    var filled = paths(end, bytes).filter(fills);
    assert.ok(isColor(filled[0].fill, "DeviceGray", [unit(0x80)]));
    assert.ok(isColor(filled[1].fill, "DeviceCMYK", [0, 1, 0, 0]));
    assert.ok(isColor(filled[2].fill, "DeviceCMYK", [0, 0, 0, 1]));
  });

  it("places byte images with fit, alignment, transforms, and reuse", function () {
    var logo = end.image("images/png/pnglogo-grr.png");
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(300, 300)
      .image(logo, 80, 80, {
        width: 80,
        height: 40,
        align: "center center",
        opacity: 0.5,
        rotation: 15,
        skewY: 5,
      })
      .image(logo, 180, 80, { scale: 0.25 })
      .endPage()
      .endPDF();
    writeOutput(end, "colors-shapes-images-placement", bytes);
    var images = painted(end, bytes).filter((item) => item.kind === "image");
    assert.equal(images.length, 2);
    assert.equal(images[0].fillAlpha, 0.5);
    // The rotated image is no longer axis aligned.
    assert.notEqual(Math.round(images[0].ctm[1] * 1000), 0);
    // scale: 0.25 of the 1024 x 768 pixel logo, top-left at (180, 80).
    assert.deepEqual(bounds(images[1].points), {
      left: 180,
      bottom: 300 - 80 - 192,
      right: 180 + 256,
      top: 300 - 80,
    });
    assert.equal(images[1].fillAlpha, 1);
  });

  it("supports PDF rectangle coordinates, four radii, and n-gon vertex/debug options", function () {
    var draw = (options) =>
      end
        .newRecipe({ compress: false })
        .createPage(200, 200)
        .rectangle(10, 20, 80, 40, {
          useGivenCoords: true,
          borderRadius: [1, 2, 3, 4],
          fill: "#ff0000",
        })
        .n_gon(120, 80, 30, 5, { stroke: "#000000", ...options })
        .endPage()
        .endPDF();
    var bytes = draw({ rotation: 15, rotationVertice: 3, debug: true });
    writeOutput(end, "colors-shapes-images-rectangle-radii-ngon-debug", bytes);
    assert.deepEqual(mediaBox(end, bytes), [0, 0, 200, 200]);
    var drawn = paths(end, bytes);
    // useGivenCoords takes (10, 20) as the PDF bottom-left corner. The
    // corners are rounded clockwise from the top-left: 1, 2, 3 and 4.
    var rectangle = drawn.find(fills);
    assert.deepEqual(bounds(rectangle.points), {
      left: 10,
      bottom: 20,
      right: 90,
      top: 60,
    });
    var corners = rounded(rectangle.anchors).map((point) => point.join());
    [
      [10, 59],
      [11, 60],
      [88, 60],
      [90, 58],
      [90, 23],
      [87, 20],
      [14, 20],
      [10, 24],
    ].forEach((point) =>
      assert.ok(corners.includes(point.join()), `corner point ${point}`),
    );
    assert.equal(rectangle.ops.filter((op) => op === "c").length, 4);
    // debug adds the circumscribed circle and the filled center.
    var circles = drawn.filter(
      (path) =>
        path.ops.filter((op) => op === "c").length === 4 && path !== rectangle,
    );
    assert.equal(circles.length, 2);
    // rotationVertice 3 turns the n-gon around its third vertex.
    var upright = paths(end, draw({})).filter(isPolygon)[0].anchors;
    var pivot = upright[2];
    var turned = drawn.filter(isPolygon)[0].anchors;
    assert.deepEqual(
      distinct(turned),
      distinct(upright.map((point) => clockwise(point, pivot, 15))),
    );
    assert.ok(distinct(turned).includes(distinct([pivot])[0]));
  });

  it("edits byte source pages with polygon-derived shapes", function () {
    var source = end
      .newRecipe({ compress: false })
      .createPage(200, 200)
      .rectangle(1, 1, 1, 1, { fill: "#000000" })
      .endPage()
      .endPDF();
    writeOutput(end, "colors-shapes-images-polygon-derived-source", source);
    var bytes = end
      .openRecipe(source, { compress: false })
      .editPage(1)
      .polygon(
        [
          [10, 10],
          [30, 10],
          [20, 30],
        ],
        { fill: "#ff0000" },
      )
      .n_gon(60, 30, 15, 5, { fill: "#00ff00" })
      .star(110, 30, 15, { fill: "#0000ff" })
      .arrow(155, 30, { fill: "#123456" })
      .triangle(20, 80, [20, 25, 30], { fill: "#654321" })
      .endPage()
      .endPDF();
    writeOutput(end, "colors-shapes-images-polygon-derived-edit", bytes);
    var filled = paths(end, bytes).filter(fills);
    // The source content is kept under the edit.
    assert.ok(isColor(filled[0].fill, "DeviceRGB", [0, 0, 0]));
    assert.deepEqual(bounds(filled[0].points), {
      left: 1,
      bottom: 198,
      right: 2,
      top: 199,
    });
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0x12, 0x34, 0x56].map(unit),
      [0x65, 0x43, 0x21].map(unit),
    ].forEach((values, index) =>
      assert.ok(isColor(filled[index + 1].fill, "DeviceRGB", values)),
    );
    assert.equal(filled.length, 6);
  });

  it("supports every arrow and triangle trait variant and TIFF directory selection", function () {
    var recipe = end.newRecipe({ compress: false }).createPage(400, 300);
    ["triangle", "dart", "kite", 1, 2].forEach((type, index) =>
      recipe.arrow(40 + index * 65, 45, {
        type,
        double: index === 0,
        fill: "#0000ff",
      }),
    );
    var bytes = recipe
      .triangle(30, 130, [30, 40, 50], { traitID: "sss" })
      .triangle(100, 130, [30, 60, 40], { traitID: "sas" })
      .triangle(180, 130, [50, 40, 60], { traitID: "asa" })
      .triangle(
        260,
        130,
        [
          [260, 130],
          [290, 170],
          [320, 130],
        ],
        { traitID: "vtx" },
      )
      .image(end.image("images/tiff/multipage.tif"), 20, 200, {
        width: 80,
        page: 2,
      })
      .endPage()
      .endPDF();
    writeOutput(end, "colors-shapes-images-arrows-triangles-tiff", bytes);
    assert.equal(pageCount(end, bytes), 1);
    var drawn = paths(end, bytes);
    // Arrow types by name and by number draw the same heads, relative to
    // their first point.
    var arrows = drawn.filter((path) => fills(path) && isPolygon(path));
    assert.equal(arrows.length, 5);
    var shape = (path) =>
      distinct(
        path.anchors.map(([x, y]) => [
          x - path.anchors[0][0],
          y - path.anchors[0][1],
        ]),
      );
    assert.equal(distinct(arrows[0].anchors).length, 10, "a double arrow");
    assert.deepEqual(shape(arrows[3]), shape(arrows[1]), "1 is dart");
    assert.deepEqual(shape(arrows[4]), shape(arrows[2]), "2 is kite");
    assert.notDeepEqual(shape(arrows[1]), shape(arrows[2]));
    // Triangles: B (left of the base), C (apex), A (right of the base).
    var triangles = drawn
      .filter((path) => strokes(path) && isPolygon(path))
      .map((path) => {
        var [B, C, A] = path.anchors.map(([x, y]) => [x, 300 - y]);
        return { A, B, C };
      });
    assert.equal(triangles.length, 4);
    var length = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
    var close = (actual, expected, message) =>
      assert.ok(Math.abs(actual - expected) < 0.01, `${message}: ${actual}`);
    var angleAt = (vertex, p, q) =>
      (Math.acos(
        ((p[0] - vertex[0]) * (q[0] - vertex[0]) +
          (p[1] - vertex[1]) * (q[1] - vertex[1])) /
          (length(vertex, p) * length(vertex, q)),
      ) *
        180) /
      Math.PI;
    var [sss, sas, asa, vtx] = triangles;
    close(length(sss.B, sss.C), 30, "SSS a");
    close(length(sss.A, sss.C), 40, "SSS b");
    close(length(sss.A, sss.B), 50, "SSS c");
    close(length(sas.B, sas.C), 30, "SAS a");
    close(angleAt(sas.C, sas.A, sas.B), 60, "SAS angle C");
    close(length(sas.A, sas.C), 40, "SAS b");
    close(angleAt(asa.B, asa.A, asa.C), 50, "ASA angle B");
    close(length(asa.A, asa.B), 40, "ASA c");
    close(angleAt(asa.A, asa.B, asa.C), 60, "ASA angle A");
    assert.deepEqual(rounded([vtx.B, vtx.C, vtx.A]), [
      [260, 130],
      [290, 170],
      [320, 130],
    ]);
    // The second TIFF directory is placed 80 pt wide.
    var images = painted(end, bytes).filter((item) => item.kind === "image");
    assert.equal(images.length, 1);
    var box = bounds(images[0].points);
    assert.equal(box.left, 20);
    assert.equal(box.right - box.left, 80);
    assert.equal(box.top, 100);
  });
});
