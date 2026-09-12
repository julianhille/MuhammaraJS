const muhammara = require("../muhammara");
const utils = require("./utils");

/**
 * Append pages from the other pdf to the current pdf
 * @name appendPage
 * @function
 * @memberof Recipe#
 * @param {string} pdfSrc - The path for the other pdf.
 * @param {number|number[]} [pages=[]] - The page number or array of page numbers to append. Omitting it appends all pages.
 * @returns {Recipe} The recipe instance.
 */
exports.appendPage = function appendPage(pdfSrc, pages = []) {
  if (this.deletedPages?.size) {
    throw new Error("appendPage cannot be combined with deletePage");
  }
  if (!Array.isArray(pages) && !isNaN(pages)) {
    pages = [pages];
  }
  // Using stream so it can be closed to release reader resource (Issue #61)
  const instream = new muhammara.PDFRStreamForFile(pdfSrc);
  let pageCount;
  try {
    const pdfReader = muhammara.createReader(instream);
    try {
      pageCount = pdfReader.getPagesCount();
    } finally {
      pdfReader.end();
    }
  } finally {
    // An unreadable source must not leave the file open, which would keep it
    // locked on Windows for the life of the process.
    instream.close();
  }

  // prevent unmatched pagenumber
  const transformPageNumber = (pageNum) => {
    pageNum = pageNum > pageCount ? pageCount : pageNum;
    pageNum = pageNum < 1 ? 1 : pageNum;
    return pageNum - 1;
  };
  pages = pages.map((element) => {
    if (Array.isArray(element)) {
      return [transformPageNumber(element[0]), transformPageNumber(element[1])];
    } else {
      return [transformPageNumber(element), transformPageNumber(element)];
    }
  });
  this.pagesAppended = true;
  if (pages.length > 0) {
    utils.appendPDFPagesFromPDFWithAnnotations(this.writer, pdfSrc, {
      specificRanges: pages,
    });
  } else {
    utils.appendPDFPagesFromPDFWithAnnotations(this.writer, pdfSrc);
  }
  return this;
};
