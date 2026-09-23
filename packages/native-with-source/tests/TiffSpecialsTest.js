var assert = require("chai").assert;
var muhammara = require("@muhammara/native-with-source");

describe("TiffSpecialsTest", function () {
  it("should complete without error", function () {
    function createPageFormImage(inPDFWriter, inImageForm) {
      var page = inPDFWriter.createPage(0, 0, 595, 842);
      inPDFWriter
        .startPageContentContext(page)
        .q()
        .cm(1, 0, 0, 1, 0, 0)
        .doXObject(inImageForm)
        .Q();
      inPDFWriter.writePage(page);
    }

    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      __dirname + "/output/TiffSpecialsTest.pdf",
    );
    var pageCount = pdfWriter.getImagePagesCount(
      __dirname + "/TestMaterials/images/tiff/multipage.tif",
    );
    assert.equal(pageCount, 4, "expected number of pages");

    for (var i = 0; i < 4; ++i) {
      var imageForm = pdfWriter.createFormXObjectFromTIFF(
        __dirname + "/TestMaterials/images/tiff/multipage.tif",
        { pageIndex: i },
      );
      createPageFormImage(pdfWriter, imageForm);
    }

    // ---
    //
    var imagePath = __dirname + "/TestMaterials/images/tiff/jim___ah.tif";
    var imageBW = pdfWriter.createFormXObjectFromTIFF(imagePath);
    var imageBWMask = pdfWriter.createFormXObjectFromTIFF(imagePath, {
      bwTreatment: { asImageMask: true, oneColor: [255, 128, 0] },
    });
    var page = pdfWriter.createPage(0, 0, 595, 842);

    pdfWriter
      .startPageContentContext(page)
      .q()
      .cm(1, 0, 0, 1, 0, 842 - 195.12)
      .doXObject(imageBW)
      .Q()
      .q()
      .cm(1, 0, 0, 1, 159.36, 842 - 195.12)
      .rg(0, 0, 1)
      .re(0, 0, 159.36, 195.12)
      .f()
      .doXObject(imageBWMask)
      .Q();

    pdfWriter.writePage(page);

    // ---

    var imagePath = __dirname + "/TestMaterials/images/tiff/jim___cg.tif";
    var imageGrayScale = pdfWriter.createFormXObjectFromTIFF(imagePath);
    var imageGrayScaleGreen = pdfWriter.createFormXObjectFromTIFF(imagePath, {
      grayscaleTreatment: {
        asColorMap: true,
        oneColor: [0, 255, 0],
        zeroColor: [255, 255, 255],
      },
    });
    var imageGrayScaleCyanMagenta = pdfWriter.createFormXObjectFromTIFF(
      imagePath,
      {
        grayscaleTreatment: {
          asColorMap: true,
          oneColor: [255, 255, 0, 0],
          zeroColor: [0, 0, 0, 0],
        },
      },
    );
    var imageGrayScaleGreenVSRed = pdfWriter.createFormXObjectFromTIFF(
      imagePath,
      {
        grayscaleTreatment: {
          asColorMap: true,
          oneColor: [0, 255, 0],
          zeroColor: [255, 0, 0],
        },
      },
    );
    var imageGrayScaleCyanVSMagenta = pdfWriter.createFormXObjectFromTIFF(
      imagePath,
      {
        grayscaleTreatment: {
          asColorMap: true,
          oneColor: [255, 0, 0, 0],
          zeroColor: [0, 255, 0, 0],
        },
      },
    );

    var page = pdfWriter.createPage(0, 0, 595, 842);

    pdfWriter
      .startPageContentContext(page)
      .q()
      .cm(1, 0, 0, 1, 0, 842 - 195.12)
      .doXObject(imageGrayScale)
      .Q()
      .q()
      .cm(1, 0, 0, 1, 159.36, 842 - 195.12)
      .doXObject(imageGrayScaleGreen)
      .Q()
      .q()
      .cm(1, 0, 0, 1, 159.36 * 2, 842 - 195.12)
      .doXObject(imageGrayScaleCyanMagenta)
      .Q()
      .q()
      .cm(1, 0, 0, 1, 0, 842 - 195.12 * 2)
      .doXObject(imageGrayScaleGreenVSRed)
      .Q()
      .q()
      .cm(1, 0, 0, 1, 159.36, 842 - 195.12 * 2)
      .doXObject(imageGrayScaleCyanVSMagenta)
      .Q();

    pdfWriter.writePage(page);

    // ---

    pdfWriter.end();
  });

  it("rejects invalid colors before processing the TIFF", function () {
    var output = __dirname + "/output/TiffSpecialsInvalidColors.pdf";
    var image = __dirname + "/TestMaterials/images/tiff/jim___ah.tif";
    var pdfWriter = muhammara.createWriter(output);
    var objectsContext = pdfWriter.getObjectsContext();
    var objectIdBeforeValidation = objectsContext.allocateNewObjectID();
    var invalidOptions = [
      { bwTreatment: { oneColor: [1, 2] } },
      { grayscaleTreatment: { oneColor: [1, 2] } },
      { grayscaleTreatment: { zeroColor: [1, 2] } },
    ];

    invalidOptions.forEach(function (options) {
      var error = assert.throws(function () {
        pdfWriter.createFormXObjectFromTIFF(image, options);
      }, /array of either 3 or 4 colors/);
      assert.instanceOf(error, TypeError);
    });

    assert.throws(function () {
      pdfWriter.createFormXObjectFromTIFF(image, {
        bwTreatment: {
          oneColor: [
            0,
            {
              valueOf: function () {
                throw new Error("TIFF color coercion failed");
              },
            },
            0,
          ],
        },
      });
    }, /TIFF color coercion failed/);

    var objectIdAfterValidation = objectsContext.allocateNewObjectID();
    assert.equal(
      objectIdAfterValidation,
      objectIdBeforeValidation + 1,
      "invalid TIFF options must not allocate PDF objects",
    );
    [objectIdBeforeValidation, objectIdAfterValidation].forEach(function (id) {
      var form = pdfWriter.createFormXObject(0, 0, 10, 10, id);
      pdfWriter.endFormXObject(form);
    });

    pdfWriter.writePage(pdfWriter.createPage(0, 0, 100, 100));
    pdfWriter.end();

    var reader = muhammara.createReader(output);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });
});
