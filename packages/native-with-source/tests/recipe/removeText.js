var expect = require("chai").expect;
var path = require("path");
var muhammara = require("../..");
var Recipe = muhammara.Recipe;

var fontPath = path.join(__dirname, "../TestMaterials/fonts/arial.ttf");

function writeSource(file, freeCode) {
  var writer = muhammara.createWriter(file);
  var page = writer.createPage(0, 0, 200, 200);
  var font = writer.getFontForFile(fontPath);
  var context = writer.startPageContentContext(page);

  context
    .q()
    .rg(1, 0, 0)
    .re(10, 10, 50, 50)
    .f()
    .Q()
    .BT()
    .Tf(font, 12)
    .Tm(1, 0, 0, 1, 20, 30)
    .Tj("Visible")
    .ET();
  if (freeCode) context.writeFreeCode(freeCode);
  writer.writePage(page);
  writer.end();
}

function readStream(reader, stream) {
  var streamReader = reader.startReadingFromStream(stream);
  var chunks = [];
  while (streamReader.notEnded()) {
    chunks.push(Buffer.from(streamReader.read(65536)));
  }
  return Buffer.concat(chunks).toString("latin1");
}

function readFormContents(file) {
  var reader = muhammara.createReader(file);
  var resources = reader.queryDictionaryObject(
    reader.parsePage(0).getDictionary(),
    "Resources",
  );
  var xObjects = resources.exists("XObject")
    ? reader.queryDictionaryObject(resources, "XObject").toJSObject()
    : {};
  var forms = Object.keys(xObjects).map(function (name) {
    return readStream(
      reader,
      reader.parseNewObject(
        xObjects[name].toPDFIndirectObjectReference().getObjectID(),
      ),
    );
  });
  reader.end();
  return forms.join("\n");
}

function readPageContent(file) {
  var reader = muhammara.createReader(file);
  var contents = reader.queryDictionaryObject(
    reader.parsePage(0).getDictionary(),
    "Contents",
  );
  var streams =
    contents.getType() === muhammara.ePDFObjectArray
      ? contents.toJSArray().map(function (entry) {
          return reader.parseNewObject(
            entry.toPDFIndirectObjectReference().getObjectID(),
          );
        })
      : [contents];
  var content = streams
    .map(function (stream) {
      return readStream(reader, stream);
    })
    .join("\n");
  var text = reader.extractPageText(0);
  reader.end();
  return { content: content, text: text };
}

describe("Remove text", function () {
  it("removes every text-showing operator and keeps graphics", function () {
    var source = path.join(__dirname, "../output/Remove text source.pdf");
    var output = path.join(__dirname, "../output/Remove text output.pdf");
    writeSource(
      source,
      [
        "% comment with (Tj) inside",
        "/Span <</ActualText (a\\)b) /MCID 0>> BDC",
        "BT 20 60 Td 14 TL [(Kern) -250 <00410042> (ed\\) \\(x)] TJ",
        "(Next line) ' 2 1 (Spaced) \" ET EMC",
        "q 2 0 0 2 0 0 cm BI /W 1 /H 1 /CS /G /BPC 8 ID \xe9Tj\xff EI Q",
        "0 0 1 rg 100 100 20 20 re f",
      ].join("\n"),
    );

    expect(readPageContent(source).text.length).to.be.greaterThan(0);

    new Recipe(source, output).removeText(1).endPDF();

    var result = readPageContent(output);
    expect(result.text).to.deep.equal([]);
    expect(
      result.content.replace(/ID [^]*? EI/, "").replace(/%.*/, ""),
    ).not.to.match(/\bTj\b|\bTJ\b|'|"/);
    expect(result.content).to.include("10 10 50 50 re");
    expect(result.content).to.include("100 100 20 20 re f");
    expect(result.content).to.include("<</ActualText (a\\)b) /MCID 0>> BDC");
    expect(result.content).to.include(
      "ID " + Buffer.from("\xe9Tj\xff").toString("latin1") + " EI",
    );
    expect(result.content).to.match(/14 TL\s+T\*\s+2 Tw 1 Tc T\*\s+ET/);
  });

  it("removes text from painted Form XObjects when forms is set", function () {
    var source = path.join(__dirname, "../output/Remove text forms.pdf");
    var edited = path.join(__dirname, "../output/Remove text forms edited.pdf");
    var pageOnly = path.join(__dirname, "../output/Remove text forms page.pdf");
    var output = path.join(__dirname, "../output/Remove text forms out.pdf");
    writeSource(source);
    new Recipe(source, edited)
      .editPage(1)
      .text("Added", 50, 50)
      .endPage()
      .endPDF();
    expect(readFormContents(edited)).to.match(/\bTj\b/);

    new Recipe(edited, pageOnly).removeText(1).endPDF();
    expect(readPageContent(pageOnly).text).to.deep.equal([]);
    expect(readFormContents(pageOnly)).to.match(/\bTj\b/);

    new Recipe(edited, output).removeText(1, { forms: true }).endPDF();
    var result = readPageContent(output);
    expect(result.text).to.deep.equal([]);
    expect(result.content).to.include("10 10 50 50 re");
    expect(result.content).to.include("/_0 Do");
    expect(readFormContents(output)).not.to.match(/\bTj\b/);
    expect(readFormContents(output)).to.match(/\bTf\b/);

    var twice = path.join(__dirname, "../output/Remove text forms twice.pdf");
    new Recipe(edited, twice)
      .removeText(1, { forms: true })
      .removeText(1, { forms: true })
      .endPDF();
    var bytes = require("fs").readFileSync(twice).toString("latin1");
    var update = bytes.slice(bytes.lastIndexOf("%%EOF", bytes.length - 8));
    var objectIds = update.match(/^\d+(?= 0 obj)/gm);
    expect(new Set(objectIds).size).to.equal(objectIds.length);
    expect(readPageContent(twice).text).to.deep.equal([]);
  });

  it("keeps text added with editPage in either order", function () {
    var source = path.join(__dirname, "../output/Remove text ocr.pdf");
    var output = path.join(__dirname, "../output/Remove text ocr out.pdf");
    writeSource(source);

    new Recipe(source, output)
      .removeText(1)
      .editPage(1)
      .text("OCR", 20, 30)
      .endPage()
      .endPDF();

    var result = readPageContent(output);
    expect(result.content).not.to.include("Visible");
    expect(readFormContents(output)).to.match(/\bTj\b/);

    new Recipe(source, output)
      .editPage(1)
      .text("OCR", 20, 30)
      .endPage()
      .removeText(1)
      .endPDF();

    result = readPageContent(output);
    expect(result.content).not.to.include("Visible");
    expect(readFormContents(output)).to.match(/\bTj\b/);
  });

  it("validates the page number", function () {
    var source = path.join(__dirname, "../output/Remove text source.pdf");
    var output = path.join(__dirname, "../output/Remove text invalid.pdf");
    writeSource(source);
    var recipe = new Recipe(source, output);

    expect(() => recipe.removeText()).to.throw(
      TypeError,
      "removeText expects a positive integer page number",
    );
    expect(() => recipe.removeText(0)).to.throw(
      TypeError,
      "removeText expects a positive integer page number",
    );
    expect(() => recipe.removeText(1, true)).to.throw(
      TypeError,
      "removeText expects an options object",
    );
    expect(() => recipe.removeText(2)).to.throw(
      RangeError,
      "removeText page 2 does not exist",
    );
    recipe.endPDF();
  });
});
