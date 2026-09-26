var assert = require("assert");
var muhammara = require("@muhammara/native-with-source");

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
  var found = {};
  for (var objectId = 1; objectId < reader.getXrefSize(); ++objectId) {
    var object = reader.parseNewObject(objectId);
    if (object.getType() !== muhammara.ePDFObjectStream) continue;
    var parser = reader.startReadingObjectsFromStream(object.toPDFStream());
    for (var index = 0; index < 200; ++index) {
      var parsed = parser.parseNewObject();
      if (!parsed) break;
      found[parsed.toString()] = true;
    }
  }
  ["ri", "i", "gs", "CS", "cs", "SC", "SCN", "sc", "scn"].forEach(
    function (operator) {
      assert.ok(found[operator], "expected " + operator + " content operator");
    },
  );
}

describe("StructuredContentOperators", function () {
  it("writes low-level structured operators on page and form contexts", function () {
    var output = __dirname + "/output/StructuredContentOperators.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 100, 100);
    var pageContext = writer.startPageContentContext(page);
    var pageNames = names(page.getResourcesDictionary());
    assert.match(pageNames.gs, /^GS/);
    assert.match(pageNames.colorSpace, /^CS/);
    assert.match(pageNames.pattern, /^P/);
    assert.equal(applyOperators(pageContext, pageNames), pageContext);

    var form = writer.createFormXObject(0, 0, 100, 100);
    var formContext = form.getContentContext();
    var formNames = names(form.getResourcesDictionary());
    assert.equal(applyOperators(formContext, formNames), formContext);
    writer.endFormXObject(form);

    pageContext.doXObject(form);
    writer.writePage(page);
    writer.end();

    var reader = muhammara.createReader(output);
    assertOperators(reader);
    reader.end();
  });

  it("selects a colored pattern by name alone", function () {
    var output = __dirname + "/output/StructuredContentPatternName.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 100, 100);
    var context = writer.startPageContentContext(page);
    var pattern = page.getResourcesDictionary().addPatternMapping(12);
    assert.equal(context.SCN(pattern).scn(pattern), context);
    writer.writePage(page);
    writer.end();
    var reader = muhammara.createReader(output);

    var tokens = [];
    for (var objectId = 1; objectId < reader.getXrefSize(); ++objectId) {
      var object = reader.parseNewObject(objectId);
      if (!object || object.getType() !== muhammara.ePDFObjectStream) continue;
      var parser = reader.startReadingObjectsFromStream(object.toPDFStream());
      for (var parsed; (parsed = parser.parseNewObject());) {
        tokens.push(parsed.toString());
      }
    }
    assert.deepEqual(tokens.slice(0, 4), [pattern, "SCN", pattern, "scn"]);
    reader.end();
  });
});
