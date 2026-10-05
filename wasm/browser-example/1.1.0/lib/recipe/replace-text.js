import { constants } from "../constants.js";
import * as contentStream from "../content-stream.js";
import { createPageFontLookup } from "../font-text.js";

var PdfOperator = contentStream.PdfOperator;
var TokenKind = contentStream.TokenKind;
var decodeName = contentStream.decodeName;
var forEachOperation = contentStream.forEachOperation;
var tokenKind = contentStream.tokenKind;

var ePDFObjectArray = constants.ePDFObjectArray;
var ePDFObjectIndirectObjectReference =
  constants.ePDFObjectIndirectObjectReference;

// PDF dictionary keys and names this module reads.
var PdfName = Object.freeze({
  RESOURCES: "Resources",
  CONTENTS: "Contents",
  LENGTH: "Length",
  FILTER: "Filter",
  DECODE_PARMS: "DecodeParms",
  XOBJECT: "XObject",
  SUBTYPE: "Subtype",
  FORM: "Form",
});

/**
 * Remove text-showing operators from a page content stream. `'` and `"`
 * keep their line advance and spacing effects as `T*`, `Tw`, and `Tc`.
 *
 * @private
 * @param {string} source Latin-1 content stream.
 * @returns {{content: string, xObjectNames: string[]}} Latin-1 content
 * stream without shown text, and the XObject names it paints with `Do`.
 */
function removeTextShowingOperators(source) {
  var result = "";
  var xObjectNames = [];
  var operandStart = 0;

  /**
   * Copy one operation, dropping shown text.
   *
   * @private
   * @param {{operator: string, operands: Array<{token: string}>, end:
   * number}} operation Content-stream operation.
   * @returns {void}
   */
  function removeOperation(operation) {
    var operator = operation.operator;
    var operands = [];
    for (var index = 0; index < operation.operands.length; index++) {
      operands.push(operation.operands[index].token);
    }
    if (
      operator === PdfOperator.PAINT_XOBJECT &&
      operands.length &&
      tokenKind(operands[0]) === TokenKind.NAME
    ) {
      xObjectNames.push(decodeName(operands[0]));
    }

    if (
      operator === PdfOperator.SHOW_TEXT ||
      operator === PdfOperator.SHOW_TEXT_ARRAY
    ) {
      result += " ";
    } else if (operator === PdfOperator.NEXT_LINE_SHOW_TEXT) {
      result += " T*";
    } else if (operator === PdfOperator.SPACING_NEXT_LINE_SHOW_TEXT) {
      // `aw ac string "`; a malformed one is skipped by viewers, so drop it.
      if (operands.length === 3)
        result += " " + operands[0] + " Tw " + operands[1] + " Tc T*";
      else result += " ";
    } else {
      result += source.slice(operandStart, operation.end);
    }
    operandStart = operation.end;
  }

  forEachOperation(source, removeOperation);
  return {
    content: result + source.slice(operandStart),
    xObjectNames: xObjectNames,
  };
}

/**
 * Replace the operands of `Tj` operators whose text, decoded through the
 * active font, equals `text`. Everything else is kept byte for byte.
 *
 * @private
 * @param {string} source Latin-1 content stream.
 * @param {string} text Text to replace.
 * @param {string} replacement Replacement text.
 * @param {function(string): object} fonts Font codec lookup by resource
 * name.
 * @returns {string} Latin-1 content stream.
 * @throws {Error} If a matched font has no glyph for a replacement
 * character.
 */
function replaceShownText(source, text, replacement, fonts) {
  var result = "";
  var copied = 0;
  var font = null;
  var fontStack = [];
  var encoded = new Map();

  /**
   * Track the font and rewrite one matching `Tj` operand.
   *
   * @private
   * @param {{operator: string, operands: Array<{token: string, start:
   * number, end: number}>}} operation Content-stream operation.
   * @returns {void}
   */
  function replaceOperation(operation) {
    var operator = operation.operator;
    var operands = operation.operands;
    if (operator === PdfOperator.SAVE_STATE) fontStack.push(font);
    if (operator === PdfOperator.RESTORE_STATE && fontStack.length) {
      font = fontStack.pop();
    }
    if (
      operator === PdfOperator.SET_FONT &&
      operands.length === 2 &&
      tokenKind(operands[0].token) === TokenKind.NAME
    ) {
      font = decodeName(operands[0].token);
    }
    var kind = operands.length === 1 ? tokenKind(operands[0].token) : null;
    if (
      operator !== PdfOperator.SHOW_TEXT ||
      (kind !== TokenKind.LITERAL_STRING && kind !== TokenKind.HEX_STRING)
    ) {
      return;
    }
    var operand = operands[0];
    var codec = fonts(font);
    var bytes = contentStream.stringBytes(operand.token);
    if (codec.decode(bytes) !== text) return;
    if (!encoded.has(codec)) {
      try {
        encoded.set(codec, codec.encode(replacement));
      } catch (error) {
        throw new Error(
          "replaceText cannot write the replacement: " + error.message,
        );
      }
    }
    result +=
      source.slice(copied, operand.start) +
      contentStream.stringToken(encoded.get(codec), kind);
    copied = operand.end;
  }

  forEachOperation(source, replaceOperation);
  return result + source.slice(copied);
}

/**
 * Encode a Latin-1 string as one byte per character.
 *
 * @param {string} value Latin-1 string.
 * @returns {Uint8Array} Bytes.
 */
function latin1Bytes(value) {
  var bytes = new Uint8Array(value.length);
  for (var index = 0; index < value.length; index++) {
    bytes[index] = value.charCodeAt(index);
  }
  return bytes;
}

/**
 * Resolve an object through an indirect reference.
 *
 * @param {object} parser Source document parser.
 * @param {object} object PDF object or indirect reference.
 * @returns {object} Resolved PDF object.
 */
function resolve(parser, object) {
  if (object && object.getType() === ePDFObjectIndirectObjectReference) {
    return parser.parseNewObject(
      object.toPDFIndirectObjectReference().getObjectID(),
    );
  }
  return object;
}

/**
 * Look up a dictionary entry and resolve it.
 *
 * @param {object} parser Source document parser.
 * @param {object} dictionary PDF dictionary.
 * @param {string} key Entry name.
 * @returns {object|null} Resolved PDF object, or null when missing.
 */
function lookup(parser, dictionary, key) {
  return dictionary && dictionary.exists(key)
    ? resolve(parser, dictionary.queryObject(key))
    : null;
}

/**
 * Collect the content stream object IDs of a page, in drawing order, and the
 * page's resources dictionary, including inherited resources.
 *
 * @param {object} parser Source document parser.
 * @param {number} pageIndex Zero-based page index.
 * @returns {{streamIds: number[], resources: object|null}} Page content.
 * @throws {Error} If `Contents` holds a direct stream.
 */
function pageContent(parser, pageIndex) {
  var page = parser.parsePage(pageIndex).getDictionary().toPDFDictionary();
  var resources = contentStream.inheritedResources(parser, constants, page);

  var contents = page.exists(PdfName.CONTENTS)
    ? page.queryObject(PdfName.CONTENTS)
    : null;
  var resolved = resolve(parser, contents);
  var entries = [];
  if (contents && resolved.getType() === ePDFObjectArray) {
    var array = resolved.toPDFArray();
    for (var index = 0; index < array.getLength(); index++) {
      entries.push(array.queryObject(index));
    }
  } else if (contents) {
    entries.push(contents);
  }

  return {
    resources: resources || null,
    streamIds: entries.map(function (entry) {
      if (entry.getType() !== ePDFObjectIndirectObjectReference) {
        throw new Error("removeText supports indirect page content streams");
      }
      return entry.toPDFIndirectObjectReference().getObjectID();
    }),
  };
}

/**
 * Read and decode one content stream as a Latin-1 string.
 *
 * @param {object} parser Source document parser.
 * @param {number} objectId Stream object ID.
 * @returns {string} Decoded stream bytes, one character per byte.
 */
function readContentStream(parser, objectId) {
  return contentStream.readStreamString(
    parser,
    parser.parseNewObject(objectId).toPDFStream(),
  );
}

/**
 * Overwrite a source stream object in place with new unfiltered content,
 * keeping every dictionary entry except the length and filters.
 *
 * @param {object} writer Modifying writer.
 * @param {object} copyingContext Copying context for the modified file.
 * @param {object} parser Source document parser.
 * @param {number} objectId Stream object ID.
 * @param {string} content Latin-1 stream content.
 */
function rewriteStream(writer, copyingContext, parser, objectId, content) {
  var source = parser
    .parseNewObject(objectId)
    .toPDFStream()
    .getDictionary()
    .toJSObject();
  var objectsContext = writer.getObjectsContext();
  objectsContext.startModifiedIndirectObject(objectId);
  var dictionary = objectsContext.startDictionary();

  Object.keys(source).forEach(function (key) {
    if (
      key === PdfName.LENGTH ||
      key === PdfName.FILTER ||
      key === PdfName.DECODE_PARMS
    )
      return;
    dictionary.writeKey(key);
    copyingContext.copyDirectObjectAsIs(source[key]);
  });

  var stream = objectsContext.startUnfilteredPDFStream(dictionary);
  stream.getWriteStream().write(latin1Bytes(content));
  objectsContext.endPDFStream(stream).endIndirectObject();
}

/**
 * Collect the Form XObjects a content stream paints, following nested forms.
 *
 * @param {object} parser Source document parser.
 * @param {string[]} names XObject names used with `Do`.
 * @param {object|null} resources Resources dictionary for those names.
 * @param {Map<number, string|null>} forms Collected form IDs and stripped
 * content, or null when a form shows no text.
 */
function collectForms(parser, names, resources, forms) {
  var xObjects = lookup(parser, resources, PdfName.XOBJECT)?.toPDFDictionary();
  names.forEach(function (name) {
    var reference =
      xObjects && xObjects.exists(name) && xObjects.queryObject(name);
    if (
      !reference ||
      reference.getType() !== ePDFObjectIndirectObjectReference
    ) {
      return;
    }
    var objectId = reference.toPDFIndirectObjectReference().getObjectID();
    if (forms.has(objectId)) return;

    var dictionary = parser
      .parseNewObject(objectId)
      .toPDFStream()
      ?.getDictionary();
    var subtype = dictionary && lookup(parser, dictionary, PdfName.SUBTYPE);
    if (!subtype || subtype.toPDFName()?.value !== PdfName.FORM) return;

    var source = readContentStream(parser, objectId);
    var stripped = removeTextShowingOperators(source);
    forms.set(objectId, stripped.content === source ? null : stripped.content);
    collectForms(
      parser,
      stripped.xObjectNames,
      lookup(parser, dictionary, PdfName.RESOURCES)?.toPDFDictionary() ||
        resources,
      forms,
    );
  });
}

/**
 * Creates literal page-content text replacement and removal methods.
 * @returns {object} Methods mixed into Recipe.prototype.
 */
export function createReplaceTextMethods() {
  return {
    /**
     * Replaces text shown with `Tj` in a page's single content stream. Each
     * operand is decoded through the font selected by `Tf` (its `/ToUnicode`
     * CMap, then its `/Encoding` and `/Differences`), and a match is compared
     * with `text`. The replacement is encoded through the same font and
     * written back as a literal or hex string, like the original operand.
     * Only whole `Tj` operands match; `TJ`, `'`, and `"` operands and text
     * split across operators are left unchanged. No match leaves the page
     * unchanged.
     *
     * The replacement can only use glyphs the font already has. Embedded
     * subset fonts usually carry just the glyphs of their original text.
     *
     * @name replaceText
     * @function
     * @memberof Recipe#
     * @param {string} text Text to replace.
     * @param {string} replacement Replacement text.
     * @param {number} pageNumber One-based page number.
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If text or replacement is not a string, or if the
     * page number is not a positive integer.
     * @throws {RangeError} If the source document has no such page.
     * @throws {Error} If the page does not have one indirect content stream, or
     * the matched font cannot be read, has a malformed `/Widths` array, or has
     * no glyph for a replacement character.
     */
    replaceText: function (text, replacement, pageNumber) {
      if (typeof text !== "string" || typeof replacement !== "string") {
        throw new TypeError("replaceText expects text and replacement strings");
      }
      if (!Number.isInteger(pageNumber) || pageNumber < 1) {
        throw new TypeError(
          "replaceText expects a positive integer page number",
        );
      }
      if (typeof this.writer?.getModifiedFileParser !== "function") {
        throw new RangeError(
          "replaceText page " + pageNumber + " does not exist",
        );
      }

      var parser = this.writer.getModifiedFileParser();
      var contentsObjectId;
      var source;
      try {
        if (pageNumber > parser.getPagesCount()) {
          throw new RangeError(
            "replaceText page " + pageNumber + " does not exist",
          );
        }
        var page = parser
          .parsePage(pageNumber - 1)
          .getDictionary()
          .toPDFDictionary();
        var contents = page.exists(PdfName.CONTENTS)
          ? page.queryObject(PdfName.CONTENTS)
          : null;
        var reference = contents?.toPDFIndirectObjectReference();
        if (!reference) {
          throw new Error("replaceText supports pages with one content stream");
        }
        contentsObjectId = reference.getObjectID();
        source = readContentStream(parser, contentsObjectId);
        var replaced = replaceShownText(
          source,
          text,
          replacement,
          createPageFontLookup(parser, constants, pageNumber - 1),
        );
      } finally {
        parser.end();
      }

      if (replaced === source) return this;

      var objectsContext = this.writer.getObjectsContext();
      var replacementObjectId = objectsContext.startNewIndirectObject();
      var replacementStream = objectsContext.startUnfilteredPDFStream();
      replacementStream.getWriteStream().write(latin1Bytes(replaced));
      objectsContext.endPDFStream(replacementStream).endIndirectObject();
      this.writer.replaceObject(
        pageNumber - 1,
        contentsObjectId,
        replacementObjectId,
      );
      this._modifiedSourcePages.add(pageNumber);
      return this;
    },
    /**
     * Removes all shown text from a page, for example before placing a fresh
     * OCR text layer. Text-showing operators (`Tj`, `TJ`, `'`, `"`) are
     * dropped; graphics, images, and text state are kept. Annotation
     * appearances are not changed.
     *
     * The page's source content streams are rewritten in place, so a stream
     * shared with another page loses its text there too. Content added with
     * `editPage()` in the same Recipe is kept.
     *
     * @name removeText
     * @function
     * @memberof Recipe#
     * @param {number} pageNumber One-based page number.
     * @param {RemoveTextOptions} [options] Removal options.
     * @param {boolean} [options.forms=false] Also remove text from the Form
     * XObjects the page paints, including nested forms. Other pages that
     * paint the same form lose that text too.
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If the page number is not a positive integer, or
     * the options are not an object.
     * @throws {RangeError} If the source document has no such page.
     * @throws {Error} If the page's `Contents` holds a direct stream.
     */
    removeText: function (pageNumber, options) {
      if (!Number.isInteger(pageNumber) || pageNumber < 1) {
        throw new TypeError(
          "removeText expects a positive integer page number",
        );
      }
      if (
        options !== undefined &&
        (options === null || typeof options !== "object")
      ) {
        throw new TypeError("removeText expects an options object");
      }
      if (
        typeof this.writer?.createPDFCopyingContextForModifiedFile !==
        "function"
      ) {
        throw new RangeError(
          "removeText page " + pageNumber + " does not exist",
        );
      }

      var recipe = this;
      var writer = this.writer;
      var copyingContext = writer.createPDFCopyingContextForModifiedFile();
      try {
        var parser = copyingContext.getSourceDocumentParser();
        if (pageNumber > parser.getPagesCount()) {
          throw new RangeError(
            "removeText page " + pageNumber + " does not exist",
          );
        }
        var page = pageContent(parser, pageNumber - 1);
        var source = page.streamIds
          .map(function (objectId) {
            return readContentStream(parser, objectId);
          })
          .join("\n");
        var stripped = removeTextShowingOperators(source);
        var forms = new Map();
        if (options && options.forms) {
          collectForms(parser, stripped.xObjectNames, page.resources, forms);
        }

        // Rewrite each source stream once per Recipe; the result never changes.
        if (!recipe._textRemovedStreamIds) {
          recipe._textRemovedStreamIds = new Set();
        }
        var rewritten = recipe._textRemovedStreamIds;
        if (stripped.content !== source && !rewritten.has(page.streamIds[0])) {
          page.streamIds.forEach(function (objectId, index) {
            rewriteStream(
              writer,
              copyingContext,
              parser,
              objectId,
              index === 0 ? stripped.content : "",
            );
            rewritten.add(objectId);
          });
        }
        forms.forEach(function (content, objectId) {
          if (content !== null && !rewritten.has(objectId)) {
            rewriteStream(writer, copyingContext, parser, objectId, content);
            rewritten.add(objectId);
          }
        });
      } finally {
        copyingContext.end();
      }

      this._modifiedSourcePages.add(pageNumber);
      return this;
    },
  };
}
