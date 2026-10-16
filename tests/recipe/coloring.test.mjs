import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeEnds, fixture, writeOutput } from "../support/ends.mjs";
import { fills, painted, paths, strokes } from "../support/geometry.mjs";

var DEFAULT_RGB = [0.090196, 0.466667, 0.819608];

/**
 * Assert a painted color.
 * @param {{space: string, values: number[]}} color - The painted color.
 * @param {string} space - The expected color space, such as "DeviceRGB" or
 *   "Separation:Spot".
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
 * The fill colors of the text a page shows, in painting order.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {object[]} The colors.
 */
function textColors(end, bytes) {
  return painted(end, bytes)
    .filter((item) => item.kind === "text")
    .map((item) => item.fill);
}

/**
 * Write the source page the color specs edit: a separation magenta text.
 * @param {object} end - The end.
 * @returns {Uint8Array} The PDF.
 */
function usingNames(end) {
  return end
    .newRecipe({ colorspace: "rgb" })
    .createPage("letter")
    .chroma("magenta", [0, 255, 0, 0], "separation")
    .text("Separation color magenta", 100, 430, {
      font: "arial",
      bold: true,
      size: 20,
      color: "magenta",
      colorspace: "separation",
    })
    .line(
      [
        [80, 430],
        [100, 430],
      ],
      { lineWidth: 0.5 },
    )
    .endPage()
    .endPDF();
}

describeEnds("Coloring", function (end) {
  it("uses a registered Separation name", function () {
    var bytes = usingNames(end);
    writeOutput(end, "coloring-using-names", bytes);
    assertColor(
      textColors(end, bytes)[0],
      "Separation:magenta",
      [1],
      "magenta text",
    );
    var [marker] = paths(end, bytes);
    assert.equal(marker.lineWidth, 0.5);
    assertColor(marker.stroke, "DeviceRGB", DEFAULT_RGB, "default line");
  });

  it("adds names for colors, also from JSON bytes", function () {
    var lineOpt = { lineWidth: 0.5 };
    var text = (recipe, value, y, options) =>
      recipe
        .text(value, 100, y, {
          font: "arial",
          bold: true,
          size: 20,
          ...options,
        })
        .line(
          [
            [80, y],
            [100, y],
          ],
          lineOpt,
        );
    var recipe = end
      .openRecipe(usingNames(end), { colorspace: "rgb" })
      .chroma("purple", [255, 0, 255])
      .chroma("yellow", [255, 255, 0])
      .chroma("fucia", "#990066")
      .editPage(1)
      .circle(60, 375, 20, { fill: "yellow", stroke: "fucia" });
    text(recipe, "White", 70, {
      color: "white",
      colorspace: "gray",
      textBox: { style: { fill: "#00", colorspace: "gray" } },
    });
    text(recipe, "Purple", 100, { color: "purple" });
    text(recipe, "Yellow", 130, { color: "yellow" });
    text(recipe, "Fucia", 160, { color: "fucia" });
    text(recipe, "Magenta", 190, { color: "magenta", colorspace: "cmyk" });
    text(recipe, "Defining Gold Here", 220, {
      color: "#ff9900",
      colorName: "gold",
    });
    text(recipe, "Using Gold Here", 250, { color: "gold" });
    text(recipe, "Undefined color returns default color", 280, {
      color: "undefinedColorGivesDefault",
    });
    recipe.chroma("!load", readFileSync(fixture("recipe/rgb-colors.json")));
    text(recipe, "Burlywood from file load", 310, { color: "burlywood" });
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "coloring-adding-names", bytes);

    var colors = textColors(end, bytes);
    assert.equal(colors.length, 10);
    [
      ["Separation:magenta", [1]],
      ["DeviceGray", [1]],
      ["DeviceRGB", [1, 0, 1]],
      ["DeviceRGB", [1, 1, 0]],
      ["DeviceRGB", [0.6, 0, 0.4]],
      ["DeviceCMYK", [0, 1, 0, 0]],
      ["DeviceRGB", [1, 0.6, 0]],
      ["DeviceRGB", [1, 0.6, 0]],
      ["DeviceRGB", DEFAULT_RGB],
      ["DeviceRGB", [0.870588, 0.721569, 0.529412]],
    ].forEach(([space, values], index) =>
      assertColor(colors[index], space, values, `text ${index}`),
    );
    var drawn = paths(end, bytes);
    var circle = drawn.filter((path) => path.ops.includes("c"));
    assertColor(circle.find(fills).fill, "DeviceRGB", [1, 1, 0], "circle");
    assertColor(
      circle.find(strokes).stroke,
      "DeviceRGB",
      [0.6, 0, 0.4],
      "circle outline",
    );
    // The gray text box behind "White".
    assert.ok(
      drawn.some(
        (path) =>
          fills(path) &&
          path.fill.space === "DeviceGray" &&
          path.fill.values[0] === 0,
      ),
    );
  });

  it("rejects loaded colors that name an inherited key as a colorspace", function () {
    assert.throws(
      () =>
        end
          .newRecipe()
          .chroma(
            "!load",
            new TextEncoder().encode('{"__proto__": {"polluted": "ff0000"}}'),
          ),
      /Unrecognized colorspace: __proto__/,
    );
    assert.equal({}.polluted, undefined);
  });

  it("uses special Separation color space names", function () {
    var lineOpt = { lineWidth: 0.5 };
    var recipe = end
      .openRecipe(usingNames(end), { colorspace: "separation" })
      .editPage(1)
      .chroma("purple", [255, 0, 255], "separation");
    [
      ["Separation color purple", 460, { color: "purple" }],
      [
        "Separation color orange",
        490,
        { color: [255, 69, 0], colorName: "orange" },
      ],
      [
        "Pantone 1505 C, RGB",
        520,
        { color: [255, 105, 0], colorName: "PANTONE 1505 C" },
      ],
      [
        "Pantone 1505 C, CMYK",
        550,
        { color: "%0,56,90,0", colorName: "PANTONE 1505 C" },
      ],
      ["CMYK Direct", 580, { color: "%0,56,90,0", colorspace: "cmyk" }],
    ].forEach(([value, y, options]) =>
      recipe
        .text(value, 100, y, {
          font: "arial",
          bold: true,
          size: 20,
          ...options,
        })
        .line(
          [
            [80, y],
            [100, y],
          ],
          lineOpt,
        ),
    );
    var bytes = recipe
      .text("Nan, a great PDF collaborator!", 100, 360, {
        font: "arial",
        bold: true,
        size: 30,
        color: "nans",
      })
      .endPage()
      .endPDF();
    writeOutput(end, "coloring-special-names", bytes);
    var colors = textColors(end, bytes);
    [
      ["Separation:magenta", [1]],
      ["Separation:purple", [1]],
      ["Separation:orange", [1]],
      ["Separation:PANTONE 1505 C", [1]],
      ["Separation:PANTONE 1505 C", [1]],
      // PercentColor 90 is round(90 * 2.55) = 229 of 255.
      ["DeviceCMYK", [0, 0.560784, 0.898039, 0]],
      ["Separation:nans", [1]],
    ].forEach(([space, values], index) =>
      assertColor(colors[index], space, values, `text ${index}`),
    );
    // The ink keeps each alternate it is given, RGB and CMYK, once each.
    var raw = Buffer.from(bytes).toString("latin1");
    ["DeviceRGB", "DeviceCMYK"].forEach((alternate) =>
      assert.equal(
        raw.match(
          new RegExp(`/Separation /PANTONE#201505#20C /${alternate}\\b`, "g"),
        )?.length,
        1,
      ),
    );
  });

  it("exposes frozen colorspace constants valued the same on both ends", function () {
    assert.deepEqual(end.Recipe.Colorspace, {
      RGB: "rgb",
      CMYK: "cmyk",
      GRAY: "gray",
      SEPARATION: "separation",
    });
    assert.deepEqual(end.muhammara.DeviceColorSpace, {
      RGB: "rgb",
      GRAY: "gray",
      CMYK: "cmyk",
    });
    assert.ok(Object.isFrozen(end.Recipe.Colorspace));
    assert.ok(Object.isFrozen(end.muhammara.DeviceColorSpace));
  });

  it("writes the separation color space into every document", function () {
    var draw = (name) => {
      var bytes = end
        .newRecipe()
        .createPage(100, 100)
        .rectangle(10, 10, 20, 20, { fill: "nans", colorspace: "separation" })
        .endPage()
        .endPDF();
      writeOutput(end, name, bytes);
      return bytes;
    };
    draw("coloring-separation-first");
    var second = draw("coloring-separation-second");
    assertColor(
      paths(end, second).find(fills).fill,
      "Separation:nans",
      [1],
      "second document",
    );
  });

  it("names Separation inks freely and keeps the first color of a shared ink", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(200, 200)
      .chroma("__proto__", "#ff0000", "separation")
      .chroma("constructor", "#0000ff", "separation")
      .rectangle(10, 10, 20, 20, {
        fill: "__proto__",
        colorspace: "separation",
      })
      .rectangle(40, 10, 20, 20, {
        fill: "constructor",
        colorspace: "separation",
      })
      // A stroke resolves before the fill, so its color is the ink alternate.
      .rectangle(70, 10, 40, 40, {
        fill: "#ff0000",
        stroke: "#00ff00",
        colorName: "ink",
        colorspace: "separation",
      })
      .endPage()
      .endPDF();
    writeOutput(end, "coloring-separation-ink-names", bytes);
    var raw = Buffer.from(bytes).toString("latin1");
    assert.equal(raw.match(/\/Separation \/__proto__ \/DeviceRGB/g)?.length, 1);
    assert.equal(
      raw.match(/\/Separation \/constructor \/DeviceRGB/g)?.length,
      1,
    );
    assert.equal(raw.match(/\/Separation \/ink \/DeviceRGB/g)?.length, 1);
    assert.match(raw, /\/C1 \[ 0 1 0 \]/);
    var drawn = paths(end, bytes);
    assertColor(drawn[0].fill, "Separation:__proto__", [1], "__proto__ ink");
    assertColor(drawn[1].fill, "Separation:constructor", [1], "constructor");
    assertColor(drawn[2].fill, "Separation:ink", [1], "ink fill");
    assertColor(drawn[3].stroke, "Separation:ink", [1], "ink stroke");
  });

  it("strokes a filled shape with its color, not the fill", function () {
    var colors = { fill: "#ff0000", color: "#0000ff" };
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(300, 300)
      .rectangle(10, 10, 40, 40, colors)
      .circle(100, 30, 20, colors)
      .ellipse(160, 30, 20, 10, colors)
      .arc(220, 30, 20, 0, 90, colors)
      .polygon(
        [
          [10, 100],
          [50, 100],
          [30, 140],
        ],
        colors,
      )
      .endPage()
      .endPDF();
    writeOutput(end, "coloring-stroke-with-color", bytes);
    // Every shape fills red and strokes its border blue.
    var drawn = paths(end, bytes);
    assert.equal(drawn.length, 10);
    drawn
      .filter(fills)
      .forEach((path) =>
        assertColor(path.fill, "DeviceRGB", [1, 0, 0], "fill"),
      );
    drawn
      .filter(strokes)
      .forEach((path) =>
        assertColor(path.stroke, "DeviceRGB", [0, 0, 1], "stroke"),
      );
    assert.equal(drawn.filter(fills).length, 5);
    assert.equal(drawn.filter(strokes).length, 5);
  });

  ["new", "source", "edited"].forEach(function (mode) {
    it(`draws separation colors on ${mode} pages`, function () {
      var source = end.newRecipe().createPage(200, 200).endPage().endPDF();
      var recipe =
        mode === "new"
          ? end.newRecipe({ compress: false }).createPage(200, 200)
          : mode === "source"
            ? end.openRecipe(source).createPage(200, 200)
            : end.openRecipe(source).editPage(1);
      recipe
        .chroma("SpotOrange", [255, 128, 0], "separation")
        .rectangle(10, 10, 40, 40, {
          fill: "SpotOrange",
          colorspace: "separation",
        })
        .line(10, 60, 60, 60, {
          stroke: "SpotOrange",
          colorspace: "separation",
        })
        .text("Spot", 10, 80, {
          font: "arial",
          color: "SpotOrange",
          colorspace: "separation",
        })
        .text("<u>Under</u>", 80, 80, {
          font: "arial",
          html: true,
          color: "SpotOrange",
          colorspace: "separation",
        })
        .circle(120, 40, 20, {
          fill: [0, 255, 0, 0],
          colorspace: "separation",
          colorName: "SpotGreen",
        })
        .text("<u>Value</u>", 80, 110, {
          font: "arial",
          html: true,
          color: [0, 255, 0, 0],
          colorspace: "separation",
          colorName: "SpotGreen",
        })
        .rectangle(10, 120, 40, 40, {
          fill: "#0000ff",
          colorspace: "separation",
        })
        // Neither a fill nor a stroke: the default color strokes as the
        // colorName ink.
        .line(10, 180, 60, 180, {
          colorspace: "separation",
          colorName: "SpotDefault",
        })
        .endPage();
      var bytes = recipe.endPDF();
      writeOutput(end, `coloring-separation-${mode}`, bytes);
      var raw = Buffer.from(bytes).toString("latin1");
      assert.equal(
        raw.match(/\/Separation \/SpotOrange \/DeviceRGB/g)?.length,
        1,
      );
      assert.equal(
        raw.match(/\/Separation \/SpotGreen \/DeviceCMYK/g)?.length,
        1,
      );
      assert.equal(recipe.knownColors.separation.SpotGreen, "00ff0000");
      // colorName names only the painted color; no second definition of the
      // ink with the default alternate.
      assert.equal(raw.match(/\/Separation \/SpotGreen\b/g)?.length, 1);
      assert.equal(
        raw.match(/\/Separation \/SpotDefault \/DeviceRGB/g)?.length,
        1,
      );

      var items = painted(end, bytes, mode === "source" ? 1 : 0);
      // Writing a color space mid-path would split the path across content
      // streams, which edited pages place as separate forms.
      var balance = (text) =>
        (text.match(/\bq\b/g)?.length || 0) -
        (text.match(/\bQ\b/g)?.length || 0);
      items.streams.forEach((stream) => assert.equal(balance(stream), 0));
      var painting = (kind, paint, space) =>
        items.filter(
          (item) =>
            item.kind === kind &&
            (paint === "text" || paint(item)) &&
            item[paint === strokes ? "stroke" : "fill"].space === space &&
            item[paint === strokes ? "stroke" : "fill"].values.join() === "1",
        ).length;
      // The rectangle fills, the texts show and the line and an underline
      // stroke in the orange ink.
      assert.equal(painting("path", fills, "Separation:SpotOrange"), 1);
      assert.ok(painting("text", "text", "Separation:SpotOrange") >= 2);
      assert.equal(painting("path", strokes, "Separation:SpotOrange"), 2);
      // The colorName circle fills, "Value" shows and its underline strokes
      // in the green ink given by value.
      assert.equal(painting("path", fills, "Separation:SpotGreen"), 1);
      assert.ok(painting("text", "text", "Separation:SpotGreen") >= 1);
      assert.equal(painting("path", strokes, "Separation:SpotGreen"), 1);
      assert.equal(painting("path", strokes, "Separation:SpotDefault"), 1);
      // A value without an ink name keeps its device color.
      assert.ok(
        items.some(
          (item) =>
            item.kind === "path" &&
            fills(item) &&
            item.fill.space === "DeviceRGB" &&
            item.fill.values.join() === "0,0,1",
        ),
      );
    });
  });
});
