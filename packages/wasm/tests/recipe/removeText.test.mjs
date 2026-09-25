import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../../index.js";
import { writeOutput } from "../testOutput.mjs";
import { getRecipe } from "./recipe.mjs";

var FONT = "remove-text-font";

function latin1(bytes) {
  var result = "";
  for (var index = 0; index < bytes.length; index++) {
    result += String.fromCharCode(bytes[index]);
  }
  return result;
}

function readStream(reader, stream) {
  var streamReader = reader.startReadingFromStream(stream);
  var result = "";
  while (streamReader.notEnded()) {
    result += latin1(new Uint8Array(streamReader.read(65536)));
  }
  streamReader.dispose?.();
  return result;
}

function resolve(reader, object) {
  return object.getType() === 9
    ? reader.parseNewObject(object.toPDFIndirectObjectReference().getObjectID())
    : object;
}

function readPage(muhammara, bytes) {
  var reader = muhammara.createReader(bytes);
  var page = reader.parsePage(0).getDictionary().toPDFDictionary();
  var contents = resolve(reader, page.queryObject("Contents"));
  var streams = contents.toPDFArray()
    ? contents
        .toPDFArray()
        .toJSArray()
        .map((entry) => resolve(reader, entry))
    : [contents];
  var content = streams.map((stream) => readStream(reader, stream)).join("\n");
  var resources = resolve(
    reader,
    page.queryObject("Resources"),
  ).toPDFDictionary();
  var xObjects = resources.exists("XObject")
    ? resolve(reader, resources.queryObject("XObject"))
        .toPDFDictionary()
        .toJSObject()
    : {};
  var forms = Object.values(xObjects)
    .map((reference) => readStream(reader, resolve(reader, reference)))
    .join("\n");
  var text = reader.extractPageText(0);
  reader.end();
  return { content, forms, text };
}

async function writeSource(muhammara, freeCode) {
  var writer = muhammara.createWriter();
  var page = writer.createPage(0, 0, 200, 200);
  var context = writer.startPageContentContext(page);
  context
    .q()
    .rg(1, 0, 0)
    .re(10, 10, 50, 50)
    .f()
    .Q()
    .BT()
    .Tf(writer.getFontForBytes(FONT), 12)
    .Tm(1, 0, 0, 1, 20, 30)
    .Tj("Visible")
    .ET();
  if (freeCode) context.writeFreeCode(freeCode);
  writer.writePage(page);
  return writer.end();
}

describe("Remove text", function () {
  var muhammara;
  var Recipe;

  before(async function () {
    muhammara = await createMuhammaraWasm();
    Recipe = await getRecipe();
    muhammara.registerFont(
      FONT,
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/fonts/arial.ttf",
            import.meta.url,
          ),
        ),
      ),
    );
  });

  after(function () {
    muhammara.unregisterFont(FONT);
    muhammara.disposeAssets();
  });

  it("removes every text-showing operator and keeps graphics", async function () {
    var source = await writeSource(
      muhammara,
      [
        "% comment with (Tj) inside",
        "/Span <</ActualText (a\\)b) /MCID 0>> BDC",
        "BT 20 60 Td 14 TL [(Kern) -250 <00410042> (ed\\) \\(x)] TJ",
        "(Next line) ' 2 1 (Spaced) \" ET EMC",
        "q 2 0 0 2 0 0 cm BI /W 1 /H 1 /CS /G /BPC 8 ID \xe9Tj\xff EI Q",
        "0 0 1 rg 100 100 20 20 re f",
      ].join("\n"),
    );
    assert.ok(readPage(muhammara, source).text.length > 0);

    var output = new Recipe(source).removeText(1).endPDF();
    writeOutput("removeText", output);

    var result = readPage(muhammara, output);
    assert.deepEqual(result.text, []);
    assert.doesNotMatch(
      result.content.replace(/ID [^]*? EI/, "").replace(/%.*/, ""),
      /\bTj\b|\bTJ\b|'|"/,
    );
    assert.ok(result.content.includes("10 10 50 50 re"));
    assert.ok(result.content.includes("100 100 20 20 re f"));
    assert.ok(result.content.includes("<</ActualText (a\\)b) /MCID 0>> BDC"));
    assert.ok(
      result.content.includes(
        "ID " + latin1(new TextEncoder().encode("\xe9Tj\xff")) + " EI",
      ),
    );
    assert.match(result.content, /14 TL\s+T\*\s+2 Tw 1 Tc T\*\s+ET/);
  });

  it("removes text from painted Form XObjects when forms is set", async function () {
    var source = await writeSource(muhammara);
    var edited = new Recipe(source)
      .editPage(1)
      .text("Added", 50, 50, { font: "arial" })
      .endPage()
      .endPDF();
    assert.match(readPage(muhammara, edited).forms, /\bTj\b/);

    var pageOnly = readPage(
      muhammara,
      new Recipe(edited).removeText(1).endPDF(),
    );
    assert.deepEqual(pageOnly.text, []);
    assert.match(pageOnly.forms, /\bTj\b/);

    var output = new Recipe(edited).removeText(1, { forms: true }).endPDF();
    writeOutput("removeText-forms", output);
    var result = readPage(muhammara, output);
    assert.deepEqual(result.text, []);
    assert.ok(result.content.includes("10 10 50 50 re"));
    assert.ok(result.content.includes("/_0 Do"));
    assert.doesNotMatch(result.forms, /\bTj\b/);
    assert.match(result.forms, /\bTf\b/);

    var twice = latin1(
      new Recipe(edited)
        .removeText(1, { forms: true })
        .removeText(1, { forms: true })
        .endPDF(),
    );
    var update = twice.slice(twice.lastIndexOf("%%EOF", twice.length - 8));
    var objectIds = update.match(/^\d+(?= 0 obj)/gm);
    assert.equal(new Set(objectIds).size, objectIds.length);
  });

  it("keeps text added with editPage in either order", async function () {
    var source = await writeSource(muhammara);

    var removedFirst = readPage(
      muhammara,
      new Recipe(source)
        .removeText(1)
        .editPage(1)
        .text("OCR", 20, 30, { font: "arial" })
        .endPage()
        .endPDF(),
    );
    assert.ok(!removedFirst.content.includes("Visible"));
    assert.match(removedFirst.forms, /\bTj\b/);

    var editedFirst = readPage(
      muhammara,
      new Recipe(source)
        .editPage(1)
        .text("OCR", 20, 30, { font: "arial" })
        .endPage()
        .removeText(1)
        .endPDF(),
    );
    assert.ok(!editedFirst.content.includes("Visible"));
    assert.match(editedFirst.forms, /\bTj\b/);
  });

  it("validates the page number", async function () {
    var source = await writeSource(muhammara);
    var recipe = new Recipe(source);

    assert.throws(() => recipe.removeText(), {
      name: "TypeError",
      message: "removeText expects a positive integer page number",
    });
    assert.throws(() => recipe.removeText(0), {
      name: "TypeError",
      message: "removeText expects a positive integer page number",
    });
    assert.throws(() => recipe.removeText(1, true), {
      name: "TypeError",
      message: "removeText expects an options object",
    });
    assert.throws(() => recipe.removeText(2), {
      name: "RangeError",
      message: "removeText page 2 does not exist",
    });
    recipe.endPDF();
  });
});
