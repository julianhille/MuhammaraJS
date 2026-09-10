var assert = require("node:assert/strict");
var muhammara = require("@muhammara/native-with-source");

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
});
