import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { withReader } from "../support/pdf.mjs";
import { fills, painted, strokes } from "../support/geometry.mjs";

/**
 * Every dictionary of a PDF that sets a fill (`ca`) or stroke (`CA`) alpha.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {object[]} The dictionaries as key to plain value maps.
 */
function alphaStates(end, bytes) {
  return withReader(end, bytes, (reader) => {
    var M = end.muhammara;
    var states = [];
    for (var id = 1; id < reader.getXrefSize(); id++) {
      var object = reader.parseNewObject(id);
      if (!object || object.getType() !== M.ePDFObjectDictionary) continue;
      var entries = object.toPDFDictionary().toJSObject();
      if ("ca" in entries || "CA" in entries)
        states.push(
          Object.fromEntries(
            Object.entries(entries).map(([key, value]) => [key, value.value]),
          ),
        );
    }
    return states;
  });
}

/**
 * The fill alpha of each painted text show.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {number[]} The alphas in painting order.
 */
function textAlphas(end, bytes, pageIndex = 0) {
  return painted(end, bytes, pageIndex)
    .filter((item) => item.kind === "text")
    .map((item) => item.fillAlpha);
}

/**
 * Freeze an options object and every object in it.
 * @param {object} value - The options.
 * @returns {object} The same options, deeply frozen.
 */
function frozen(value) {
  Object.values(value).forEach((child) => {
    if (child instanceof Object) frozen(child);
  });
  return Object.freeze(value);
}

describeEnds("Recipe opacity", function (end) {
  it("sets fill and stroke ExtGState alpha", function () {
    var bytes = end
      .newRecipe()
      .createPage(595, 842)
      .opacity(0.4)
      .rectangle(72, 72, 120, 60, { fill: "#ff0000", stroke: "#0000ff" })
      .endPage()
      .endPDF();
    writeOutput(end, "opacity-fill-and-stroke", bytes);
    var items = painted(end, bytes);
    assert.equal(items.find(fills).fillAlpha, 0.4);
    assert.equal(items.find(strokes).strokeAlpha, 0.4);
    // The graphics states are valid ExtGState dictionaries.
    var states = alphaStates(end, bytes);
    assert.ok(states.length > 0);
    states.forEach((state) => {
      assert.equal(state.Type, "ExtGState");
      assert.equal(state.type, undefined);
    });
  });

  [NaN, Infinity, -0.1, 1.1, "0.5"].forEach(function (value) {
    it(`rejects ${String(value)} opacity`, function () {
      var recipe = end.newRecipe();
      assert.throws(function () {
        recipe.opacity(value);
      }, /Opacity must be a finite number between 0 and 1/);
    });
  });

  it("applies text opacity to that text only", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(595, 842)
      .text("Translucent", 72, 72, { font: "arial", opacity: 0.3 })
      .rectangle(72, 120, 120, 60, { fill: "#000000" })
      .endPage()
      .endPDF();
    writeOutput(end, "opacity-text", bytes);
    assert.deepEqual(textAlphas(end, bytes), [0.3]);
    // The rectangle after the text is painted opaque again.
    assert.equal(painted(end, bytes).find(fills).fillAlpha, 1);
  });

  it("applies text opacity on an edited page", function () {
    var source = end
      .newRecipe({ compress: false })
      .createPage(595, 842)
      .endPage()
      .endPDF();
    var bytes = end
      .openRecipe(source, { compress: false })
      .editPage(1)
      .text("Watermark", 72, 72, { font: "arial", size: 60, opacity: 0.45 })
      .endPage()
      .endPDF();
    writeOutput(end, "opacity-text-edited-page", bytes);
    assert.deepEqual(textAlphas(end, bytes), [0.45]);
  });

  it("clamps text opacity to 0 through 1", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(595, 842)
      .text("Above", 72, 72, { font: "arial", opacity: 2 })
      .text("Below", 72, 120, { font: "arial", opacity: -1 })
      .endPage()
      .endPDF();
    writeOutput(end, "opacity-text-clamped", bytes);
    assert.deepEqual(textAlphas(end, bytes), [1, 0]);
  });

  it("writes a numeric-string opacity as a number", function () {
    // "0.5" used to fail after the ExtGState dictionary was started, and the
    // open dictionary crashed endPDF().
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(595, 842)
      .rectangle(10, 10, 20, 20, { fill: "#ff0000", opacity: "0.5" })
      .endPage()
      .endPDF();
    writeOutput(end, "opacity-numeric-string", bytes);
    assert.equal(painted(end, bytes).find(fills).fillAlpha, 0.5);
    assert.ok(alphaStates(end, bytes).some((state) => state.ca === 0.5));
  });

  it("takes frozen options", function () {
    var style = frozen({ stroke: "#000000", fill: "#ff0000", lineWidth: 2 });
    var recipe = end.newRecipe().createPage(595, 842);
    recipe
      .line(
        [
          [10, 10],
          [50, 50],
        ],
        style,
      )
      .polygon(
        [
          [10, 10],
          [50, 10],
          [30, 40],
        ],
        style,
      )
      .rectangle(10, 10, 40, 40, style)
      .circle(50, 50, 20, style)
      .ellipse(50, 50, 30, 20, style)
      .arc(50, 50, 20, 0, 90, style)
      .n_gon(100, 100, 20, 5, style)
      .image(end.image("images/png/pnglogo-grr.png"), 100, 200, style)
      .text(
        "abc def ghi",
        10,
        10,
        frozen({
          size: 12,
          textBox: {
            width: 40,
            padding: [1, 2],
            style: { stroke: "#000000", lineWidth: 1 },
          },
        }),
      )
      .text(
        "<b>a</b> c",
        10,
        100,
        frozen({ html: true, size: 12, textBox: { width: 60 } }),
      )
      .endPage()
      .endPDF();
  });

  it("draws a reused style at the opacity of each call", function () {
    var style = { stroke: "#000000", fill: "#ff0000", lineWidth: 2 };
    var bytes = end
      .newRecipe()
      .createPage(595, 842)
      .rectangle(10, 10, 40, 40, style)
      .opacity(0.3)
      .rectangle(100, 10, 40, 40, style)
      .endPage()
      .endPDF();
    writeOutput(end, "opacity-reused-style", bytes);
    assert.deepEqual(
      painted(end, bytes)
        .filter(fills)
        .map((item) => item.fillAlpha),
      [1, 0.3],
    );
    assert.deepEqual(Object.keys(style), ["stroke", "fill", "lineWidth"]);
  });
});
