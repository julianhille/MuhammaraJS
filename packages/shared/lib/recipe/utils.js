import { trimBreakableEnd } from "../text-direction.js";

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
 * Append one page through an open copying context, with its annotations:
 * through the writer's page write event on native, through the copying
 * context on Wasm.
 *
 * @param {any} pdfWriter - The writer.
 * @param {any} cpyCxt - The copying context of the source.
 * @param {number} pageNumber - The zero-based page index.
 * @private
 * @returns {void}
 */
function appendPageWithAnnotations(pdfWriter, cpyCxt, pageNumber) {
  const pageDictionary = cpyCxt
    .getSourceDocumentParser()
    .parsePageDictionary(pageNumber);

  if (!pageDictionary.exists(ANNOTATION_PREFIX)) {
    cpyCxt.appendPDFPageFromPDF(pageNumber);
    return;
  }
  // Wasm copies the annotations itself, having no writer events.
  if (!pdfWriter.getEvents) {
    cpyCxt._appendPageWithAnnotations(pageNumber);
    return;
  }
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

/**
 * Append PDF Page with annotations.
 *
 * @param {any} pdfWriter - The writer.
 * @param {string|any} sourcePDFPath - The source PDF: what the platform's
 *   copying context accepts.
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
    appendPageWithAnnotations(pdfWriter, cpyCxt, pageNumber);
  } finally {
    cpyCxt.end();
  }
}

/**
 * Append PDF Pages with annotations, all through one copying context, so a
 * source that can be read only once (a stream) works like a path.
 *
 * @param {any} pdfWriter - The writer.
 * @param {string|any} sourcePDFPath - The source PDF: what the platform's
 *   copying context accepts.
 * @param {Object} [options] - The options.
 * @param {number[][]} [options.specificRanges] - Zero-based inclusive
 *   [start, end] page ranges; all pages when omitted.
 * @private
 * @returns {void}
 * @throws {Error} If the source cannot be read or a page does not exist.
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
          appendPageWithAnnotations(pdfWriter, cpyCxt, i);
        }
      }
    } else {
      for (let i = 0; i < cpyCxtParser.getPagesCount(); ++i) {
        appendPageWithAnnotations(pdfWriter, cpyCxt, i);
      }
    }
  } finally {
    cpyCxt.end();
  }
}

/**
 * Resolves a text font size from `size`, its `fontSize` alias, or a fallback,
 * rejecting a size that is not a finite number greater than zero. Zero,
 * negative, and infinite sizes have
 * no usable meaning: they draw nothing readable and measure to nonsensical font
 * metrics, so they are reported as invalid input naming the option and the
 * value. Omitting both options, or passing `null` or `undefined`, selects the
 * fallback.
 * @param {Object} [options] - Options holding `size` or `fontSize`.
 * @param {number} [fallback] - Size used when neither option is given.
 * @returns {number} The resolved font size in PDF points.
 * @throws {RangeError} If the given size is not a finite number greater than
 *   zero.
 */
function resolveFontSize(options = {}, fallback) {
  const name = options.size == null ? "fontSize" : "size";
  const size = options[name];
  if (size == null) {
    return fallback;
  }
  if (!(size > 0) || size === Infinity) {
    throw new RangeError(
      `Text ${name} must be a number greater than zero, received ${size}`,
    );
  }
  return size;
}

/**
 * Forget the runs and the paragraph state of a text flow, as a new text box,
 * a table or a new page starts without them.
 * @param {Object} recipe - The Recipe.
 * @returns {void}
 */
function clearTextFlow(recipe) {
  recipe._previousTextObjects = [];
  recipe._flowLines = [];
  recipe._flowParagraph = "";
  recipe._flowWaits = false;
}

/**
 * The transformation from a page's upright Recipe frame (its media box, as
 * displayed, from the media box origin) to its user space, for a page with a
 * /Rotate: the `cm` drawing uses and the transform annotations get.
 * @private
 * @param {{rotate: number, width: number, height: number, mediaBox: number[]}} page
 *   The page metadata; width and height as displayed.
 * @returns {?number[]} The matrix [a, b, c, d, e, f], or null for an upright page.
 */
function pageRotationMatrix(page) {
  const { rotate, width, height, mediaBox } = page;
  const [x0, y0] = mediaBox;
  switch ((((rotate || 0) % 360) + 360) % 360) {
    case 90:
      return [0, 1, -1, 0, height + x0 + y0, y0 - x0];
    case 180:
      return [-1, 0, 0, -1, width + 2 * x0, height + 2 * y0];
    case 270:
      return [0, -1, 1, 0, x0 - y0, width + x0 + y0];
    default:
      return null;
  }
}

export {
  pageRotationMatrix,
  ANNOTATION_PREFIX,
  PAGE_CONTEXT_STATE,
  cloneOptions,
  resolveFontSize,
  trimBreakableEnd,
  clearTextFlow,
  appendPDFPageFromPDFWithAnnotations,
  appendPDFPagesFromPDFWithAnnotations,
};
