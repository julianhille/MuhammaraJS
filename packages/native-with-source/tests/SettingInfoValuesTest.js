var muhammara = require("@muhammara/native-with-source");
var assert = require("chai").assert;
var fs = require("fs");

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

/**
 * Reads the Info dictionary a reader follows: strings as their bytes, in
 * latin1, so that a changed encoding shows, and names as their value.
 * @param {Buffer} pdf - The PDF.
 * @returns {Object<string, string>} The entries by key.
 */
function readInfo(pdf) {
  var reader = muhammara.createReader(new muhammara.PDFRStreamForBuffer(pdf));
  var info = reader
    .queryDictionaryObject(reader.getTrailer(), "Info")
    .toJSObject();
  var entries = {};
  Object.keys(info).forEach(function (key) {
    entries[key] = info[key].toBytesArray
      ? Buffer.from(info[key].toBytesArray()).toString("latin1")
      : info[key].value;
  });
  reader.end();
  return entries;
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

    [[], [42], ["D:20140720204655+03'00'", 42]].forEach(function (args) {
      ["setCreationDate", "setModDate"].forEach(function (method) {
        assert.throws(function () {
          infoDictionary[method].apply(infoDictionary, args);
        }, /Provide 1 argument which is a date/);
      });
    });

    pdfWriter.writePage(pdfWriter.createPage(0, 0, 595, 842));
    pdfWriter.end();
  });
  it("keeps a custom entry named like a field apart from it", function () {
    var stream = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(stream);
    var info = writer.getDocumentContext().getInfoDictionary();
    info.addAdditionalInfoEntry("title", "custom");
    info.title = "field";
    assert.equal(info.title, "field");
    assert.equal(info.getAdditionalInfoEntry("title"), "custom");
    writer.writePage(writer.createPage(0, 0, 10, 10));
    writer.end();
    var pdf = stream.buffer.toString("latin1");
    assert.include(pdf, "/Title (field)");
    assert.include(pdf, "/title (custom)");
  });

  it("writes a custom entry under a field's Info key in place of the field", function () {
    var source = new muhammara.PDFWStreamForBuffer();
    var sourceWriter = muhammara.createWriter(source);
    sourceWriter.writePage(sourceWriter.createPage(0, 0, 10, 10));
    sourceWriter.end();
    var keys = ["Title", "Trapped", "CreationDate", "ModDate"];
    [false, true].forEach(function (modify) {
      var stream = new muhammara.PDFWStreamForBuffer();
      var writer = modify
        ? muhammara.createWriterToModify(
            new muhammara.PDFRStreamForBuffer(source.buffer),
            stream,
          )
        : muhammara.createWriter(stream);
      var info = writer.getDocumentContext().getInfoDictionary();
      info.title = "field";
      info.trapped = muhammara.EInfoTrappedTrue;
      info.setCreationDate("D:20200102030405Z");
      info.setModDate("D:20200102030405Z");
      keys.forEach(function (key) {
        info.addAdditionalInfoEntry(key, "custom");
      });
      assert.equal(info.title, "");
      assert.equal(info.trapped, muhammara.EInfoTrappedUnknown);
      if (!modify) writer.writePage(writer.createPage(0, 0, 10, 10));
      writer.end();
      var pdf = stream.buffer.toString("latin1");
      // each key once, with the custom value
      keys.forEach(function (key) {
        assert.deepEqual(pdf.match(new RegExp("/" + key + " .*", "g")), [
          "/" + key + " (custom)",
        ]);
      });
    });
  });

  it("writes a field set after a custom entry under its Info key in place of the entry", function () {
    var source = new muhammara.PDFWStreamForBuffer();
    var sourceWriter = muhammara.createWriter(source);
    sourceWriter.writePage(sourceWriter.createPage(0, 0, 10, 10));
    sourceWriter.end();
    var texts = [
      "Title",
      "Author",
      "Subject",
      "Keywords",
      "Creator",
      "Producer",
    ];
    var keys = texts.concat("CreationDate", "ModDate", "Trapped", "Department");
    var date = "D:20200102030405Z";
    /**
     * Sets every field after a custom entry under its Info key.
     * @param {boolean} modify - Whether to modify a PDF.
     * @param {boolean} clear - Whether to clear the fields.
     * @returns {Object<string, string>} The Info entries a reader sees.
     */
    function write(modify, clear) {
      var stream = new muhammara.PDFWStreamForBuffer();
      var writer = modify
        ? muhammara.createWriterToModify(
            new muhammara.PDFRStreamForBuffer(source.buffer),
            stream,
          )
        : muhammara.createWriter(stream);
      var info = writer.getDocumentContext().getInfoDictionary();
      keys.forEach(function (key) {
        info.addAdditionalInfoEntry(key, "custom");
      });
      // each setter takes only the entry under its own key
      texts.forEach(function (key, index) {
        info[key.toLowerCase()] = clear ? "" : "field";
        assert.equal(info.getAdditionalInfoEntry(keys[index + 1]), "custom");
      });
      info.setCreationDate(clear ? null : date);
      assert.equal(info.getAdditionalInfoEntry("ModDate"), "custom");
      info.setModDate(clear ? null : date);
      // and a set that throws takes none
      assert.throws(function () {
        info.trapped = "True";
      });
      assert.equal(info.getAdditionalInfoEntry("Trapped"), "custom");
      info.trapped = clear
        ? muhammara.EInfoTrappedUnknown
        : muhammara.EInfoTrappedTrue;
      assert.deepEqual(info.getAdditionalInfoEntries(), {
        Department: "custom",
      });
      if (!modify) writer.writePage(writer.createPage(0, 0, 10, 10));
      writer.end();
      return readInfo(stream.buffer);
    }
    [false, true].forEach(function (modify) {
      // each key once, with the field's value
      assert.deepEqual(write(modify, false), {
        Title: "field",
        Author: "field",
        Subject: "field",
        Keywords: "field",
        Creator: "field",
        Producer: "field",
        CreationDate: date,
        ModDate: date,
        Trapped: "True",
        Department: "custom",
      });
      // a field cleared last takes the entry with it
      assert.deepEqual(write(modify, true), { Department: "custom" });
    });
  });

  it("removes a date set to null", function () {
    var stream = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(stream);
    var info = writer.getDocumentContext().getInfoDictionary();
    info.setCreationDate(new Date());
    info.setModDate(new Date());
    info.setCreationDate(null);
    info.setModDate(null);
    writer.writePage(writer.createPage(0, 0, 10, 10));
    writer.end();
    // with no entry left, the writer writes no Info dictionary
    assert.notInclude(stream.buffer.toString("latin1"), "/Info");
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

  it("keeps the source Info entries when modifying a PDF", function () {
    var sourcePath = __dirname + "/TestMaterials/InfoEntries.pdf";
    var modifiedPath = __dirname + "/output/InfoEntriesModified.pdf";
    var stream = new muhammara.PDFWStreamForBuffer();
    [
      muhammara.createWriterToModify(sourcePath, {
        modifiedFilePath: modifiedPath,
      }),
      muhammara.createWriterToModify(
        new muhammara.PDFRStreamForBuffer(fs.readFileSync(sourcePath)),
        stream,
      ),
    ].forEach(function (writer) {
      var info = writer.getDocumentContext().getInfoDictionary();
      assert.equal(info.title, "Snowman \u2603");
      assert.equal(info.author, "Indirect author");
      assert.equal(info.subject, "Caf\u00e9");
      assert.equal(info.keywords, "source, keywords");
      assert.equal(info.creator, "Source Creator");
      assert.equal(info.producer, "Source Producer");
      assert.equal(info.trapped, muhammara.EInfoTrappedFalse);
      assert.deepEqual(info.getAdditionalInfoEntries(), {
        Department: "Typesetting",
      });
      writer.end();
    });

    [fs.readFileSync(modifiedPath), stream.buffer].forEach(function (pdf) {
      var info = readInfo(pdf);
      // the date of this update
      assert.match(info.ModDate, /^D:\d{14}/);
      assert.notEqual(info.ModDate, "D:20200102030405Z");
      delete info.ModDate;
      // the text entries with the bytes of the source, the indirect one
      // resolved, and the Trapped name; /Revision 3 and /Status /Final are
      // left out, since the Info dictionary holds no numbers or other names
      assert.deepEqual(info, {
        Title: "\xfe\xff\0S\0n\0o\0w\0m\0a\0n\0 \x26\x03",
        Author: "Indirect author",
        Subject: "Caf\xe9",
        Keywords: "source, keywords",
        Creator: "Source Creator",
        Producer: "Source Producer",
        CreationDate: "D:20200102030405Z",
        Trapped: "False",
        Department: "Typesetting",
      });
    });
  });

  it("writes the Info values set on a modified PDF over the source ones", function () {
    var stream = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriterToModify(
      new muhammara.PDFRStreamForBuffer(
        fs.readFileSync(__dirname + "/TestMaterials/InfoEntries.pdf"),
      ),
      stream,
    );
    var info = writer.getDocumentContext().getInfoDictionary();
    info.title = "New title";
    info.subject = "";
    info.setCreationDate(null);
    info.trapped = muhammara.EInfoTrappedTrue;
    info.addAdditionalInfoEntry("Department", "Layout");
    // takes the place of the copied Author
    info.addAdditionalInfoEntry("Author", "Custom author");
    assert.equal(info.author, "");
    writer.end();

    var modified = readInfo(stream.buffer);
    assert.equal(modified.Title, "New title");
    assert.notProperty(modified, "Subject");
    assert.notProperty(modified, "CreationDate");
    assert.equal(modified.Trapped, "True");
    assert.equal(modified.Department, "Layout");
    assert.equal(modified.Author, "Custom author");
    assert.equal(modified.Keywords, "source, keywords");
  });
});
