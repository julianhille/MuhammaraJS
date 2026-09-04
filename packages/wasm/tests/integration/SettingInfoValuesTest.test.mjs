// Ports tests/SettingInfoValuesTest.js and tests/PDFTextString.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

function infoDictionary(pdf) {
  var text = new TextDecoder().decode(pdf);
  var match = /trailer[\s\S]*?\/Info (\d+) 0 R/.exec(text);
  assert.ok(match, "PDF trailer has an Info reference");
  var object = new RegExp(`${match[1]} 0 obj\\s*<<([\\s\\S]*?)>>`).exec(text);
  assert.ok(object, "PDF Info object is present");
  return object[1];
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
});
