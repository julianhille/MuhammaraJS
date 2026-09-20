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
});
