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
 * @param {*} value - The options or value to copy.
 * @returns {*} The copy; functions and primitives are returned as they are.
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
 * @param {string|any} sourcePDFPath - The source PDF path or read stream.
 * @param {number} pageNumber - The zero-based page index.
 * @private
 * @returns {void}
 * @throws {Error} If the source cannot be read or the page does not exist.
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
 * rejecting a size that is not greater than zero. Zero and negative sizes have
 * no usable meaning: they draw nothing readable and measure to nonsensical font
 * metrics, so they are reported as invalid input naming the option and the
 * value. Omitting both options, or passing `null` or `undefined`, selects the
 * fallback.
 * @param {Object} [options] - Options holding `size` or `fontSize`.
 * @param {number} [fallback] - Size used when neither option is given.
 * @returns {number} The resolved font size in PDF points.
 * @throws {RangeError} If the given size is not greater than zero.
 */
function resolveFontSize(options = {}, fallback) {
  const name = options.size == null ? "fontSize" : "size";
  const size = options[name];
  if (size == null) {
    return fallback;
  }
  if (!(size > 0)) {
    throw new RangeError(
      `Text ${name} must be a number greater than zero, received ${size}`,
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
