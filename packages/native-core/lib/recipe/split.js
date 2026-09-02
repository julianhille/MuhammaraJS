const muhammara = require("../muhammara");
const path = require("path");
const hummusUtils = require("./utils");

/**
 * Split the pdf
 * @name split
 * @function
 * @memberof Recipe
 * @param {string} [outputDir=''] - The path for the output PDFs.
 * @param {string} [prefix] - The output filename prefix. Defaults to the source filename.
 * @returns {Recipe} The recipe instance.
 */
exports.split = function split(outputDir = "", prefix) {
  prefix = prefix || this.filename;
  for (let i = 0; i < this.metadata.pages; i++) {
    const newPdf = path.join(outputDir, `${prefix}-${i + 1}.pdf`);
    const pdfWriter = muhammara.createWriter(newPdf);
    hummusUtils.appendPDFPageFromPDFWithAnnotations(
      pdfWriter,
      this.pdfReader,
      i,
    );
    pdfWriter.end();
  }
  return this;
};
