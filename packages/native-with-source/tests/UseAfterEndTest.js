var assert = require("chai").assert;
var muhammara = require("@muhammara/native-with-source");

describe("UseAfterEndTest", function () {
  it("should reject all PDF reader use after end", function () {
    var reader = muhammara.createReader(
      __dirname + "/TestMaterials/XObjectContent.PDF",
    );
    var methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(reader),
    ).filter(function (method) {
      return method !== "constructor" && method !== "end";
    });

    reader.end();
    reader.end();

    methods.forEach(function (method) {
      assert.throws(
        function () {
          reader[method]();
        },
        /PDF reader has ended/,
        method,
      );
    });
  });

  it("should reject copying context use after end", function () {
    var writer = muhammara.createWriter(
      __dirname + "/output/UseAfterEndTest.PDF",
    );
    var copyingContext = writer.createPDFCopyingContext(
      __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
    );

    copyingContext.end();

    assert.throws(function () {
      copyingContext.getSourceDocumentParser();
    }, /PDF copying context has ended/);
    writer.end();
  });

  it("should reject a source reader after its copying context ends", function () {
    var writer = muhammara.createWriter(
      __dirname + "/output/UseSourceReaderAfterEndTest.PDF",
    );
    var copyingContext = writer.createPDFCopyingContext(
      __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
    );
    var reader = copyingContext.getSourceDocumentParser();

    copyingContext.end();

    assert.throws(function () {
      reader.getPagesCount();
    }, /PDF reader has ended/);
    reader.end();
    writer.end();
  });

  it("should reject an ended reader when creating a copying context", function () {
    var reader = muhammara.createReader(
      __dirname + "/TestMaterials/XObjectContent.PDF",
    );
    var writer = muhammara.createWriter(
      __dirname + "/output/UseEndedReaderCopyingContextTest.PDF",
    );
    reader.end();

    assert.throws(function () {
      writer.createPDFCopyingContext(reader);
    }, /PDF reader has ended/);
    writer.end();
  });

  it("should reject a copying context after its source reader ends", function () {
    var reader = muhammara.createReader(
      __dirname + "/TestMaterials/XObjectContent.PDF",
    );
    var writer = muhammara.createWriter(
      __dirname + "/output/UseCopyingContextAfterReaderEndTest.PDF",
    );
    var copyingContext = writer.createPDFCopyingContext(reader);

    reader.end();

    assert.throws(function () {
      copyingContext.appendPDFPageFromPDF(0);
    });
    copyingContext.end();
    writer.end();
  });
});
