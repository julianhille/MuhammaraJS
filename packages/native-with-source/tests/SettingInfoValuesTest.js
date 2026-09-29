var muhammara = require("@muhammara/native-with-source");
var assert = require("chai").assert;

/**
 * Creates a Date that reports its local time in a fixed UTC offset, such as
 * India's +05:30, so the test does not depend on the process time zone.
 * Changing TZ at runtime is not applied consistently in Electron.
 * @param {number} time - Milliseconds since the Unix epoch.
 * @param {number} offset - Minutes east of UTC.
 * @returns {Date} The date, with local-time getters for that offset.
 */
function zonedDate(time, offset) {
  var date = new Date(time);
  var local = new Date(time + offset * 60000);
  date.getTimezoneOffset = () => -offset;
  date.getFullYear = () => local.getUTCFullYear();
  date.getMonth = () => local.getUTCMonth();
  date.getDate = () => local.getUTCDate();
  date.getHours = () => local.getUTCHours();
  date.getMinutes = () => local.getUTCMinutes();
  date.getSeconds = () => local.getUTCSeconds();
  return date;
}

describe("SettingInfoValues", function () {
  it("should complete without error", function () {
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/SettingInfoValues.pdf",
      { version: muhammara.ePDFVersion14 },
    );

    // set the document author, title, subject, creator, creation date, additional info
    var infoDictionary = pdfWriter.getDocumentContext().getInfoDictionary();

    infoDictionary.author = "Gal Kahana";
    infoDictionary.title = "PDFHummus explained";
    infoDictionary.subject =
      "On the wonders of one-pass PDF file generation, and how it can save the world";
    infoDictionary.creator = "PDFHummus";
    infoDictionary.setCreationDate("D:20140720204655+03'00'"); // two options to set dates: 1. PDF encoded string (like what comes from the parser)
    infoDictionary.setModDate(new Date()); // 2. javascript date
    infoDictionary.setModDate(new muhammara.PDFDate("D:20150101000000Z")); // 3. PDFDate
    infoDictionary.addAdditionalInfoEntry("words of praise", "amazing");
    assert.deepEqual(infoDictionary.getAdditionalInfoEntries(), {
      "words of praise": "amazing",
    });

    // create empty page
    var page = pdfWriter.createPage();
    page.mediaBox = [0, 0, 595, 842];
    pdfWriter.writePage(page);
    pdfWriter.end();

    var reader = muhammara.createReader(
      __dirname + "/output/SettingInfoValues.pdf",
    );
    var info = reader
      .queryDictionaryObject(reader.getTrailer(), "Info")
      .toJSObject();
    assert.equal(reader.getPagesCount(), 1);
    assert.equal(info.Author.toText(), "Gal Kahana");
    assert.equal(info.Title.toText(), "PDFHummus explained");
    assert.equal(
      info.Subject.toText(),
      "On the wonders of one-pass PDF file generation, and how it can save the world",
    );
    assert.equal(info.Creator.toText(), "PDFHummus");
    assert.equal(info.CreationDate.value, "D:20140720204655+03'00'");
    assert.equal(info.ModDate.value, "D:20150101000000Z");
    assert.equal(info["words of praise"].toText(), "amazing");
    reader.end();
  });

  it("should reject invalid dates instead of aborting", function () {
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/SettingInfoValuesInvalidDate.pdf",
    );
    var infoDictionary = pdfWriter.getDocumentContext().getInfoDictionary();

    [[], [42], [null], ["D:20140720204655+03'00'", 42]].forEach(
      function (args) {
        ["setCreationDate", "setModDate"].forEach(function (method) {
          assert.throws(function () {
            infoDictionary[method].apply(infoDictionary, args);
          }, /Provide 1 argument which is a date/);
        });
      },
    );

    pdfWriter.writePage(pdfWriter.createPage(0, 0, 595, 842));
    pdfWriter.end();
  });
  it("writes a Date's time zone offset with its minutes", function () {
    var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    var time = Date.UTC(2026, 0, 2, 3, 4, 5);
    [
      [330, "D:20260102083405+05'30'"],
      [-210, "D:20260101233405-03'30'"],
      [60, "D:20260102040405+01'00'"],
    ].forEach(function ([offset, expected]) {
      var date = zonedDate(time, offset);
      assert.equal(writer.createPDFDate(date).toString(), expected);
      assert.equal(new muhammara.PDFDate(date).toString(), expected);
    });
  });
});
