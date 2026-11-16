var assert = require("assert");
var fs = require("fs");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

var output = path.join(__dirname, "../output");

/**
 * Reads every stream of a PDF, decoded, as one latin1 string.
 *
 * @param {string} file - The PDF path.
 * @param {string} password - The user password.
 * @returns {string} The concatenated stream contents.
 */
function readAllStreams(file, password) {
  var reader = muhammara.createReader(file, { password: password });
  var text = "";
  try {
    assert.ok(reader.isEncrypted());
    for (var id = 1; id < reader.getXrefSize(); ++id) {
      var object = reader.parseNewObject(id);
      if (!object || object.getType() !== muhammara.ePDFObjectStream) continue;
      var stream = reader.startReadingFromStream(object);
      while (stream.notEnded()) {
        text += Buffer.from(stream.read(4096)).toString("latin1");
      }
    }
  } finally {
    reader.end();
  }
  return text;
}

/**
 * Reads the document title of a PDF.
 *
 * @param {string} file - The PDF path.
 * @param {string} password - The user password.
 * @returns {string} The /Title of the /Info dictionary.
 */
function readTitle(file, password) {
  var reader = muhammara.createReader(file, { password: password });
  try {
    return reader
      .queryDictionaryObject(reader.getTrailer(), "Info")
      .queryObject("Title")
      .toText();
  } finally {
    reader.end();
  }
}

// Content written after createWriterToContinue() was stored unencrypted
// in a document that keeps its /Encrypt dictionary.
describe("GHSA-fvpv-4wx7-85f6", function () {
  it("encrypts what a continued writer adds to a new encrypted PDF", function () {
    var target = path.join(output, "GHSA-fvpv-4wx7-85f6-new.pdf");
    var state = path.join(output, "GHSA-fvpv-4wx7-85f6-new.state");
    var writer = muhammara.createWriter(target, {
      version: muhammara.ePDFVersion16,
      userPassword: "user",
      ownerPassword: "owner",
      compress: false,
    });
    var page = writer.createPage(0, 0, 200, 200);
    writer.startPageContentContext(page).q().re(1, 2, 3, 4).f().Q();
    writer.writePage(page).shutdown(state);

    writer = muhammara.createWriterToContinue(target, state);
    page = writer.createPage(0, 0, 200, 200);
    writer.startPageContentContext(page).q().re(5, 6, 7, 8).f().Q();
    writer.writePage(page).end();

    assert.ok(!fs.readFileSync(target).includes("5 6 7 8 re"));
    var streams = readAllStreams(target, "user");
    assert.ok(streams.includes("1 2 3 4 re"));
    assert.ok(streams.includes("5 6 7 8 re"));
  });

  it("continues a state of 7.2.3 or earlier encrypted", function () {
    var target = path.join(output, "GHSA-fvpv-4wx7-85f6-old.pdf");
    var state = path.join(output, "GHSA-fvpv-4wx7-85f6-old.state");
    var writer = muhammara.createWriter(target, {
      version: muhammara.ePDFVersion16,
      userPassword: "user",
      ownerPassword: "owner",
      compress: false,
    });
    writer.shutdown(state);
    // 7.2.3 kept one xcryptor as DefaultEncryption; same-length renames keep
    // the offsets of the state file.
    fs.writeFileSync(
      state,
      fs
        .readFileSync(state, "latin1")
        .replace("/StreamsEncryption", "/DefaultEncryption")
        .replace("/StringsEncryption", "/UnusedEncryption0"),
      "latin1",
    );

    writer = muhammara.createWriterToContinue(target, state);
    var page = writer.createPage(0, 0, 200, 200);
    writer.startPageContentContext(page).q().re(5, 6, 7, 8).f().Q();
    writer.writePage(page);
    writer.getDocumentContext().getInfoDictionary().title = "Continued Title";
    writer.end();

    var written = fs.readFileSync(target);
    assert.ok(!written.includes("5 6 7 8 re"));
    assert.ok(!written.includes("Continued Title"));
    assert.ok(readAllStreams(target, "user").includes("5 6 7 8 re"));
    assert.strictEqual(readTitle(target, "user"), "Continued Title");
  });

  it("rejects a state with an AES key of the wrong length", function () {
    var target = path.join(output, "GHSA-fvpv-4wx7-85f6-key.pdf");
    var state = path.join(output, "GHSA-fvpv-4wx7-85f6-key.state");
    var writer = muhammara.createWriter(target, {
      version: muhammara.ePDFVersion16,
      userPassword: "user",
      ownerPassword: "owner",
    });
    writer.shutdown(state);
    var content = fs.readFileSync(state, "latin1");
    assert.ok(content.includes("/XCryptorAlgo 1"));
    // AESV3 with the 16-byte AESV2 key: AES accepts it, but AESV3 keys are
    // 256 bits.
    fs.writeFileSync(
      state,
      content.replaceAll("/XCryptorAlgo 1", "/XCryptorAlgo 2"),
      "latin1",
    );

    assert.throws(function () {
      muhammara.createWriterToContinue(target, state);
    }, /Unable to continue PDF/);

    // AESV2 with a 5-byte key, whose object keys AES rejects; the padding
    // keeps the offsets of the state file.
    fs.writeFileSync(
      state,
      content.replace(
        /\/FileEncryptionKey \((?:\\.|[^\\)])*\)/g,
        function (entry) {
          return "/FileEncryptionKey (12345)".padEnd(entry.length);
        },
      ),
      "latin1",
    );

    assert.throws(function () {
      muhammara.createWriterToContinue(target, state);
    }, /Unable to continue PDF/);
  });

  // Separate, non-StdCF crypt filters for streams and strings.
  it("encrypts what a continued writer adds to a modified PDF", function () {
    var source = path.join(
      __dirname,
      "../TestMaterials/EncryptedTwoCryptFilters.pdf",
    );
    var target = path.join(output, "GHSA-fvpv-4wx7-85f6-modified.pdf");
    var state = path.join(output, "GHSA-fvpv-4wx7-85f6-modified.state");
    var writer = muhammara.createWriterToModify(source, {
      modifiedFilePath: target,
      compress: false,
    });
    writer.shutdown(state);

    writer = muhammara.createWriterToContinue(target, state, {
      modifiedFilePath: source,
    });
    var pageModifier = new muhammara.PDFPageModifier(writer, 0, true);
    pageModifier.startContext().getContext().q().re(5, 6, 7, 8).f().Q();
    pageModifier.endContext().writePage();
    writer.end();

    assert.ok(!fs.readFileSync(target).includes("5 6 7 8 re"));
    var streams = readAllStreams(target, "");
    assert.ok(streams.includes("Hello Secret"));
    assert.ok(streams.includes("5 6 7 8 re"));
  });

  // AESV2 for streams and RC4 for strings.
  it("encrypts a continued writer's streams and strings with their crypt filters", function () {
    var source = path.join(
      __dirname,
      "../TestMaterials/EncryptedAESV2StreamsRC4Strings.pdf",
    );
    var target = path.join(output, "GHSA-fvpv-4wx7-85f6-strings.pdf");
    var state = path.join(output, "GHSA-fvpv-4wx7-85f6-strings.state");
    var writer = muhammara.createWriterToModify(source, {
      modifiedFilePath: target,
      compress: false,
    });
    writer.shutdown(state);

    writer = muhammara.createWriterToContinue(target, state, {
      modifiedFilePath: source,
    });
    var pageModifier = new muhammara.PDFPageModifier(writer, 0, true);
    pageModifier.startContext().getContext().q().re(5, 6, 7, 8).f().Q();
    pageModifier.endContext().writePage();
    writer.getDocumentContext().getInfoDictionary().title = "Continued Title";
    writer.end();

    var written = fs.readFileSync(target);
    assert.ok(!written.includes("5 6 7 8 re"));
    assert.ok(!written.includes("Continued Title"));
    var streams = readAllStreams(target, "");
    assert.ok(streams.includes("(Stream0)"));
    assert.ok(streams.includes("5 6 7 8 re"));
    assert.strictEqual(readTitle(target, ""), "Continued Title");
  });
});
