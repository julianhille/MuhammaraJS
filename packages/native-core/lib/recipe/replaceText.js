var WHITESPACE = "\0\t\n\f\r ";
var DELIMITERS = "()<>[]{}/%";

function escapePDFLiteralString(value) {
  return value.replace(/([\\()])/g, "\\$1");
}

/**
 * Escape a string for literal use inside a regular expression.
 *
 * @param {string} value Raw string.
 * @returns {string} Escaped pattern source.
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build the literal `(...) Tj` pattern and replacement operand for
 * `replaceText`. Both strings are written one byte per character, so
 * characters above U+00FF are rejected rather than truncated.
 *
 * @param {string} text Text to replace.
 * @param {string} replacement Replacement text.
 * @returns {{pattern: RegExp, operand: string}} Match pattern and operand.
 * @throws {TypeError} If either string has a character above U+00FF.
 */
function literalReplacement(text, replacement) {
  if (/[^\u0000-\u00ff]/.test(text + replacement)) {
    throw new TypeError(
      "replaceText supports only Latin-1 text and replacement strings",
    );
  }
  return {
    pattern: new RegExp(
      "\\(" + escapeRegExp(escapePDFLiteralString(text)) + "\\)(\\s+Tj\\b)",
      "g",
    ),
    operand: "(" + escapePDFLiteralString(replacement) + ")",
  };
}

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
      source[index] === "E" &&
      source[index + 1] === "I" &&
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
      token !== "true" &&
      token !== "false" &&
      token !== "null";

    if (!isOperator) {
      if (depth <= 0) operands.push(token);
      continue;
    }

    if (token === "ID") index = skipInlineImageData(source, index);
    if (token === "Do" && /^\//.test(operands[0])) {
      xObjectNames.push(decodeName(operands[0]));
    }

    if (token === "Tj" || token === "TJ") {
      result += " ";
    } else if (token === "'") {
      result += " T*";
    } else if (token === '"') {
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
 * @returns {{streamIds: number[], resources: object|null}} Page content.
 * @throws {Error} If `Contents` holds a direct stream.
 */
function pageContent(recipe, pageIndex) {
  var muhammara = recipe.muhammara;
  var page = recipe.pdfReader.parsePage(pageIndex).getDictionary();
  var resources = null;
  for (
    var node = page;
    node && !resources;
    node = lookup(recipe, node, "Parent")
  ) {
    resources = lookup(recipe, node, "Resources");
  }

  var contents = page.exists("Contents") ? page.queryObject("Contents") : null;
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
  var stream = recipe.pdfReader.parseNewObject(objectId).toPDFStream();
  var streamReader = recipe.pdfReader.startReadingFromStream(stream);
  var chunks = [];

  while (streamReader.notEnded()) {
    chunks.push(Buffer.from(streamReader.read(65536)));
  }
  return Buffer.concat(chunks).toString("latin1");
}

/**
 * Write a new unfiltered stream and point the page at it.
 *
 * @param {Recipe} recipe Recipe in modify mode.
 * @param {number} pageIndex Zero-based page index.
 * @param {number} objectId Object ID to replace on this page.
 * @param {string} content Latin-1 stream content.
 */
function replaceContentStream(recipe, pageIndex, objectId, content) {
  var objectsContext = recipe.writer.getObjectsContext();
  var replacementObjectId = objectsContext.startNewIndirectObject();
  var replacementStream = objectsContext.startUnfilteredPDFStream();

  replacementStream
    .getWriteStream()
    .write(Array.from(Buffer.from(content, "latin1")));
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
    if (key === "Length" || key === "Filter" || key === "DecodeParms") return;
    dictionary.writeKey(key);
    copyingContext.copyDirectObjectAsIs(source[key]);
  });

  var stream = objectsContext.startUnfilteredPDFStream(dictionary);
  stream.getWriteStream().write(Array.from(Buffer.from(content, "latin1")));
  objectsContext.endPDFStream(stream).endIndirectObject();
}

/**
 * Collect the Form XObjects a content stream paints, following nested forms.
 *
 * @param {Recipe} recipe Recipe with an open source reader.
 * @param {string[]} names XObject names used with `Do`.
 * @param {object|null} resources Resources dictionary for those names.
 * @param {Map<number, string>} forms Collected form IDs and stripped content.
 */
function collectForms(recipe, names, resources, forms) {
  var xObjects = lookup(recipe, resources, "XObject");
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
    var subtype = lookup(recipe, dictionary, "Subtype");
    if (!subtype || subtype.toPDFName().value !== "Form") return;

    var source = readContentStream(recipe, objectId);
    var stripped = removeTextShowingOperators(source);
    forms.set(objectId, stripped.content === source ? null : stripped.content);
    collectForms(
      recipe,
      stripped.xObjectNames,
      lookup(recipe, dictionary, "Resources") || resources,
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
 * Replace literal text-showing operands in a page's single content stream.
 *
 * @name replaceText
 * @function
 * @memberof Recipe#
 * @param {string} text Text to replace.
 * @param {string} replacement Replacement text.
 * @param {number} pageNumber One-based page number.
 * @returns {Recipe} The Recipe instance.
 * @throws {TypeError} If text or replacement is not a Latin-1 string, or if
 * the page number is not a positive integer.
 * @throws {Error} If the page does not have one indirect content stream.
 */
exports.replaceText = function replaceText(text, replacement, pageNumber) {
  if (typeof text !== "string" || typeof replacement !== "string") {
    throw new TypeError("replaceText expects text and replacement strings");
  }
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new TypeError("replaceText expects a positive integer page number");
  }
  var literal = literalReplacement(text, replacement);

  var pageIndex = pageNumber - 1;
  var page = this.pdfReader.parsePage(pageIndex).getDictionary();
  var contents = page.queryObject("Contents");

  if (
    !contents ||
    contents.getType() !== this.muhammara.ePDFObjectIndirectObjectReference
  ) {
    throw new Error("replaceText supports pages with one content stream");
  }

  var contentsObjectId = contents.toPDFIndirectObjectReference().getObjectID();
  var source = readContentStream(this, contentsObjectId);
  var replaced = source.replace(literal.pattern, function (_, operator) {
    return literal.operand + operator;
  });

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
