import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";

function readExtGStates(reader) {
  var page = reader.parsePage(0).getDictionary().toPDFDictionary();
  var resources = reader
    .queryDictionaryObject(page, "Resources")
    .toPDFDictionary();
  var forms = reader.queryDictionaryObject(resources, "XObject");
  if (!forms) return readStates(reader, resources);
  return Object.keys(forms.toPDFDictionary().toJSObject()).flatMap(
    function (name) {
      var form = reader
        .queryDictionaryObject(forms.toPDFDictionary(), name)
        .toPDFStream();
      var formResources = reader
        .queryDictionaryObject(form.getDictionary(), "Resources")
        .toPDFDictionary();
      return readStates(reader, formResources);
    },
  );
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
  it("sets fill and stroke ExtGState alpha", async function () {
    var Recipe = await getRecipe();
    var bytes = new Recipe()
      .createPage(595, 842)
      .opacity(0.4)
      .rectangle(72, 72, 120, 60, { fill: "#ff0000", stroke: "#0000ff" })
      .endPage()
      .endPDF();
    var reader = (await createMuhammaraWasm()).createReader(bytes);
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
    it(`rejects ${String(value)} opacity`, async function () {
      var Recipe = await getRecipe();
      var recipe = new Recipe();
      assert.throws(function () {
        recipe.opacity(value);
      }, /Opacity must be a finite number between 0 and 1/);
    });
  });
});
