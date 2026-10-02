"use strict";

var path = require("path");
var fontText = require("./lib/font-text");
var { createRecipe } = require("./lib/Recipe");
var textDirection = require("./lib/text-direction");

// The addon's own functions, kept on the addon so every createMuhammara call
// wraps the originals, never an earlier wrapper. Module state would not do:
// Jest loads this module again for every test file while the addon stays
// loaded. Symbol.for keys are shared by those module registries.
var nativeReaderClass = Symbol.for("@muhammara/native-core:PDFReader");
var nativeExtractPageText = Symbol.for(
  "@muhammara/native-core:extractPageText",
);
var nativeRecryptAsync = Symbol.for("@muhammara/native-core:recryptAsync");
var nativeWriteText = Symbol.for("@muhammara/native-core:writeText");

/**
 * Keep an addon's own function under a hidden key, unless it is already kept.
 *
 * @param {object} target The object holding the function.
 * @param {symbol} key The hidden key.
 * @param {*} value The function to keep.
 * @returns {*} The kept function.
 */
function keepNative(target, key, value) {
  if (!Object.prototype.hasOwnProperty.call(target, key)) {
    Object.defineProperty(target, key, { value: value });
  }
  return target[key];
}

/**
 * Make `extractPageText()` add decoded Unicode `text` to each element. The
 * addon exports its reader class for this step only; the export is removed
 * again so `PDFReader` stays out of the public API.
 *
 * @param {object} muhammara The native addon.
 * @returns {void}
 * @throws {Error} If the addon does not export its reader class, so decoded
 * text would silently be missing.
 */
function decodeExtractedText(muhammara) {
  var PDFReader = keepNative(muhammara, nativeReaderClass, muhammara.PDFReader);
  if (typeof PDFReader !== "function") {
    throw new Error(
      "The muhammara native addon does not export PDFReader; rebuild it from this version's sources",
    );
  }
  delete muhammara.PDFReader;

  var extractPageText = keepNative(
    PDFReader.prototype,
    nativeExtractPageText,
    PDFReader.prototype.extractPageText,
  );
  /**
   * Extract a page's text operations with their decoded Unicode `text`.
   *
   * @param {number} pageIndex Zero-based page index.
   * @param {object} [limits] Extraction limits.
   * @param {{decodeText?: boolean}} [options] Extraction options;
   * `decodeText: false` skips decoding and leaves out `text`.
   * @returns {Array<object>} Text elements.
   * @throws {TypeError} If `options` is not an object or `decodeText` is not a
   * boolean.
   */
  PDFReader.prototype.extractPageText = function (pageIndex, limits, options) {
    var decode = fontText.decodeTextOption(options);
    // Forward only the arguments the addon accepts, exactly as given.
    var elements = extractPageText.apply(
      this,
      Array.prototype.slice.call(arguments, 0, 2),
    );
    return decode
      ? fontText.decodeTextElements(
          this,
          muhammara,
          pageIndex,
          elements,
          limits,
        )
      : elements;
  };
}

/**
 * Make `recryptAsync()` resolve relative paths, including `options.log`, when
 * it is called. A queued job opens its files later, and the working directory
 * may change in between.
 *
 * @param {object} muhammara The native addon.
 * @returns {void}
 */
function resolveRecryptAsyncPaths(muhammara) {
  if (typeof muhammara.recryptAsync !== "function") return;
  var recryptAsync = keepNative(
    muhammara,
    nativeRecryptAsync,
    muhammara.recryptAsync,
  );
  /**
   * Re-encrypt a PDF on libuv's thread pool.
   *
   * @param {string|object} source The source path or read stream.
   * @param {string|object} target The output path or write stream.
   * @param {object} [options] The source password and encryption settings.
   * @returns {Promise<void>} Settles once the output is written.
   * @throws {TypeError} If the arguments are wrong.
   */
  muhammara.recryptAsync = function (source, target, options) {
    var args = Array.prototype.slice.call(arguments);
    if (
      typeof source === "string" &&
      typeof target === "string" &&
      source !== "" &&
      target !== ""
    ) {
      args[0] = path.resolve(source);
      args[1] = path.resolve(target);
    }
    var log = options && typeof options === "object" ? options.log : undefined;
    if (typeof log === "string" && log !== "") {
      args[2] = withLog(options, path.resolve(log));
    }
    return recryptAsync.apply(this, args);
  };
}

// Content context classes the addon exports only so writeText can be wrapped.
var CONTENT_CONTEXT_CLASSES = ["PageContentContext", "XObjectContentContext"];

/**
 * Make `writeText()` on every content context reorder right-to-left text into
 * the visual order PDF draws glyphs in, steered by its `direction` option.
 * The addon exports the content context classes for this step only; the
 * exports are removed again so they stay out of the public API.
 *
 * @param {object} muhammara The native addon.
 * @returns {void}
 * @throws {Error} If the addon does not export its content context classes,
 * so right-to-left text would silently be drawn reversed.
 */
function reorderWrittenText(muhammara) {
  var contexts = CONTENT_CONTEXT_CLASSES.map(function (name) {
    var ContentContext = keepNative(
      muhammara,
      Symbol.for("@muhammara/native-core:" + name),
      muhammara[name],
    );
    if (typeof ContentContext !== "function") {
      throw new Error(
        "The muhammara native addon does not export " +
          name +
          "; rebuild it from this version's sources",
      );
    }
    return ContentContext;
  });
  CONTENT_CONTEXT_CLASSES.forEach(function (name, index) {
    var ContentContext = contexts[index];
    delete muhammara[name];

    var writeText = keepNative(
      ContentContext.prototype,
      nativeWriteText,
      ContentContext.prototype.writeText,
    );
    /**
     * Write one line of text, reordered for its direction.
     *
     * @param {string} text The text in logical order.
     * @param {number} x Baseline start x.
     * @param {number} y Baseline y.
     * @param {object} [options] Text options; `direction` is a
     * `TextDirection` value and defaults to "none".
     * @returns {object} This content context.
     * @throws {TypeError} If `direction` is not a `TextDirection` value.
     */
    ContentContext.prototype.writeText = function (text, x, y, options) {
      var args = Array.prototype.slice.call(arguments);
      var direction =
        options && typeof options === "object" ? options.direction : undefined;
      args[0] = textDirection.toVisual(text, direction);
      return writeText.apply(this, args);
    };
  });
}

/**
 * View options with `log` replaced, reading every other property from the
 * original with the original as `this`. Copying would lose getters, inherited
 * properties, and Proxy-backed values that the addon reads with a plain
 * property get. Inheriting from the options would run getters against the
 * wrong object, and a Proxy targeting the options would throw when `log` is
 * read-only and non-configurable, so the Proxy targets an empty object.
 *
 * @param {object} options The caller's options.
 * @param {string} log The log path to report instead.
 * @returns {object} A Proxy reading through to `options`.
 */
function withLog(options, log) {
  return new Proxy(
    {},
    {
      /**
       * Report `log` and every key the options have.
       *
       * @param {object} target The empty Proxy target.
       * @param {string|symbol} key The property name.
       * @returns {boolean} Whether the property exists.
       */
      has: function (target, key) {
        return key === "log" || Reflect.has(options, key);
      },
      /**
       * Read `log` as the replacement and every other key from the options.
       *
       * @param {object} target The empty Proxy target.
       * @param {string|symbol} key The property name.
       * @returns {*} The property value.
       */
      get: function (target, key) {
        return key === "log" ? log : Reflect.get(options, key);
      },
    },
  );
}

/**
 * Attach the shared JavaScript API to an implementation package's loaded addon.
 *
 * @param {object} muhammara The native addon loaded by an implementation package.
 * @returns {object} The public MuhammaraJS API.
 */
exports.createMuhammara = function createMuhammara(muhammara) {
  /**
   * Returns the writer's event emitter, created on first use.
   * @returns {import("events").EventEmitter} The emitter for writer events.
   */
  muhammara.PDFWriter.prototype.getEvents = function () {
    if (!this.events) this.events = new (require("events").EventEmitter)();
    return this.events;
  };
  /**
   * Emits an event on the writer's emitter after setting `eventParams.writer`
   * to this writer.
   * @param {string|symbol} eventName - The event name.
   * @param {Object} eventParams - The event parameters; gains a `writer` key.
   * @returns {void}
   * @throws {TypeError} If eventParams is not an object.
   */
  muhammara.PDFWriter.prototype.triggerDocumentExtensionEvent = function (
    eventName,
    eventParams,
  ) {
    eventParams.writer = this;
    this.getEvents().emit(eventName, eventParams);
  };
  /**
   * Replaces direct references to an object in a page dictionary. Available
   * only when modifying an existing PDF.
   * @param {number} pageIndex - The zero-based page index; ignored for the
   *   global scope.
   * @param {number} sourceObjectId - The object ID to stop referencing.
   * @param {number} replacementObjectId - The object ID to reference instead.
   * @param {Object} [options] - The options.
   * @param {string} [options.scope] - ObjectReplacementScope.GLOBAL to
   *   replace on every page.
   * @returns {Object} This writer.
   * @throws {Error} If the writer does not modify a PDF or the page does not
   *   exist.
   */
  muhammara.PDFWriter.prototype.replaceObject = function (
    pageIndex,
    sourceObjectId,
    replacementObjectId,
    options,
  ) {
    if (options && options.scope === muhammara.ObjectReplacementScope.GLOBAL) {
      var copyingContext = this.createPDFCopyingContextForModifiedFile();
      var pageCount = copyingContext.getSourceDocumentParser().getPagesCount();

      copyingContext.end();
      for (var index = 0; index < pageCount; ++index) {
        this.replaceObject(index, sourceObjectId, replacementObjectId);
      }
      return this;
    }

    var copyingContext = this.createPDFCopyingContextForModifiedFile();
    var parser = copyingContext.getSourceDocumentParser();
    var pageObjectId = parser.getPageObjectID(pageIndex);
    var pageObject = parser.parsePage(pageIndex).getDictionary().toJSObject();
    var objectsContext = this.getObjectsContext();
    var pageDictionary;

    objectsContext.startModifiedIndirectObject(pageObjectId);
    pageDictionary = objectsContext.startDictionary();

    Object.getOwnPropertyNames(pageObject).forEach(function (key) {
      var value = pageObject[key];

      pageDictionary.writeKey(key);
      if (
        value.getType() === muhammara.ePDFObjectIndirectObjectReference &&
        value.toPDFIndirectObjectReference().getObjectID() === sourceObjectId
      ) {
        pageDictionary.writeObjectReferenceValue(replacementObjectId);
      } else {
        copyingContext.copyDirectObjectAsIs(value);
      }
    });

    objectsContext.endDictionary(pageDictionary).endIndirectObject();
    copyingContext.end();
    return this;
  };
  decodeExtractedText(muhammara);
  resolveRecryptAsyncPaths(muhammara);
  reorderWrittenText(muhammara);
  muhammara.PDFStreamForResponse = require("./lib/PDFStreamForResponse");
  muhammara.PDFWStreamForFile = require("./lib/PDFWStreamForFile");
  muhammara.PDFRStreamForFile = require("./lib/PDFRStreamForFile");
  muhammara.PDFRStreamForBuffer = require("./lib/PDFRStreamForBuffer");
  muhammara.PDFWStreamForBuffer = require("./lib/PDFWStreamForBuffer");
  muhammara.DrawingPathType = Object.freeze({
    STROKE: "stroke",
    FILL: "fill",
    CLIP: "clip",
  });
  muhammara.ImageFit = Object.freeze({
    ALWAYS: "always",
    OVERFLOW: "overflow",
  });
  muhammara.DeviceColorSpace = Object.freeze({
    RGB: "rgb",
    GRAY: "gray",
    CMYK: "cmyk",
  });
  muhammara.PageBox = Object.freeze({
    MEDIA: "media",
    CROP: "crop",
    BLEED: "bleed",
    TRIM: "trim",
    ART: "art",
  });
  muhammara.PDFImageType = Object.freeze({
    PDF: "PDF",
    JPG: "JPG",
    TIFF: "TIFF",
    PNG: "PNG",
  });
  muhammara.EEncoding = Object.freeze({
    TEXT: "text",
    CODE: "code",
    HEX: "hex",
  });
  muhammara.TextDirection = textDirection.TextDirection;
  muhammara.ObjectReplacementScope = Object.freeze({
    GLOBAL: "global",
  });
  muhammara.LineCapStyle = Object.freeze({
    LINECAP_BUTT: 0,
    LINECAP_ROUND: 1,
    LINECAP_SQUARE: 2,
  });
  muhammara.ETokenSeparator = Object.freeze({
    eTokenSeparatorSpace: muhammara.eTokenSeparatorSpace,
    eTokenSeparatorEndLine: muhammara.eTokenSeparatorEndLine,
    eTokenSeparatorNone: muhammara.eTokenSeparatorNone,
  });

  // A factory instead of module state, so module systems without Node's
  // require.cache (Jest, bundlers) load Recipe too.
  muhammara.Recipe = createRecipe(muhammara);

  return muhammara;
};
