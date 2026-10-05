var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
var malformed = require("./helpers/malformedInputs");

describe("BasicJPGImagesTest", function () {
  it("should complete without error", function () {
    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      __dirname + "/output/BasicJPGImagesTest.PDF",
    );

    var page = pdfWriter.createPage(0, 0, 595, 842);
    var contentContext = pdfWriter
      .startPageContentContext(page)
      .q()
      .k(100, 0, 0, 0)
      .re(500, 0, 100, 100)
      .f()
      .Q();
    // pause  page content placement so i can now put image data into the file
    pdfWriter.pausePageContentContext(contentContext);

    var imageXObject = pdfWriter.createImageXObjectFromJPG(
      __dirname + "/TestMaterials/images/otherStage.JPG",
    );

    // now continue with page content placement
    contentContext.q().cm(500, 0, 0, 400, 0, 0).doXObject(imageXObject).Q();

    // now the same, but with form (which will already have the right size)
    pdfWriter.pausePageContentContext(contentContext);

    var formXObject = pdfWriter.createFormXObjectFromJPG(
      __dirname + "/TestMaterials/images/otherStage.JPG",
    );
    contentContext.q().cm(1, 0, 0, 1, 0, 400).doXObject(formXObject).Q();

    pdfWriter.writePage(page);
    pdfWriter.end();
  });

  it("ends a DCTDecode stream at a JPEG decoding error", function () {
    var pdfPath = path.join(__dirname, "output", "FuzzCorruptJPEG.pdf");
    var writer = muhammara.createWriter(pdfPath);
    var image = writer.createImageXObjectFromJPG(
      path.join(malformed.fuzzInputs, "image-corrupt-jpeg-scan-data.bin"),
    );
    var page = writer.createPage(0, 0, 595, 842);
    writer
      .startPageContentContext(page)
      .q()
      .cm(100, 0, 0, 100, 0, 0)
      .doXObject(image)
      .Q();
    writer.writePage(page);
    writer.end();

    var reader = muhammara.createReader(pdfPath);
    var streams = 0;
    for (var id = 1; id < reader.getXrefSize(); ++id) {
      var object = reader.parseNewObject(id);
      if (!object || object.getType() !== muhammara.ePDFObjectStream) continue;
      var stream = reader.queryDictionaryObject(
        object.getDictionary(),
        "Filter",
      );
      if (!stream || stream.value !== "DCTDecode") continue;
      ++streams;
      var bytes = reader.startReadingFromStream(object);
      var total = 0;
      for (var reads = 0; bytes.notEnded(); ++reads) {
        assert.ok(reads < 1000, "the stream keeps reporting unread data");
        total += bytes.read(65536).length;
      }
      assert.ok(total >= 0);
    }
    assert.equal(streams, 1);
  });
});
