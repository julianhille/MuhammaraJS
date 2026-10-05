var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
var malformed = require("./helpers/malformedInputs");

describe("BasicPNGImagesTest", function () {
  it("should complete without error", function () {
    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      __dirname + "/output/BasicPNGImagesTest.pdf",
      { log: __dirname + "/output/BasicPNGImagesTest.log" },
    );

    var pathFillOptions = { color: 0xff0000, colorspace: "rgb", type: "fill" };
    var imageOptions = { transformation: [0.5, 0, 0, 0.5, 0, 0] };

    var page = pdfWriter.createPage(0, 0, 595, 842);
    pdfWriter
      .startPageContentContext(page)
      .drawRectangle(0, 0, 595, 842, pathFillOptions)
      .drawImage(
        10,
        200,
        __dirname + "/TestMaterials/images/png/original.png",
        imageOptions,
      );
    pdfWriter.writePage(page);

    page = pdfWriter.createPage(0, 0, 595, 842);
    pdfWriter
      .startPageContentContext(page)
      .drawRectangle(0, 0, 595, 842, pathFillOptions)
      .drawImage(
        10,
        200,
        __dirname + "/TestMaterials/images/png/original_transparent.png",
        imageOptions,
      );
    pdfWriter.writePage(page);

    page = pdfWriter.createPage(0, 0, 595, 842);
    pdfWriter
      .startPageContentContext(page)
      .drawRectangle(0, 0, 595, 842, pathFillOptions)
      .drawImage(
        10,
        200,
        __dirname + "/TestMaterials/images/png/pnglogo-grr.png",
        imageOptions,
      );
    pdfWriter.writePage(page);

    page = pdfWriter.createPage(0, 0, 595, 842);
    pdfWriter
      .startPageContentContext(page)
      .drawRectangle(0, 0, 595, 842, pathFillOptions)
      .drawImage(
        10,
        200,
        __dirname + "/TestMaterials/images/png/gray-alpha-8-linear.png",
        imageOptions,
      );
    pdfWriter.writePage(page);

    page = pdfWriter.createPage(0, 0, 595, 842);
    pdfWriter
      .startPageContentContext(page)
      .drawRectangle(0, 0, 595, 842, pathFillOptions)
      .drawImage(
        10,
        200,
        __dirname + "/TestMaterials/images/png/gray-16-linear.png",
        imageOptions,
      );
    pdfWriter.writePage(page);

    pdfWriter.end();
  });

  it("embeds a PNG whose rows fail to decode", function () {
    var writer = muhammara.createWriter(
      path.join(__dirname, "output", "FuzzPNGRowError.pdf"),
    );
    // libpng reports the error by longjmp; the row reader catches it, so the
    // image stream is released and the writer stays usable.
    assert.throws(function () {
      writer.createFormXObjectFromPNG(
        path.join(
          malformed.fuzzInputs,
          "image-png-error-while-reading-rows.bin",
        ),
      );
    });
    writer.end();
  });

  it("stops a PNG at the first row that fails to decode", function () {
    // 60000 x 60000 RGBA with one row of data. Padding the missing rows used to
    // push 14 GB of zeros through the compressor.
    var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    assert.throws(function () {
      writer.createFormXObjectFromPNG(
        path.join(
          malformed.fuzzInputs,
          "image-png-truncated-huge-dimensions.bin",
        ),
      );
    }, /unable to create form xobject/);
    writer.end();
  });

  it("keeps the writer usable after a PNG ends early", function () {
    var png = malformed.material("images", "png", "gray-alpha-8-linear.png");
    // Without IEND, libpng fails in png_read_end, after the rows were read. It
    // used to longjmp into the frame that read the rows, which had returned.
    var file = malformed.writeFixture(
      "FuzzNoIEND.png",
      png.subarray(0, png.length - 12),
    );
    var stream = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(stream);
    assert.throws(function () {
      writer.createFormXObjectFromPNG(file);
    }, /unable to create form xobject/);
    writer.writePage(writer.createPage(0, 0, 200, 200));
    writer.end();
    assert.ok(stream.buffer.length > 0);
  });
});
