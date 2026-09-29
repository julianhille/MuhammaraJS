const {
  AnnotSubtype,
  AnnotIcon,
  AnnotFlag,
  Colorspace,
  Coordinate,
} = require("../recipe-constants");
const { cssColors } = require("../css-colors");

/**
 * Encodes annotation text as a PDF text string, so characters outside
 * PDFDocEncoding are written as UTF-16BE instead of raw UTF-8 bytes.
 * @private
 * @param {Object} writer - The PDF writer.
 * @param {string} [value] - The text to encode.
 * @returns {number[]} The encoded string bytes.
 */
function textString(writer, value) {
  var text = writer.createPDFTextString();
  text.fromString(String(value ?? ""));
  return text.toBytesArray();
}

/**
 * Formats an annotation's `/M` modification date, as Wasm does: no date
 * writes no `/M`, and text that is not a date is written as given, which the
 * PDF specification allows for `/M`. A date is written in local time with its
 * UTC offset.
 * @private
 * @param {Object} writer - The PDF writer.
 * @param {string|number|Date} [value] - The date.
 * @returns {string|undefined} The `/M` text, or undefined for no `/M`.
 */
function annotationDate(writer, value) {
  if (value === undefined || value === null || value === "") return undefined;
  var date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value);
  return writer.createPDFDate(date).toString();
}

/**
 * Create a comment annotation: a Text annotation with the Comment icon. It is
 * written when the PDF ends.
 * @name comment
 * @function
 * @memberof Recipe#
 * @param {string} [text=''] - The text content
 * @param {number|"center"} x - The coordinate x
 * @param {number|"center"} y - The top coordinate y; (x, y) is the top-left
 *   corner, as for `annot()`.
 * @param {Object} [options] - The options
 * @param {string} [options.title] - The title.
 * @param {string} [options.date] - The date.
 * @param {boolean} [options.open=false] - Open the annotation by default?
 * @param {boolean} [options.richText] - Display with rich text format, text will be transformed automatically, or you may pass in your own rich text starts with "<?xml..."
 * @param {Array} [options.replies] - Array of annotation replies, each with text and optional title, date, subject, richText, and flag.
 * @param {Recipe.AnnotFlag} [options.flag] - The flag property, one of the `Recipe.AnnotFlag` values.
 * @param {string|number[]} [options.color] - The annotation color, as for
 *   `annot()`.
 * @param {number} [options.width] - The rectangle width, as for `annot()`.
 * @param {number} [options.height] - The rectangle height; as for `annot()`,
 *   (x, y) is the top-left corner and the rectangle extends down from it.
 *   The other `annot()` options, such as `border`, `opacity`, and
 *   `quadPoints`, apply too; `contents` is used when `text` is empty.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If `options.color` is not a known color, or a
 *   position, size, opacity, border, or `quadPoints` value is invalid.
 */
exports.comment = function comment(text = "", x, y, options = {}) {
  this._validateAnnot(options);
  validateAnnotationPosition(x, y, options);
  this.annotationsToWrite.push({
    subtype: AnnotSubtype.TEXT,
    pageNumber: this.pageNumber,
    args: {
      text: text || options.contents,
      x,
      y,
      width: options.width,
      height: options.height,
      options: Object.assign({ icon: AnnotIcon.COMMENT }, options),
    },
    replies: options.replies,
  });
  return this;
};

/**
 * Add a clickable URL link to the current page.
 * @name link
 * @function
 * @memberof Recipe#
 * @param {string} url - The URL to open.
 * @param {number|"center"} x - The top-left x coordinate.
 * @param {number|"center"} y - The top-left y coordinate.
 * @param {number} width - The link width.
 * @param {number} height - The link height.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If no page is active, `url` is not a string, or the
 *   rectangle is not finite.
 */
exports.link = function link(url, x, y, width, height) {
  const { nx, ny } = this._calibrateCoordinate(x, y, 0, -height);
  return linkPdf(this, url, nx, ny, width, height);
};

/**
 * Attach a URL link at PDF coordinates, pausing the page content context
 * while the writer adds the annotation.
 * @private
 * @param {Recipe} recipe - The recipe with an active page.
 * @param {string} url - The URL to open.
 * @param {number} left - The left edge in PDF points.
 * @param {number} bottom - The bottom edge in PDF points.
 * @param {number} width - The link width.
 * @param {number} height - The link height.
 * @returns {Recipe} The recipe instance.
 * @throws {Error} If no page is active or the link cannot be attached.
 * @throws {TypeError} If `url` is not a string or the rectangle is not finite.
 */
function linkPdf(recipe, url, left, bottom, width, height) {
  recipe.pauseContext();
  try {
    // Reject what cannot form a PDF rectangle before writing, as Wasm does.
    if (
      typeof url !== "string" ||
      ![left, bottom, width, height, left + width, bottom + height].every(
        Number.isFinite,
      )
    )
      throw new TypeError("URL link requires a URL and valid PDF rectangle");
    recipe.writer.attachURLLinktoCurrentPage(
      url,
      left,
      bottom,
      left + width,
      bottom + height,
    );
  } finally {
    recipe.resumeContext();
  }
  return recipe;
}

Object.defineProperty(exports, "linkPdf", { value: linkPdf });

/**
 * Create an annotation. It is written when the PDF ends.
 * @name annot
 * @function
 * @memberof Recipe#
 * @todo support for rich text RC
 * @param {number|"center"} x - The left edge of the annotation rectangle.
 * @param {number|"center"} y - The top edge of the annotation rectangle. Like
 *   `rectangle()` and `link()`, (x, y) is the rectangle's top-left corner, and
 *   the rectangle extends `options.height` down from it.
 * @param {Recipe.AnnotSubtype} subtype - The annotation subtype, one of the
 *   `Recipe.AnnotSubtype` values.
 * @param {Object} [options] - The options
 * @param {string} [options.text=''] - The annotation content.
 * @param {string} [options.contents] - The content when `text` is empty.
 * @param {string} [options.title] - The title.
 * @param {boolean} [options.open=false] - Open the annotation. Annotation will be closed by default. Specific to text annotations; subtype='Text'
 * @param {boolean} [options.richText] - Rich text
 * @param {Recipe.AnnotFlag} [options.flag] - The flag property, one of the `Recipe.AnnotFlag` values.
 * @param {Recipe.AnnotIcon} [options.icon] - The icon of a Text annotation, one
 *   of the `Recipe.AnnotIcon` values. Viewers show 'Note' when it is omitted.
 * @param {string} [options.name] - The `/Name` icon when `icon` is omitted.
 * @param {number} [options.flags] - Flag bits when `flag` is omitted.
 * @param {number} [options.width] - Width; a finite number of at least zero.
 * @param {number} [options.height] - Height; a finite number of at least zero.
 * @param {string} [options.date] - Date of annotation
 * @param {string} [options.subject] - The subject.
 * @param {Array} [options.replies] - Array of annotation replies. A reply
 *   keeps its own `open`, `icon`, `name`, and `opacity`, and otherwise
 *   inherits the metadata of the annotation it answers.
 * @param {number|Object} [options.border] - The border width, or an object
 *   with its `width` and `dash` pattern. A negative width writes no border;
 *   text markup annotations default to 0.
 * @param {number} [options.borderWidth] - The border width; overrides
 *   `border.width`.
 * @param {number[]} [options.borderDash] - The border dash pattern; overrides
 *   `border.dash`.
 * @param {number[]} [options.quadPoints] - Quad points, eight numbers per
 *   quadrilateral, written as given instead of covering the rectangle.
 * @param {string|number[]} [options.color] - The annotation color: a `#rrggbb`
 *   HexColor, a `%r,g,b` PercentColor, a DecimalColor array, a color registered
 *   with `chroma()`, or a CSS color name in any case.
 * @param {number} [options.opacity=1] - Annotation opacity from 0 (transparent) to 1 (opaque).
 * @param {boolean} [options.followOriginalPageRotation=false] - Preserve the original page rotation when positioning the annotation.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If `options.color` is not a known color, or a
 *   position, size, opacity, border, or `quadPoints` value is invalid.
 */
exports.annot = function annot(
  x,
  y,
  subtype,
  options = { text: "", width: 0, height: 0 },
) {
  const { width, height, replies } = options;
  const text = options.text || options.contents;
  this._validateAnnot(options);
  validateAnnotationPosition(x, y, options);
  this.annotationsToWrite.push({
    subtype,
    args: { text, x, y, width, height, options },
    pageNumber: this.pageNumber,
    replies,
  });
  return this;
};

// TODO: allow non-markup annots to be associated with markup annotations
// Link, Popup, Movie, Widget, Screen, PrinterMark, TrapNet, Watermark, 3D
/**
 * Placeholder for associating non-markup annotations with markup ones; it
 * currently does nothing.
 * @private
 * @returns {void}
 */
exports._attachNonMarkupAnnot = function _attachNonMarkupAnnot() {};

/**
 * Write one queued annotation, or a reply to one, as an indirect object and
 * register it on its page.
 * @private
 * @param {Recipe.AnnotSubtype} subtype - The annotation subtype.
 * @param {Object} [args] - The queued x, y, width, height, text, options, and
 *   for a reply the reply entry.
 * @param {number} pageNumber - The one-based page number.
 * @param {number} [ref] - The object ID of the annotation a reply answers.
 * @returns {number} The object ID of the written annotation.
 * @throws {TypeError} If the page number is unknown.
 */
exports._annot = function _annot(subtype, args = {}, pageNumber, ref) {
  // Write known subtypes with their PDF casing; the markup check below
  // already matches them case-insensitively.
  subtype =
    Object.values(AnnotSubtype).find(
      (known) => known.toLowerCase() === String(subtype).toLowerCase(),
    ) || subtype;
  const { x, y, width, height, options, reply } = args;
  let { text } = args;
  this._startDictionary(pageNumber);
  const { rotate } = this.metadata[pageNumber];
  // (x, y) is the top-left corner, like rectangle() and link(): offset by the
  // height to reach the bottom-left corner that PDF rectangles start from.
  let { nx, ny } = this._calibrateCoordinateForAnnots(
    x,
    y,
    0,
    -(height || 0),
    pageNumber,
  );

  // A missing size is zero, as in Wasm; undefined would write nan on rotated
  // pages.
  const rectWidth = width || 0;
  const rectHeight = height || 0;
  let nWidth = rectWidth;
  let nHeight = rectHeight;

  if (!options.followOriginalPageRotation) {
    switch (rotate) {
      case 90:
        nWidth = rectHeight;
        nHeight = rectWidth;
        nx = nx - nWidth;
        break;
      case 180:
        nx = nx - nWidth;
        ny = ny - nHeight;
        break;
      case 270:
        nWidth = rectHeight;
        nHeight = rectWidth;
        ny = ny - nHeight;
        break;
      default:
    }
  }

  const params = Object.assign(
    {
      title: "",
      subject: "",
      date: "",
      open: false,
      flag: "", // 'readonly'
    },
    options,
  );

  const ex = nWidth ? nWidth : 0;
  const ey = nHeight ? nHeight : 0;
  const position = [nx, ny, nx + ex, ny + ey];

  params.flag = options.flag ?? options.flags ?? "";
  if (reply && ref) {
    text = reply.text || reply.contents;
    params.title = reply.title || params.title;
    params.date = reply.date || params.date;
    params.subject = reply.subject || params.subject;
    params.richText = Boolean(reply.richText);
    // Like Wasm, a reply keeps its own open state and icon when it has one.
    params.flag = reply.flag || reply.flags || params.flag;
    params.open = reply.open ?? params.open;
    params.icon = reply.icon ?? params.icon;
    params.name = reply.name ?? params.name;
  }

  this.dictionaryContext
    .writeKey("Type")
    .writeNameValue("Annot")
    .writeKey("Subtype")
    .writeNameValue(subtype)
    .writeKey("L")
    .writeBooleanValue(true)
    .writeKey("Rect")
    .writeRectangleValue(position)
    .writeKey("Subj")
    .writeLiteralStringValue(textString(this.writer, params.subject))
    .writeKey("T")
    .writeLiteralStringValue(textString(this.writer, params.title));
  const date = annotationDate(this.writer, params.date);
  if (date !== undefined) {
    this.dictionaryContext
      .writeKey("M")
      .writeLiteralStringValue(textString(this.writer, date));
  }
  this.dictionaryContext
    .writeKey("Open")
    .writeBooleanValue(params.open)
    .writeKey("F")
    .writeNumberValue(getFlagBitNumberByName(params.flag));

  var opacity = (reply || options).opacity ?? 1;
  if (opacity !== 1) {
    this.dictionaryContext.writeKey("CA").writeNumberValue(opacity);
  }

  /**
   * Rich Text Strings
   * 12.7.3.4
   */
  if (text && params.richText) {
    const richText =
      text.substring(0, 5) !== "<?xml" ? contentToRC(text) : text;
    const richTextContent = richText;
    this.dictionaryContext
      .writeKey("RC")
      .writeLiteralStringValue(textString(this.writer, richTextContent));
  } else if (text) {
    const textContent = text;
    this.dictionaryContext
      .writeKey("Contents")
      .writeLiteralStringValue(textString(this.writer, textContent));
  }

  if (reply && ref) {
    this.dictionaryContext
      .writeKey("IRT")
      .writeObjectReferenceValue(ref)
      .writeKey("RT")
      .writeNameValue("R");
  }

  let { color } = options;
  const markup = Boolean(this._getTextMarkupAnnotationSubtype(subtype));
  const border = annotationBorder(options, markup);
  // Custom quad points are written as given; markup annotations otherwise
  // cover their rectangle, in whole numbers.
  const quadPoints =
    options.quadPoints ||
    (markup
      ? [
          nx,
          ny + nHeight,
          nx + nWidth,
          ny + nHeight,
          nx,
          ny,
          nx + nWidth,
          ny,
        ].map(Math.round)
      : []);

  if (quadPoints.length) {
    this.dictionaryContext.writeKey("QuadPoints");
    this.objectsContext.startArray();
    quadPoints.forEach((point) => this.objectsContext.writeNumber(point));
    this.objectsContext.endArray().endLine();
  }

  if (markup && !color) {
    switch (subtype) {
      case AnnotSubtype.HIGHLIGHT:
        color = [255, 255, 0];
        break;
      case AnnotSubtype.STRIKE_OUT:
        color = [255, 0, 0];
        break;
      default:
        color = [0, 255, 0];
        break;
    }
  }

  // A negative width writes no /Border, as in Wasm.
  if (border.width !== undefined && border.width >= 0) {
    this.dictionaryContext.writeKey("Border");
    this.objectsContext
      .startArray()
      .writeNumber(0)
      .writeNumber(0)
      .writeNumber(border.width);
    if (border.dash.length) {
      this.objectsContext.startArray();
      border.dash.forEach((value) => this.objectsContext.writeNumber(value));
      this.objectsContext.endArray();
    }
    this.objectsContext.endArray().endLine();
  }

  if (color) {
    this.dictionaryContext.writeKey("C");
    this.objectsContext.startArray();
    annotationColorComponents(this, color).forEach((component) =>
      this.objectsContext.writeNumber(component),
    );
    this.objectsContext.endArray().endLine();
  }

  /* Display Icon */
  const icon = params.icon || params.name;
  if (icon) {
    this.dictionaryContext.writeKey("Name").writeNameValue(icon);
  }
  return this._endDictionary(pageNumber);
};

/**
 * Write every queued annotation and its replies, then add them to the Annots
 * arrays of their pages.
 * @private
 * @returns {void}
 * @throws {Error} If an annotation or page cannot be written.
 */
exports._writeAnnotations = function _writeAnnotations() {
  this.annotationsToWrite.forEach((annot) => {
    const ref = this._annot(annot.subtype, annot.args, annot.pageNumber);

    if (annot.replies) {
      annot.replies.forEach((reply) => {
        this._annot(
          annot.subtype,
          { ...annot.args, reply },
          annot.pageNumber,
          ref,
        );
      });
    }
  });
  this.annotations.forEach((pageAnnots, index) => {
    this._writeAnnotation(index);
  });
};

/**
 * Rewrite one page dictionary so its Annots array keeps the existing
 * annotations and adds the ones written for it.
 * @private
 * @param {number} pageIndex - The zero-based page index.
 * @returns {void}
 * @throws {Error} If the page cannot be read or rewritten.
 */
exports._writeAnnotation = function _writeAnnotation(pageIndex) {
  const pdfWriter = this.writer;
  const copyingContext = pdfWriter.createPDFCopyingContextForModifiedFile();
  const pageID = copyingContext
    .getSourceDocumentParser()
    .getPageObjectID(pageIndex);
  const pageObject = copyingContext
    .getSourceDocumentParser()
    .parsePage(pageIndex)
    .getDictionary()
    .toJSObject();
  const objectsContext = pdfWriter.getObjectsContext();

  objectsContext.startModifiedIndirectObject(pageID);
  const modifiedPageObject = pdfWriter.getObjectsContext().startDictionary();
  Object.getOwnPropertyNames(pageObject).forEach((element) => {
    const ignore = ["Annots"];
    if (!ignore.includes(element)) {
      modifiedPageObject.writeKey(element);
      copyingContext.copyDirectObjectAsIs(pageObject[element]);
    }
  });

  modifiedPageObject.writeKey("Annots");
  objectsContext.startArray();
  if (pageObject["Annots"] && pageObject["Annots"].toJSArray) {
    pageObject["Annots"].toJSArray().forEach((annot) => {
      objectsContext.writeIndirectObjectReference(
        annot.getObjectID(),
        annot.getVersion(),
      );
    });
  }
  this.annotations[pageIndex].forEach((item) => {
    objectsContext.writeIndirectObjectReference(item);
  });

  objectsContext
    .endArray()
    .endLine()
    .endDictionary(modifiedPageObject)
    .endIndirectObject();
  copyingContext.end();
};

/**
 * Start a new indirect object holding a dictionary for an annotation.
 * @private
 * @returns {void}
 */
exports._startDictionary = function _startDictionary() {
  this.objectsContext = this.writer.getObjectsContext();
  this.dictionaryObject = this.objectsContext.startNewIndirectObject();
  this.dictionaryContext = this.objectsContext.startDictionary();
};

/**
 * End the annotation dictionary started by _startDictionary() and record its
 * object ID for the page.
 * @private
 * @param {number} pageNumber - The one-based page number.
 * @returns {number} The object ID of the annotation.
 */
exports._endDictionary = function _endDictionary(pageNumber) {
  this.objectsContext.endDictionary(this.dictionaryContext).endIndirectObject();
  const pageIndex = pageNumber - 1;
  this.annotations[pageIndex] = this.annotations[pageIndex] || [];
  this.annotations[pageIndex].push(this.dictionaryObject);

  return this.dictionaryObject;
};

/**
 * Match a text markup annotation subtype case-insensitively.
 * @private
 * @param {string} [subtype] - The subtype to look up.
 * @returns {string|undefined} The matching `Recipe.AnnotSubtype` markup
 *   value, or undefined when the subtype is not a text markup annotation.
 */
exports._getTextMarkupAnnotationSubtype =
  function _getTextMarkupAnnotationSubtype(subtype = "") {
    const matchedSubtype = this.textMarkupAnnotations.find((item) => {
      return item.toLowerCase() == subtype.toLowerCase();
    });
    return matchedSubtype;
  };

/**
 * Rejects an unknown annotation flag when the annotation is queued, before the
 * page is written.
 * @private
 * @param {object} options - Annotation options, with optional `replies`.
 * @returns {void}
 * @throws {Error} If a flag is neither a bit mask nor an AnnotFlag value.
 */
function validateAnnotationFlags(options) {
  if (!options) return;
  getFlagBitNumberByName(options.flag ?? options.flags);
  (options.replies || []).forEach(validateAnnotationFlags);
}

/**
 * Resolve the border width and dash an annotation writes, as Wasm does: a
 * number `border` is the width, an object `border` gives `width` and `dash`,
 * and `borderWidth` and `borderDash` override the object.
 * @private
 * @param {Object} options - Annotation options.
 * @param {boolean} markup - Whether the subtype is a text markup annotation,
 *   whose border defaults to zero.
 * @returns {{width: (number|undefined), dash: Array}} The border width, or
 *   undefined for no `/Border` entry, and the dash array.
 */
function annotationBorder(options, markup) {
  var border = options.border;
  if (typeof border === "number")
    return { width: border, dash: options.borderDash ?? [] };
  var object = border && typeof border === "object" ? border : {};
  return {
    width: options.borderWidth ?? object.width ?? (markup ? 0 : undefined),
    dash: options.borderDash ?? object.dash ?? [],
  };
}

/**
 * Rejects annotation values that cannot be written as a valid PDF
 * annotation, as Wasm does: `width` and `height` must be finite numbers of at
 * least zero, `opacity` a finite number from 0 to 1 (also on replies), the
 * border width a finite number, `borderDash` an array of finite numbers, and
 * `quadPoints` an array of finite numbers, eight per quadrilateral. A missing
 * size is zero.
 * @private
 * @param {Object} [options] - Annotation options, with optional `replies`.
 * @returns {void}
 * @throws {TypeError} If a value is invalid.
 */
function validateAnnotationValues(options) {
  if (!options) return;
  var invalid = function () {
    return new TypeError("Invalid annotation options");
  };
  var finite = function (value) {
    return typeof value === "number" && Number.isFinite(value);
  };
  [options.width, options.height].forEach(function (size) {
    if (size !== undefined && size !== null && !(finite(size) && size >= 0))
      throw invalid();
  });
  var border = annotationBorder(options, false);
  if (border.width !== undefined && !finite(border.width)) throw invalid();
  if (!Array.isArray(border.dash) || !border.dash.every(finite))
    throw invalid();
  var quadPoints = options.quadPoints;
  if (
    quadPoints !== undefined &&
    quadPoints !== null &&
    (!Array.isArray(quadPoints) ||
      quadPoints.length % 8 !== 0 ||
      !quadPoints.every(finite))
  )
    throw invalid();
  [options].concat(options.replies || []).forEach(function (source) {
    var opacity = (source || {}).opacity ?? 1;
    if (!(finite(opacity) && opacity >= 0 && opacity <= 1)) throw invalid();
  });
}

/**
 * Rejects an annotation position that cannot form a finite PDF rectangle, as
 * Wasm does: `x` and `y` must be finite numbers or `Recipe.Coordinate.CENTER`,
 * and the far corner must stay finite. A numeric string would otherwise be
 * concatenated into the rectangle.
 * @private
 * @param {number|"center"} x - The left coordinate.
 * @param {number|"center"} y - The top coordinate.
 * @param {Object} [options] - Annotation options with `width` and `height`.
 * @returns {void}
 * @throws {TypeError} If the position is invalid.
 */
function validateAnnotationPosition(x, y, options) {
  var sizes = [(options || {}).width || 0, (options || {}).height || 0];
  [x, y].forEach(function (value, index) {
    if (value === Coordinate.CENTER) return;
    if (!Number.isFinite(value) || !Number.isFinite(value + sizes[index]))
      throw new TypeError("Invalid annotation options");
  });
}

/**
 * Check annotation options that would otherwise only fail when the
 * annotation is written, so an invalid one is never queued.
 * @private
 * @param {Object} [options] - Annotation options, with optional `replies`.
 * @returns {void}
 * @throws {Error} If a flag is neither a bit mask nor an AnnotFlag value.
 * @throws {TypeError} If `options.color` is not a known color, or a size,
 *   opacity, border, or `quadPoints` value is invalid.
 */
exports._validateAnnot = function _validateAnnot(options) {
  validateAnnotationFlags(options);
  validateAnnotationValues(options);
  annotationColorComponents(this, (options || {}).color);
};

/**
 * Resolve an annotation color to PDF color components, throwing instead of
 * falling back to a default color so a typo never writes a wrong color.
 * @private
 * @param {Recipe} recipe - The Recipe with its registered colors.
 * @param {string|number[]} [color] - A `#rrggbb` HexColor, a `%r,g,b`
 *   PercentColor, a gray, RGB, or CMYK DecimalColor array with values from 0 to
 *   255, an RGB color name registered with `chroma()`, or a CSS color name in
 *   any case.
 * @returns {number[]} One gray, three RGB, or four CMYK components from 0 to
 *   1; empty when the color is omitted or empty.
 * @throws {TypeError} If an array does not hold one, three, or four numbers
 *   from 0 to 255, or any other value is not a known color.
 */
function annotationColorComponents(recipe, color) {
  if (color === undefined || color === null || color === "") return [];
  if (Array.isArray(color)) {
    if (
      ![1, 3, 4].includes(color.length) ||
      !color.every((part) => Number.isFinite(part) && part >= 0 && part <= 255)
    )
      throw new TypeError(
        "Annotation colors need one, three, or four numbers from 0 to 255",
      );
    return color.map((part) => part / 255);
  }
  var rgb = annotationColorCode(recipe, color);
  if (rgb === undefined)
    throw new TypeError(`Unknown annotation color (${String(color)})`);
  return [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255].map(
    (part) => part / 255,
  );
}

/**
 * Resolve an annotation color string to 0xRRGGBB. Registered Recipe colors
 * win over CSS names, so `chroma()` can redefine one.
 * @private
 * @param {Recipe} recipe - The Recipe with its registered colors.
 * @param {*} color - The color value.
 * @returns {number|undefined} The color, or undefined when it is unknown.
 */
function annotationColorCode(recipe, color) {
  if (typeof color !== "string") return undefined;
  var registered = (recipe.knownColors || {})[Colorspace.RGB] || {};
  if (Object.hasOwn(registered, color)) {
    color = String(registered[color]);
    if (/^[0-9a-f]{6}$/i.test(color)) color = `#${color}`;
  } else if (Object.hasOwn(cssColors, color.toLowerCase())) {
    return cssColors[color.toLowerCase()];
  }
  if (/^#[0-9a-f]{6}$/i.test(color)) return parseInt(color.slice(1), 16);
  if (color.startsWith("%")) {
    var parts = color.slice(1).split(",");
    if (
      parts.length === 3 &&
      parts.every(
        (part) =>
          part.trim() !== "" && Number(part) >= 0 && Number(part) <= 100,
      )
    )
      return parts.reduce(
        (value, part) => (value << 8) | Math.round(Number(part) * 2.55),
        0,
      );
  }
  return undefined;
}

/**
 * Get Flag Bit by Name
 * @description 12.5.3 Annotation Flags
 * @private
 * @param {Recipe.AnnotFlag|number|string} [name] - A `Recipe.AnnotFlag` value,
 *   matched case-insensitively, or a non-negative integer bit mask.
 * @returns {number} The flag bits; 0 when the flag is omitted or empty.
 * @throws {Error} If `name` is neither a bit mask nor an AnnotFlag value.
 */
function getFlagBitNumberByName(name) {
  if (name === undefined || name === null || name === "") return 0;
  if (Number.isSafeInteger(name) && name >= 0) return name;
  switch (String(name).toLowerCase()) {
    case AnnotFlag.INVISIBLE:
      return 1;
    case AnnotFlag.HIDDEN:
      return 2;
    case AnnotFlag.PRINT:
      return 4;
    case AnnotFlag.NO_ZOOM:
      return 8;
    case AnnotFlag.NO_ROTATE:
      return 16;
    case AnnotFlag.NO_VIEW:
      return 32;
    case AnnotFlag.READ_ONLY:
      return 64;
    case AnnotFlag.LOCKED:
      return 128;
    case AnnotFlag.TOGGLE_NO_VIEW:
      return 256;
    // PDF 1.7
    case AnnotFlag.LOCKED_CONTENTS:
      return 512;
    default:
      throw new Error(`Unknown annotation flag (${name})`);
  }
}

/**
 * Text Strings to Rich Text Strings
 * @todo Fix display issue for ol/ul in richText
 * @param {string} content - The XHTML fragment to wrap.
 * @returns {string} The rich text XML document for the RC entry.
 * @private
 * @description Supports XHTML elements: '<p>' | '<span>' | '<b>' | '<i>'. Supports CSS2 styles: 'text-align' | 'vertical-align' | 'font-size' | 'font-style' | 'font-weight' | 'font-family' | 'font' | 'color' | 'text-decoration' | 'font-stretch'.
 */
function contentToRC(content) {
  content = content.replace("&nbsp;", " ");
  content = content.replace(/\r?\n|\r|\t/g, "");
  let richText =
    '<?xml version="1.0"?>' +
    "<body " +
    'xmlns="http://www.w3.org/1999/xhtml"' +
    // 'xmlns:xga=\"http://www.xfa.org/schema/xfa-data/1.0/\" ' +
    // 'xfa:contentType=\"text/html\" ' +
    // 'xfa:APIVersion=\"Acrobat:8.0.0\" ' +
    // 'xfa:spec=\"2.4\" ' +
    ">" +
    content +
    "</body>";
  richText = richText
    .replace(/<li>/g, "<p> • ")
    .replace(/<(\/)li>/g, "</p>")
    .replace(/<(\/)p>/g, "</p><br/>");
  return richText;
}
