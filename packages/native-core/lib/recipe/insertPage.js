const muhammara = require("../muhammara");
const fs = require("fs");
const utils = require("./utils");
/**
 * Insert a page from the other pdf
 * @name insertPage
 * @function
 * @memberof Recipe#
 * @param {number} afterPageNumber - The one-based page number to insert after; 0 inserts before the first page.
 * @param {string} pdfSrc - The path for the other pdf
 * @param {number} srcPageNumber - The one-based page number to be inserted from the other pdf.
 * @returns {Recipe} The recipe instance. Pages are inserted by `endPDF()`;
 *   Buffer sources do not support insertion.
 * @throws {Error} If pages were deleted with deletePage() on this Recipe.
 * @throws {Error} If afterPageNumber is not a number.
 * @throws {TypeError} If pdfSrc or srcPageNumber is missing.
 */
exports.insertPage = function insertPage(
  afterPageNumber,
  pdfSrc,
  srcPageNumber,
) {
  if (this.deletedPages?.size) {
    throw new Error("insertPage cannot be combined with deletePage");
  }
  if (isNaN(afterPageNumber)) {
    throw new Error("The afterPageNumber is inValid.");
  }
  if (!pdfSrc || !srcPageNumber) {
    throw new TypeError("insertPage requires pdfSrc and srcPageNumber");
  }
  this.insertInformation = this.insertInformation || {};
  this.insertInformation[afterPageNumber] =
    this.insertInformation[afterPageNumber] || [];
  this.insertInformation[afterPageNumber].push({
    afterPageNumber,
    pdfSrc,
    srcPageNumber,
  });
  this.needToInsertPages = true;
  return this;
};

exports._insertPages = function _insertPages() {
  if (!this.insertInformation) {
    throw new Error("No insertInformation");
  }
  const pagesForInsert = [
    0,
    ...Object.keys(this.metadata)
      .filter((item) => !isNaN(item))
      .map((item) => parseInt(item)),
  ];
  const tmp = this.output + ".tmp.pdf";
  fs.renameSync(this.output, tmp);

  const pdfWriter = muhammara.createWriter(this.output);
  let lastInsertedOriginal = 0;
  pagesForInsert.forEach((pageNumber) => {
    const toAppendPage = pageNumber - 1;
    if (toAppendPage >= 0) {
      const specificRanges = [[lastInsertedOriginal, toAppendPage]];
      utils.appendPDFPagesFromPDFWithAnnotations(pdfWriter, tmp, {
        specificRanges,
      });
    }
    lastInsertedOriginal = pageNumber;

    const toInserts = this.insertInformation[pageNumber];
    if (toInserts) {
      toInserts.forEach((info) => {
        const specificRanges = [
          [info.srcPageNumber - 1, info.srcPageNumber - 1],
        ];
        utils.appendPDFPagesFromPDFWithAnnotations(pdfWriter, info.pdfSrc, {
          specificRanges,
        });
      });
    }
  });
  pdfWriter.end();
  fs.unlinkSync(tmp);
  return this;
};
