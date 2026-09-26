import { constants } from "../constants.js";
import { createPageFontLookup } from "../font-text.js";

var ePDFObjectArray = constants.ePDFObjectArray;
var ePDFObjectIndirectObjectReference =
  constants.ePDFObjectIndirectObjectReference;

var WHITESPACE = "\0\t\n\f\r ";
var DELIMITERS = "()<>[]{}/%";

// Content-stream operators this module interprets.
var PdfOperator = Object.freeze({
  SHOW_TEXT: "Tj",
  SHOW_TEXT_ARRAY: "TJ",
  NEXT_LINE_SHOW_TEXT: "'",
  SPACING_NEXT_LINE_SHOW_TEXT: '"',
  PAINT_XOBJECT: "Do",
  INLINE_IMAGE_DATA: "ID",
  END_INLINE_IMAGE: "EI",
  SET_FONT: "Tf",
  SAVE_STATE: "q",
  RESTORE_STATE: "Q",
});

// PDF dictionary keys and names this module reads.
var PdfName = Object.freeze({
  PARENT: "Parent",
  RESOURCES: "Resources",
  CONTENTS: "Contents",
  LENGTH: "Length",
  FILTER: "Filter",
  DECODE_PARMS: "DecodeParms",
  XOBJECT: "XObject",
  SUBTYPE: "Subtype",
  FORM: "Form",
});

// Content-stream keywords that are operands, not operators.
var PdfKeyword = Object.freeze({
  TRUE: "true",
  FALSE: "false",
  NULL: "null",
});

/**
 * Check whether a content-stream character is PDF whitespace.
 *
 * @param {string} character One character.
 * @returns {boolean} True for PDF whitespace.
 */
function isWhitespace(character) {
  return character !== "" && WHITESPACE.includes(character);
}

/**
 * Check whether a content-stream character ends a regular token.
 *
 * @param {string} character One character, or an empty string at the end.
 * @returns {boolean} True for whitespace, delimiters, and the end of input.
 */
function endsRegularToken(character) {
  return (
    character === "" ||
    isWhitespace(character) ||
    DELIMITERS.includes(character)
  );
}

/**
 * Find the end of a literal string that starts at `start`.
 *
 * @param {string} source Latin-1 content stream.
 * @param {number} start Offset of the opening parenthesis.
 * @returns {number} Offset after the closing parenthesis.
 */
function skipLiteralString(source, start) {
  var depth = 0;
  for (var index = start; index < source.length; index++) {
    var character = source[index];
    if (character === "\\") {
      index++;
    } else if (character === "(") {
      depth++;
    } else if (character === ")") {
      depth--;
      if (depth === 0) return index + 1;
    }
  }
  return source.length;
}

/**
 * Find the end of inline image data after its `ID` operator.
 *
 * @param {string} source Latin-1 content stream.
 * @param {number} start Offset directly after `ID`.
 * @returns {number} Offset after the closing `EI` operator.
 */
function skipInlineImageData(source, start) {
  for (var index = start + 1; index < source.length - 1; index++) {
    if (
      source[index] === PdfOperator.END_INLINE_IMAGE[0] &&
      source[index + 1] === PdfOperator.END_INLINE_IMAGE[1] &&
      isWhitespace(source[index - 1]) &&
      endsRegularToken(source.charAt(index + 2))
    ) {
      return index + 2;
    }
  }
  return source.length;
}

/**
 * Remove text-showing operators from a page content stream. `'` and `"`
 * keep their line advance and spacing effects as `T*`, `Tw`, and `Tc`.
 *
 * @param {string} source Latin-1 content stream.
 * @returns {{content: string, xObjectNames: string[]}} Latin-1 content
 * stream without shown text, and the XObject names it paints with `Do`.
 */
function removeTextShowingOperators(source) {
  var result = "";
  var xObjectNames = [];
  var operandStart = 0;
  var operands = [];
  var depth = 0;
  var index = 0;

  while (index < source.length) {
    var character = source[index];
    var start = index;

    if (isWhitespace(character)) {
      index++;
      continue;
    }
    if (character === "%") {
      while (
        index < source.length &&
        source[index] !== "\n" &&
        source[index] !== "\r"
      ) {
        index++;
      }
      continue;
    }
    if (character === "(") {
      index = skipLiteralString(source, index);
    } else if (character === "<" && source[index + 1] === "<") {
      depth++;
      index += 2;
    } else if (character === ">" && source[index + 1] === ">") {
      depth--;
      index += 2;
    } else if (character === "<") {
      index = source.indexOf(">", index);
      index = index === -1 ? source.length : index + 1;
    } else if (character === "[" || character === "{") {
      depth++;
      index++;
    } else if (character === "]" || character === "}") {
      depth--;
      index++;
    } else if (character === "/") {
      index++;
      while (!endsRegularToken(source.charAt(index))) index++;
    } else {
      while (!endsRegularToken(source.charAt(index))) index++;
      if (index === start) index++;
    }

    var token = source.slice(start, index);
    var isOperator =
      depth <= 0 &&
      /^[A-Za-z'"*]/.test(token) &&
      token !== PdfKeyword.TRUE &&
      token !== PdfKeyword.FALSE &&
      token !== PdfKeyword.NULL;

    if (!isOperator) {
      if (depth <= 0) operands.push(token);
      continue;
    }

    if (token === PdfOperator.INLINE_IMAGE_DATA)
      index = skipInlineImageData(source, index);
    if (token === PdfOperator.PAINT_XOBJECT && /^\//.test(operands[0])) {
      xObjectNames.push(decodeName(operands[0]));
    }

    if (
      token === PdfOperator.SHOW_TEXT ||
      token === PdfOperator.SHOW_TEXT_ARRAY
    ) {
      result += " ";
    } else if (token === PdfOperator.NEXT_LINE_SHOW_TEXT) {
      result += " T*";
    } else if (token === PdfOperator.SPACING_NEXT_LINE_SHOW_TEXT) {
      result += " " + operands[0] + " Tw " + operands[1] + " Tc T*";
    } else {
      result += source.slice(operandStart, index);
    }
    operandStart = index;
    operands = [];
    depth = 0;
  }

  return {
    content: result + source.slice(operandStart),
    xObjectNames: xObjectNames,
  };
}

/**
 * Decode a content-stream name token such as `/Fm#201`.
 *
 * @param {string} token Name token including the leading slash.
 * @returns {string} Name without the slash, with `#xx` escapes decoded.
 */
function decodeName(token) {
  return token.slice(1).replace(/#([0-9A-Fa-f]{2})/g, function (_, hex) {
    return String.fromCharCode(parseInt(hex, 16));
  });
}

/**
 * Decode the bytes of a literal string token such as `(caf\\351)`.
 *
 * @param {string} token Literal string token including parentheses.
 * @returns {string} Operand bytes, one character per byte.
 */
function literalStringBytes(token) {
  var escapes = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
  return token
    .slice(1, -1)
    .replace(/\r\n?/g, "\n")
    .replace(/\\([0-7]{1,3}|\n|[\s\S])/g, function (_, escape) {
      if (/^[0-7]/.test(escape)) {
        return String.fromCharCode(parseInt(escape, 8) & 0xff);
      }
      if (escape === "\n") return "";
      return escapes[escape] || escape;
    });
}

/**
 * Decode the bytes of a hex string token such as `<0048>`.
 *
 * @param {string} token Hex string token including angle brackets.
 * @returns {string} Operand bytes, one character per byte.
 */
function hexStringBytes(token) {
  var hex = token.slice(1, -1).replace(/[^0-9A-Fa-f]/g, "");
  if (hex.length % 2) hex += "0";
  return hex.replace(/../g, function (pair) {
    return String.fromCharCode(parseInt(pair, 16));
  });
}

/**
 * Write operand bytes as a string token in the same form as `original`.
 *
 * @param {string} bytes Operand bytes, one character per byte.
 * @param {string} original Original literal or hex string token.
 * @returns {string} Literal or hex string token.
 */
function stringToken(bytes, original) {
  if (original[0] === "<") {
    return (
      "<" +
      bytes.replace(/[\s\S]/g, function (character) {
        return ("0" + character.charCodeAt(0).toString(16).toUpperCase()).slice(
          -2,
        );
      }) +
      ">"
    );
  }
  return (
    "(" +
    bytes.replace(/[\\()]|[\x00-\x1f]/g, function (character) {
      if (/[\\()]/.test(character)) return "\\" + character;
      return "\\" + ("00" + character.charCodeAt(0).toString(8)).slice(-3);
    }) +
    ")"
  );
}

/**
 * Replace the operands of `Tj` operators whose text, decoded through the
 * active font, equals `text`. Everything else is kept byte for byte.
 *
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
  var operands = [];
  var depth = 0;
  var index = 0;
  var font = null;
  var fontStack = [];
  var encoded = new Map();

  while (index < source.length) {
    var character = source[index];
    var start = index;

    if (isWhitespace(character)) {
      index++;
      continue;
    }
    if (character === "%") {
      while (
        index < source.length &&
        source[index] !== "\n" &&
        source[index] !== "\r"
      ) {
        index++;
      }
      continue;
    }
    if (character === "(") {
      index = skipLiteralString(source, index);
    } else if (character === "<" && source[index + 1] === "<") {
      depth++;
      index += 2;
    } else if (character === ">" && source[index + 1] === ">") {
      depth--;
      index += 2;
    } else if (character === "<") {
      index = source.indexOf(">", index);
      index = index === -1 ? source.length : index + 1;
    } else if (character === "[" || character === "{") {
      depth++;
      index++;
    } else if (character === "]" || character === "}") {
      depth--;
      index++;
    } else if (character === "/") {
      index++;
      while (!endsRegularToken(source.charAt(index))) index++;
    } else {
      while (!endsRegularToken(source.charAt(index))) index++;
      if (index === start) index++;
    }

    var token = source.slice(start, index);
    var isOperator =
      depth <= 0 &&
      /^[A-Za-z'"*]/.test(token) &&
      !Object.values(PdfKeyword).includes(token);

    if (!isOperator) {
      if (depth <= 0) operands.push({ token: token, start: start, end: index });
      continue;
    }

    if (token === PdfOperator.INLINE_IMAGE_DATA)
      index = skipInlineImageData(source, index);
    if (token === PdfOperator.SAVE_STATE) fontStack.push(font);
    if (token === PdfOperator.RESTORE_STATE && fontStack.length)
      font = fontStack.pop();
    if (
      token === PdfOperator.SET_FONT &&
      operands.length === 2 &&
      operands[0].token[0] === "/"
    ) {
      font = decodeName(operands[0].token);
    }
    if (
      token === PdfOperator.SHOW_TEXT &&
      operands.length === 1 &&
      /^(\(|<(?!<))/.test(operands[0].token)
    ) {
      var operand = operands[0];
      var codec = fonts(font);
      var bytes =
        operand.token[0] === "("
          ? literalStringBytes(operand.token)
          : hexStringBytes(operand.token);
      if (codec.decode(bytes) === text) {
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
          stringToken(encoded.get(codec), operand.token);
        copied = operand.end;
      }
    }
    operands = [];
    depth = 0;
  }

  return result + source.slice(copied);
}

/**
 * Maps bytes one-to-one to a string of code units 0 to 255.
 * @param {Uint8Array} bytes - Bytes.
 * @returns {string} The string.
 */
function oneByteString(bytes) {
  var result = "";
  for (var offset = 0; offset < bytes.length; offset += 0x8000) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return result;
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
  var resources = null;
  for (
    var node = page;
    node && !resources;
    node = lookup(parser, node, PdfName.PARENT)?.toPDFDictionary()
  ) {
    resources = lookup(parser, node, PdfName.RESOURCES)?.toPDFDictionary();
  }

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
  var stream = parser.parseNewObject(objectId).toPDFStream();
  var streamReader = parser.startReadingFromStream(stream);
  var source = "";
  try {
    while (streamReader.notEnded()) {
      source += oneByteString(streamReader.read(65536));
    }
  } finally {
    streamReader.dispose?.();
  }
  return source;
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
     * @throws {Error} If the page does not have one indirect content stream,
     * or the matched font has no glyph for a replacement character.
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

      var parser = this.writer.getModifiedFileParser();
      var contentsObjectId;
      var source = "";
      var streamReader;
      try {
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
        var stream = parser.parseNewObject(contentsObjectId).toPDFStream();
        streamReader = parser.startReadingFromStream(stream);
        while (streamReader.notEnded()) {
          source += oneByteString(streamReader.read(65536));
        }
        streamReader.dispose();
        streamReader = null;
        var replaced = replaceShownText(
          source,
          text,
          replacement,
          createPageFontLookup(parser, constants, pageNumber - 1),
        );
      } finally {
        streamReader?.dispose();
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
