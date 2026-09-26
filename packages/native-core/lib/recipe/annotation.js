const { AnnotSubtype, AnnotIcon } = require("../recipe-constants");

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
 * Create a comment annotation: a Text annotation with the Comment icon. It is
 * written when the PDF ends.
 * @name comment
 * @function
 * @memberof Recipe#
 * @param {string} [text=''] - The text content
 * @param {number|"center"} x - The coordinate x
 * @param {number|"center"} y - The coordinate y
 * @param {Object} [options] - The options
 * @param {string} [options.title] - The title.
 * @param {string} [options.date] - The date.
 * @param {boolean} [options.open=false] - Open the annotation by default?
 * @param {boolean} [options.richText] - Display with rich text format, text will be transformed automatically, or you may pass in your own rich text starts with "<?xml..."
 * @param {Array} [options.replies] - Array of annotation replies, each with text and optional title, date, subject, richText, and flag.
 * @param {Recipe.AnnotFlag} [options.flag] - The flag property, one of the `Recipe.AnnotFlag` values.
 * @returns {Recipe} The recipe instance.
 */
exports.comment = function comment(text = "", x, y, options = {}) {
  this.annotationsToWrite.push({
    subtype: AnnotSubtype.TEXT,
    pageNumber: this.pageNumber,
    args: {
      text,
      x,
      y,
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
 * @throws {TypeError} If no page is active.
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
 */
function linkPdf(recipe, url, left, bottom, width, height) {
  recipe.pauseContext();
  try {
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
 * @param {number|"center"} x - The coordinate x
 * @param {number|"center"} y - The coordinate y
 * @param {Recipe.AnnotSubtype} subtype - The annotation subtype, one of the
 *   `Recipe.AnnotSubtype` values.
 * @param {Object} [options] - The options
 * @param {string} [options.text=''] - The annotation content.
 * @param {string} [options.title] - The title.
 * @param {boolean} [options.open=false] - Open the annotation. Annotation will be closed by default. Specific to text annotations; subtype='Text'
 * @param {boolean} [options.richText] - Rich text
 * @param {Recipe.AnnotFlag} [options.flag] - The flag property, one of the `Recipe.AnnotFlag` values.
 * @param {Recipe.AnnotIcon} [options.icon] - The icon of a Text annotation, one
 *   of the `Recipe.AnnotIcon` values. Viewers show 'Note' when it is omitted.
 * @param {number} [options.width] - Width
 * @param {number} [options.height] - Height
 * @param {string} [options.date] - Date of annotation
 * @param {string} [options.subject] - The subject.
 * @param {Array} [options.replies] - Array of annotation replies
 * @param {number} [options.border] - The border width.
 * @param {string|number[]} [options.color] - The annotation color, as HexColor,
 *   PercentColor or DecimalColor.
 * @param {number} [options.opacity=1] - Annotation opacity from 0 (transparent) to 1 (opaque).
 * @param {boolean} [options.followOriginalPageRotation=false] - Preserve the original page rotation when positioning the annotation.
 * @returns {Recipe} The recipe instance.
 */
exports.annot = function annot(
  x,
  y,
  subtype,
  options = { text: "", width: 0, height: 0 },
) {
  const { text, width, height, replies } = options;
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
  let { nx, ny } = this._calibrateCoordinateForAnnots(x, y, 0, 0, pageNumber);

  let nWidth = width;
  let nHeight = height;

  if (!options.followOriginalPageRotation) {
    switch (rotate) {
      case 90:
        nWidth = height;
        nHeight = width;
        nx = nx - nWidth;
        break;
      case 180:
        nx = nx - nWidth;
        ny = ny - nHeight;
        break;
      case 270:
        nWidth = height;
        nHeight = width;
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

  if (reply && ref) {
    text = reply.text;
    params.title = reply.title || params.title;
    params.date = reply.date || params.date;
    params.subject = reply.subject || params.subject;
    params.richText = Boolean(reply.richText);
    params.flag = reply.flag || params.flag;
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
    .writeLiteralStringValue(textString(this.writer, params.title))
    .writeKey("M")
    .writeLiteralStringValue(
      this.writer.createPDFDate(new Date(params.date)).toString(),
    )
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

  let { border, color } = options;

  if (this._getTextMarkupAnnotationSubtype(subtype)) {
    this.dictionaryContext.writeKey("QuadPoints");
    const { _textHeight } = options;
    const annotHeight = height;
    const bx = nx;
    const by = ny + (_textHeight ? 0 : -annotHeight);
    const coordinates = [
      [bx, by + annotHeight],
      [bx + nWidth, by + annotHeight],
      [bx, by],
      [bx + nWidth, by],
    ];
    this.objectsContext.startArray();
    coordinates.forEach((coord) => {
      coord.forEach((point) => {
        this.objectsContext.writeNumber(Math.round(point));
      });
    });
    this.objectsContext.endArray().endLine();

    border = border || 0;
    if (!color) {
      switch (subtype) {
        case AnnotSubtype.HIGHLIGHT:
          color = [255, 255, 0];
          break;
        case AnnotSubtype.STRIKE_OUT:
          color = [255, 0, 0];
          break;
        case AnnotSubtype.UNDERLINE:
          color = [0, 255, 0];
          break;
        case AnnotSubtype.SQUIGGLY:
          color = [0, 255, 0];
          break;
        default:
          color = [0, 0, 0];
          break;
      }
    }
  }

  if (border != void 0) {
    this.dictionaryContext.writeKey("Border");
    this.objectsContext
      .startArray()
      .writeNumber(0)
      .writeNumber(0)
      .writeNumber(border)
      .endArray()
      .endLine();
  }

  if (color) {
    const rgb = this._colorNumberToRGB(this._transformColor(color));
    this.dictionaryContext.writeKey("C");
    this.objectsContext
      .startArray()
      .writeNumber(rgb.r / 255)
      .writeNumber(rgb.g / 255)
      .writeNumber(rgb.b / 255)
      .endArray()
      .endLine();
  }

  /* Display Icon */
  if (params.icon) {
    this.dictionaryContext.writeKey("Name").writeNameValue(params.icon);
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
 * Get Flag Bit by Name
 * @description 12.5.3 Annotation Flags
 * @private
 * @param {string} name
 */
function getFlagBitNumberByName(name) {
  switch (name.toLowerCase()) {
    case "invisible":
      return 1;
    case "hidden":
      return 2;
    case "print":
      return 4;
    case "nozoom":
      return 8;
    case "norotate":
      return 16;
    case "noview":
      return 32;
    case "readonly":
      return 64;
    case "locked":
      return 128;
    case "togglenoview":
      return 256;
    // 1.7+
    // case 'lockedcontents':
    //     return 512;
    default:
      return 0;
  }
}

/**
 * Text Strings to Rich Text Strings
 * @todo Fix display issue for ol/ul in richText
 * @param {string} content
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
