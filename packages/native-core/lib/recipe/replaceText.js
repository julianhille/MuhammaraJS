var contentStream = require("../content-stream");
var fontText = require("../font-text");

var PdfOperator = contentStream.PdfOperator;
var TokenKind = contentStream.TokenKind;
var decodeName = contentStream.decodeName;
var forEachOperation = contentStream.forEachOperation;
var tokenKind = contentStream.tokenKind;

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
      result += " " + operands[0] + " Tw " + operands[1] + " Tc T*";
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
 * Resolve an object through an indirect reference.
 *
 * @param {Recipe} recipe Recipe with an open source reader.
 * @param {object} object PDF object or indirect reference.
 * @returns {object} Resolved PDF object.
 */
function resolve(recipe, object) {
  if (
    object &&
    object.getType() === recipe.muhammara.ePDFObjectIndirectObjectReference
  ) {
    return recipe.pdfReader.parseNewObject(
      object.toPDFIndirectObjectReference().getObjectID(),
    );
  }
  return object;
}

/**
 * Look up a dictionary entry and resolve it.
 *
 * @param {Recipe} recipe Recipe with an open source reader.
 * @param {object} dictionary PDF dictionary.
 * @param {string} key Entry name.
 * @returns {object|null} Resolved PDF object, or null when missing.
 */
function lookup(recipe, dictionary, key) {
  return dictionary && dictionary.exists(key)
    ? resolve(recipe, dictionary.queryObject(key))
    : null;
}

/**
 * Collect the content stream object IDs of a page, in drawing order, and the
 * page's resources dictionary, including inherited resources.
 *
 * @param {Recipe} recipe Recipe with an open source reader.
 * @param {number} pageIndex Zero-based page index.
 * @private
 * @returns {{streamIds: number[], resources: object|null}} Page content.
 * @throws {Error} If `Contents` holds a direct stream.
 */
function pageContent(recipe, pageIndex) {
  var muhammara = recipe.muhammara;
  var page = recipe.pdfReader.parsePage(pageIndex).getDictionary();
  var resources = contentStream.inheritedResources(
    recipe.pdfReader,
    muhammara,
    page,
  );

  var contents = page.exists(PdfName.CONTENTS)
    ? page.queryObject(PdfName.CONTENTS)
    : null;
  var resolved = resolve(recipe, contents);
  var entries = [];
  if (contents && resolved.getType() === muhammara.ePDFObjectArray) {
    var array = resolved.toPDFArray();
    for (var index = 0; index < array.getLength(); index++) {
      entries.push(array.queryObject(index));
    }
  } else if (contents) {
    entries.push(contents);
  }

  return {
    resources: resources,
    streamIds: entries.map(function (entry) {
      if (entry.getType() !== muhammara.ePDFObjectIndirectObjectReference) {
        throw new Error("removeText supports indirect page content streams");
      }
      return entry.toPDFIndirectObjectReference().getObjectID();
    }),
  };
}

/**
 * Read and decode one content stream as a Latin-1 string.
 *
 * @param {Recipe} recipe Recipe with an open source reader.
 * @param {number} objectId Stream object ID.
 * @returns {string} Decoded stream bytes, one character per byte.
 */
function readContentStream(recipe, objectId) {
  return contentStream.readStreamString(
    recipe.pdfReader,
    recipe.pdfReader.parseNewObject(objectId).toPDFStream(),
  );
}

/**
 * Write a new unfiltered stream and point the page at it.
 *
 * @param {Recipe} recipe Recipe in modify mode.
 * @param {number} pageIndex Zero-based page index.
 * @param {number} objectId Object ID to replace on this page.
 * @param {string} content Latin-1 stream content.
 * @private
 * @returns {void}
 */
function replaceContentStream(recipe, pageIndex, objectId, content) {
  var objectsContext = recipe.writer.getObjectsContext();
  var replacementObjectId = objectsContext.startNewIndirectObject();
  var replacementStream = objectsContext.startUnfilteredPDFStream();

  replacementStream.getWriteStream().write(Buffer.from(content, "latin1"));
  objectsContext.endPDFStream(replacementStream).endIndirectObject();
  recipe.writer.replaceObject(pageIndex, objectId, replacementObjectId);
}

/**
 * Overwrite a source stream object in place with new unfiltered content,
 * keeping every dictionary entry except the length and filters.
 *
 * @param {Recipe} recipe Recipe in modify mode.
 * @param {object} copyingContext Copying context for the modified file.
 * @param {number} objectId Stream object ID.
 * @param {string} content Latin-1 stream content.
 * @private
 * @returns {void}
 */
function rewriteStream(recipe, copyingContext, objectId, content) {
  var source = recipe.pdfReader
    .parseNewObject(objectId)
    .toPDFStream()
    .getDictionary()
    .toJSObject();
  var objectsContext = recipe.writer.getObjectsContext();
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
  stream.getWriteStream().write(Buffer.from(content, "latin1"));
  objectsContext.endPDFStream(stream).endIndirectObject();
}

/**
 * Collect the Form XObjects a content stream paints, following nested forms.
 *
 * @param {Recipe} recipe Recipe with an open source reader.
 * @param {string[]} names XObject names used with `Do`.
 * @param {object|null} resources Resources dictionary for those names.
 * @param {Map<number, string>} forms Collected form IDs and stripped content.
 * @private
 * @returns {void}
 */
function collectForms(recipe, names, resources, forms) {
  var xObjects = lookup(recipe, resources, PdfName.XOBJECT);
  names.forEach(function (name) {
    var reference =
      xObjects && xObjects.exists(name) && xObjects.queryObject(name);
    if (
      !reference ||
      reference.getType() !== recipe.muhammara.ePDFObjectIndirectObjectReference
    ) {
      return;
    }
    var objectId = reference.toPDFIndirectObjectReference().getObjectID();
    if (forms.has(objectId)) return;

    var dictionary = recipe.pdfReader
      .parseNewObject(objectId)
      .toPDFStream()
      .getDictionary();
    var subtype = lookup(recipe, dictionary, PdfName.SUBTYPE);
    if (!subtype || subtype.toPDFName().value !== PdfName.FORM) return;

    var source = readContentStream(recipe, objectId);
    var stripped = removeTextShowingOperators(source);
    forms.set(objectId, stripped.content === source ? null : stripped.content);
    collectForms(
      recipe,
      stripped.xObjectNames,
      lookup(recipe, dictionary, PdfName.RESOURCES) || resources,
      forms,
    );
  });
}

/**
 * Validate a one-based page number argument.
 *
 * @param {Recipe} recipe Recipe with an open source reader.
 * @param {*} pageNumber Candidate page number.
 * @param {string} methodName Method name used in errors.
 * @private
 * @returns {void}
 * @throws {TypeError} If the page number is not a positive integer.
 * @throws {RangeError} If the source has no such page.
 */
function assertPageNumber(recipe, pageNumber, methodName) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new TypeError(methodName + " expects a positive integer page number");
  }
  if (!recipe.pdfReader || pageNumber > recipe.pdfReader.getPagesCount()) {
    throw new RangeError(
      methodName + " page " + pageNumber + " does not exist",
    );
  }
}

/**
 * Replace text shown with `Tj` in a page's single content stream. Each operand
 * is decoded through the font selected by `Tf` (its `/ToUnicode` CMap, then
 * its `/Encoding` and `/Differences`), and a match is compared with `text`.
 * The replacement is encoded through the same font and written back as a
 * literal or hex string, like the original operand. Only whole `Tj` operands
 * match; `TJ`, `'`, and `"` operands and text split across operators are left
 * unchanged.
 *
 * The replacement can only use glyphs the font already has. Embedded subset
 * fonts usually carry just the glyphs of their original text.
 *
 * @name replaceText
 * @function
 * @memberof Recipe#
 * @param {string} text Text to replace.
 * @param {string} replacement Replacement text.
 * @param {number} pageNumber One-based page number.
 * @returns {Recipe} The Recipe instance.
 * @throws {TypeError} If text or replacement is not a string, or if the page
 * number is not a positive integer.
 * @throws {RangeError} If the source document has no such page.
 * @throws {Error} If the page does not have one indirect content stream, or
 * the matched font cannot be read, has a malformed `/Widths` array, or has
 * no glyph for a replacement character.
 */
exports.replaceText = function replaceText(text, replacement, pageNumber) {
  if (typeof text !== "string" || typeof replacement !== "string") {
    throw new TypeError("replaceText expects text and replacement strings");
  }
  assertPageNumber(this, pageNumber, "replaceText");
  var pageIndex = pageNumber - 1;
  var page = this.pdfReader.parsePage(pageIndex).getDictionary();
  var contents = page.queryObject(PdfName.CONTENTS);

  if (
    !contents ||
    contents.getType() !== this.muhammara.ePDFObjectIndirectObjectReference
  ) {
    throw new Error("replaceText supports pages with one content stream");
  }

  var contentsObjectId = contents.toPDFIndirectObjectReference().getObjectID();
  var source = readContentStream(this, contentsObjectId);
  var replaced = replaceShownText(
    source,
    text,
    replacement,
    fontText.createPageFontLookup(this.pdfReader, this.muhammara, pageIndex),
  );

  if (replaced === source) {
    return this;
  }

  replaceContentStream(this, pageIndex, contentsObjectId, replaced);
  this.modifiedSourcePages.add(pageNumber);
  return this;
};

/**
 * Remove all shown text from a page, for example before placing a fresh OCR
 * text layer. Text-showing operators (`Tj`, `TJ`, `'`, `"`) are dropped;
 * graphics, images, and text state are kept. Annotation appearances are not
 * changed.
 *
 * The page's source content streams are rewritten in place, so a stream shared
 * with another page loses its text there too. Content added with `editPage()`
 * in the same Recipe is kept.
 *
 * @name removeText
 * @function
 * @memberof Recipe#
 * @param {number} pageNumber One-based page number.
 * @param {RemoveTextOptions} [options] Removal options.
 * @param {boolean} [options.forms=false] Also remove text from the Form
 * XObjects the page paints, including nested forms. Other pages that paint
 * the same form lose that text too.
 * @returns {Recipe} The Recipe instance.
 * @throws {TypeError} If the page number is not a positive integer, or the
 * options are not an object.
 * @throws {RangeError} If the source document has no such page.
 * @throws {Error} If the page's `Contents` holds a direct stream.
 */
exports.removeText = function removeText(pageNumber, options) {
  assertPageNumber(this, pageNumber, "removeText");
  if (
    options !== undefined &&
    (options === null || typeof options !== "object")
  ) {
    throw new TypeError("removeText expects an options object");
  }

  var recipe = this;
  var page = pageContent(this, pageNumber - 1);
  var source = page.streamIds
    .map(function (objectId) {
      return readContentStream(recipe, objectId);
    })
    .join("\n");
  var stripped = removeTextShowingOperators(source);
  var forms = new Map();
  if (options && options.forms) {
    collectForms(this, stripped.xObjectNames, page.resources, forms);
  }

  // Rewrite each source stream once per Recipe; the result never changes.
  if (!this.textRemovedStreamIds) this.textRemovedStreamIds = new Set();
  var rewritten = this.textRemovedStreamIds;
  var copyingContext = this.writer.createPDFCopyingContextForModifiedFile();
  if (stripped.content !== source && !rewritten.has(page.streamIds[0])) {
    page.streamIds.forEach(function (objectId, index) {
      rewriteStream(
        recipe,
        copyingContext,
        objectId,
        index === 0 ? stripped.content : "",
      );
      rewritten.add(objectId);
    });
  }
  forms.forEach(function (content, objectId) {
    if (content !== null && !rewritten.has(objectId)) {
      rewriteStream(recipe, copyingContext, objectId, content);
      rewritten.add(objectId);
    }
  });
  copyingContext.end();

  this.modifiedSourcePages.add(pageNumber);
  return this;
};
