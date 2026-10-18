import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { withReader } from "../support/pdf.mjs";

/**
 * Write a one-page PDF and read its header.
 * @param {object} end - The end.
 * @param {string} name - The output name suffix.
 * @param {object} options - The Recipe options.
 * @returns {string} The `%PDF-x.y` header.
 */
function header(end, name, options) {
  var bytes = end.newRecipe(options).createPage().endPage().endPDF();
  writeOutput(end, `version-${name}`, bytes);
  return Buffer.from(bytes.subarray(0, 8)).toString("latin1");
}

describeEnds("Recipe version", function (end) {
  it("writes the requested PDF version", function () {
    assert.equal(header(end, "1-4", { version: 1.4 }), "%PDF-1.4");
    assert.equal(header(end, "1-5", { version: 1.5 }), "%PDF-1.5");
    assert.equal(header(end, "2-0", { version: 2.0 }), "%PDF-2.0");
  });

  it("takes 10 through 17 and 20 as the same versions", function () {
    assert.equal(header(end, "10", { version: 10 }), "%PDF-1.0");
    assert.equal(header(end, "15", { version: 15 }), "%PDF-1.5");
    assert.equal(header(end, "17", { version: 17 }), "%PDF-1.7");
    assert.equal(header(end, "20", { version: 20 }), "%PDF-2.0");
  });

  it("falls back to 1.7 for unsupported versions", function () {
    assert.equal(header(end, "default", {}), "%PDF-1.7");
    assert.equal(header(end, "1-9", { version: 1.9 }), "%PDF-1.7");
    assert.equal(header(end, "18", { version: 18 }), "%PDF-1.7");
  });

  it("compresses streams unless compress is false", function () {
    /**
     * Whether the page content stream is Flate-compressed.
     * @param {Uint8Array} bytes - The PDF.
     * @returns {boolean} Whether it has a FlateDecode filter.
     */
    function compressed(bytes) {
      return withReader(end, bytes, (reader) => {
        var page = reader.parsePageDictionary(0);
        var contents = reader.queryDictionaryObject(page, "Contents");
        var filter = reader.queryDictionaryObject(
          contents.toPDFStream().getDictionary(),
          "Filter",
        );
        return filter?.value === "FlateDecode";
      });
    }
    var draw = (options) =>
      end
        .newRecipe(options)
        .createPage(100, 100)
        .rectangle(10, 10, 20, 20, { fill: "#000000" })
        .endPage()
        .endPDF();
    assert.equal(compressed(draw({})), true);
    assert.equal(compressed(draw({ compress: true })), true);
    assert.equal(compressed(draw({ compress: false })), false);
    // only false turns compression off, as before
    assert.equal(compressed(draw({ compress: null })), true);
    assert.equal(compressed(draw({ compress: "false" })), true);
    assert.equal(compressed(draw({ compress: 0 })), true);
    end.openRecipe("Original.pdf", { compress: 0 }).endPDF();
  });
});
