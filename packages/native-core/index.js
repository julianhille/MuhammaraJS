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

  muhammara.PDFWriter.prototype.getEvents = function () {
    if (!this.events) this.events = new (require("events").EventEmitter)();
    return this.events;
  };
  muhammara.PDFWriter.prototype.triggerDocumentExtensionEvent = function (
    eventName,
    eventParams,
  ) {
    eventParams.writer = this;
    this.getEvents().emit(eventName, eventParams);
  };
  muhammara.PDFStreamForResponse = require("./lib/PDFStreamForResponse");
  muhammara.PDFWStreamForFile = require("./lib/PDFWStreamForFile");
  muhammara.PDFRStreamForFile = require("./lib/PDFRStreamForFile");
  muhammara.PDFRStreamForBuffer = require("./lib/PDFRStreamForBuffer");
  muhammara.PDFWStreamForBuffer = require("./lib/PDFWStreamForBuffer");

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
