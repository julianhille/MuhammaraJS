// Helpers for the specs that compose documents: deleting, appending,
// inserting, splitting and overlaying pages. They build sources, hand a
// produced PDF to an end the way that end takes another PDF, and read page
// geometry, page content and page labels back from the result.
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeOutput } from "./ends.mjs";
import { drawnContent, pageContent, pageCount, withReader } from "./pdf.mjs";

var OUTPUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../output",
);

/**
 * Build a PDF whose pages tell themselves apart: page n is 100 + n wide and
 * 200 + n high and fills an n by n square.
 * @param {object} end - The end.
 * @param {number} [pages=12] - The page count.
 * @returns {Uint8Array} The PDF.
 */
export function numberedPdf(end, pages = 12) {
  var recipe = end.newRecipe();
  for (var page = 1; page <= pages; page += 1) {
    recipe
      .createPage(100 + page, 200 + page)
      .rectangle(10, 10, page, page, { fill: "#000000" })
      .endPage();
  }
  return recipe.endPDF();
}

/**
 * Hand produced PDF bytes to an end as another PDF to append, insert or
 * overlay: a file path on native, a registered name on Wasm. The bytes are
 * also written to tests/output for review.
 * @param {object} end - The end.
 * @param {string} name - A unique name, prefixed with the spec name.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {string} What the end's Recipe takes as `pdfSrc`.
 */
export function pdfSource(end, name, bytes) {
  var file = writeOutput(end, name, bytes);
  if (end.name !== "wasm") return file;
  end.Recipe.registerPdf(name, bytes);
  return name;
}

/**
 * The media box width of every page.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {number[]} The widths, in page order.
 */
export function pageWidths(end, bytes) {
  return withReader(end, bytes, (reader) =>
    Array.from(
      { length: reader.getPagesCount() },
      (_, index) => reader.parsePage(index).getMediaBox()[2],
    ),
  );
}

/**
 * The media box of every page.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {number[][]} The boxes, in page order.
 */
export function mediaBoxes(end, bytes) {
  return withReader(end, bytes, (reader) =>
    Array.from({ length: reader.getPagesCount() }, (_, index) =>
      Array.from(reader.parsePage(index).getMediaBox()),
    ),
  );
}

/**
 * The size of the square each page of a numberedPdf() draws, wherever an end
 * put the drawing.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {number[]} The square sizes, in page order.
 */
export function squareSizes(end, bytes) {
  return Array.from({ length: pageCount(end, bytes) }, (_, index) => {
    var match = drawnContent(end, bytes, index).match(/\b(\d+) \1 re\b/);
    return match ? Number(match[1]) : null;
  });
}

/**
 * The decoded content of every page, which identifies a copied page.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {string[]} The contents, in page order.
 */
export function pageContents(end, bytes) {
  return Array.from({ length: pageCount(end, bytes) }, (_, index) =>
    pageContent(end, bytes, index),
  );
}

/**
 * The matrices of every `cm` that directly precedes a `Do`, in the drawn
 * content of a page.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {number[][]} The six-number matrices.
 */
export function placedXObjectMatrices(end, bytes, pageIndex = 0) {
  var number = "(-?[\\d.]+)";
  var pattern = new RegExp(
    `${Array(6).fill(number).join("\\s+")}\\s+cm\\s+/\\S+\\s+Do\\b`,
    "g",
  );
  return Array.from(
    drawnContent(end, bytes, pageIndex).matchAll(pattern),
    (m) => m.slice(1, 7).map(Number),
  );
}

/**
 * The catalog's page labels as plain values, read without following
 * references inside a label dictionary.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {{kids: boolean, entries: object[]}} Whether the label tree has
 *   Kids, and each Nums entry: its start index, style, prefix text, prefix
 *   bytes, prefix string type and start number.
 */
export function pageLabels(end, bytes) {
  var M = end.muhammara;
  return withReader(end, bytes, (reader) => {
    var catalog = reader
      .queryDictionaryObject(reader.getTrailer(), "Root")
      .toPDFDictionary();
    var labels = reader
      .queryDictionaryObject(catalog, "PageLabels")
      .toPDFDictionary();
    var nums = reader.queryDictionaryObject(labels, "Nums").toPDFArray();
    var length = nums.toJSArray().length;
    var entries = [];
    for (var index = 0; index + 1 < length; index += 2) {
      var label = reader
        .queryArrayObject(nums, index + 1)
        .toPDFDictionary()
        .toJSObject();
      var entry = { start: nums.toJSArray()[index].toNumber() };
      if (label.S) entry.S = label.S.toPDFName().value;
      if (label.St) entry.St = label.St.toNumber();
      if (label.P) {
        var hex = label.P.getType() === M.ePDFObjectHexString;
        var prefix = hex
          ? label.P.toPDFHexString()
          : label.P.toPDFLiteralString();
        entry.P = prefix.toText();
        entry.prefixType = hex ? "hex" : "literal";
        entry.prefixBytes = Array.from(prefix.toBytesArray());
      }
      entries.push(entry);
    }
    return { kids: labels.exists("Kids"), entries };
  });
}

/**
 * Split a Recipe into one-page PDFs the way its end does: native writes
 * `<prefix>-<n>.pdf` files into a directory, Wasm returns them.
 * @param {object} end - The end.
 * @param {object} recipe - The Recipe to split.
 * @param {string} prefix - The file name prefix, unique per test.
 * @returns {{name: string, bytes: Uint8Array}[]} The pages, in page order.
 */
export function splitRecipe(end, recipe, prefix) {
  if (end.name === "wasm") return recipe.split(prefix);
  var dir = path.join(OUTPUT, end.name, prefix);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  recipe.split(dir, prefix);
  return readdirSync(dir)
    .map((name) => ({ name, page: Number(name.slice(prefix.length + 1, -4)) }))
    .sort((a, b) => a.page - b.page)
    .map(({ name }) => ({ name, bytes: readFileSync(path.join(dir, name)) }));
}
