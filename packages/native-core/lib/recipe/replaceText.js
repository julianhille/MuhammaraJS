function escapePDFLiteralString(value) {
  return value.replace(/([\\()])/g, "\\$1");
}

/**
 * Replace literal text-showing operands in a page's single content stream.
 *
 * @name replaceText
 * @function
 * @memberof Recipe#
 * @param {string} text Text to replace.
 * @param {string} replacement Replacement text.
 * @param {number} [pageNumber=1] One-based page number.
 */
exports.replaceText = function replaceText(text, replacement, pageNumber) {
  pageNumber = pageNumber || 1;

  if (typeof text !== "string" || typeof replacement !== "string") {
    throw new TypeError("replaceText expects text and replacement strings");
  }

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
  var stream = this.pdfReader.parseNewObject(contentsObjectId).toPDFStream();
  var streamReader = this.pdfReader.startReadingFromStream(stream);
  var chunks = [];

  while (streamReader.notEnded()) {
    chunks.push(Buffer.from(streamReader.read(65536)));
  }

  var source = Buffer.concat(chunks).toString("latin1");
  var textPattern = new RegExp(
    "\\(" + escapePDFLiteralString(text) + "\\)(\\s+Tj\\b)",
    "g",
  );
  var replaced = source.replace(
    textPattern,
    "(" + escapePDFLiteralString(replacement) + ")$1",
  );

  if (replaced === source) {
    return this;
  }

  var objectsContext = this.writer.getObjectsContext();
  var replacementObjectId = objectsContext.startNewIndirectObject();
  var replacementStream = objectsContext.startUnfilteredPDFStream();

  replacementStream.getWriteStream().write(Array.from(Buffer.from(replaced)));
  objectsContext.endPDFStream(replacementStream).endIndirectObject();
  this.writer.replaceObject(pageIndex, contentsObjectId, replacementObjectId);
  return this;
};
