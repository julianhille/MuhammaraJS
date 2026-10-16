import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { fills, painted, paths, strokes } from "../support/geometry.mjs";

var DEFAULT_RGB = [0.090196, 0.466667, 0.819608];
var DEFAULT_CMYK = [1, 0, 0, 0];

/**
 * Assert a painted color.
 * @param {{space: string, values: number[]}} color - The painted color.
 * @param {string} space - The expected color space, such as "DeviceRGB".
 * @param {number[]} values - The expected components.
 * @param {string} message - What is painted.
 * @returns {void}
 */
function assertColor(color, space, values, message) {
  assert.equal(color.space, space, `${message} color space`);
  assert.equal(color.values.length, values.length, `${message} components`);
  values.forEach((value, index) =>
    assert.ok(
      Math.abs(color.values[index] - value) < 0.000002,
      `${message}: ${color.values} is not ${values}`,
    ),
  );
}

/**
 * A DecimalColor component as the PDF writes it.
 * @param {number} value - The component, 0 to 255.
 * @returns {number} The component, 0 to 1.
 */
function unit(value) {
  return Math.round((value / 255) * 1e6) / 1e6;
}

/**
 * The painted items of a page split into texts, fills and strokes.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {{texts: object[], fills: object[], strokes: object[]}} The items.
 */
function split(end, bytes) {
  var items = painted(end, bytes);
  return {
    texts: items.filter((item) => item.kind === "text"),
    fills: items.filter((item) => item.kind === "path" && fills(item)),
    strokes: items.filter((item) => item.kind === "path" && strokes(item)),
  };
}

/**
 * Draw the shapes of the implicit colorspace specs: a stroked circle with a
 * cross, a filled and stroked polygon and a dashed translucent ellipse.
 * @param {object} end - The end.
 * @param {object} colors - The circle, cross, polygon and ellipse colors and
 *   the text color.
 * @returns {Uint8Array} The PDF.
 */
function implicitShapes(end, colors) {
  var text = { font: "arial", color: colors.text };
  return end
    .newRecipe()
    .createPage("letter")
    .text("circle with a cross in its center", 400, 200, text)
    .circle(500, 100, 50, { ...colors.circle, lineWidth: 10 })
    .line(
      [
        [490, 100],
        [510, 100],
      ],
      { stroke: colors.cross, lineWidth: 5 },
    )
    .line(
      [
        [500, 90],
        [500, 110],
      ],
      { stroke: colors.cross, lineWidth: 5 },
    )
    .text("3 corner polygon", 360, 630, text)
    .polygon(
      [
        [500, 500],
        [550, 600],
        [450, 600],
      ],
      colors.polygon,
    )
    .text("ellipse with dash border", 40, 675, text)
    .ellipse(150, 625, 75, 25, {
      ...colors.ellipse,
      opacity: 0.4,
      dash: [5, 2],
    })
    .endPage()
    .endPDF();
}

describeEnds("Color", function (end) {
  // Each explicit spec sets the Recipe's colorspace and paints a translucent
  // watermark and a translucent rectangle.
  [
    {
      colorspace: "rgb",
      watermark: "#f442ee",
      fill: [50, 255, 50],
      expectedText: ["DeviceRGB", [0xf4, 0x42, 0xee].map(unit)],
      expectedFill: ["DeviceRGB", [50, 255, 50].map(unit)],
    },
    {
      colorspace: "cmyk",
      watermark: "#f442ee52",
      fill: [0, 255, 50, 10],
      expectedText: ["DeviceCMYK", [0xf4, 0x42, 0xee, 0x52].map(unit)],
      expectedFill: ["DeviceCMYK", [0, 255, 50, 10].map(unit)],
    },
    {
      colorspace: "gray",
      watermark: "#00",
      fill: [100],
      expectedText: ["DeviceGray", [0]],
      expectedFill: ["DeviceGray", [unit(100)]],
    },
  ].forEach((spec) => {
    it(`paints ${spec.colorspace} colors with a global colorspace setting`, function () {
      var bytes = end
        .newRecipe({ colorspace: spec.colorspace })
        .createPage("letter")
        .text("WATERMARK", "center", "center", {
          font: "arial",
          bold: true,
          size: 60,
          color: spec.watermark,
          align: "center center",
          opacity: 0.3,
        })
        .text("translucent filled rectangle", 40, 550, { font: "arial" })
        .rectangle(0, 0, 300, 500, { fill: spec.fill, opacity: 0.5 })
        .endPage()
        .endPDF();
      writeOutput(end, `color-${spec.colorspace}`, bytes);
      var { texts, fills: filled } = split(end, bytes);
      assertColor(texts[0].fill, ...spec.expectedText, "watermark");
      assert.equal(texts[0].fillAlpha, 0.3);
      assert.equal(texts[1].fillAlpha, 1);
      assertColor(filled[0].fill, ...spec.expectedFill, "rectangle");
      assert.equal(filled[0].fillAlpha, 0.5);
    });
  });

  it("picks RGB from three DecimalColor components", function () {
    var bytes = implicitShapes(end, {
      circle: { stroke: [0, 0, 255] },
      cross: [200, 0, 0],
      polygon: { fill: [255, 255, 0], stroke: [255, 0, 0] },
      ellipse: { stroke: [255, 0, 0], fill: [60, 0, 255] },
    });
    writeOutput(end, "color-rgb-implicit", bytes);
    var { fills: filled, strokes: stroked } = split(end, bytes);
    assertColor(stroked[0].stroke, "DeviceRGB", [0, 0, 1], "circle");
    assert.equal(stroked[0].lineWidth, 10);
    [stroked[1], stroked[2]].forEach((cross) => {
      assertColor(cross.stroke, "DeviceRGB", [unit(200), 0, 0], "cross");
      assert.equal(cross.lineWidth, 5);
    });
    assertColor(filled[0].fill, "DeviceRGB", [1, 1, 0], "polygon fill");
    assertColor(stroked[3].stroke, "DeviceRGB", [1, 0, 0], "polygon stroke");
    assertColor(filled[1].fill, "DeviceRGB", [unit(60), 0, 1], "ellipse fill");
    assertColor(stroked[4].stroke, "DeviceRGB", [1, 0, 0], "ellipse stroke");
    assert.equal(filled[1].fillAlpha, 0.4);
    assert.deepEqual(stroked[4].dash, [[5, 2], 0]);
  });

  it("picks CMYK from four DecimalColor components", function () {
    var bytes = implicitShapes(end, {
      circle: { stroke: [255, 0, 0, 0] },
      cross: [255, 0, 255, 0],
      polygon: { fill: [0, 0, 255, 0], stroke: [0, 0, 0, 255] },
      ellipse: { stroke: [255, 0, 0, 0], fill: [60, 0, 255, 0] },
    });
    writeOutput(end, "color-cmyk-implicit", bytes);
    var { fills: filled, strokes: stroked } = split(end, bytes);
    assertColor(stroked[0].stroke, "DeviceCMYK", [1, 0, 0, 0], "circle");
    assertColor(stroked[1].stroke, "DeviceCMYK", [1, 0, 1, 0], "cross");
    assertColor(filled[0].fill, "DeviceCMYK", [0, 0, 1, 0], "polygon fill");
    assertColor(stroked[3].stroke, "DeviceCMYK", [0, 0, 0, 1], "polygon");
    assertColor(
      filled[1].fill,
      "DeviceCMYK",
      [unit(60), 0, 1, 0],
      "ellipse fill",
    );
    assertColor(stroked[4].stroke, "DeviceCMYK", [1, 0, 0, 0], "ellipse");
  });

  it("picks gray from one DecimalColor component", function () {
    var bytes = implicitShapes(end, {
      text: [0],
      circle: { fill: [200], stroke: [0] },
      cross: [255],
      polygon: { fill: [235], stroke: [0] },
      ellipse: { stroke: [0], fill: [100] },
    });
    writeOutput(end, "color-gray-implicit", bytes);
    var { texts, fills: filled, strokes: stroked } = split(end, bytes);
    texts.forEach((text) => assertColor(text.fill, "DeviceGray", [0], "text"));
    assertColor(filled[0].fill, "DeviceGray", [unit(200)], "circle fill");
    assertColor(stroked[0].stroke, "DeviceGray", [0], "circle");
    assertColor(stroked[1].stroke, "DeviceGray", [1], "cross");
    assertColor(filled[1].fill, "DeviceGray", [unit(235)], "polygon fill");
    assertColor(filled[2].fill, "DeviceGray", [unit(100)], "ellipse fill");
  });

  it("paints every color space and falls back to colorspace defaults", function () {
    var title = 30;
    var ts = 190;
    var gsize = ts + 16 * 4 + 15;
    var cwid = 24;
    var col = 20;
    var para = col + 20;
    var icon = para - 10;
    var line = (i) => i * 20;
    var i = 2;
    var recipe = end.newRecipe().createPage("letter");
    var text = (value, x, y, options = {}) =>
      recipe.text(value, x, y, { font: "arial", ...options });
    // Title: Gray, RGB, CMYK.
    [
      ["Gray,", ts, "#44"],
      ["R", gsize, [255, 0, 0]],
      ["G", gsize + cwid - 1, [0, 255, 0]],
      ["B", gsize + cwid * 2, [0, 0, 255]],
      [", ", gsize + cwid * 3, "#00"],
      ["C", gsize + cwid * 4 - 10, [255, 0, 0, 0]],
      ["M", gsize + cwid * 5 - 10, [0, 255, 0, 0]],
      ["Y", gsize + cwid * 6 - 6, [0, 0, 255, 0]],
      ["K", gsize + cwid * 7 - 10, [0, 0, 0, 255]],
    ].forEach(([value, x, color]) =>
      text(value, x, line(i), { size: title, color }),
    );
    i += 1;
    text("IMPLICIT Colorspace (via input color specification)", col, line(++i));
    // Implicit colorspaces: [label, color].
    var implicit = [
      ["Gray, DecimalColor: [200]", [200]],
      ["Gray, PercentColor: %50", "%50"],
      ["Gray, HexColor: #55", "#55"],
      ["RGB,  DecimalColor: [255,0,0]", [255, 0, 0]],
      ["RGB,  PercentColor: %0,100,0", "%0,100,0"],
      ["RGB,  HexColor: #0000FF", "#0000FF"],
      ["CMYK, DecimalColor: [255,0,0,0]", [255, 0, 0, 0]],
      ["CMYK, PercentColor: %0,28,100,6", "%0,28,100,6"],
      ["CMYK, HexColor: #FF000088", "#FF000088"],
    ];
    implicit.forEach(([value, color]) =>
      text(value, para, line(++i), { color }),
    );
    i += 1;
    text("Colorspace Defaults", col, line(++i));
    recipe.circle(icon, line(i + 1) + 8, 5, {
      colorspace: "gray",
      fill: "#ffff",
    });
    text("Gray", para, line(++i), { colorspace: "gray" });
    recipe.circle(icon, line(i + 1) + 8, 5, { colorspace: "rgb", fill: "#00" });
    text("RGB", para, line(++i), { colorspace: "rgb" });
    recipe.circle(icon, line(i + 1) + 8, 5, {
      colorspace: "cmyk",
      fill: "#00",
    });
    text("CMYK", para, line(++i), { colorspace: "cmyk" });
    i += 1;
    text('Bad "color" value results in colorspace defaults', col, line(++i));
    text("Gray, #ffff", para, line(++i), {
      colorspace: "gray",
      color: "#ffff",
    });
    text("RGB,  #00", para, line(++i), { colorspace: "rgb", color: "#00" });
    text("CMYK, #abcdef", para, line(++i), {
      colorspace: "cmyk",
      color: "#abcdef",
    });
    text("Shapes using default RGB", 360, 160);
    var bytes = recipe
      .circle(400, 200, 20)
      .ellipse(475, 200, 30, 20)
      .rectangle(445, 240, 60, 40)
      .polygon([
        [400, 240],
        [420, 280],
        [380, 280],
      ])
      .endPage()
      .endPDF();
    writeOutput(end, "color-all", bytes);

    var { texts, fills: filled, strokes: stroked } = split(end, bytes);
    var expected = [
      ["DeviceGray", [unit(0x44)]],
      ["DeviceRGB", [1, 0, 0]],
      ["DeviceRGB", [0, 1, 0]],
      ["DeviceRGB", [0, 0, 1]],
      ["DeviceGray", [0]],
      ["DeviceCMYK", [1, 0, 0, 0]],
      ["DeviceCMYK", [0, 1, 0, 0]],
      ["DeviceCMYK", [0, 0, 1, 0]],
      ["DeviceCMYK", [0, 0, 0, 1]],
      ["DeviceRGB", DEFAULT_RGB],
      ["DeviceGray", [unit(200)]],
      // PercentColor 50 is round(50 * 2.55) = 127 of 255.
      ["DeviceGray", [unit(127)]],
      ["DeviceGray", [unit(0x55)]],
      ["DeviceRGB", [1, 0, 0]],
      ["DeviceRGB", [0, 1, 0]],
      ["DeviceRGB", [0, 0, 1]],
      ["DeviceCMYK", [1, 0, 0, 0]],
      ["DeviceCMYK", [0, unit(71), 1, unit(15)]],
      ["DeviceCMYK", [1, 0, 0, unit(0x88)]],
      ["DeviceRGB", DEFAULT_RGB],
      // A missing color is the colorspace default.
      ["DeviceGray", [0]],
      ["DeviceRGB", DEFAULT_RGB],
      ["DeviceCMYK", DEFAULT_CMYK],
      ["DeviceRGB", DEFAULT_RGB],
      // A color of the wrong size is the colorspace default too.
      ["DeviceGray", [0]],
      ["DeviceRGB", DEFAULT_RGB],
      ["DeviceCMYK", DEFAULT_CMYK],
      ["DeviceRGB", DEFAULT_RGB],
    ];
    assert.equal(texts.length, expected.length);
    expected.forEach(([space, values], index) =>
      assertColor(texts[index].fill, space, values, `text ${index}`),
    );
    // The default circles fill in their colorspace's default color.
    assertColor(filled[0].fill, "DeviceGray", [0], "gray default");
    assertColor(filled[1].fill, "DeviceRGB", DEFAULT_RGB, "rgb default");
    assertColor(filled[2].fill, "DeviceCMYK", DEFAULT_CMYK, "cmyk default");
    // Shapes without colors stroke in the default RGB color.
    assert.equal(stroked.length, 4);
    stroked.forEach((path) =>
      assertColor(path.stroke, "DeviceRGB", DEFAULT_RGB, "default shape"),
    );
  });

  it("rejects unknown colorspaces", function () {
    var recipe = end.newRecipe().createPage("A4");
    var unknown = { name: "TypeError", message: "Unknown colorspace: lab" };
    assert.throws(() => recipe.chroma("brand", "#ff0000", "lab"), unknown);
    assert.throws(
      () =>
        recipe.text("Lab", 10, 10, {
          font: "arial",
          color: "#ff0000",
          colorspace: "lab",
        }),
      unknown,
    );
    assert.throws(
      () =>
        recipe.rectangle(10, 10, 20, 20, { fill: "brand", colorspace: "lab" }),
      unknown,
    );
    ["__proto__", "constructor", "toString"].forEach((colorspace) => {
      var inherited = {
        name: "TypeError",
        message: `Unknown colorspace: ${colorspace}`,
      };
      assert.throws(
        () => recipe.chroma("polluted", "#ff0000", colorspace),
        inherited,
      );
      assert.throws(
        () => recipe.rectangle(10, 10, 20, 20, { fill: "#ff0000", colorspace }),
        inherited,
      );
    });
    assert.equal({}.polluted, undefined);
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "color-unknown-colorspace", bytes);
    // Nothing of the rejected calls was drawn.
    assert.deepEqual(painted(end, bytes), []);
  });

  it("keeps registered colors per Recipe and ignores inherited names", function () {
    var recipe = end.newRecipe({ compress: false }).createPage(200, 200);
    var other = end.newRecipe();
    recipe.chroma("__proto__", "#123456").chroma("brand", "#654321");
    // Colors registered on one Recipe stay in that Recipe.
    assert.equal(other.knownColors.rgb.brand, undefined);
    assert.equal(Object.hasOwn(other.knownColors.rgb, "__proto__"), false);
    // An inherited key is no color name; "__proto__" is a registered one.
    var bytes = recipe
      .rectangle(10, 10, 20, 20, { fill: "constructor" })
      .rectangle(40, 10, 20, 20, { fill: "__proto__" })
      .endPage()
      .endPDF();
    writeOutput(end, "color-own-names", bytes);
    writeOutput(end, "color-own-names-other", other.endPDF());
    var filled = paths(end, bytes).filter(fills);
    assertColor(filled[0].fill, "DeviceRGB", DEFAULT_RGB, "constructor");
    assertColor(
      filled[1].fill,
      "DeviceRGB",
      [0x12, 0x34, 0x56].map(unit),
      "__proto__",
    );
  });
});
