var muhammara = require("@muhammara/native");

// Returns the position of every text-showing operation on a page whose raw
// content matches `text`. Positions use the PDF bottom-left coordinate system.
function findTextPositions(inputPath, pageIndex, text) {
  var reader = muhammara.createReader(inputPath);

  try {
    // Omitted fields keep the built-in default; values above it are clamped.
    return reader
      .extractPageText(pageIndex, { maxTextBytes: 1024 * 1024 })
      .filter(function (element) {
        return element.content === text;
      })
      .map(function (element) {
        return {
          x: element.textMatrix[4],
          y: element.textMatrix[5],
          fontSize: element.fontSize,
          fontResource: element.fontResource,
        };
      });
  } finally {
    reader.end();
  }
}

module.exports = findTextPositions;
