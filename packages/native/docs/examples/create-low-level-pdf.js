var muhammara = require("../../lib/muhammara");

function createLowLevelPdf(outputPath) {
  var writer = muhammara.createWriter(outputPath);
  var page = writer.createPage(0, 0, 595, 842);

  writer.writePage(page);
  writer.end();
}

module.exports = createLowLevelPdf;
