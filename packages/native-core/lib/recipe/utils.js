const ANNOTATION_PREFIX = "Annots";

/** Recipe page content-stream lifecycle states. */
const PAGE_CONTEXT_STATE = Object.freeze({
  IDLE: "idle",
  ACTIVE_NEW: "active-new",
  ACTIVE_EDIT: "active-edit",
  PAUSED_NEW: "paused-new",
  PAUSED_EDIT: "paused-edit",
});

/**
 * Copies nested option objects and arrays without discarding callback values.
 * @private
 */
function cloneOptions(value) {
  if (Array.isArray(value)) return value.map(cloneOptions);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneOptions(item)]),
    );
  }
  return value;
}

/**
 * Append PDF Page with annotations.
 *
 * @param {any} pdfWriter - Hummus writer.
 * @param {string|any} sourcePDFPath - The path for the output pdfs or Reader stream.
 * @param {number} pageNumber - page number.
 * @private
 */
function appendPDFPageFromPDFWithAnnotations(
  pdfWriter,
  sourcePDFPath,
  pageNumber,
) {
  const cpyCxt = pdfWriter.createPDFCopyingContext(sourcePDFPath);
  try {
    const cpyCxtParser = cpyCxt.getSourceDocumentParser();
    const pageDictionary = cpyCxtParser.parsePageDictionary(pageNumber);

    if (!pageDictionary.exists(ANNOTATION_PREFIX)) {
      cpyCxt.appendPDFPageFromPDF(pageNumber);
    } else {
      let reffedObjects;
      pdfWriter.getEvents().once("OnPageWrite", (params) => {
        params.pageDictionaryContext.writeKey(ANNOTATION_PREFIX);
        reffedObjects = cpyCxt.copyDirectObjectWithDeepCopy(
          pageDictionary.queryObject(ANNOTATION_PREFIX),
        );
      });

      cpyCxt.appendPDFPageFromPDF(pageNumber);

      if (reffedObjects && reffedObjects.length > 0) {
        cpyCxt.copyNewObjectsForDirectObject(reffedObjects);
      }
    }
  } finally {
    cpyCxt.end();
  }
}

/**
 * Append PDF Pages with annotations.
 *
 * @param {any} pdfWriter - Hummus writer.
 * @param {string|any} sourcePDFPath - The path for the output pdfs or Reader stream.
 * @private
 */
function appendPDFPagesFromPDFWithAnnotations(
  pdfWriter,
  sourcePDFPath,
  options = {},
) {
  const cpyCxt = pdfWriter.createPDFCopyingContext(sourcePDFPath);
  try {
    const cpyCxtParser = cpyCxt.getSourceDocumentParser();

    if (options.specificRanges && options.specificRanges.length) {
      for (const [start, end] of options.specificRanges) {
        for (let i = start; i <= end; ++i) {
          appendPDFPageFromPDFWithAnnotations(pdfWriter, sourcePDFPath, i);
        }
      }
    } else {
      for (let i = 0; i < cpyCxtParser.getPagesCount(); ++i) {
        appendPDFPageFromPDFWithAnnotations(pdfWriter, sourcePDFPath, i);
      }
    }
  } finally {
    cpyCxt.end();
  }
}

/**
 * Resolves a text font size from `size`, its `fontSize` alias, or a fallback,
 * rejecting a negative size. A negative size has no usable meaning: measuring
 * with it returns nonsensical font metrics, so it is reported as invalid input
 * naming the option and the value.
 * @param {Object} [options] - Options holding `size` or `fontSize`.
 * @param {number} [fallback] - Size used when neither option is given.
 * @returns {number} The resolved font size in PDF points.
 * @throws {RangeError} If the resolved size is negative.
 */
function resolveFontSize(options = {}, fallback) {
  const size = options.size || options.fontSize || fallback;
  if (size < 0) {
    throw new RangeError(
      `Text ${options.size ? "size" : "fontSize"} must be a non-negative number, received ${size}`,
    );
  }
  return size;
}

exports.ANNOTATION_PREFIX = ANNOTATION_PREFIX;
exports.PAGE_CONTEXT_STATE = PAGE_CONTEXT_STATE;
exports.cloneOptions = cloneOptions;
exports.resolveFontSize = resolveFontSize;
exports.appendPDFPageFromPDFWithAnnotations =
  appendPDFPageFromPDFWithAnnotations;
exports.appendPDFPagesFromPDFWithAnnotations =
  appendPDFPagesFromPDFWithAnnotations;
