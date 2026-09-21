var assert = require("node:assert/strict");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
var Recipe = muhammara.Recipe;

var FONT = path.join(__dirname, "../TestMaterials/fonts/arial.ttf");
var BOX_X = 20;
var BOX_WIDTH = 200;

function pageContent(bytes) {
  var reader = muhammara.createReader(new muhammara.PDFRStreamForBuffer(bytes));
  var page = reader.parsePage(0).getDictionary();
  var contents = reader.queryDictionaryObject(page, "Contents");
  var streams =
    contents.getType() === muhammara.ePDFObjectArray
      ? contents
          .toPDFArray()
          .toJSArray()
          .map(function (reference) {
            return reader.parseNewObject(
              reference.toPDFIndirectObjectReference().getObjectID(),
            );
          })
      : [contents];
  return streams
    .map(function (stream) {
      var input = reader.startReadingFromStream(stream.toPDFStream());
      var chunk = [];
      while (input.notEnded()) chunk.push.apply(chunk, input.read(4096));
      return Buffer.from(chunk).toString("latin1");
    })
    .join("\n");
}

/** Start x of every text run the page positions, in drawing order. */
function textStarts(bytes) {
  return Array.from(
    pageContent(bytes).matchAll(/1 0 0 1 ([-\d.]+) [-\d.]+ Tm/g),
    function (match) {
      return Number(match[1]);
    },
  );
}

/** Lays a single text box out with the shared Arial fixture. */
function layout(text, html, textAlign) {
  var recipe = new Recipe(Buffer.from("new")).createPage(300, 300);
  recipe.registerFont("arial", FONT);
  recipe.text(text, BOX_X, 20, {
    font: "arial",
    size: 12,
    html: html,
    textBox: { width: BOX_WIDTH, padding: 0, textAlign: textAlign },
  });
  return textStarts(
    recipe.endPage().endPDF(function (bytes) {
      return bytes;
    }),
  );
}

describe("Recipe HTML text alignment", function () {
  // Regression for #708: HTML lines were measured one space wider than they
  // are drawn, so every aligned line sat a space (centered: half a space)
  // to the left of the same text without `html`.
  ["center", "right", "justify"].forEach(function (textAlign) {
    it(`aligns single-segment HTML like plain text when ${textAlign}`, function () {
      assert.deepEqual(
        layout("one", true, textAlign),
        layout("one", false, textAlign),
      );
    });

    it(`aligns HTML lines ended by <br> like plain text when ${textAlign}`, function () {
      assert.deepEqual(
        layout("one<br>two", true, textAlign),
        layout("one\ntwo", false, textAlign),
      );
    });

    it(`aligns wrapped HTML like plain text when ${textAlign}`, function () {
      var wrapping = "one two three four five six seven";
      assert.deepEqual(
        layout(wrapping, true, textAlign),
        layout(wrapping, false, textAlign),
      );
    });
  });

  /** xMax of a run measured with the fixture font, as the layout measures it. */
  function runExtent(text) {
    var recipe = new Recipe(Buffer.from("new")).createPage(300, 300);
    recipe.registerFont("arial", FONT);
    var extent = recipe.textDimensions(text, { font: "arial", size: 12 }).xMax;
    recipe.endPage().endPDF(function () {});
    return extent;
  }

  it("ends a multi-segment HTML line at the box edge when right aligned", function () {
    var starts = layout("<b>a</b> b", true, "right");
    assert.equal(starts.length, 2, "the line is drawn as two styled runs");
    // Before #708 the line stopped a full space short of the box edge.
    assert.equal(starts[1] + runExtent(" b"), BOX_X + BOX_WIDTH);
  });

  it("centers a multi-segment HTML line inside the text box", function () {
    var starts = layout("<b>a</b> b", true, "center");
    assert.equal(starts.length, 2, "the line is drawn as two styled runs");
    // Before #708 the line sat half a space left of centre.
    assert.equal(
      starts[0] - BOX_X,
      BOX_X + BOX_WIDTH - (starts[1] + runExtent(" b")),
    );
  });

  it("writes every aligned pair to one page for review", function (done) {
    var output = path.join(__dirname, "../output/text-html-align.pdf");
    var recipe = new Recipe("new", output).createPage(300, 300);
    recipe.registerFont("arial", FONT);
    var y = 20;
    ["center", "right", "justify"].forEach(function (textAlign) {
      [
        ["one", "one"],
        ["one\ntwo", "one<br>two"],
        ["a b", "<b>a</b> b"],
      ].forEach(function (pair) {
        [false, true].forEach(function (html) {
          recipe.text(pair[html ? 1 : 0], BOX_X, y, {
            font: "arial",
            size: 12,
            html: html,
            textBox: {
              width: BOX_WIDTH,
              padding: 0,
              textAlign: textAlign,
              style: { stroke: "#cccccc", lineWidth: 0.5 },
            },
          });
          y += 40;
        });
      });
    });
    recipe.endPage().endPDF(done);
  });
});
