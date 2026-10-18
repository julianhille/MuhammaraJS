import * as utils from "./utils.js";
/**
 * Insert a page from the other pdf
 * @name insertPage
 * @function
 * @memberof Recipe#
 * @param {number} afterPageNumber - The one-based page number to insert after; 0 inserts before the first page.
 * @param {string|Uint8Array} pdfSrc - The other PDF: a path or Buffer on
 *   native, bytes or a registered PDF name on Wasm.
 * @param {number} srcPageNumber - The one-based page number to be inserted from the other pdf.
 * @returns {Recipe} The recipe instance. Pages are inserted by `endPDF()`.
 * @throws {Error} If pages were deleted with deletePage() on this Recipe, or
 *   it writes PDF/A or attached files, which the inserted pages' new PDF
 *   would lose.
 * @throws {Error} If afterPageNumber is not a number, or after fillForm().
 * @throws {TypeError} If pdfSrc or srcPageNumber is missing.
 */
export const insertPage = function insertPage(
  afterPageNumber,
  pdfSrc,
  srcPageNumber,
) {
  if (this.deletedPages?.size) {
    throw new Error("insertPage cannot be combined with deletePage");
  }
  if (this.pdfa_ || this.attachments_) {
    throw new Error("insertPage() cannot be combined with pdfa or attach()");
  }
  // the inserted pages' new PDF would lose the form
  if (this._formFills?.size)
    throw new Error("insertPage() cannot be combined with fillForm()");
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

/**
 * Rebuild the output with the pages queued by insertPage() inserted after
 * their target pages. The pages are counted in the output itself, so pages
 * that appendPage() added are kept.
 * @private
 * @param {Uint8Array} bytes - The finished output.
 * @param {Array<Array>} [fields=[]] - The Info fields as [key, value] pairs,
 *   which the rebuilt PDF keeps.
 * @param {Object} [customInfo={}] - The custom Info entries it keeps.
 * @returns {Uint8Array} The rebuilt output.
 * @throws {Error} If nothing was queued, or a source cannot be read.
 */
export const _insertPages = function _insertPages(
  bytes,
  fields = [],
  customInfo = {},
) {
  if (!this.insertInformation) {
    throw new Error("No insertInformation");
  }
  const reader = this.muhammara.createReader(this.platform.readerSource(bytes));
  const pageCount = reader.getPagesCount();
  // the rebuilt PDF keeps the version of the output
  const version = this._getVersion(reader.getPDFLevel());
  reader.end();
  const pagesForInsert = Array.from({ length: pageCount + 1 }, (_, i) => i);

  this._output = this.platform.newWriter({ ...this._compression(), version });
  const pdfWriter = this._output.writer;
  const info = pdfWriter.getDocumentContext().getInfoDictionary();
  fields.forEach(([key, value]) => {
    if (value) info[key] = value;
  });
  Object.entries(customInfo).forEach(([key, value]) =>
    info.addAdditionalInfoEntry(key, value),
  );
  let lastInsertedOriginal = 0;
  pagesForInsert.forEach((pageNumber) => {
    const toAppendPage = pageNumber - 1;
    if (toAppendPage >= 0) {
      const specificRanges = [[lastInsertedOriginal, toAppendPage]];
      utils.appendPDFPagesFromPDFWithAnnotations(
        pdfWriter,
        this.platform.readerSource(bytes),
        { specificRanges },
      );
    }
    lastInsertedOriginal = pageNumber;

    const toInserts = this.insertInformation[pageNumber];
    if (toInserts) {
      toInserts.forEach((info) => {
        const specificRanges = [
          [info.srcPageNumber - 1, info.srcPageNumber - 1],
        ];
        utils.appendPDFPagesFromPDFWithAnnotations(
          pdfWriter,
          this.platform.readerSource(info.pdfSrc),
          { specificRanges },
        );
      });
    }
  });
  return this._output.finish();
};
