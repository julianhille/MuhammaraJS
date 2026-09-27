var assert = require("node:assert/strict");
var muhammara = require("@muhammara/native-with-source");
var { writeOutput } = require("../helpers/testOutput");

function readExtGStates(reader) {
  var page = reader.parsePage(0).getDictionary();
  var resources = reader
    .queryDictionaryObject(page, "Resources")
    .toPDFDictionary();
  var forms = reader
    .queryDictionaryObject(resources, "XObject")
    .toPDFDictionary();
  return Object.keys(forms.toJSObject()).flatMap(function (name) {
    var form = reader.queryDictionaryObject(forms, name).toPDFStream();
    var formResources = reader
      .queryDictionaryObject(form.getDictionary(), "Resources")
      .toPDFDictionary();
    return readStates(reader, formResources);
  });
}

function readStates(reader, resources) {
  var extGStates = reader
    .queryDictionaryObject(resources, "ExtGState")
    .toPDFDictionary();
  return Object.keys(extGStates.toJSObject()).map(function (stateName) {
    return reader
      .queryDictionaryObject(extGStates, stateName)
      .toPDFDictionary()
      .toJSObject();
  });
}

/**
 * Lists the fill alpha (`/ca`) of every ExtGState in uncompressed PDF bytes.
 * @param {Buffer} bytes - Uncompressed PDF bytes.
 * @returns {number[]} Fill alpha values in file order.
 */
function fillAlphas(bytes) {
  return Array.from(
    bytes.toString("latin1").matchAll(/\/ca ([0-9.]+)/g),
    function (match) {
      return Number(match[1]);
    },
  );
}

/**
 * Ends a buffer-backed Recipe and returns its bytes.
 * @param {muhammara.Recipe} recipe - Recipe writing to a buffer.
 * @returns {Buffer} The PDF bytes.
 */
function endToBuffer(recipe) {
  return recipe.endPDF(function (output) {
    return output;
  });
}

describe("Recipe opacity", function () {
  it("sets fill and stroke ExtGState alpha", function () {
    var recipe = new muhammara.Recipe(Buffer.from("new"));
    var bytes = recipe
      .createPage(595, 842)
      .opacity(0.4)
      .rectangle(72, 72, 120, 60, { fill: "#ff0000", stroke: "#0000ff" })
      .endPage()
      .endPDF(function (output) {
        return output;
      });
    writeOutput("opacity-fill-and-stroke", bytes);
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(bytes),
    );
    try {
      var states = readExtGStates(reader);
      assert.ok(
        states.some(function (state) {
          return state.ca?.toNumber() === 0.4;
        }),
      );
      assert.ok(
        states.some(function (state) {
          return state.CA?.toNumber() === 0.4;
        }),
      );
      assert.ok(
        states.every(function (state) {
          return state.Type?.value === "ExtGState" && !state.type;
        }),
      );
    } finally {
      reader.end();
    }
  });

  [NaN, Infinity, -0.1, 1.1, "0.5"].forEach(function (value) {
    it(`rejects ${String(value)} opacity`, function () {
      var recipe = new muhammara.Recipe(Buffer.from("new"));
      assert.throws(function () {
        recipe.opacity(value);
      }, /Opacity must be a finite number between 0 and 1/);
    });
  });

  it("applies text opacity to that text only", function () {
    var recipe = new muhammara.Recipe(Buffer.from("new"), null, {
      compress: false,
    });
    var bytes = endToBuffer(
      recipe
        .createPage(595, 842)
        .text("Translucent", 72, 72, { opacity: 0.3 })
        .rectangle(72, 120, 120, 60, { fill: "#000000" })
        .endPage(),
    );
    writeOutput("opacity-text", bytes);
    // The rectangle after the text is painted opaque again.
    assert.deepEqual(fillAlphas(bytes), [0.3, 1]);
  });

  it("applies text opacity on an edited page", function () {
    var source = endToBuffer(
      new muhammara.Recipe(Buffer.from("new"), null, { compress: false })
        .createPage(595, 842)
        .endPage(),
    );
    var bytes = endToBuffer(
      new muhammara.Recipe(source, null, { compress: false })
        .editPage(1)
        .text("Watermark", 72, 72, { size: 60, opacity: 0.45 })
        .endPage(),
    );
    writeOutput("opacity-text-edited-page", bytes);
    assert.deepEqual(fillAlphas(bytes), [0.45]);
  });

  it("clamps text opacity to 0 through 1", function () {
    var bytes = endToBuffer(
      new muhammara.Recipe(Buffer.from("new"), null, { compress: false })
        .createPage(595, 842)
        .text("Above", 72, 72, { opacity: 2 })
        .text("Below", 72, 120, { opacity: -1 })
        .endPage(),
    );
    assert.deepEqual(fillAlphas(bytes), [1, 0]);
  });
});
