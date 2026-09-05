var muhammara = require("@muhammara/native");

// Reports the zero-based index of every page that puts no mark on the page.
// extractPageContentItems only walks the content stream, so this does not
// decode fonts or resolve resources the way text extraction would.
function detectBlankPages(inputPath) {
  var reader = muhammara.createReader(inputPath);

  try {
    var blankPages = [];

    for (var pageIndex = 0; pageIndex < reader.getPagesCount(); ++pageIndex) {
      // Untrusted input: tighten the budget below the built-in ceilings.
      // Higher values would be clamped back down to them.
      var items = reader.extractPageContentItems(pageIndex, {
        maxElements: 1000,
        maxParsedObjects: 100000,
      });

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
