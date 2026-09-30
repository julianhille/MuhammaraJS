var assert = require("assert");
var muhammara = require("@muhammara/native-with-source");

describe("RetrieveJPGImageInformation", function () {
  it("reads JFIF/Exif/Photoshop density metadata from a JPEG file", function () {
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/RetrieveJPGImageInformation.pdf",
    );
    var information = pdfWriter.retrieveJPGImageInformation(
      __dirname + "/TestMaterials/images/otherStage.JPG",
    );

    assert.ok(information.samplesWidth > 0);
    assert.ok(information.samplesHeight > 0);
    assert.ok(information.colorComponentsCount > 0);
    [
      ["JFIFInformationExists", ["JFIFUnit", "JFIFXDensity", "JFIFYDensity"]],
      ["ExifInformationExists", ["ExifUnit", "ExifXDensity", "ExifYDensity"]],
      [
        "PhotoshopInformationExists",
        ["PhotoshopXDensity", "PhotoshopYDensity"],
      ],
    ].forEach(function ([exists, fields]) {
      assert.equal(typeof information[exists], "boolean");
      fields.forEach(function (field) {
        assert.equal(field in information, information[exists]);
      });
    });

    assert.throws(function () {
      pdfWriter.retrieveJPGImageInformation(
        __dirname + "/TestMaterials/images/png/original.png",
      );
    });
    assert.throws(function () {
      pdfWriter.retrieveJPGImageInformation(
        __dirname + "/TestMaterials/does-not-exist.jpg",
      );
    });

    pdfWriter.end();
  });

  [
    // otherStage.JPG is 180 dpi, so it measures 72/180 of its samples.
    ["baseline", "images/otherStage.JPG", 1600, 1200, 3, 640, 480],
    ["baseline Adobe", "images/soundcloud_logo.jpg", 550, 350, 3, 550, 350],
    ["progressive", "recipe/myCats.jpg", 720, 960, 3, 720, 960],
    ["grayscale", "images/grayscale.jpg", 40, 30, 1, 40, 30],
    ["CMYK", "images/cmyk.jpg", 36, 24, 4, 36, 24],
  ].forEach(function ([kind, file, width, height, components, w, h]) {
    it("reads the size and components of a " + kind + " JPEG", function () {
      var pdfWriter = muhammara.createWriter(
        new muhammara.PDFWStreamForBuffer(),
      );
      var information = pdfWriter.retrieveJPGImageInformation(
        __dirname + "/TestMaterials/" + file,
      );

      assert.equal(information.samplesWidth, width);
      assert.equal(information.samplesHeight, height);
      assert.equal(information.colorComponentsCount, components);
      assert.deepEqual(
        pdfWriter.getImageDimensions(__dirname + "/TestMaterials/" + file),
        { width: w, height: h },
      );
      pdfWriter.end();
    });
  });
});
