function escapePDFLiteralString(value) {
  return value.replace(/([\\()])/g, "\\$1");
}

function oneByteString(bytes) {
  var result = "";
  for (var offset = 0; offset < bytes.length; offset += 0x8000) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return result;
}

/** Creates literal page-content text replacement methods. */
export function createReplaceTextMethods(encoder) {
  return {
    /**
     * Replaces literal text-showing operands in a page's single content stream.
     *
     * @param {string} text Text to replace.
     * @param {string} replacement Replacement text.
     * @param {number} [pageNumber=1] One-based page number.
     * @returns {this}
     */
    replaceText: function (text, replacement, pageNumber) {
      pageNumber = pageNumber || 1;
      if (typeof text !== "string" || typeof replacement !== "string") {
        throw new TypeError("replaceText expects text and replacement strings");
      }

      var parser = this.writer.getModifiedFileParser();
      var contentsObjectId;
      var source = "";
      try {
        var page = parser
          .parsePage(pageNumber - 1)
          .getDictionary()
          .toPDFDictionary();
        var contents = page.exists("Contents")
          ? page.queryObject("Contents")
          : null;
        var reference = contents?.toPDFIndirectObjectReference();
        if (!reference) {
          throw new Error("replaceText supports pages with one content stream");
        }
        contentsObjectId = reference.getObjectID();
        var stream = parser.parseNewObject(contentsObjectId).toPDFStream();
        var streamReader = parser.startReadingFromStream(stream);
        while (streamReader.notEnded()) {
          source += oneByteString(new Uint8Array(streamReader.read(65536)));
        }
      } finally {
        parser.end();
      }

      var textPattern = new RegExp(
        "\\(" + escapePDFLiteralString(text) + "\\)(\\s+Tj\\b)",
        "g",
      );
      var replaced = source.replace(
        textPattern,
        "(" + escapePDFLiteralString(replacement) + ")$1",
      );
      if (replaced === source) return this;

      var objectsContext = this.writer.getObjectsContext();
      var replacementObjectId = objectsContext.startNewIndirectObject();
      var replacementStream = objectsContext.startUnfilteredPDFStream();
      replacementStream.getWriteStream().write(encoder.encode(replaced));
      objectsContext.endPDFStream(replacementStream).endIndirectObject();
      this.writer.replaceObject(
        pageNumber - 1,
        contentsObjectId,
        replacementObjectId,
      );
      return this;
    },
  };
}
