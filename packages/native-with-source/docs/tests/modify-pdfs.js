var assert = require("chai").assert;
var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
require.cache[require.resolve("@muhammara/native")] = { exports: muhammara };
var editAnnotation = require("../../../native/docs/examples/edit-annotation");

var fontPath = path.join(
  __dirname,
  "../../tests/TestMaterials/fonts/arial.ttf",
);

function getPageContentsId(reader, pageIndex) {
  return reader
    .parsePage(pageIndex)
    .getDictionary()
    .queryObject("Contents")
    .toPDFIndirectObjectReference()
    .getObjectID();
}

function writeSourcePdf(sourcePath) {
  var writer = muhammara.createWriter(sourcePath);
  var page = writer.createPage(0, 0, 200, 200);

  writer
    .startPageContentContext(page)
    .BT()
    .Tf(writer.getFontForFile(fontPath), 12)
    .Tm(1, 0, 0, 1, 20, 30)
    .Tj("Before")
    .ET();
  writer.writePage(page);
  writer.end();
}

function writeAnnotatedPdf(annotatedPath) {
  var Recipe = muhammara.Recipe;

  return new Promise(function (resolve) {
    new Recipe("new", annotatedPath)
      .createPage("letter")
      .annot(100, 200, "FreeText", { text: "Keep me", width: 200, height: 60 })
      .annot(100, 400, "FreeText", { text: "Edit me", width: 200, height: 60 })
      .endPage()
      .endPDF(resolve);
  });
}

function readAnnotations(pdfPath) {
  var reader = muhammara.createReader(pdfPath);

  try {
    var page = reader.parsePage(0).getDictionary();
    var annotations = reader.queryDictionaryObject(page, "Annots");

    if (!annotations) {
      return [];
    }

    return annotations
      .toPDFArray()
      .toJSArray()
      .map(function (annotation) {
        var id = annotation.toPDFIndirectObjectReference().getObjectID();
        var dictionary = reader
          .parseNewObject(id)
          .toPDFDictionary()
          .toJSObject();

        return {
          id: id,
          subtype: dictionary.Subtype.toString(),
          contents: dictionary.Contents ? dictionary.Contents.toText() : "",
        };
      });
  } finally {
    reader.end();
  }
}

describe("Documentation examples", function () {
  var outputDirectory;
  var sourcePath;

  beforeEach(function () {
    outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "muhammara-docs-"));
    sourcePath = path.join(outputDirectory, "source.pdf");
    writeSourcePdf(sourcePath);
  });

  afterEach(function () {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  });

  it("replaces a page object", function () {
    var outputPath = path.join(outputDirectory, "replaced-object.pdf");
    var sourceReader = muhammara.createReader(sourcePath);
    var sourceContentsId = getPageContentsId(sourceReader, 0);

    sourceReader.end();

    var reader = muhammara.createReader(sourcePath);
    var contentsId = reader
      .parsePage(0)
      .getDictionary()
      .queryObject("Contents")
      .toPDFIndirectObjectReference()
      .getObjectID();

    reader.end();

    var writer = muhammara.createWriterToModify(sourcePath, {
      modifiedFilePath: outputPath,
    });
    var objectsContext = writer.getObjectsContext();
    var replacementId = objectsContext.startNewIndirectObject();
    var replacement = objectsContext.startPDFStream();

    replacement.getWriteStream().write(Array.from(Buffer.from("BT ET")));
    objectsContext.endPDFStream(replacement).endIndirectObject();
    writer.replaceObject(0, contentsId, replacementId);
    writer.end();

    var reader = muhammara.createReader(outputPath);

    assert.notStrictEqual(getPageContentsId(reader, 0), sourceContentsId);
    assert.deepStrictEqual(reader.extractPageText(0), []);
    reader.end();
  });

  it("replaces literal Recipe text", function () {
    var outputPath = path.join(outputDirectory, "replaced-text.pdf");
    var Recipe = require("@muhammara/native").Recipe;

    new Recipe(sourcePath, outputPath)
      .replaceText("Before", "After", 1)
      .endPDF();

    var reader = muhammara.createReader(outputPath);
    var text = reader.extractPageText(0);

    assert.strictEqual(text.length, 1);
    assert.strictEqual(text[0].content, "After");
    assert.deepStrictEqual(text[0].textMatrix, [1, 0, 0, 1, 20, 30]);
    reader.end();
  });
  it("edits an existing annotation without losing its other keys", async function () {
    var annotatedPath = path.join(outputDirectory, "annotated.pdf");
    var outputPath = path.join(outputDirectory, "edited-annotation.pdf");

    await writeAnnotatedPdf(annotatedPath);

    var annotationId = editAnnotation.findAnnotationId(
      annotatedPath,
      0,
      "Edit me",
    );

    assert.isNumber(annotationId);
    editAnnotation.editAnnotationContents(
      annotatedPath,
      outputPath,
      annotationId,
      "Edited",
    );

    var before = readAnnotations(annotatedPath);
    var after = readAnnotations(outputPath);
    var edited = after.find(function (annotation) {
      return annotation.id === annotationId;
    });

    assert.strictEqual(after.length, before.length);
    assert.strictEqual(edited.contents, "Edited");
    assert.strictEqual(edited.subtype, "FreeText");
    assert.deepStrictEqual(
      after.map(function (annotation) {
        return annotation.id;
      }),
      before.map(function (annotation) {
        return annotation.id;
      }),
    );
  });

  it("removes an annotation from a page", async function () {
    var annotatedPath = path.join(outputDirectory, "annotated.pdf");
    var outputPath = path.join(outputDirectory, "removed-annotation.pdf");

    await writeAnnotatedPdf(annotatedPath);

    var annotationId = editAnnotation.findAnnotationId(
      annotatedPath,
      0,
      "Edit me",
    );

    editAnnotation.removeAnnotation(annotatedPath, outputPath, 0, annotationId);

    var remaining = readAnnotations(outputPath);

    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].contents, "Keep me");
  });
});
