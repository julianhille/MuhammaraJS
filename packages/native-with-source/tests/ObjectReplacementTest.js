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

  it("replaces matching page references globally when requested", function () {
    var sourcePath = __dirname + "/output/ObjectReplacementGlobalSource.PDF";
    var sharedPath = __dirname + "/output/ObjectReplacementShared.PDF";
    var outputPath = __dirname + "/output/ObjectReplacementGlobalOutput.PDF";
    var sourceWriter = muhammara.createWriter(sourcePath);
    var firstPage = sourceWriter.createPage(0, 0, 200, 200);
    var secondPage = sourceWriter.createPage(0, 0, 200, 200);

    sourceWriter
      .startPageContentContext(firstPage)
      .q()
      .re(10, 10, 10, 10)
      .f()
      .Q();
    sourceWriter.writePage(firstPage);
    sourceWriter
      .startPageContentContext(secondPage)
      .q()
      .re(20, 20, 10, 10)
      .f()
      .Q();
    sourceWriter.writePage(secondPage);
    sourceWriter.end();

    var sourceReader = muhammara.createReader(sourcePath);
    var firstPageContentsID = getPageContentsID(sourceReader, 0);
    var secondPageContentsID = getPageContentsID(sourceReader, 1);
    sourceReader.end();

    var sharingWriter = muhammara.createWriterToModify(sourcePath, {
      modifiedFilePath: sharedPath,
    });
    sharingWriter.replaceObject(1, secondPageContentsID, firstPageContentsID);
    sharingWriter.end();

    var writer = muhammara.createWriterToModify(sharedPath, {
      modifiedFilePath: outputPath,
    });
    var objectsContext = writer.getObjectsContext();
    var replacementObjectID = objectsContext.startNewIndirectObject();
    var replacementStream = objectsContext.startPDFStream();

    objectsContext.endPDFStream(replacementStream).endIndirectObject();
    writer.replaceObject(0, firstPageContentsID, replacementObjectID, {
      scope: muhammara.ObjectReplacementScope.GLOBAL,
    });
    writer.end();

    var resultReader = muhammara.createReader(outputPath);
    expect(getPageContentsID(resultReader, 0)).to.equal(replacementObjectID);
    expect(getPageContentsID(resultReader, 1)).to.equal(replacementObjectID);
    resultReader.end();
  });

  it("rejects a writer that does not modify a PDF", function () {
    var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    var notModifying =
      /^createPDFCopyingContextForModifiedFile is only available when modifying a PDF$/;

    expect(function () {
      writer.replaceObject(0, 1, 2);
    }).to.throw(notModifying);
    expect(function () {
      writer.replaceObject(0, 1, 2, {
        scope: muhammara.ObjectReplacementScope.GLOBAL,
      });
    }).to.throw(notModifying);
    expect(function () {
      writer.createPDFCopyingContextForModifiedFile();
    }).to.throw(notModifying);
    writer.end();
  });
});
