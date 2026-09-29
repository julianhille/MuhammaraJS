var assert = require("node:assert/strict");
var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");
var muhammara = require("@muhammara/native-with-source");
var { writeOutput } = require("./helpers/testOutput");

/**
 * Writes a PDF with two portrait pages, 100x200 and 300x400.
 * @param {string} file The PDF path.
 * @returns {void}
 */
function writeBoxes(file) {
  var writer = muhammara.createWriter(file);
  writer.writePage(writer.createPage(0, 0, 100, 200));
  writer.writePage(writer.createPage(0, 0, 300, 400));
  writer.end();
}

/**
 * Reads the decoded content of a page of a PDF.
 * @param {string} file The PDF path.
 * @returns {string} The page content, with whitespace collapsed.
 */
function pageContent(file) {
  var reader = muhammara.createReader(file);
  var page = reader.parsePage(0).getDictionary();
  var contents = reader.queryDictionaryObject(page, "Contents");
  var stream = reader.startReadingFromStream(contents.toPDFStream());
  var bytes = [];
  while (stream.notEnded()) bytes.push(...stream.read(4096));
  return Buffer.from(bytes).toString("latin1").replace(/\s+/g, " ");
}

describe("ImageDimensions", function () {
  var directory;
  var boxes;

  beforeEach(function () {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "image-dimensions-"));
    boxes = path.join(directory, "boxes.pdf");
    writeBoxes(boxes);
  });

  afterEach(function () {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  // 6.x reported a PDF page's width and height swapped, as Wasm never did.
  it("reads PDF page dimensions as width by height", function () {
    var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    assert.deepEqual(writer.getImageDimensions(boxes, 0), {
      width: 100,
      height: 200,
    });
    assert.deepEqual(writer.getImageDimensions(boxes, 1), {
      width: 300,
      height: 400,
    });
    writer.end();
  });

  it("fits a PDF page to a drawImage() box along its own axes", function () {
    var output = path.join(directory, "draw.pdf");
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 595, 842);
    writer.startPageContentContext(page).drawImage(10, 10, boxes, {
      transformation: { width: 50, height: 50 },
    });
    writer.writePage(page);
    writer.end();
    writeOutput("ImageDimensions-drawImage", fs.readFileSync(output));
    // 50/100 across and 50/200 up.
    assert.match(pageContent(output), /q 0\.5 0 0 0\.25 10 10 cm/);
  });

  it("sizes a Recipe image() of a PDF page by its width", function () {
    var output = path.join(directory, "recipe.pdf");
    new muhammara.Recipe("new", output)
      .createPage(595, 842)
      .image(boxes, 10, 10, { width: 50 })
      .endPage()
      .endPDF();
    writeOutput("ImageDimensions-recipe", fs.readFileSync(output));
    // 50 wide keeps the 1:2 ratio, so it is 100 high and its top edge at
    // y = 10 puts its bottom at 842 - 10 - 100. 6.x made it 25 high (807).
    assert.match(pageContent(output), /q 1 0 0 1 10 732 cm \/\w+ Do Q/);
  });
});
