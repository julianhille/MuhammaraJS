// Byte-first ports of LinksTest.js and resource usage in ImagesAndFormsForwardReferenceTest.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("LinksTest", function () {
  it("writes annotations and resource mappings", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var page = new muhammara.PDFPage(0, 0, 200, 200);
    var context = writer.startPageContentContext(page).q().Q();
    var resources = page.getResourcesDictionary();
    resources.addProcsetResource(muhammara.kProcsetPDF);
    resources.addProcsetResource(muhammara.kProcsetText);
    assert.match(resources.addExtGStateMapping(10), /^GS/);
    assert.match(resources.addFontMapping(11), /^F/);
    assert.match(resources.addColorSpaceMapping(12), /^CS/);
    assert.match(resources.addPatternMapping(13), /^P/);
    assert.match(resources.addPropertyMapping(14), /^PP/);
    assert.match(resources.addXObjectMapping(15), /^X/);
    assert.match(resources.addFormXObjectMapping(16), /^Fm/);
    assert.match(resources.addImageXObjectMapping(17), /^Im/);
    assert.match(resources.addShadingMapping(18), /^SH/);
    writer.pausePageContentContext(context);
    writer.attachURLLinktoCurrentPage("https://example.test", 10, 20, 90, 40);
    var annotationId = writer.createAnnotation("Highlight", 10, 20, 90, 40, {
      contents: "byte-first markup",
      title: "Wasm",
      name: "markup-1",
      color: [1, 0.5, 0],
      border: { width: 2, dash: [3, 1] },
      quadPoints: [10, 40, 90, 40, 10, 20, 90, 20],
      flags: 4,
      open: true,
      opacity: 0.5,
    });
    writer.writePage(page);

    var form = writer.createFormXObject(0, 0, 10, 10);
    assert.match(
      form.getResourcesDictionary().addFormXObjectMapping(19),
      /^Fm/,
    );
    writer.endFormXObject(form);
    var pdf = writer.end();
    var output = new TextDecoder().decode(pdf);
    assert.match(output, /\/URI \(https:\/\/example\.test\)/);
    assert.match(output, /\/QuadPoints \[ 10 40 90 40 10 20 90 20 \]/);
    assert.match(output, /\/Border \[ 0 0 2 \[ 3 1 \]\]/);
    assert.match(output, /\/CA 0\.5/);
    assert.match(output, /\/ExtGState/);
    assert.match(output, /\/Shading/);
    var reader = muhammara.createReader(pdf);
    var annotation = reader.parseNewObject(annotationId).toPDFDictionary();
    assert.equal(annotation.queryObject("Subtype").value, "Highlight");
    assert.equal(
      annotation.queryObject("Contents").toText(),
      "byte-first markup",
    );
    reader.end();

    var modifier = muhammara.createWriterToModify(pdf);
    var pageModifier = modifier.createPageModifier(0);
    pageModifier.startContext();
    pageModifier
      .getResourcesDictionary()
      .addProcsetResource(muhammara.kProcsetPDF);
    pageModifier.attachURLLinktoCurrentPage(
      "https://modified.test",
      30,
      50,
      70,
      80,
    );
    var modifiedAnnotationId = pageModifier.createAnnotation(
      "Square",
      30,
      50,
      70,
      80,
      { color: [0, 1, 0], borderWidth: 1 },
    );
    pageModifier.endContext().writePage();
    var modified = modifier.end();
    var modifiedOutput = new TextDecoder().decode(modified);
    assert.match(modifiedOutput, /\/URI \(https:\/\/modified\.test\)/);
    var modifiedReader = muhammara.createReader(modified);
    assert.equal(
      modifiedReader
        .parseNewObject(modifiedAnnotationId)
        .toPDFDictionary()
        .queryObject("Subtype").value,
      "Square",
    );
    modifiedReader.end();
  });
});
