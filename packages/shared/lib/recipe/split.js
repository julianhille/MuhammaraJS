import * as utils from "./utils.js";

/**
 * Split the source PDF into one PDF per page.
 * @name split
 * @function
 * @memberof Recipe#
 * @param {string} [outputDir=''] - The path for the output PDFs.
 * @param {string} [prefix] - The output filename prefix. Defaults to the
 *   source filename; pass one for a Buffer source, which has no filename.
 * @returns {Recipe} The recipe instance. Each page is saved by the platform
 *   as `<prefix>-<pageNumber>.pdf`; native writes it into `outputDir`.
 * @throws {Error} If the source reader was released by endPDF(), or an output
 *   file cannot be written.
 */
export const split = function split(outputDir = "", prefix) {
  prefix = prefix || this.filename;
  for (let i = 0; i < this._metadata.pages; i++) {
    const output = this.platform.newWriter({});
    utils.appendPDFPageFromPDFWithAnnotations(
      output.writer,
      this.platform.readerSource(this._source),
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
