var muhammara = require("@muhammara/native");

// Reports the zero-based index of every page that puts no mark on the page.
// extractPageContentItems only walks the content stream, so this does not
// decode fonts or resolve resources the way text extraction would.
function detectBlankPages(inputPath) {
  var reader = muhammara.createReader(inputPath);

  try {
    var blankPages = [];

    for (var pageIndex = 0; pageIndex < reader.getPagesCount(); ++pageIndex) {
      var items;

      try {
        // Untrusted input: tighten the budget below the built-in ceilings.
        // Higher values would be clamped back down to them.
        items = reader.extractPageContentItems(pageIndex, {
          maxElements: 1000,
          maxParsedObjects: 100000,
        });
      } catch (error) {
        // Over budget means the page holds more marks than the budget allows,
        // which already answers the question: it is not blank. A chart or a
        // ruled table reaches this easily, so do not let it end the scan.
        if (!/exceeds item extraction limits/.test(error.message)) {
          throw error;
        }
        continue;
      }

      if (items.length === 0) {
        blankPages.push(pageIndex);
      }
    }

    return blankPages;
  } finally {
    reader.end();
  }
}

module.exports = detectBlankPages;
