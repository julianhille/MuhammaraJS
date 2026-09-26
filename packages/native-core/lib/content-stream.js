// Content-stream tokenizing, string and name tokens, and page-resource lookup
// shared by the Recipe text operations and the font decoder. Mirrored in
// packages/wasm/lib/content-stream.js; keep both files identical apart from the
// module syntax.

var WHITESPACE = "\0\t\n\f\r ";
var DELIMITERS = "()<>[]{}/%";

// Content-stream delimiters that start or end a token.
var Delimiter = Object.freeze({
  LITERAL_STRING_START: "(",
  LITERAL_STRING_END: ")",
  LITERAL_STRING_ESCAPE: "\\",
  HEX_STRING_START: "<",
  HEX_STRING_END: ">",
  DICTIONARY_START: "<<",
  DICTIONARY_END: ">>",
  ARRAY_START: "[",
  ARRAY_END: "]",
  PROCEDURE_START: "{",
  PROCEDURE_END: "}",
  NAME_START: "/",
  COMMENT_START: "%",
});

// Kinds of operand token callers tell apart.
var TokenKind = Object.freeze({
  LITERAL_STRING: "literalString",
  HEX_STRING: "hexString",
  NAME: "name",
  OTHER: "other",
});

// Literal-string escapes that stand for a control character.
var LITERAL_ESCAPES = Object.freeze({
  n: "\n",
  r: "\r",
  t: "\t",
  b: "\b",
  f: "\f",
});

// Content-stream operators the tokenizer and its callers interpret.
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

// Content-stream keywords that are operands, not operators.
var PdfKeyword = Object.freeze({
  TRUE: "true",
  FALSE: "false",
  NULL: "null",
});

// Page-tree keys followed for inherited resources.
var PdfName = Object.freeze({
  PARENT: "Parent",
  RESOURCES: "Resources",
});

// The error both extractors throw when a page exceeds its extraction limits.
var EXTRACTION_LIMIT_MESSAGE = "Page content exceeds text extraction limits";

// Errors created by `extractionLimitError`, so best-effort fallbacks can let
// them through.
var extractionLimitErrors = new WeakSet();

// Most page-tree ancestors followed for inherited resources. The visited set
// already stops cycles; this bounds pathological trees.
var MAX_PAGE_TREE_DEPTH = 256;

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
    if (character === Delimiter.LITERAL_STRING_ESCAPE) {
      index++;
    } else if (character === Delimiter.LITERAL_STRING_START) {
      depth++;
    } else if (character === Delimiter.LITERAL_STRING_END) {
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
      source.startsWith(PdfOperator.END_INLINE_IMAGE, index) &&
      isWhitespace(source[index - 1]) &&
      endsRegularToken(source.charAt(index + 2))
    ) {
      return index + 2;
    }
  }
  return source.length;
}

/**
 * Call `callback` for every operator in a content stream, in order. Operands
 * inside arrays and dictionaries are not reported separately; inline image
 * data is skipped and belongs to its `ID` operator.
 *
 * @param {string} source Latin-1 content stream.
 * @param {function({operator: string, operands: Array<{token: string, start:
 * number, end: number}>, end: number}): void} callback Receives each
 * operator, its top-level operand tokens with their offsets, and the offset
 * after the operator.
 * @returns {void}
 */
function forEachOperation(source, callback) {
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
    if (character === Delimiter.COMMENT_START) {
      while (
        index < source.length &&
        source[index] !== "\n" &&
        source[index] !== "\r"
      ) {
        index++;
      }
      continue;
    }
    if (character === Delimiter.LITERAL_STRING_START) {
      index = skipLiteralString(source, index);
    } else if (source.startsWith(Delimiter.DICTIONARY_START, index)) {
      depth++;
      index += 2;
    } else if (source.startsWith(Delimiter.DICTIONARY_END, index)) {
      depth--;
      index += 2;
    } else if (character === Delimiter.HEX_STRING_START) {
      index = source.indexOf(Delimiter.HEX_STRING_END, index);
      index = index === -1 ? source.length : index + 1;
    } else if (
      character === Delimiter.ARRAY_START ||
      character === Delimiter.PROCEDURE_START
    ) {
      depth++;
      index++;
    } else if (
      character === Delimiter.ARRAY_END ||
      character === Delimiter.PROCEDURE_END
    ) {
      depth--;
      index++;
    } else if (character === Delimiter.NAME_START) {
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

    if (token === PdfOperator.INLINE_IMAGE_DATA) {
      index = skipInlineImageData(source, index);
    }
    callback({ operator: token, operands: operands, end: index });
    operands = [];
    depth = 0;
  }
}

/**
 * Tell which kind of operand a token is.
 *
 * @param {string} token Operand token.
 * @returns {string} A `TokenKind` value.
 */
function tokenKind(token) {
  if (token.startsWith(Delimiter.LITERAL_STRING_START)) {
    return TokenKind.LITERAL_STRING;
  }
  if (
    token.startsWith(Delimiter.HEX_STRING_START) &&
    !token.startsWith(Delimiter.DICTIONARY_START)
  ) {
    return TokenKind.HEX_STRING;
  }
  if (token.startsWith(Delimiter.NAME_START)) return TokenKind.NAME;
  return TokenKind.OTHER;
}

/**
 * Decode a content-stream name token such as `/Fm#201`. The name's bytes are
 * read as UTF-8, as PDF dictionary keys are, so the result can be looked up in
 * a resource dictionary.
 *
 * @param {string} token Name token including the leading slash.
 * @returns {string} Name without the slash, with `#xx` escapes decoded.
 */
function decodeName(token) {
  var bytes = token.slice(1).replace(/#([0-9A-Fa-f]{2})/g, decodeNameEscape);
  return /^[\x00-\x7f]*$/.test(bytes) ? bytes : utf8Text(bytes);
}

/**
 * Decode one `#xx` escape of a name token.
 *
 * @param {string} escape The whole escape, such as `#20`.
 * @param {string} hex Its two hexadecimal digits.
 * @returns {string} The escaped byte, as a character.
 */
function decodeNameEscape(escape, hex) {
  return String.fromCharCode(parseInt(hex, 16));
}

/**
 * Decode a one-byte string as UTF-8.
 *
 * @param {string} bytes One character per byte.
 * @returns {string} Decoded text; invalid sequences become U+FFFD.
 */
function utf8Text(bytes) {
  var array = new Uint8Array(bytes.length);
  for (var index = 0; index < bytes.length; index++) {
    array[index] = bytes.charCodeAt(index);
  }
  return new TextDecoder().decode(array);
}

/**
 * Decode the bytes of a literal string token such as `(caf\351)`.
 *
 * @param {string} token Literal string token including parentheses.
 * @returns {string} Operand bytes, one character per byte.
 */
function literalStringBytes(token) {
  return token
    .slice(1, -1)
    .replace(/\r\n?/g, "\n")
    .replace(/\\([0-7]{1,3}|\n|[\s\S])/g, unescapeLiteral);
}

/**
 * Decode one backslash escape of a literal string.
 *
 * @param {string} sequence The whole escape, including the backslash.
 * @param {string} escape The escaped text after the backslash.
 * @returns {string} The byte it stands for; an escaped line break is dropped.
 */
function unescapeLiteral(sequence, escape) {
  if (/^[0-7]/.test(escape)) {
    return String.fromCharCode(parseInt(escape, 8) & 0xff);
  }
  if (escape === "\n") return "";
  return LITERAL_ESCAPES[escape] || escape;
}

/**
 * Decode hexadecimal digits to bytes, ignoring anything else and padding an
 * odd final digit with zero.
 *
 * @param {string} digits Hexadecimal digits, possibly with whitespace.
 * @returns {string} Bytes, one character per byte.
 */
function hexBytes(digits) {
  var hex = digits.replace(/[^0-9A-Fa-f]/g, "");
  if (hex.length % 2) hex += "0";
  var bytes = "";
  for (var index = 0; index < hex.length; index += 2) {
    bytes += String.fromCharCode(parseInt(hex.slice(index, index + 2), 16));
  }
  return bytes;
}

/**
 * Decode the bytes of a hex string token such as `<0048>`.
 *
 * @param {string} token Hex string token including angle brackets.
 * @returns {string} Operand bytes, one character per byte.
 */
function hexStringBytes(token) {
  return hexBytes(token.slice(1, -1));
}

/**
 * Decode the bytes of a literal or hex string token.
 *
 * @param {string} token String token.
 * @returns {string} Operand bytes, one character per byte.
 */
function stringBytes(token) {
  return tokenKind(token) === TokenKind.HEX_STRING
    ? hexStringBytes(token)
    : literalStringBytes(token);
}

/**
 * Write bytes as a string token of the given kind.
 *
 * @param {string} bytes Operand bytes, one character per byte.
 * @param {string} kind `TokenKind.HEX_STRING` or `TokenKind.LITERAL_STRING`.
 * @returns {string} Hex or literal string token.
 */
function stringToken(bytes, kind) {
  if (kind === TokenKind.HEX_STRING) {
    var hex = "";
    for (var index = 0; index < bytes.length; index++) {
      hex += ("0" + bytes.charCodeAt(index).toString(16).toUpperCase()).slice(
        -2,
      );
    }
    return Delimiter.HEX_STRING_START + hex + Delimiter.HEX_STRING_END;
  }
  return (
    Delimiter.LITERAL_STRING_START +
    bytes.replace(/[\\()]|[\x00-\x1f]/g, escapeLiteral) +
    Delimiter.LITERAL_STRING_END
  );
}

/**
 * Escape one byte for a literal string: backslashes and parentheses get a
 * backslash, control characters an octal escape.
 *
 * @param {string} character One byte as a character.
 * @returns {string} The escaped byte.
 */
function escapeLiteral(character) {
  if (/[\\()]/.test(character)) return "\\" + character;
  return "\\" + ("00" + character.charCodeAt(0).toString(8)).slice(-3);
}

/**
 * Read a whole stream as a one-byte string.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} stream PDF stream object.
 * @param {number} [maxBytes] Most decoded bytes to read.
 * @returns {string|null} Decoded stream bytes, one character per byte, or
 * null when the stream is longer than `maxBytes`.
 */
function readStreamString(reader, stream, maxBytes) {
  var streamReader = reader.startReadingFromStream(stream);
  var source = "";
  try {
    while (streamReader.notEnded()) {
      var chunk = streamReader.read(65536);
      var bytes = ArrayBuffer.isView(chunk) ? chunk : Uint8Array.from(chunk);
      if (maxBytes !== undefined && source.length + bytes.length > maxBytes) {
        return null;
      }
      for (var offset = 0; offset < bytes.length; offset += 0x8000) {
        source += String.fromCharCode.apply(
          null,
          bytes.subarray(offset, offset + 0x8000),
        );
      }
    }
  } finally {
    if (typeof streamReader.dispose === "function") streamReader.dispose();
  }
  return source;
}

/**
 * Create the error thrown when decoding would exceed the caller's extraction
 * limits. Its message matches the extractors' own limit error.
 *
 * @returns {Error} The error.
 */
function extractionLimitError() {
  var error = new Error(EXTRACTION_LIMIT_MESSAGE);
  extractionLimitErrors.add(error);
  return error;
}

/**
 * Check whether an error is an extraction limit error.
 *
 * @param {*} error Caught value.
 * @returns {boolean} True for errors from `extractionLimitError`.
 */
function isExtractionLimitError(error) {
  return typeof error === "object" && error !== null
    ? extractionLimitErrors.has(error)
    : false;
}

/**
 * Find the resources dictionary that applies to a page, following `/Parent`
 * inheritance. A page-tree cycle or an unreadable ancestor ends the search;
 * an extraction limit error is rethrown.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} types PDF object type constants.
 * @param {object} page Page dictionary.
 * @returns {object|null} Resources dictionary, or null when none applies.
 */
function inheritedResources(reader, types, page) {
  var visited = new Set();
  var node = page;
  try {
    for (var depth = 0; depth < MAX_PAGE_TREE_DEPTH; depth++) {
      if (!node || node.getType() !== types.ePDFObjectDictionary) return null;
      if (node.exists(PdfName.RESOURCES)) {
        var resources = reader.queryDictionaryObject(node, PdfName.RESOURCES);
        return resources && resources.getType() === types.ePDFObjectDictionary
          ? resources
          : null;
      }
      if (!node.exists(PdfName.PARENT)) return null;
      var parent = node.queryObject(PdfName.PARENT);
      if (parent.getType() === types.ePDFObjectIndirectObjectReference) {
        var objectId = parent.toPDFIndirectObjectReference().getObjectID();
        if (visited.has(objectId)) return null;
        visited.add(objectId);
        parent = reader.parseNewObject(objectId);
      }
      node = parent;
    }
  } catch (error) {
    if (isExtractionLimitError(error)) throw error;
    return null;
  }
  return null;
}

module.exports = {
  PdfOperator: PdfOperator,
  TokenKind: TokenKind,
  decodeName: decodeName,
  hexBytes: hexBytes,
  stringBytes: stringBytes,
  stringToken: stringToken,
  tokenKind: tokenKind,
  extractionLimitError: extractionLimitError,
  isExtractionLimitError: isExtractionLimitError,
  forEachOperation: forEachOperation,
  inheritedResources: inheritedResources,
  readStreamString: readStreamString,
};
