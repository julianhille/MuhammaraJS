/**
 * Create a comment annotation
 * @name comment
 * @function
 * @memberof Recipe
 * @param {string} text - The text content
 * @param {number} x - The coordinate x
 * @param {number} y - The coordinate y
 * @param {Object} [options] - The options
 * @param {string} [options.title] - The title.
 * @param {string} [options.date] - The date.
 * @param {boolean} [options.open=false] - Open the annotation by default?
 * @param {boolean} [options.richText] - Display with rich text format, text will be transformed automatically, or you may pass in your own rich text starts with "<?xml..."
 * @param {'invisible'|'hidden'|'print'|'nozoom'|'norotate'|'noview'|'readonly'|'locked'|'togglenoview'} [options.flag] - The flag property
 */
exports.comment = function comment(text = "", x, y, options = {}) {
  this.annotationsToWrite.push({
    subtype: "Text",
    pageNumber: this.pageNumber,
    args: { text, x, y, options: Object.assign({ icon: "Comment" }, options) },
  });
  return this;
};

/**
 * Create an annotation
 * @name annot
 * @function
 * @memberof Recipe
 * @todo support for rich text RC
 * @todo support for opacity CA
 * @param {number} x - The coordinate x
 * @param {number} y - The coordinate y
 * @param {string} subtype - The markup annotation type 'Text'|'Link'|'FreeText'|'Line'|'Square'|'Circle'|'Polygon'|'PolyLine'|'Highlight'|'Underline'|'Squiggly'|'StrikeOut'|'Caret'|'Stamp'|'Ink'|'Popup'|'FileAttachment'|'Sound'|'Movie'|'Screen'|'Widget'|'PrinterMark'|'TrapNet'|'Watermark'|'3D'|'Redact'|'Projection'|'RichMedia'
 * @param {Object} [options] - The options
 * @param {string} [options.title] - The title.
 * @param {boolean} [options.open=false] - Open the annotation. Annotation will be closed by default. Specific to text annotations; subtype='Text'
 * @param {boolean} [options.richText] - Rich text
 * @param {'invisible'|'hidden'|'print'|'nozoom'|'norotate'|'noview'|'readonly'|'locked'|'togglenoview'} [options.flag] - The flag property
 * @param {'Comment'|'Key'|'Note'|'Help'|'NewParagraph'|'Paragraph'|'Insert'} [options.icon='Note'] - The icon of annotation. Specific to text annotations. Default value: 'Note'
 * @param {number} [options.width] - Width
 * @param {number} [options.height] - Height
 * @param {string} [options.date] - Date of annotation
 * @param {string} [options.subject] - The subject.
 * @param {Array} [options.replies] - Array of annotation replies
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
exports._attachNonMarkupAnnot = function _attachNonMarkupAnnot() {};

exports._annot = function _annot(subtype, args = {}, pageNumber, ref) {
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
    .writeLiteralStringValue(params.subject)
    .writeKey("T")
    .writeLiteralStringValue(params.title || "")
    .writeKey("M")
    .writeLiteralStringValue(
      this.writer.createPDFDate(new Date(params.date)).toString(),
    )
    .writeKey("Open")
    .writeBooleanValue(params.open)
    .writeKey("F")
    .writeNumberValue(getFlagBitNumberByName(params.flag));

  /**
   * Rich Text Strings
   * 12.7.3.4
   */
  if (text && params.richText) {
    const richText =
      text.substring(0, 5) !== "<?xml" ? contentToRC(text) : params.richText;
    const richTextContent = richText;
    this.dictionaryContext
      .writeKey("RC")
      .writeLiteralStringValue(richTextContent);
  } else if (text) {
    const textContent = text;
    this.dictionaryContext
      .writeKey("Contents")
      .writeLiteralStringValue(textContent);
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
        case "Highlight":
          color = [255, 255, 0];
          break;
        case "StrikeOut":
          color = [255, 0, 0];
          break;
        case "Underline":
          color = [0, 255, 0];
          break;
        case "Squiggly":
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

exports._writeAnnotations = function _writeAnnotations() {
  this.annotationsToWrite.forEach((annot) => {
    const ref = this._annot(annot.subtype, annot.args, annot.pageNumber);

    if (annot.replies) {
      annot.replies.forEach((reply) => {
        annot.args.reply = reply;
        this._annot(annot.subtype, annot.args, annot.pageNumber, ref);
      });
    }
  });
  this.annotations.forEach((pageAnnots, index) => {
    this._writeAnnotation(index);
  });
};

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
      objectsContext.writeIndirectObjectReference(annot.getObjectID());
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
};

exports._startDictionary = function _startDictionary() {
  this.objectsContext = this.writer.getObjectsContext();
  this.dictionaryObject = this.objectsContext.startNewIndirectObject();
  this.dictionaryContext = this.objectsContext.startDictionary();
};

exports._endDictionary = function _endDictionary(pageNumber) {
  this.objectsContext.endDictionary(this.dictionaryContext).endIndirectObject();
  const pageIndex = pageNumber - 1;
  this.annotations[pageIndex] = this.annotations[pageIndex] || [];
  this.annotations[pageIndex].push(this.dictionaryObject);

  return this.dictionaryObject;
};

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
 * @description Support XHTML Elements:  '<p>' | '<span>' | '<b>' | '<i>'
 * @description Support CSS2 Style: 'text-align' | 'vertical-align' | 'font-size' | 'font-style' | 'font-weight' | 'font-family' | 'font' | 'color' | 'text-decoration' | 'font-stretch'
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
