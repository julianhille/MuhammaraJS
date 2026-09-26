var assert = require("chai").assert;
var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

function createEncryptedPdf(outputPath, version) {
  var writer = muhammara.createWriter(outputPath, {
    version: version,
    userPassword: "user",
    ownerPassword: "owner",
  });

  writer.writePage(writer.createPage(0, 0, 100, 100));
  writer.end();
}

function readStreamIVs(pdf) {
  var marker = Buffer.from("stream");
  var ivs = [];
  var offset = 0;

  while ((offset = pdf.indexOf(marker, offset)) !== -1) {
    var contentOffset = offset + marker.length;
    var previous = pdf[offset - 1];
    if (
      (previous === 0x0a || previous === 0x0d || previous === 0x20) &&
      (pdf[contentOffset] === 0x0a || pdf[contentOffset] === 0x0d)
    ) {
      if (pdf[contentOffset] === 0x0d) contentOffset++;
      if (pdf[contentOffset] === 0x0a) contentOffset++;
      ivs.push(pdf.subarray(contentOffset, contentOffset + 16));
    }
    offset += marker.length;
  }

  return ivs;
}

describe("Encryption algorithms", function () {
  var outputDirectory;

  beforeEach(function () {
    outputDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "muhammara-encryption-"),
    );
  });

  afterEach(function () {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  });

  function assertEncryptionDictionary(version, expectedValues) {
    var outputPath = path.join(outputDirectory, `version-${version}.pdf`);
    createEncryptedPdf(outputPath, version);

    var pdf = fs.readFileSync(outputPath, "latin1");
    expectedValues.forEach(function (value) {
      assert.include(pdf, value);
    });

    var reader = muhammara.createReader(outputPath, { password: "user" });
    assert.equal(reader.isEncrypted(), true);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  }

  it("uses 40-bit RC4 for PDF 1.3", function () {
    assertEncryptionDictionary(muhammara.ePDFVersion13, ["/V 1", "/R 2"]);
  });

  it("uses 128-bit RC4 for PDF 1.4", function () {
    assertEncryptionDictionary(muhammara.ePDFVersion14, [
      "/V 2",
      "/Length 128",
    ]);
  });

  it("uses 128-bit AESV2 for PDF 1.6", function () {
    assertEncryptionDictionary(muhammara.ePDFVersion16, [
      "/V 4",
      "/Length 128",
      "/CFM /AESV2",
    ]);
  });

  it("uses 128-bit AESV2 for PDF 1.7", function () {
    assertEncryptionDictionary(muhammara.ePDFVersion17, [
      "/V 4",
      "/Length 128",
      "/CFM /AESV2",
    ]);
  });

  it("uses 256-bit AESV3 for PDF 2.0", function () {
    assertEncryptionDictionary(muhammara.ePDFVersion20, [
      "/V 5",
      "/Length 256",
      "/CFM /AESV3",
    ]);
  });

  it("generates a distinct IV for each AES-encrypted stream", function () {
    var outputPath = path.join(outputDirectory, "distinct-aes-ivs.pdf");
    var writer = muhammara.createWriter(outputPath, {
      compress: false,
      version: muhammara.ePDFVersion17,
      userPassword: "user",
      ownerPassword: "owner",
    });

    for (var index = 0; index < 2; index++) {
      var page = writer.createPage(0, 0, 100, 100);
      writer.startPageContentContext(page).q().re(1, 1, 10, 10).f().Q();
      writer.writePage(page);
    }
    writer.end();

    var ivs = readStreamIVs(fs.readFileSync(outputPath));
    assert.isAtLeast(ivs.length, 2);
    assert.notDeepEqual(ivs[0], ivs[1]);
  });
});
