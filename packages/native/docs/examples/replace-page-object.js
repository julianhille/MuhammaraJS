var muhammara = require("@muhammara/native");

function replacePageObject(inputPath, outputPath) {
  var reader = muhammara.createReader(inputPath);
  var contentsId = reader
    .parsePage(0)
    .getDictionary()
    .queryObject("Contents")
    .toPDFIndirectObjectReference()
    .getObjectID();

  reader.end();

  var writer = muhammara.createWriterToModify(inputPath, {
    modifiedFilePath: outputPath,
  });
  var objectsContext = writer.getObjectsContext();
  var replacementId = objectsContext.startNewIndirectObject();
  var replacement = objectsContext.startPDFStream();

  replacement.getWriteStream().write(Array.from(Buffer.from("BT ET")));
  objectsContext.endPDFStream(replacement).endIndirectObject();
  writer.replaceObject(0, contentsId, replacementId);
  writer.end();
}

module.exports = replacePageObject;
