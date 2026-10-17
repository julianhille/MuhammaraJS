var assert = require("chai").assert;
var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
var { writeOutput } = require("./helpers/testOutput");

function createEncryptedPdf(outputPath, version) {
  var writer = muhammara.createWriter(outputPath, {
    version: version,
    userPassword: "user",
    ownerPassword: "owner",
  });

  writer.getDocumentContext().getInfoDictionary().title = "Encrypted";
  var page = writer.createPage(0, 0, 100, 100);
  writer.startPageContentContext(page).re(0, 0, 10, 10).f();
  writer.writePage(page);
  writer.end();
}

/**
 * Reads the decoded content of a PDF's first page.
 * @param {object} reader Reader of the PDF.
 * @returns {string} The content stream as latin1 text.
 */
function readPageContent(reader) {
  var contents = reader.queryDictionaryObject(
    reader.parsePage(0).getDictionary(),
    "Contents",
  );
  var stream = reader.startReadingFromStream(contents.toPDFStream());
  var bytes = [];
  while (stream.notEnded()) bytes.push(...stream.read(4096));
  return Buffer.from(bytes).toString("latin1");
}

/**
 * Opens an encrypted PDF with a password and reads its decrypted Info title
 * and first page content, and the page content of the PDF that `recrypt()`
 * decrypts with that password.
 * @param {string} filePath Path of the encrypted PDF.
 * @param {string} password User or owner password.
 * @returns {{title: string, content: string, recrypted: string}} The
 *   decrypted string and streams.
 */
function readDecrypted(filePath, password) {
  var plainPath = filePath + "-plain-" + password + ".pdf";
  muhammara.recrypt(filePath, plainPath, { password: password });
  var plainReader = muhammara.createReader(plainPath);
  var reader = muhammara.createReader(filePath, { password: password });
  try {
    assert.equal(plainReader.isEncrypted(), false);
    assert.equal(reader.isEncrypted(), true);
    assert.equal(reader.getPagesCount(), 1);
    var info = reader.queryDictionaryObject(reader.getTrailer(), "Info");
    return {
      title: reader.queryDictionaryObject(info, "Title").toText(),
      content: readPageContent(reader),
      recrypted: readPageContent(plainReader),
    };
  } finally {
    // Windows cannot delete the test directory while the files are open.
    reader.end();
    plainReader.end();
  }
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

  /**
   * Encrypts a one-page PDF for the given version, writes it to the test
   * output, and asserts on its encryption dictionary and that both passwords
   * decrypt it.
   * @param {number} version PDF version constant (`muhammara.ePDFVersion*`).
   * @param {string[]} expectedValues Fragments the encryption dictionary must contain.
   */
  function assertEncryptionDictionary(version, expectedValues) {
    var outputPath = path.join(outputDirectory, `version-${version}.pdf`);
    createEncryptedPdf(outputPath, version);
    writeOutput(
      "EncryptionAlgorithms-version-" + version,
      fs.readFileSync(outputPath),
    );

    var pdf = fs.readFileSync(outputPath, "latin1");
    expectedValues.forEach(function (value) {
      assert.include(pdf, value);
    });

    // The owner password decrypts like the user password (#1002).
    ["user", "owner"].forEach(function (password) {
      var decrypted = readDecrypted(outputPath, password);
      assert.equal(decrypted.title, "Encrypted", password);
      assert.include(decrypted.content, "0 0 10 10 re", password);
      assert.include(decrypted.recrypted, "0 0 10 10 re", password);
    });
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
    writeOutput(
      "EncryptionAlgorithms-distinct-aes-ivs",
      fs.readFileSync(outputPath),
    );

    var ivs = readStreamIVs(fs.readFileSync(outputPath));
    assert.isAtLeast(ivs.length, 2);
    assert.notDeepEqual(ivs[0], ivs[1]);
  });
});
