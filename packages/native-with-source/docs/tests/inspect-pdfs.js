var assert = require("chai").assert;
var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
require.cache[require.resolve("@muhammara/native")] = { exports: muhammara };
var detectBlankPages = require("../../../native/docs/examples/detect-blank-pages");
var findTextPositions = require("../../../native/docs/examples/find-text-positions");
var inspectPageXObjects = require("../../../native/docs/examples/inspect-pdf-objects");
var readBookmarks = require("../../../native/docs/examples/read-bookmarks");

describe("Documentation examples for reading pages", function () {
  var outputDirectory;

  beforeEach(function () {
    outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "muhammara-docs-"));
  });

  afterEach(function () {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  });

  function writeSamplePdf(inputPath) {
    var writer = muhammara.createWriter(inputPath);
    var font = writer.getFontForFile(
      path.join(__dirname, "../../tests/TestMaterials/fonts/arial.ttf"),
    );

    // Page 0 is blank, page 1 is painted, page 2 shows text.
    writer.writePage(writer.createPage(0, 0, 200, 200));

    var pathPage = writer.createPage(0, 0, 200, 200);
    writer.startPageContentContext(pathPage).re(20, 20, 40, 40).f();
    writer.writePage(pathPage);

    var textPage = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(textPage)
      .BT()
      .Tf(font, 12)
      .Tm(1, 0, 0, 1, 25, 50)
      .Tj("locate me")
      .ET();
    writer.writePage(textPage);

    writer.end();
  }

  function writeOutlinedPdf(inputPath) {
    var objects = [
      "<< /Type /Catalog /Pages 2 0 R /Outlines 5 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /XObject << /Im1 4 0 R >> >> >>",
      "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\nx\nendstream",
      "<< /Type /Outlines /First 6 0 R /Last 6 0 R /Count 1 >>",
      "<< /Title (Chapter 1) /Parent 5 0 R /Dest [3 0 R /Fit] >>",
    ];
    var output = "%PDF-1.4\n";
    var offsets = [0];

    objects.forEach(function (object, index) {
      offsets.push(Buffer.byteLength(output));
      output += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    var xrefPosition = Buffer.byteLength(output);
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(function (offset) {
      output += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF\n`;

    fs.writeFileSync(inputPath, output);
  }

  it("detects blank pages", function () {
    var inputPath = path.join(outputDirectory, "pages.pdf");
    writeSamplePdf(inputPath);

    assert.deepEqual(detectBlankPages(inputPath), [0]);
  });

  it("treats a page over the extraction budget as not blank", function () {
    var inputPath = path.join(outputDirectory, "dense.pdf");
    var writer = muhammara.createWriter(inputPath);

    writer.writePage(writer.createPage(0, 0, 200, 200));

    // The example caps maxElements at 1000; a page like a vector chart or a
    // ruled table goes past that and must not abort the scan.
    var densePage = writer.createPage(0, 0, 200, 200);
    var context = writer.startPageContentContext(densePage);
    for (var i = 0; i < 1200; ++i) {
      context.re(i % 100, Math.floor(i / 100), 1, 1).f();
    }
    writer.writePage(densePage).end();

    assert.deepEqual(detectBlankPages(inputPath), [0]);
  });

  it("finds text positions", function () {
    var inputPath = path.join(outputDirectory, "pages.pdf");
    writeSamplePdf(inputPath);

    assert.deepEqual(findTextPositions(inputPath, 2, "locate me"), [
      { x: 25, y: 50, fontSize: 12, fontResource: "FN1" },
    ]);
    assert.deepEqual(findTextPositions(inputPath, 2, "missing"), []);
  });

  it("inspects page XObjects", function () {
    var inputPath = path.join(outputDirectory, "outlined.pdf");
    writeOutlinedPdf(inputPath);

    assert.deepEqual(inspectPageXObjects(inputPath, 0), [
      { name: "Im1", objectId: 4, subtype: "Image" },
    ]);
  });

  it("reads direct-destination bookmarks", function () {
    var inputPath = path.join(outputDirectory, "outlined.pdf");
    writeOutlinedPdf(inputPath);

    assert.deepEqual(readBookmarks(inputPath), [
      { title: "Chapter 1", page: 1, children: [] },
    ]);
  });
});
