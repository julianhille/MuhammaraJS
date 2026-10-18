import * as utils from "./utils.js";

/**
 * Append pages from the other pdf to the current pdf. An active page is
 * finished first, so appended pages follow it in the output.
 * @name appendPage
 * @function
 * @memberof Recipe#
 * @param {string|Uint8Array} pdfSrc - The other PDF: a path or Buffer on
 *   native, bytes or a registered PDF name on Wasm.
 * @param {number|Array.<number|Array.<number>>} [pages=[]] - A one-based page
 * number or array of page numbers and inclusive ranges. Omitting it appends all
 * pages; endpoints beyond the source are clamped to its final page.
 * @returns {Recipe} The recipe instance.
 * @throws {RangeError} If a selection is not a positive integer or a two-value
 * range in ascending order.
 * @throws {Error} If pages were deleted with deletePage() on this Recipe.
 * @throws {Error} If the source PDF cannot be read.
 */
export const appendPage = function appendPage(pdfSrc, pages = []) {
  if (this.deletedPages?.size) {
    throw new Error("appendPage cannot be combined with deletePage");
  }
  if (!Array.isArray(pages)) pages = [pages];
  // The source's page geometry, also for the metadata of appended pages.
  const sourcePages = this.read(pdfSrc);
  const pageCount = sourcePages.pages;

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
  const source = this.platform.readerSource(pdfSrc);
  if (pages.length > 0) {
    utils.appendPDFPagesFromPDFWithAnnotations(this.writer, source, {
      specificRanges: pages,
    });
  } else {
    utils.appendPDFPagesFromPDFWithAnnotations(this.writer, source);
  }
  // Record the appended pages, so pages created later are numbered after
  // them and their annotations land on them.
  const appended = pages.length
    ? pages.flatMap(([start, end]) =>
        Array.from({ length: end - start + 1 }, (_, i) => start + i),
      )
    : Array.from({ length: pageCount }, (_, i) => i);
  this._metadata = this._metadata || {};
  appended.forEach((index) => {
    const pageNumber =
      (this._metadata.pageCount ?? this._metadata.pages ?? 0) + 1;
    this._metadata.pageCount = pageNumber;
    this._metadata[pageNumber] = { ...sourcePages[index + 1], pageNumber };
  });
  this.pagesAppended = true;
  return this;
};
