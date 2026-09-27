import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

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

/**
 * Lists the fill alpha (`/ca`) of every ExtGState in uncompressed PDF bytes.
 * @param {Uint8Array} bytes - Uncompressed PDF bytes.
 * @returns {number[]} Fill alpha values in file order.
 */
function fillAlphas(bytes) {
  return Array.from(
    new TextDecoder("latin1").decode(bytes).matchAll(/\/ca ([0-9.]+)/g),
    function (match) {
      return Number(match[1]);
    },
  );
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
    writeOutput("opacity-fill-and-stroke", bytes);
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

  it("applies text opacity to that text only", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe({ compress: false });
    var bytes = recipe
      .createPage(595, 842)
      .text("Translucent", 72, 72, { opacity: 0.3 })
      .rectangle(72, 120, 120, 60, { fill: "#000000" })
      .endPage()
      .endPDF();
    writeOutput("opacity-text", bytes);
    // The rectangle after the text is painted opaque again.
    assert.deepEqual(fillAlphas(bytes), [0.3, 1]);
  });

  it("applies text opacity on an edited page", async function () {
    var Recipe = await getRecipe();
    var source = new Recipe({ compress: false })
      .createPage(595, 842)
      .endPage()
      .endPDF();
    var bytes = new Recipe(source, { compress: false })
      .editPage(1)
      .text("Watermark", 72, 72, { size: 60, opacity: 0.45 })
      .endPage()
      .endPDF();
    writeOutput("opacity-text-edited-page", bytes);
    assert.deepEqual(fillAlphas(bytes), [0.45]);
  });

  it("clamps text opacity to 0 through 1", async function () {
    var Recipe = await getRecipe();
    var bytes = new Recipe({ compress: false })
      .createPage(595, 842)
      .text("Above", 72, 72, { opacity: 2 })
      .text("Below", 72, 120, { opacity: -1 })
      .endPage()
      .endPDF();
    assert.deepEqual(fillAlphas(bytes), [1, 0]);
  });
});
