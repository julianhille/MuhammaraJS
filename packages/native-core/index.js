"use strict";

var path = require("path");

/**
 * Attach the shared JavaScript API to an implementation package's loaded addon.
 *
 * @param {object} muhammara The native addon loaded by an implementation package.
 * @returns {object} The public MuhammaraJS API.
 */
exports.createMuhammara = function createMuhammara(muhammara) {
  var bindingModule = require.resolve("./lib/muhammara");
  var recipeDirectory = path.join(__dirname, "lib", "recipe") + path.sep;

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

  Object.keys(require.cache).forEach(function (filename) {
    if (
      filename === require.resolve("./lib/Recipe") ||
      filename.startsWith(recipeDirectory)
    ) {
      delete require.cache[filename];
    }
  });

  // Recipe modules historically import lib/muhammara directly. Supply this
  // factory's addon while they initialize, without retaining global addon state.
  require.cache[bindingModule] = {
    id: bindingModule,
    filename: bindingModule,
    loaded: true,
    exports: muhammara,
  };
  try {
    muhammara.Recipe = require("./lib/Recipe");
  } finally {
    delete require.cache[bindingModule];
  }

  return muhammara;
};
