import * as utils from "./utils.js";

/**
 * Split the PDF the Recipe produces into one PDF per page. This finishes the
 * Recipe with `endPDF()`, so the parts hold its edits.
 * @name split
 * @function
 * @memberof Recipe#
 * @param {string} [outputDir=''] - The path for the output PDFs.
 * @param {string} [prefix] - The output filename prefix. Defaults to the
 *   source filename; pass one for a Buffer source, which has no filename.
 * @returns {Recipe} The recipe instance. Each page is saved by the platform
 *   as `<prefix>-<pageNumber>.pdf`; native writes it into `outputDir`.
 * @throws {Error} If the Recipe cannot be finished, or an output file cannot
 *   be written.
 */
export const split = function split(outputDir = "", prefix) {
  prefix = prefix || this.filename;
  this.endPDF();
  const bytes = this.bytes_;
  const reader = this.muhammara.createReader(this.platform.readerSource(bytes));
  const pages = reader.getPagesCount();
  reader.end();
  for (let i = 0; i < pages; i++) {
    const output = this.platform.newWriter({});
    utils.appendPDFPageFromPDFWithAnnotations(
      output.writer,
      this.platform.readerSource(bytes),
      i,
    );
    this.platform.saveSplit(
      outputDir,
      `${prefix}-${i + 1}.pdf`,
      output.finish(),
    );
  }
  return this;
};
