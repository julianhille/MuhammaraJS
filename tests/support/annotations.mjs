// Helpers for the annotation specs: reading annotation dictionaries with
// their object IDs, so a reply can be matched to the annotation it answers,
// and opening new, added or edited pages the same way on every end.
import assert from "node:assert/strict";
import { drawnContent, withReader } from "./pdf.mjs";

/**
 * A PDF object as a plain JavaScript value. Indirect references become their
 * object ID under `IRT` and `Popup`, `"<parent>"` under `P` and `Parent`, and
 * are followed one level anywhere else.
 * @param {object} end - The end.
 * @param {object} reader - The reader.
 * @param {object} object - The object.
 * @param {number} depth - How many references to follow.
 * @returns {*} The value.
 */
function plain(end, reader, object, depth) {
  var M = end.muhammara;
  var type = object.getType();
  if (type === M.ePDFObjectIndirectObjectReference) {
    if (depth <= 0) return "<ref>";
    var id = object.toPDFIndirectObjectReference().getObjectID();
    return plain(end, reader, reader.parseNewObject(id), depth - 1);
  }
  if (type === M.ePDFObjectDictionary || type === M.ePDFObjectStream) {
    var dict =
      type === M.ePDFObjectStream
        ? object.toPDFStream().getDictionary()
        : object;
    var values = dict.toPDFDictionary().toJSObject();
    return Object.fromEntries(
      Object.keys(values).map((key) => [
        key,
        entry(end, reader, key, values[key], depth),
      ]),
    );
  }
  if (type === M.ePDFObjectArray) {
    return object
      .toPDFArray()
      .toJSArray()
      .map((item) => plain(end, reader, item, depth));
  }
  if (type === M.ePDFObjectLiteralString || type === M.ePDFObjectHexString) {
    return object.toText ? object.toText() : object.value;
  }
  return object.value;
}

/**
 * One dictionary entry as a plain value, keeping links between annotations
 * as object IDs.
 * @param {object} end - The end.
 * @param {object} reader - The reader.
 * @param {string} key - The entry key.
 * @param {object} value - The entry value.
 * @param {number} depth - How many references to follow.
 * @returns {*} The value.
 */
function entry(end, reader, key, value, depth) {
  if (key === "P" || key === "Parent") return "<parent>";
  if (
    (key === "IRT" || key === "Popup") &&
    value.getType() === end.muhammara.ePDFObjectIndirectObjectReference
  ) {
    return value.toPDFIndirectObjectReference().getObjectID();
  }
  return plain(end, reader, value, depth);
}

/**
 * The annotations of a page as plain values with their object ID under `id`,
 * and the object ID of the annotation a reply answers under `IRT`.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {object[]} The annotation dictionaries; empty without /Annots.
 */
export function readAnnotations(end, bytes, pageIndex = 0) {
  return withReader(end, bytes, (reader) => {
    var page = reader.parsePageDictionary(pageIndex);
    var annots = reader.queryDictionaryObject(page, "Annots");
    if (!annots) return [];
    return annots
      .toPDFArray()
      .toJSArray()
      .map((reference) => {
        var id = reference.toPDFIndirectObjectReference().getObjectID();
        return { id, ...plain(end, reader, reader.parseNewObject(id), 1) };
      });
  });
}

/**
 * Whether a page has an /Annots entry at all.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {boolean} True when the page lists annotations.
 */
export function hasAnnots(end, bytes, pageIndex = 0) {
  return withReader(end, bytes, (reader) =>
    reader.parsePageDictionary(pageIndex).exists("Annots"),
  );
}

/**
 * The subtypes of annotations, in page order.
 * @param {object[]} annotations - Annotations from readAnnotations().
 * @returns {string[]} The subtypes.
 */
export function subtypes(annotations) {
  return annotations.map((annotation) => annotation.Subtype);
}

/**
 * A one-page PDF to edit, drawn on the given end.
 * @param {object} end - The end.
 * @param {number} width - The page width.
 * @param {number} height - The page height.
 * @param {function(object): object} [draw] - Draws on the open page.
 * @returns {Uint8Array} The PDF.
 */
export function sourcePdf(end, width, height, draw = (recipe) => recipe) {
  return draw(end.newRecipe().createPage(width, height)).endPage().endPDF();
}

/**
 * A Recipe with an open page: a page of a new PDF (`new`), a page added to
 * the source (`added`, page 2), or the source's first page (`edited`).
 * @param {object} end - The end.
 * @param {string} mode - `new`, `added` or `edited`.
 * @param {number} width - The page width.
 * @param {number} height - The page height.
 * @returns {object} The Recipe.
 */
export function openPage(end, mode, width, height) {
  if (mode === "new") return end.newRecipe().createPage(width, height);
  var recipe = end.openRecipe(sourcePdf(end, width, height));
  return mode === "added"
    ? recipe.createPage(width, height)
    : recipe.editPage(1);
}

/**
 * Reads a PDF date, `D:YYYYMMDDHHmmSS` with `Z` or a `+HH'mm'` offset.
 * @param {string} text - The PDF date.
 * @returns {number} Milliseconds since the Unix epoch.
 */
export function pdfDateToTime(text) {
  var match =
    /^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(Z|([+-])(\d{2})'(\d{2})'?)$/.exec(
      text,
    );
  assert.ok(match, `a PDF date: ${text}`);
  var [, year, month, day, hour, minute, second, zone, sign, hours, minutes] =
    match;
  var offset =
    zone === "Z" ? 0 : (sign === "-" ? -1 : 1) * (hours * 60 + +minutes);
  return Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60000;
}

/**
 * How many text-showing operators (Tj, TJ) a page draws, in its content or
 * in the forms it draws, wherever an end put them.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {number} The count.
 */
export function textShowCount(end, bytes, pageIndex = 0) {
  return (drawnContent(end, bytes, pageIndex).match(/\bT[jJ]\b/g) || []).length;
}
