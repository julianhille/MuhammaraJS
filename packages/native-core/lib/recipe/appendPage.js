const muhammara = require("../muhammara");
const utils = require("./utils");

/**
 * Append pages from the other pdf to the current pdf. An active page is
 * finished first, so appended pages follow it in the output.
 * @name appendPage
 * @function
 * @memberof Recipe#
 * @param {string} pdfSrc - The path for the other pdf.
 * @param {number|Array.<number|Array.<number>>} [pages=[]] - A one-based page
 * number or array of page numbers and inclusive ranges. Omitting it appends all
 * pages; endpoints beyond the source are clamped to its final page.
 * @returns {Recipe} The recipe instance.
 * @throws {RangeError} If a selection is not a positive integer or a two-value
 * range in ascending order.
 */
exports.appendPage = function appendPage(pdfSrc, pages = []) {
  if (this.deletedPages?.size) {
    throw new Error("appendPage cannot be combined with deletePage");
  }
  if (!Array.isArray(pages)) pages = [pages];
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

  // Preserve the established upper-bound clamping after validating that the
  // caller supplied meaningful one-based page numbers.
  const transformPageNumber = (pageNum) => {
    pageNum = pageNum > pageCount ? pageCount : pageNum;
    return pageNum - 1;
  };
  pages = pages.map((element) => {
    let range = Array.isArray(element) ? element : [element, element];
    range = range.map(Number);
    if (
      range.length !== 2 ||
      !range.every(
        (pageNumber) => Number.isInteger(pageNumber) && pageNumber > 0,
      ) ||
      range[1] < range[0]
    ) {
      throw new RangeError("Page ranges use one-based inclusive page numbers");
    }
    return range.map(transformPageNumber);
  });
  // Appending writes whole pages, which the writer cannot do around an open
  // content stream. Close the active page only once the selection is known to
  // be valid, so a rejected selection leaves the page exactly as it was.
  if (this.page) this.endPage();
  if (pages.length > 0) {
    utils.appendPDFPagesFromPDFWithAnnotations(this.writer, pdfSrc, {
      specificRanges: pages,
    });
  } else {
    utils.appendPDFPagesFromPDFWithAnnotations(this.writer, pdfSrc);
  }
  this.pagesAppended = true;
  return this;
};
