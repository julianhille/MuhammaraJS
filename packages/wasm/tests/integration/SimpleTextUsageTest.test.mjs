// Ports the low-level creation and measurement behavior in
// tests/SimpleTextUsageTest.js and tests/TextMeasurementsTest.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";
import { writeOutput } from "../testOutput.mjs";

function assertTextStateOperations(reader, stream, operations) {
  var found = new Set();
  for (var contentStream of Array.isArray(stream) ? stream : [stream]) {
    var parser = reader.startReadingObjectsFromStream(contentStream);
    var previous;
    for (var index = 0; index < 100; ++index) {
      var object = parser.parseNewObject();
      if (!object) break;
      for (var [operator, value] of operations) {
        if (object.toString() === operator && previous?.toNumber() === value) {
          found.add(operator);
        }
      }
      previous = object;
    }
    parser.end();
  }
  for (var [operator, value] of operations) {
    assert.ok(
      found.has(operator),
      `expected ${value} ${operator} content operation`,
    );
  }
}

function allStreams(reader) {
  var streams = [];
  for (var objectId = 1; objectId < reader.getXrefSize(); ++objectId) {
    var stream = reader.parseNewObject(objectId)?.toPDFStream();
    if (stream) streams.push(stream);
  }
  return streams;
}

function assertOperators(reader, stream, operators) {
  var found = new Set();
  for (var contentStream of Array.isArray(stream) ? stream : [stream]) {
    var parser = reader.startReadingObjectsFromStream(contentStream);
    for (var index = 0; index < 200; ++index) {
      var object = parser.parseNewObject();
      if (!object) break;
      found.add(object.toString());
    }
    parser.end();
  }
  for (var operator of operators) {
    assert.ok(found.has(operator), `expected ${operator} content operator`);
  }
}

function assertRawGrayOperators(reader, streams, count) {
  var found = 0;
  for (var stream of streams) {
    var parser = reader.startReadingObjectsFromStream(stream);
    var previous;
    for (var index = 0; index < 200; ++index) {
      var object = parser.parseNewObject();
      if (!object) break;
      if (object.toString() === "g" && previous?.toNumber() === 0.25)
        found += 1;
      previous = object;
    }
    parser.end();
  }
  assert.ok(found >= count, `expected ${count} raw 0.25 g operations`);
}

describe("SimpleTextUsageTest", function () {
  it("writes text with byte-registered fonts", async function () {
    var muhammara = await createMuhammaraWasm();
    muhammara.registerFont(
      "arial",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    muhammara.registerFont(
      "koz",
      new Uint8Array(
        await readFile("tests/TestMaterials/fonts/KozGoPro-Regular.otf"),
      ),
    );
    muhammara.registerFont(
      "helvetica-pfb",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/HLB_____.PFB")),
    );
    muhammara.registerFont(
      "helvetica-pfm",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/HLB_____.PFM")),
    );

    var page = new muhammara.PDFPage(0, 0, 595, 842);
    var writer = muhammara.createWriter();
    var arial = writer.getFontForBytes("arial");
    // Glyph id lists measure like the text they encode, as on native.
    assert.deepEqual(
      arial.calculateTextDimensions([43, 76], 12),
      arial.calculateTextDimensions("Hi", 12),
    );
    var koz = writer.getFontForBytes("koz");
    var helvetica = writer.getFontForBytes("helvetica-pfb", "helvetica-pfm");
    var dimensions = arial.calculateTextDimensions("Hello World", 14);
    var metrics = arial.getFontMetrics(14);
    var fractional = arial.calculateTextDimensions("Hi gy", 10.5);
    var unit = arial.calculateTextDimensions("Hi gy", 1);

    assert.ok(Math.abs(fractional.width - unit.width * 10.5) < 1e-9);
    assert.ok(Math.abs(fractional.yMin - unit.yMin * 10.5) < 1e-9);
    assert.ok(
      fractional.width > arial.calculateTextDimensions("Hi gy", 10).width,
    );
    [0, -5, NaN, Infinity].forEach((size) => {
      assert.throws(
        () => arial.calculateTextDimensions("Hi gy", size),
        TypeError,
      );
    });

    assert.ok(dimensions.width > 0);
    assert.ok(dimensions.height > 0);
    assert.ok(dimensions.xMax > dimensions.xMin);
    assert.ok(dimensions.yMax > dimensions.yMin);
    assert.equal(metrics.pixelsPerEm.x, 14);
    assert.ok(metrics.height > 0);

    var context = writer.startPageContentContext(page);
    assert.equal(
      context
        .BT()
        .k(0, 0, 0, 1)
        .Tf(koz, 30)
        .Tc(1.25)
        .Tw(2.5)
        .Tz(85)
        .TL(18)
        .Tr(2)
        .Ts(-3.5)
        .Tm(1, 0, 0, 1, 78.4252, 662.8997)
        .Tj("abcd")
        .ET()
        .BT()
        .Tf(arial, 30)
        .Tm(1, 0, 0, 1, 78.4252, 400.8997)
        .Tj([
          [68, 97],
          [69, 98],
          [70, 99],
          [71, 100],
        ])
        .ET()
        .BT()
        .Tf(helvetica, 18)
        .Tm(1, 0, 0, 1, 10, 100)
        .Tj("Hello World")
        .ET(),
      context,
    );
    assert.throws(() => context.Tc(Infinity), /finite numeric arguments/);
    assert.throws(() => context.Tw(NaN), /finite numeric arguments/);
    assert.throws(() => context.Tz(85.5), /integer numeric arguments/);
    assert.throws(() => context.TL(Infinity), /finite numeric arguments/);
    assert.throws(() => context.Tr(2.5), /integer numeric arguments/);
    assert.throws(() => context.Ts(NaN), /finite numeric arguments/);
    writer.writePage(page);
    assert.throws(() => context.Tw(1), /not active/);

    var pdf = writer.end();
    writeOutput("SimpleTextUsageTest", pdf);
    assert.ok(pdf instanceof Uint8Array);
    assert.equal(new TextDecoder().decode(pdf.slice(0, 8)), "%PDF-1.4");
    assert.match(new TextDecoder().decode(pdf), /\/Font/);

    var reader = muhammara.createReader(pdf);
    assert.equal(reader.getPagesCount(), 1);
    assert.deepEqual(reader.getPageInfo(0).mediaBox, [0, 0, 595, 842]);
    var pageDictionary = reader.parsePageDictionary(0).toPDFDictionary();
    assertTextStateOperations(
      reader,
      reader.queryDictionaryObject(pageDictionary, "Contents").toPDFStream(),
      [
        ["Tc", 1.25],
        ["Tw", 2.5],
        ["Tz", 85],
        ["TL", 18],
        ["Tr", 2],
        ["Ts", -3.5],
      ],
    );
    reader.end();
  });

  it("writes text state operators on form and modifier contexts", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var form = writer.createFormXObject(0, 0, 100, 100);
    var formContext = form.getContentContext();
    assert.equal(
      formContext.Tw(-0.5).Tz(90).TL(12).Tr(1).Ts(2).Tc(0.25),
      formContext,
    );
    assert.throws(() => formContext.Tw(Infinity), /finite numeric arguments/);
    assert.throws(() => formContext.Tz(90.5), /integer numeric arguments/);
    assert.throws(() => formContext.TL(NaN), /finite numeric arguments/);
    assert.throws(() => formContext.Tr(1.5), /integer numeric arguments/);
    assert.throws(() => formContext.Ts(Infinity), /finite numeric arguments/);
    writer.endFormXObject(form);
    assert.throws(() => formContext.Tw(1), /has ended/);

    var page = writer.createPage(0, 0, 100, 100);
    writer.startPageContentContext(page).doXObject(form);
    writer.writePage(page);
    var source = writer.end();

    var reader = muhammara.createReader(source);
    var pageDictionary = reader.parsePageDictionary(0).toPDFDictionary();
    var resources = reader
      .queryDictionaryObject(pageDictionary, "Resources")
      .toPDFDictionary();
    var xObjects = reader
      .queryDictionaryObject(resources, "XObject")
      .toPDFDictionary();
    var formName = Object.keys(xObjects.toJSObject())[0];
    assertTextStateOperations(
      reader,
      reader.queryDictionaryObject(xObjects, formName).toPDFStream(),
      [
        ["Tw", -0.5],
        ["Tz", 90],
        ["TL", 12],
        ["Tr", 1],
        ["Ts", 2],
        ["Tc", 0.25],
      ],
    );
    reader.end();

    var modifier = muhammara.createWriterToModify(source);
    var pageModifier = modifier.createPageModifier(0).startContext();
    var modifierContext = pageModifier.getContext();
    assert.equal(
      modifierContext.Tw(1.5).Tz(95).TL(10).Tr(3).Ts(-1).Tc(0.5),
      modifierContext,
    );
    assert.throws(() => modifierContext.Tw(NaN), /finite numeric arguments/);
    assert.throws(() => modifierContext.Tz(95.5), /integer numeric arguments/);
    assert.throws(
      () => modifierContext.TL(Infinity),
      /finite numeric arguments/,
    );
    assert.throws(() => modifierContext.Tr(3.5), /integer numeric arguments/);
    assert.throws(() => modifierContext.Ts(NaN), /finite numeric arguments/);
    pageModifier.endContext();
    assert.throws(() => modifierContext.Tw(1), /not active/);
    pageModifier.writePage();
    var modified = modifier.end();
    assert.ok(modified instanceof Uint8Array);
    var modifiedReader = muhammara.createReader(modified);
    assertTextStateOperations(modifiedReader, allStreams(modifiedReader), [
      ["Tw", 1.5],
      ["Tz", 95],
      ["TL", 10],
      ["Tr", 3],
      ["Ts", -1],
      ["Tc", 0.5],
    ]);
    modifiedReader.end();
  });

  it("writes text positioning and showing operators on every content context", async function () {
    var muhammara = await createMuhammaraWasm();
    muhammara.registerFont(
      "arial",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    var writer = muhammara.createWriter();
    var font = writer.getFontForBytes("arial");
    var page = writer.createPage(0, 0, 100, 100);
    var pageContext = writer.startPageContentContext(page);
    assert.equal(
      pageContext
        .BT()
        .Tf(font, 10)
        .Td(10, 10)
        .TD(1, -2)
        .TStar()
        .Quote("page")
        .DoubleQuote(1, 2, "page", { encoding: "hex" })
        .TJ("page", -20, [[68, 68]], "text")
        .Tj("raw", { encoding: "code" })
        .ET(),
      pageContext,
    );
    assert.throws(
      () => pageContext.Td(Infinity, 1),
      /finite numeric arguments/,
    );
    assert.throws(
      () => pageContext.DoubleQuote(1, NaN, "x"),
      /finite numeric arguments/,
    );
    assert.throws(
      () => pageContext.TJ("x", Infinity),
      /finite numeric arguments/,
    );
    writer.writePage(page);
    assert.throws(() => pageContext.TStar(), /not active/);

    var form = writer.createFormXObject(0, 0, 100, 100);
    var formContext = form.getContentContext();
    assert.equal(
      formContext
        .BT()
        .Tf(font, 10)
        .Td(1, 2)
        .TD(1, -1)
        .TStar()
        .Quote("form")
        .DoubleQuote(1, 2, [[68, 68]])
        .TJ("form", -10, [[69, 69]])
        .ET(),
      formContext,
    );
    writer.endFormXObject(form);
    assert.throws(() => formContext.TJ("stale"), /has ended/);
    var formPage = writer.createPage(0, 0, 100, 100);
    writer.startPageContentContext(formPage).doXObject(form);
    writer.writePage(formPage);
    var source = writer.end();
    writeOutput("SimpleTextUsageTest-positioning", source);

    var reader = muhammara.createReader(source);
    var pageDictionary = reader.parsePageDictionary(0).toPDFDictionary();
    assertOperators(
      reader,
      reader.queryDictionaryObject(pageDictionary, "Contents").toPDFStream(),
      ["Td", "TD", "T*", "'", '"', "TJ"],
    );
    reader.end();

    var modifier = muhammara.createWriterToModify(source);
    var pageModifier = modifier.createPageModifier(0).startContext();
    var modifierContext = pageModifier.getContext();
    assert.equal(
      modifierContext
        .BT()
        .Tf(modifier.getFontForBytes("arial"), 10)
        .Td(1, 2)
        .TD(1, -1)
        .TStar()
        .Quote("modifier")
        .DoubleQuote(1, 2, "modifier", { encoding: "code" })
        .TJ("modifier", -10, [[68, 68]])
        .ET(),
      modifierContext,
    );
    pageModifier.endContext();
    assert.throws(() => modifierContext.Quote("stale"), /not active/);
    pageModifier.writePage();
    var modified = modifier.end();
    writeOutput("SimpleTextUsageTest-positioning-modified", modified);
    var modifiedReader = muhammara.createReader(modified);
    assertOperators(modifiedReader, allStreams(modifiedReader), [
      "Td",
      "TD",
      "T*",
      "'",
      '"',
      "TJ",
    ]);
    modifiedReader.end();
  });

  var NUL_TEXT = "before\0after";
  var NUL_BYTES = [98, 101, 102, 111, 114, 101, 0, 97, 102, 116, 101, 114];

  // Reads the single text operand of the first content stream operator back as
  // raw bytes, so an embedded NUL is visible instead of ending the string.
  function readTextOperandBytes(muhammara, bytes, toStringObject) {
    var reader = muhammara.createReader(bytes);
    var stream = reader
      .queryDictionaryObject(reader.parsePageDictionary(0), "Contents")
      .toPDFStream();
    var parser = reader.startReadingObjectsFromStream(stream);
    parser.parseNewObject();
    var operand = Array.from(
      toStringObject(parser.parseNewObject()).toBytesArray(),
    );
    parser.end();
    reader.end();
    return operand;
  }

  [
    { encoding: "hex", accessor: "toPDFHexString" },
    { encoding: "code", accessor: "toPDFLiteralString" },
  ].forEach(function (variant) {
    it(`preserves embedded NUL bytes in ${variant.encoding} TJ strings`, async function () {
      var muhammara = await createMuhammaraWasm();
      var writer = muhammara.createWriter();
      var page = writer.createPage(0, 0, 100, 100);
      writer
        .startPageContentContext(page)
        .BT()
        .TJ(NUL_TEXT, { encoding: variant.encoding })
        .ET();
      writer.writePage(page);

      assert.deepEqual(
        readTextOperandBytes(muhammara, writer.end(), (object) =>
          object.toPDFArray().queryObject(0)[variant.accessor](),
        ),
        NUL_BYTES,
      );
    });

    it(`preserves embedded NUL bytes in ${variant.encoding} Tj strings`, async function () {
      var muhammara = await createMuhammaraWasm();
      var writer = muhammara.createWriter();
      var page = writer.createPage(0, 0, 100, 100);
      writer
        .startPageContentContext(page)
        .BT()
        .Tj(NUL_TEXT, { encoding: variant.encoding })
        .ET();
      writer.writePage(page);

      assert.deepEqual(
        readTextOperandBytes(muhammara, writer.end(), (object) =>
          object[variant.accessor](),
        ),
        NUL_BYTES,
      );
    });
  });

  it("writes free code on page, form, and modifier contexts", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var form = writer.createFormXObject(0, 0, 100, 100);
    var formContext = form.getContentContext();
    assert.equal(formContext.writeFreeCode("0.25 g\n"), formContext);
    assert.throws(() => formContext.writeFreeCode({}), /requires a string/);
    writer.endFormXObject(form);
    assert.throws(() => formContext.writeFreeCode("0.25 g\n"), /has ended/);

    var page = writer.createPage(0, 0, 100, 100);
    var pageContext = writer.startPageContentContext(page);
    assert.equal(pageContext.writeFreeCode("0.25 g\n"), pageContext);
    assert.throws(() => pageContext.writeFreeCode(), /requires a string/);
    pageContext.doXObject(form);
    writer.writePage(page);
    assert.throws(() => pageContext.writeFreeCode("0.25 g\n"), /not active/);
    var source = writer.end();
    var sourceReader = muhammara.createReader(source);
    var pageDictionary = sourceReader.parsePageDictionary(0).toPDFDictionary();
    assertRawGrayOperators(
      sourceReader,
      [
        sourceReader
          .queryDictionaryObject(pageDictionary, "Contents")
          .toPDFStream(),
      ],
      1,
    );
    var resources = sourceReader
      .queryDictionaryObject(pageDictionary, "Resources")
      .toPDFDictionary();
    var xObjects = sourceReader
      .queryDictionaryObject(resources, "XObject")
      .toPDFDictionary();
    var formName = Object.keys(xObjects.toJSObject())[0];
    assertRawGrayOperators(
      sourceReader,
      [sourceReader.queryDictionaryObject(xObjects, formName).toPDFStream()],
      1,
    );
    sourceReader.end();

    var modifier = muhammara.createWriterToModify(source);
    var pageModifier = modifier.createPageModifier(0).startContext();
    var modifierContext = pageModifier.getContext();
    assert.equal(modifierContext.writeFreeCode("0.25 g\n"), modifierContext);
    assert.throws(
      () => modifierContext.writeFreeCode(null),
      /requires a string/,
    );
    pageModifier.endContext();
    assert.throws(
      () => modifierContext.writeFreeCode("0.25 g\n"),
      /not active/,
    );
    pageModifier.writePage();
    var modifiedReader = muhammara.createReader(modifier.end());
    assertRawGrayOperators(modifiedReader, allStreams(modifiedReader), 3);
    modifiedReader.end();
  });
});
