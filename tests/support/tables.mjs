// Helpers for the text-editing and table specs: a source PDF drawn with the
// low-level writer of an end, and text runs with their font details.
import { readFileSync } from "node:fs";
import { fixture } from "./ends.mjs";
import { drawnContent, pageContent, withReader } from "./pdf.mjs";

var registeredFonts = new WeakMap();

/**
 * Make a font file available to the low-level writer of an end: a path on
 * native, a registered name on Wasm.
 * @param {object} end - The end.
 * @param {string} file - Path below TestMaterials/fonts.
 * @returns {string} The path or registered name.
 */
function lowLevelFont(end, file) {
  if (end.name === "native") return fixture("fonts/" + file);
  var names = registeredFonts.get(end) || new Set();
  registeredFonts.set(end, names);
  var name = "low-level-" + file;
  if (!names.has(name)) {
    end.muhammara.registerFont(name, readFileSync(fixture("fonts/" + file)));
    names.add(name);
  }
  return name;
}

/**
 * Draw a one-page PDF with the low-level writer of an end, for sources whose
 * content a Recipe cannot write itself, such as free content-stream code.
 * @param {object} end - The end.
 * @param {number} width - The page width.
 * @param {number} height - The page height.
 * @param {function(object, function(string, (string|number)=): object): void} draw -
 *   Draws on the page content context; its second argument returns the used
 *   font for a file below TestMaterials/fonts, with an optional face index or
 *   metrics file.
 * @returns {Uint8Array} The PDF.
 */
export function lowLevelPdf(end, width, height, draw) {
  var M = end.muhammara;
  var stream = end.name === "native" ? new M.PDFWStreamForBuffer() : undefined;
  var writer = stream ? M.createWriter(stream) : M.createWriter();
  var page = writer.createPage(0, 0, width, height);
  var font = (file, extra) => {
    var source = lowLevelFont(end, file);
    var method = end.name === "native" ? "getFontForFile" : "getFontForBytes";
    if (extra === undefined) return writer[method](source);
    return writer[method](
      source,
      typeof extra === "string" ? lowLevelFont(end, extra) : extra,
    );
  };
  draw(writer.startPageContentContext(page), font);
  writer.writePage(page);
  var bytes = writer.end();
  return new Uint8Array(stream ? stream.buffer : bytes);
}

/**
 * The text runs of a page as the reader extracts them: content, decoded
 * text, font size, font resource and text matrix.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {object[]} The runs.
 */
export function extractedText(end, bytes, pageIndex = 0) {
  return withReader(end, bytes, (reader) =>
    reader.extractPageText(pageIndex).map((run) => ({
      content: run.content,
      text: run.text,
      fontSize: run.fontSize,
      fontResource: run.fontResource,
      textMatrix: Array.from(run.textMatrix),
    })),
  );
}

/**
 * Count the line paths (`m` operators) in drawn content.
 * @param {string} content - Drawn content.
 * @returns {number} The number of paths started with `m`.
 */
export function lineCount(content) {
  return (content.match(/ m\b/g) || []).length;
}

/**
 * The content of the form XObjects a page draws, without the page's own
 * content stream.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {string} The form content.
 */
export function formContent(end, bytes, pageIndex = 0) {
  return drawnContent(end, bytes, pageIndex).slice(
    pageContent(end, bytes, pageIndex).length,
  );
}
