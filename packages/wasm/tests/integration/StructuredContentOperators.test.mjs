import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

function names(resources) {
  return {
    gs: resources.addExtGStateMapping(10),
    colorSpace: resources.addColorSpaceMapping(11),
    pattern: resources.addPatternMapping(12),
  };
}

function applyOperators(context, resourceNames) {
  return context
    .ri("RelativeColorimetric")
    .i(5.9)
    .gs(resourceNames.gs)
    .CS(resourceNames.colorSpace)
    .cs(resourceNames.colorSpace)
    .SC(0.1, 0.2, 0.3)
    .SCN([0.4, 0.5, 0.6], resourceNames.pattern)
    .sc(0.1, 0.2, 0.3)
    .scn(0.4, 0.5, 0.6, resourceNames.pattern);
}

function assertOperators(reader) {
  var found = new Set();
  for (var objectId = 1; objectId < reader.getXrefSize(); ++objectId) {
    var stream = reader.parseNewObject(objectId)?.toPDFStream();
    if (!stream) continue;
    var parser = reader.startReadingObjectsFromStream(stream);
    for (var index = 0; index < 200; ++index) {
      var object = parser.parseNewObject();
      if (!object) break;
      found.add(object.toString());
    }
    parser.end();
  }
  for (var operator of [
    "ri",
    "i",
    "gs",
    "CS",
    "cs",
    "SC",
    "SCN",
    "sc",
    "scn",
  ]) {
    assert.ok(found.has(operator), `expected ${operator} content operator`);
  }
}

describe("StructuredContentOperators", function () {
  it("writes native structured operators on page, form, and modifier contexts", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var page = writer.createPage(0, 0, 100, 100);
    var pageContext = writer.startPageContentContext(page);
    var pageNames = names(page.getResourcesDictionary());
    assert.match(pageNames.gs, /^GS/);
    assert.match(pageNames.colorSpace, /^CS/);
    assert.match(pageNames.pattern, /^P/);
    assert.equal(applyOperators(pageContext, pageNames), pageContext);
    assert.throws(() => pageContext.ri(1), /requires a string name/);
    assert.throws(() => pageContext.i(NaN), /finite numeric components/);
    assert.throws(() => pageContext.SC(), /requires numeric components/);
    assert.throws(() => pageContext.SCN(), /requires numeric components/);
    assert.throws(() => pageContext.scn([0.5], 1), /optional pattern name/);
    writer.writePage(page);
    assert.throws(() => pageContext.gs(pageNames.gs), /not active/);

    var form = writer.createFormXObject(0, 0, 100, 100);
    var formContext = form.getContentContext();
    var formNames = names(form.getResourcesDictionary());
    assert.equal(applyOperators(formContext, formNames), formContext);
    writer.endFormXObject(form);
    assert.throws(() => formContext.CS(formNames.colorSpace), /has ended/);

    var formPage = writer.createPage(0, 0, 100, 100);
    writer.startPageContentContext(formPage).doXObject(form);
    writer.writePage(formPage);
    var source = writer.end();

    var modifier = muhammara.createWriterToModify(source);
    var pageModifier = modifier.createPageModifier(0).startContext();
    var modifierContext = pageModifier.getContext();
    var modifierNames = names(pageModifier.getResourcesDictionary());
    assert.equal(
      applyOperators(modifierContext, modifierNames),
      modifierContext,
    );
    assert.throws(() => modifierContext.cs(1), /requires a string name/);
    pageModifier.endContext();
    assert.throws(() => modifierContext.sc(0.5), /not active/);
    pageModifier.writePage();

    var reader = muhammara.createReader(modifier.end());
    assertOperators(reader);
    reader.end();
  });
});
