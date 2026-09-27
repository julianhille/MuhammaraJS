var assert = require("assert");
var muhammara = require("@muhammara/native-with-source");
var { writeOutput } = require("../helpers/testOutput");

/**
 * Builds a one-page PDF whose page dictionary carries the given extra
 * entries, plus object 5, a content stream, and object 6, the number 7.
 * @param {string} pageEntries - Entries appended to the page dictionary.
 * @returns {Buffer} The PDF bytes.
 */
function malformedPagePdf(pageEntries) {
  var content = "0 0 10 10 re f\n";
  var objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] ${pageEntries} >>`,
    "<< >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    "7",
  ];
  var pdf = "%PDF-1.4\n";
  var offsets = objects.map((body, index) => {
    var offset = Buffer.byteLength(pdf);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  var xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

// Each page dictionary used to crash PDFModifiedPage::WritePage when the
// edited page was written.
var cases = {
  "Annots that is not an array": "/Annots 7 /Contents 5 0 R",
  "Contents that does not resolve": "/Contents 99 0 R",
  "a Contents array with direct entries": "/Contents [5 0 R (text) 7]",
  "Resources that are not a dictionary": "/Contents 5 0 R /Resources 7",
  "Resources that reference a non-dictionary":
    "/Contents 5 0 R /Resources 6 0 R",
};

describe("Malformed page edit", function () {
  Object.entries(cases).forEach(([name, pageEntries]) => {
    it(`edits a page with ${name}`, function () {
      var source = malformedPagePdf(pageEntries);
      var slug = name.replace(/\W+/g, "-");
      writeOutput(`MalformedPageEdit-${slug}-source`, source);

      new muhammara.Recipe(source)
        .editPage(1)
        .text("edited", 10, 10)
        .endPage()
        .endPDF((bytes) => {
          writeOutput(`MalformedPageEdit-${slug}`, bytes);
          var reader = muhammara.createReader(
            new muhammara.PDFRStreamForBuffer(bytes),
          );
          try {
            var page = reader.parsePage(0).getDictionary().toJSObject();
            assert.equal(reader.getPagesCount(), 1);
            // The edit is placed: new Contents and a Resources dictionary
            // that names the form XObject holding it.
            assert.ok(page.Contents);
            var resources = reader
              .queryDictionaryObject(
                reader.parsePage(0).getDictionary(),
                "Resources",
              )
              .toPDFDictionary();
            assert.ok(resources.exists("XObject"));
          } finally {
            reader.end();
          }
        });
    });
  });
});
