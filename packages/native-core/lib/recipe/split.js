const muhammara = require("../muhammara");
const path = require("path");
const utils = require("./utils");

/**
 * Split the pdf
 * @name split
 * @function
 * @memberof Recipe#
 * @param {string} [outputDir=''] - The path for the output PDFs.
 * @param {string} [prefix] - The output filename prefix. Defaults to the
 *   source filename; pass one for a Buffer source, which has no filename.
 * @returns {Recipe} The recipe instance. Each page is written to
 *   `<outputDir>/<prefix>-<pageNumber>.pdf`.
 * @throws {Error} If the source reader was released by endPDF(), or an output
 *   file cannot be written.
 */
exports.split = function split(outputDir = "", prefix) {
  prefix = prefix || this.filename;
  for (let i = 0; i < this.metadata.pages; i++) {
    const newPdf = path.join(outputDir, `${prefix}-${i + 1}.pdf`);
    const pdfWriter = muhammara.createWriter(newPdf);
    utils.appendPDFPageFromPDFWithAnnotations(pdfWriter, this._getReader(), i);
    pdfWriter.end();
  }
  return this;
};
