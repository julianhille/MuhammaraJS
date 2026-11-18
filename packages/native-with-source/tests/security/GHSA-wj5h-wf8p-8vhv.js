var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

/**
 * Reads every stream of a PDF, decoded, as one latin1 string.
 *
 * @param {object} reader - A muhammara PDF reader.
 * @returns {string} The concatenated stream contents.
 */
function readAllStreams(reader) {
  var text = "";
  for (var id = 1; id < reader.getXrefSize(); ++id) {
    var object = reader.parseNewObject(id);
    if (!object || object.getType() !== muhammara.ePDFObjectStream) continue;
    var stream = reader.startReadingFromStream(object);
    while (stream.notEnded()) {
      text += Buffer.from(stream.read(4096)).toString("latin1");
    }
  }
  return text;
}

// Both fixtures are V4 encrypted documents whose /StmF does not name a
// working crypt filter: /StmF /Identity with AES-encrypted strings, and a
// StdCF with /CFM /None. Writing a stream while modifying them read a null
// stream xcryptor.
describe("GHSA-wj5h-wf8p-8vhv", function () {
  [
    ["/StmF /Identity", "EncryptedStmFIdentity.pdf"],
    ["/CFM /None", "EncryptedCFMNone.pdf"],
  ].forEach(function ([name, fixture]) {
    it(`modifies an encrypted PDF with ${name}`, function () {
      var source = path.join(__dirname, "../TestMaterials", fixture);
      var target = path.join(
        __dirname,
        "../output/GHSA-wj5h-wf8p-8vhv-" + fixture,
      );
      var writer = muhammara.createWriterToModify(source, {
        modifiedFilePath: target,
        compress: false,
      });
      var pageModifier = new muhammara.PDFPageModifier(writer, 0, true);
      pageModifier.startContext().getContext().q().re(7, 8, 9, 10).f().Q();
      pageModifier.endContext().writePage();
      writer.end();

      var reader = muhammara.createReader(target);
      try {
        assert.ok(reader.isEncrypted());
        var streams = readAllStreams(reader);
        assert.ok(streams.includes("Hello Secret"));
        assert.ok(streams.includes("7 8 9 10 re"));
        assert.strictEqual(
          reader.parseNewObject(2).queryObject("Title").toText(),
          "Secret Title",
        );
      } finally {
        reader.end();
      }
    });
  });
});
