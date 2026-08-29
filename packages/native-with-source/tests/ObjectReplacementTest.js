var expect = require("chai").expect;
var muhammara = require("..");

function getPageContentsID(reader, pageIndex) {
  return reader
    .parsePage(pageIndex)
    .getDictionary()
    .queryObject("Contents")
    .toPDFIndirectObjectReference()
    .getObjectID();
}

describe("ObjectReplacement", function () {
  it("replaces a direct object reference on only the specified page", function () {
    var sourcePath = __dirname + "/output/ObjectReplacementSource.PDF";
    var outputPath = __dirname + "/output/ObjectReplacementOutput.PDF";
    var sourceWriter = muhammara.createWriter(sourcePath);
    var firstPage = sourceWriter.createPage(0, 0, 200, 200);
    var secondPage = sourceWriter.createPage(0, 0, 200, 200);

    sourceWriter
      .startPageContentContext(firstPage)
      .q()
      .k(100, 0, 0, 0)
      .re(10, 10, 100, 100)
      .f()
      .Q();
    sourceWriter.writePage(firstPage);
    sourceWriter
      .startPageContentContext(secondPage)
      .q()
      .k(0, 100, 0, 0)
      .re(20, 20, 100, 100)
      .f()
      .Q();
    sourceWriter.writePage(secondPage);
    sourceWriter.end();

    var sourceReader = muhammara.createReader(sourcePath);
    var firstPageContentsID = getPageContentsID(sourceReader, 0);
    var secondPageContentsID = getPageContentsID(sourceReader, 1);
    sourceReader.end();

    var writer = muhammara.createWriterToModify(sourcePath, {
      modifiedFilePath: outputPath,
    });
    var objectsContext = writer.getObjectsContext();
    var replacementObjectID = objectsContext.startNewIndirectObject();
    var replacementStream = objectsContext.startPDFStream();

    objectsContext.endPDFStream(replacementStream).endIndirectObject();
    writer.replaceObject(0, firstPageContentsID, replacementObjectID);
    writer.end();

    var resultReader = muhammara.createReader(outputPath);
    expect(getPageContentsID(resultReader, 0)).to.equal(replacementObjectID);
    expect(getPageContentsID(resultReader, 1)).to.equal(secondPageContentsID);
    resultReader.end();
  });
});
