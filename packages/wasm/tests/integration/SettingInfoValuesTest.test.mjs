// Ports tests/SettingInfoValuesTest.js and tests/PDFTextString.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";
import { writeOutput } from "../testOutput.mjs";

function infoDictionary(pdf) {
  var text = new TextDecoder().decode(pdf);
  var match = /trailer[\s\S]*?\/Info (\d+) 0 R/.exec(text);
  assert.ok(match, "PDF trailer has an Info reference");
  var object = new RegExp(`${match[1]} 0 obj\\s*<<([\\s\\S]*?)>>`).exec(text);
  assert.ok(object, "PDF Info object is present");
  return object[1];
}

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
 * @param {object} muhammara - The Wasm API.
 * @param {Uint8Array} pdf - The PDF.
 * @returns {Record<string, string>} The entries by key.
 */
function readInfo(muhammara, pdf) {
  var reader = muhammara.createReader(pdf);
  var info = reader
    .queryDictionaryObject(reader.getTrailer(), "Info")
    .toJSObject();
  var entries = {};
  Object.keys(info).forEach(function (key) {
    entries[key] = info[key].toBytesArray
      ? String.fromCharCode(...info[key].toBytesArray())
      : info[key].value;
  });
  reader.end();
  return entries;
}

describe("SettingInfoValuesTest", function () {
  it("writes document metadata and text strings", async function () {
    var muhammara = await createMuhammaraWasm();

    assert.equal(new muhammara.PDFTextString().toString(), "");
    assert.equal(
      new muhammara.PDFTextString("Hello World").toString(),
      "Hello World",
    );
    assert.equal(
      new muhammara.PDFTextString([72, 101, 108, 108, 111]).toString(),
      "Hello",
    );
    assert.equal(
      new muhammara.PDFTextString(
        new muhammara.PDFTextString("Hello World").toBytesArray(),
      ).toString(),
      "Hello World",
    );
    assert.equal(new muhammara.PDFTextString("Grüße").toString(), "Grüße");

    var writer = muhammara.createWriter();
    assert.equal(writer.createPDFTextString().toString(), "");
    assert.equal(writer.createPDFDate().toString(), "");
    assert.equal(writer.createPDFTextString("Hello").toString(), "Hello");
    assert.equal(
      writer.createPDFDate("D:20140720204655Z").toString(),
      "D:20140720204655Z",
    );
    var info = writer.getDocumentContext().getInfoDictionary();
    info.author = "Gal Kahana";
    info.title = "PDFHummus explained";
    info.subject = "One-pass PDF generation";
    info.creator = "PDFHummus";
    info.setCreationDate("D:20140720204655+03'00'");
    info.setModDate(new muhammara.PDFDate("D:20140720204655Z"));
    info.addAdditionalInfoEntry("words of praise", "amazing");
    info.addAdditionalInfoEntry("removed", "not written");
    info.removeAdditionalInfoEntry("removed");
    assert.deepEqual(info.getAdditionalInfoEntries(), {
      "words of praise": "amazing",
    });

    var page = new muhammara.PDFPage(0, 0, 595, 842);
    writer.startPageContentContext(page);
    writer.writePage(page);
    var pdf = writer.end();
    writeOutput("SettingInfoValuesTest", pdf);
    var entries = infoDictionary(pdf);

    assert.match(entries, /\/Author \(Gal Kahana\)/);
    assert.match(entries, /\/Title \(PDFHummus explained\)/);
    assert.match(entries, /\/Subject \(One-pass PDF generation\)/);
    assert.match(entries, /\/Creator \(PDFHummus\)/);
    assert.match(entries, /\/CreationDate \(D:20140720204655\+03'00'\)/);
    assert.match(entries, /\/ModDate \(D:20140720204655Z\)/);
    assert.match(entries, /\/words#20of#20praise \(amazing\)/);
    assert.doesNotMatch(entries, /\/removed/);
  });

  it("accepts only EInfoTrapped values for trapped", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var info = writer.getDocumentContext().getInfoDictionary();
    assert.equal(info.trapped, muhammara.EInfoTrappedUnknown);
    info.trapped = muhammara.EInfoTrappedTrue;
    assert.equal(info.trapped, muhammara.EInfoTrappedTrue);
    assert.throws(() => (info.trapped = 3), /EInfoTrapped value/);
    assert.throws(() => (info.trapped = 0.5), /EInfoTrapped value/);
    writer.writePage(writer.createPage(0, 0, 10, 10));
    var pdf = writer.end();
    writeOutput("SettingInfoValuesTest-trapped", pdf);
    assert.match(infoDictionary(pdf), /\/Trapped \/True/);
  });

  it("rejects Info changes after the writer or modifier ends", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var source = muhammara.createBlankPdf(10, 10);
    writeOutput("SettingInfoValuesTest-ended-source", source);
    var modifier = muhammara.createWriterToModify(source);
    var infos = [writer, modifier].map((target) => {
      var info = target.getDocumentContext().getInfoDictionary();
      info.title = "kept";
      return info;
    });
    writer.writePage(writer.createPage(0, 0, 10, 10));
    writeOutput("SettingInfoValuesTest-ended-writer", writer.end());
    writeOutput("SettingInfoValuesTest-ended-modifier", modifier.end());
    for (var info of infos) {
      assert.throws(() => info.setCreationDate(new Date()), /has ended/);
      assert.throws(() => info.setModDate(new Date()), /has ended/);
      assert.throws(() => (info.title = "changed"), /has ended/);
      assert.equal(info.title, "kept");
    }
  });
  it("keeps a custom entry named like a field apart from it", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var info = writer.getDocumentContext().getInfoDictionary();
    info.addAdditionalInfoEntry("title", "custom");
    info.title = "field";
    assert.equal(info.title, "field");
    assert.equal(info.getAdditionalInfoEntry("title"), "custom");
    writer.writePage(writer.createPage(0, 0, 10, 10));
    var pdf = new TextDecoder("latin1").decode(writer.end());
    assert.ok(pdf.includes("/Title (field)"));
    assert.ok(pdf.includes("/title (custom)"));
  });

  it("writes a custom entry under a field's Info key in place of the field", async function () {
    var muhammara = await createMuhammaraWasm();
    var keys = ["Title", "Trapped", "CreationDate", "ModDate"];
    for (var modify of [false, true]) {
      var writer = modify
        ? muhammara.createWriterToModify(muhammara.createBlankPdf(10, 10))
        : muhammara.createWriter();
      var info = writer.getDocumentContext().getInfoDictionary();
      info.title = "field";
      info.trapped = muhammara.EInfoTrappedTrue;
      info.setCreationDate("D:20200102030405Z");
      info.setModDate("D:20200102030405Z");
      for (var key of keys) info.addAdditionalInfoEntry(key, "custom");
      assert.equal(info.title, "");
      assert.equal(info.trapped, muhammara.EInfoTrappedUnknown);
      if (!modify) writer.writePage(writer.createPage(0, 0, 10, 10));
      var pdf = new TextDecoder("latin1").decode(writer.end());
      // each key once, with the custom value
      for (var key of keys) {
        assert.deepEqual(pdf.match(new RegExp(`/${key} .*`, "g")), [
          `/${key} (custom)`,
        ]);
      }
    }
  });

  it("writes a field set after a custom entry under its Info key in place of the entry", async function () {
    var muhammara = await createMuhammaraWasm();
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
     * @returns {Record<string, string>} The Info entries a reader sees.
     */
    function write(modify, clear) {
      var writer = modify
        ? muhammara.createWriterToModify(muhammara.createBlankPdf(10, 10))
        : muhammara.createWriter();
      var info = writer.getDocumentContext().getInfoDictionary();
      for (var key of keys) info.addAdditionalInfoEntry(key, "custom");
      // each setter takes only the entry under its own key
      texts.forEach((text, index) => {
        info[text.toLowerCase()] = clear ? "" : "field";
        assert.equal(info.getAdditionalInfoEntry(keys[index + 1]), "custom");
      });
      info.setCreationDate(clear ? null : date);
      assert.equal(info.getAdditionalInfoEntry("ModDate"), "custom");
      info.setModDate(clear ? null : date);
      // and a set that throws takes none
      assert.throws(() => (info.trapped = "True"), RangeError);
      assert.equal(info.getAdditionalInfoEntry("Trapped"), "custom");
      info.trapped = clear
        ? muhammara.EInfoTrappedUnknown
        : muhammara.EInfoTrappedTrue;
      assert.deepEqual(info.getAdditionalInfoEntries(), {
        Department: "custom",
      });
      if (!modify) writer.writePage(writer.createPage(0, 0, 10, 10));
      return readInfo(muhammara, writer.end());
    }
    for (var modify of [false, true]) {
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
    }
  });

  it("removes a date set to null", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var info = writer.getDocumentContext().getInfoDictionary();
    info.setCreationDate(new Date());
    info.setModDate(new Date());
    info.setCreationDate(null);
    info.setModDate(null);
    writer.writePage(writer.createPage(0, 0, 10, 10));
    // with no entry left, the writer writes no Info dictionary
    assert.ok(
      !new TextDecoder("latin1").decode(writer.end()).includes("/Info"),
    );
  });

  it("writes a Date's time zone offset with its minutes", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
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

  it("keeps the source Info entries when modifying a PDF", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = new Uint8Array(
      await readFile("tests/TestMaterials/InfoEntries.pdf"),
    );
    var outputs = [];
    for (var writer of [
      muhammara.createWriterToModify(source),
      await muhammara.createWriterToModifyAsync(new Blob([source])),
    ]) {
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
      outputs.push(writer.end());
    }
    // the compact modifier keeps them too
    outputs.push(muhammara.createModifier(source).end());
    writeOutput("InfoEntriesModified", outputs[0]);

    for (var pdf of outputs) {
      var modified = readInfo(muhammara, pdf);
      // the date of this update
      assert.match(modified.ModDate, /^D:\d{14}/);
      assert.notEqual(modified.ModDate, "D:20200102030405Z");
      delete modified.ModDate;
      // the text entries with the bytes of the source, the indirect one
      // resolved, and the Trapped name; /Revision 3 and /Status /Final are
      // left out, since the Info dictionary holds no numbers or other names
      assert.deepEqual(modified, {
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
    }
  });

  it("writes the Info values set on a modified PDF over the source ones", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriterToModify(
      await readFile("tests/TestMaterials/InfoEntries.pdf"),
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
    var pdf = writer.end();
    writeOutput("InfoEntriesModifiedValues", pdf);

    var modified = readInfo(muhammara, pdf);
    assert.equal(modified.Title, "New title");
    assert.ok(!("Subject" in modified));
    assert.ok(!("CreationDate" in modified));
    assert.equal(modified.Trapped, "True");
    assert.equal(modified.Department, "Layout");
    assert.equal(modified.Author, "Custom author");
    assert.equal(modified.Keywords, "source, keywords");
  });
});
