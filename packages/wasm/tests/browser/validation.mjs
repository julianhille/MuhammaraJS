import {
  ByteReaderWithPosition,
  ByteWriterWithPosition,
  createMuhammaraWasm,
  createRecipe,
} from "../../index.js";
import {
  runExampleWorkflow,
  validateObjectUrlLifecycle,
} from "../../examples/browser/workflow.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  assert(
    actual === expected,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

function equalBytes(actual, expected, message) {
  equal(actual.length, expected.length, `${message} length`);
  for (var index = 0; index < expected.length; ++index) {
    equal(actual[index], expected[index], `${message} byte ${index}`);
  }
}

/** Runs browser-safe byte, writer, reader, and modifier assertions. */
export async function runValidation() {
  var assertions = 0;
  var bytes = new ByteWriterWithPosition();
  equal(bytes.write(new Uint8Array([0, 255])), 2, "byte writer write count");
  assertions += 1;
  equal(bytes.write(new Uint8Array([1]).buffer), 1, "array buffer write count");
  assertions += 1;
  equal(bytes.getCurrentPosition(), 3, "byte writer position");
  assertions += 1;
  equalBytes(bytes.toUint8Array(), [0, 255, 1], "byte writer output");
  assertions += 1;

  var input = new ByteReaderWithPosition(bytes.toArrayBuffer());
  equalBytes(input.read(2), [0, 255], "byte reader first read");
  assertions += 1;
  input.setPosition(1);
  equalBytes(input.read(2), [255, 1], "byte reader positioned read");
  assertions += 1;
  equal(input.notEnded(), false, "byte reader end state");
  assertions += 1;

  var muhammara = await createMuhammaraWasm();
  var writer = muhammara.createWriter({ version: muhammara.ePDFVersion14 });
  var page = new muhammara.PDFPage(0, 0, 200, 300);
  writer
    .startPageContentContext(page)
    .re(10, 10, 20, 20)
    .f()
    .writeFreeCode("BT /F1 12 Tf 1 0 0 1 25 50 Tm (browser text) Tj ET");
  writer.writePage(page);
  var pdf = writer.end();
  assert(
    pdf instanceof Uint8Array && pdf.length > 100,
    "writer returned PDF bytes",
  );
  assertions += 1;

  var reader = muhammara.createReader(pdf.buffer);
  equal(reader.getPDFLevel(), 1.4, "reader PDF level");
  assertions += 1;
  equal(reader.getPagesCount(), 1, "reader page count");
  assertions += 1;
  equalBytes(
    reader.getPageInfo(0).mediaBox,
    [0, 0, 200, 300],
    "reader media box",
  );
  assertions += 1;
  var text = reader.extractPageText(0);
  equal(text.length, 1, "reader extracted text count");
  assertions += 1;
  equal(text[0].content, "browser text", "reader extracted text content");
  assertions += 1;
  equal(text[0].fontResource, "F1", "reader extracted font resource");
  assertions += 1;
  equal(text[0].fontSize, 12, "reader extracted font size");
  assertions += 1;
  equalBytes(text[0].textMatrix, [1, 0, 0, 1, 25, 50], "reader text matrix");
  assertions += 1;
  reader.end();

  var Recipe = await createRecipe();
  var recipe = new Recipe({ version: 2.0, compress: false });
  recipe.createPage();
  equal(recipe.position.x, 0, "recipe initial cursor x");
  equal(recipe.position.y, 0, "recipe initial cursor y");
  assertions += 2;
  equal(
    recipe._calibrateCoordinate("center", "center").nx,
    306,
    "recipe centered x",
  );
  equal(
    recipe._calibrateCoordinate("center", "center").ny,
    396,
    "recipe centered y",
  );
  assertions += 2;
  recipe.setPageBox("media", 10, 20, 210, 320);
  equal(recipe._calibrateCoordinate(0, 0).nx, 10, "recipe media-box x offset");
  equal(recipe._calibrateCoordinate(0, 0).ny, 320, "recipe media-box y offset");
  assertions += 2;
  recipe.rectangle(10, 10, 1, 1, { fill: "#000000" });
  recipe.endPage();
  var callbackBytes;
  var recipeBytes = recipe.endPDF((bytes) => {
    callbackBytes = bytes;
  });
  equal(callbackBytes, recipeBytes, "recipe callback bytes");
  equal(recipe.endPDF(), recipeBytes, "recipe finalization cache");
  equal(
    (await createMuhammaraWasm()).createReader(recipeBytes).getPDFLevel(),
    1.7,
    "recipe version",
  );
  assertions += 2;

  var inspectionRecipe = new Recipe({ compress: false });
  equal(
    inspectionRecipe.read(recipeBytes).pages,
    1,
    "Recipe metadata inspection",
  );
  assertThrows(
    () => inspectionRecipe.editPage(1),
    "Recipe inspection does not enter source mode",
  );
  inspectionRecipe.createPage(10, 10).endPage().endPDF();
  var existingRecipe = new Recipe(recipeBytes, { compress: false });
  equal(typeof existingRecipe.read, "function", "existing Recipe read API");
  existingRecipe
    .editPage(1)
    .rectangle(20, 20, 20, 20, { fill: "#000000" })
    .pauseContext()
    .resumeContext()
    .rectangle(50, 50, 20, 20, { fill: "#000000" })
    .endPage();
  var editedRecipeBytes = existingRecipe.endPDF();
  equal(
    (await createMuhammaraWasm())
      .createReader(editedRecipeBytes)
      .getPagesCount(),
    1,
    "existing Recipe output page count",
  );
  Recipe.registerPdf("browser-source-mode-append", recipeBytes);
  var sourceModeRecipe = new Recipe(recipeBytes, { compress: false })
    .editPage(1)
    .polygon(
      [
        [10, 10],
        [30, 10],
        [20, 30],
      ],
      { fill: "#ff0000" },
    )
    .n_gon(60, 30, 15, 5, { fill: "#00ff00" })
    .star(110, 30, 15, { fill: "#0000ff" })
    .arrow(155, 30, { fill: "#123456" })
    .triangle(20, 80, [20, 25, 30], { fill: "#654321" })
    .endPage()
    .createPage(120, 80)
    .endPage()
    .appendPage("browser-source-mode-append");
  equal(sourceModeRecipe.pageInfo(2).width, 120, "source Recipe new page");
  equal(
    sourceModeRecipe.pageInfo(3).height,
    300,
    "source Recipe appended page",
  );
  var sourceModeBytes = sourceModeRecipe.endPDF();
  var sourceModeReader = (await createMuhammaraWasm()).createReader(
    sourceModeBytes,
  );
  equal(sourceModeReader.getPagesCount(), 3, "source Recipe output page count");
  var sourceModeContents = sourceModeReader
    .parsePage(0)
    .getDictionary()
    .toPDFDictionary()
    .queryObject("Contents");
  assert(
    sourceModeContents.toPDFArray()?.getLength() >= 2,
    "source Recipe retains original and polygon edit contexts",
  );
  sourceModeReader.end();
  var asyncRecipe = new Recipe();
  equal(
    (await asyncRecipe.readAsync(new Blob([recipeBytes]))).pages,
    1,
    "existing Recipe Blob metadata",
  );
  assertThrows(
    () => asyncRecipe.editPage(1),
    "async Recipe inspection does not enter source mode",
  );
  asyncRecipe.createPage(10, 10).endPage().endPDF();
  assertions += 9;

  var rotatedSource = new Recipe({ compress: false })
    .createPage(200, 300)
    .setPageBox("media", 10, 20, 210, 320)
    .rotate(90)
    .endPage()
    .endPDF();
  var rotatedRecipe = new Recipe(rotatedSource, { compress: false });
  equal(rotatedRecipe.metadata[1].width, 300, "rotated Recipe width");
  equal(rotatedRecipe.metadata[1].height, 200, "rotated Recipe height");
  rotatedRecipe
    .editPage(1)
    .moveTo(50, 60)
    .lineTo(70, 80)
    .annot(110, 120, "Square", { width: 30, height: 40 });
  equal(rotatedRecipe.position.x, 70, "rotated Recipe cursor x");
  equal(rotatedRecipe.position.y, 80, "rotated Recipe cursor y");
  var rotatedOutput = new TextDecoder().decode(
    rotatedRecipe.endPage().endPDF(),
  );
  assert(
    /0 1 -1 0 190 20 cm/.test(rotatedOutput) &&
      /60 160 m\s+80 140 l/.test(rotatedOutput) &&
      /\/Rect \[ 50 140 90 170 \]/.test(rotatedOutput),
    "browser and Worker rotated Recipe output",
  );
  assertions += 6;

  var fontBytes = new Uint8Array(
    await (
      await fetch("/packages/native/tests/TestMaterials/fonts/arial.ttf")
    ).arrayBuffer(),
  );
  var imageBytes = new Uint8Array(
    await (
      await fetch(
        "/packages/native/tests/TestMaterials/images/png/pnglogo-grr.png",
      )
    ).arrayBuffer(),
  );
  Recipe.registerFont("browser-arial", fontBytes);
  await Recipe.registerFontAsync("browser-async-arial", new Blob([fontBytes]));
  Recipe.registerImage("browser-logo", imageBytes, "png");
  await Recipe.registerImageAsync(
    "browser-async-logo",
    new Blob([imageBytes]),
    "png",
  );
  var instanceRecipe = new Recipe({ compress: false });
  instanceRecipe.registerFont("browser-instance-arial", fontBytes);
  await instanceRecipe.registerFontAsync(
    "browser-instance-async-arial",
    new Blob([fontBytes]),
  );
  equal(
    instanceRecipe.htmlToTextObjects("<b>browser</b>")[0].styles.bold,
    true,
    "instance HTML text objects",
  );
  assertions += 1;
  var textRecipe = new Recipe({ compress: false }).createPage(240, 180);
  textRecipe
    .layout("columns", 10, 10, 220, 70, { columns: 2, gap: 10 })
    .text('<b>Worker-safe</b><br><span style="color:#ff0000">HTML</span>', {
      font: "browser-arial",
      html: true,
      layout: "columns",
      highlight: true,
      textBox: {
        padding: 2,
        textAlign: "center top",
        style: { fill: "#eeeeee" },
      },
    })
    .table(10, 95, [{ left: "a", right: "b" }], {
      font: "browser-arial",
      header: true,
      border: true,
      columns: [
        { name: "left", width: 100 },
        { name: "right", width: 100 },
      ],
    })
    .endPage();
  var textBytes = textRecipe.endPDF();
  assert(textBytes.length > 100, "browser recipe text output");
  assertions += 1;

  var shapesRecipe = new Recipe({ compress: false }).createPage(400, 220);
  ["triangle", "dart", "kite", 1, 2].forEach((type, index) =>
    shapesRecipe.arrow(40 + index * 70, 35, {
      type,
      double: index === 0,
      fill: "#0000ff",
    }),
  );
  shapesRecipe
    .star(30, 190, 15, 5, { fill: "#ff0000", rotation: 20, debug: true })
    .star(70, 190, 15, 6, { fill: "#00ff00" })
    .star(110, 190, 15, 8, { fill: "#0000ff" })
    .arrow(150, 190, {
      head: [12, 8],
      shaft: [20, 3],
      at: "head",
      rotation: 30,
      debug: 2,
      font: "browser-arial",
    })
    .triangle(20, 100, [30, 40, 50], { traitID: "sss" })
    .triangle(100, 100, [30, 60, 40], { traitID: "sas" })
    .triangle(180, 100, [50, 40, 60], { traitID: "asa" })
    .triangle(
      260,
      100,
      [
        [260, 100],
        [290, 140],
        [320, 100],
      ],
      { traitID: "vtx" },
    )
    .triangle(220, 180, [30, 40, 50], {
      position: "incenter",
      flipX: true,
      flipY: true,
      debug: true,
      font: "browser-arial",
    })
    .image("browser-logo", 350, 150, {
      width: 40,
      height: 30,
      align: "center center",
      rotation: 10,
      skewX: 5,
      opacity: 0.5,
    })
    .endPage();
  assert(shapesRecipe.endPDF().length > 100, "browser recipe shapes and image");
  assertions += 1;

  var overflowCalls = 0;
  var overflowRecipe = new Recipe({ compress: false }).createPage(240, 240);
  overflowRecipe
    .text("alpha bravo charlie", 10, 10, {
      font: "browser-arial",
      textBox: { width: 45, wrap: "clip" },
    })
    .text("alpha bravo charlie", 10, 30, {
      font: "browser-arial",
      textBox: { width: 45, wrap: "trim" },
    })
    .text("alpha bravo charlie", 10, 50, {
      font: "browser-arial",
      textBox: { width: 45, wrap: "ellipsis" },
    })
    .table(
      10,
      70,
      [
        { name: "first row wraps", value: "one two three four" },
        { name: "second row wraps", value: "five six seven eight" },
      ],
      {
        font: "browser-arial",
        height: 50,
        header: true,
        columns: [
          { name: "name", width: 65 },
          { name: "value", width: 65 },
        ],
        overflow: () => {
          overflowCalls += 1;
          return { position: [10, 150] };
        },
      },
    )
    .endPage();
  var overflowBytes = overflowRecipe.endPDF();
  var overflowText = (await createMuhammaraWasm())
    .createReader(overflowBytes)
    .extractPageText(0);
  equal(overflowText[0].content, "alpha bravo charlie", "clip source");
  equal(overflowText[1].content, "alpha", "trim source");
  assert(/\.\.\.$/.test(overflowText[2].content), "ellipsis source");
  var continuationHeaders = overflowText.filter(
    (entry) => entry.content === "name",
  );
  equal(overflowCalls, 1, "table overflow callback");
  equal(continuationHeaders.length, 2, "repeated table headers");
  assert(
    continuationHeaders[0].textMatrix[5] >
      overflowText.find((entry) => entry.content === "first row").textMatrix[5],
    "first header precedes wrapped row",
  );
  assert(
    continuationHeaders[1].textMatrix[5] >
      overflowText.find((entry) => entry.content === "second row")
        .textMatrix[5],
    "continued header precedes wrapped row",
  );
  assertions += 7;

  var sourceRecipe = new Recipe(overflowBytes, { compress: false });
  sourceRecipe
    .editPage(1)
    .link("https://example.test", 10, 100, 20, 10)
    .image("browser-logo", 10, 120, { width: 20 })
    .text("source clipping verifies modifier content", 10, 150, {
      font: "browser-instance-arial",
      textBox: { width: 30, wrap: "clip" },
    })
    .endPage();
  var sourceOutput = new TextDecoder().decode(sourceRecipe.endPDF());
  assert(
    /\/URI \(https:\/\/example\.test\)/.test(sourceOutput),
    "source Recipe link",
  );
  assert(/30 [\d.]+ re\r?\nW\r?\nn/.test(sourceOutput), "source Recipe clip");
  assertions += 2;

  var annotationRecipe = new Recipe({ compress: false })
    .createPage(100, 100)
    .comment("browser comment", 10, 10, {
      richText: true,
      replies: [{ text: "browser reply" }],
    })
    .annot(10, 30, "Square", { width: 20, height: 10 })
    .endPage();
  equal(annotationRecipe.permission("print, copy"), 20, "recipe permissions");
  assertions += 1;
  assertThrows(
    () => annotationRecipe.encrypt(),
    "recipe encryption is unavailable",
  );
  assertions += 1;
  var annotationBytes = annotationRecipe.endPDF();
  assert(annotationBytes.length > 100, "browser recipe annotation output");
  assertions += 1;
  Recipe.registerPdf("browser-recipe-source", annotationBytes);
  var compositionRecipe = new Recipe({ compress: false })
    .appendPage("browser-recipe-source")
    .createPage(100, 100)
    .overlay("browser-recipe-source", { page: 1, fitWidth: true })
    .endPage()
    .insertPage(0, "browser-recipe-source", 1);
  equal(compositionRecipe.info().constructor, Object, "recipe metadata read");
  var compositionBytes = compositionRecipe.endPDF();
  assert(compositionRecipe.split("browser").length === 3, "recipe byte split");
  assert(
    compositionRecipe.structure("json").pages === 3,
    "recipe structural summary",
  );
  assert(compositionBytes.length > 100, "browser recipe composition output");
  assertions += 3;

  var colorRecipe = new Recipe({ compress: false }).createPage(100, 100);
  colorRecipe
    .chroma("browser-blue", "%0,40,100")
    .rectangle(10, 10, 30, 20, { fill: "browser-blue", opacity: 0.5 })
    .star(60, 50, 20, { stroke: "#00ff00", rotation: 15, skewX: 5 })
    .endPage();
  var colorReader = (await createMuhammaraWasm()).createReader(
    colorRecipe.endPDF(),
  );
  equal(colorReader.getPagesCount(), 1, "recipe vector page count");
  equal(colorReader.getPageInfo(0).width, 100, "recipe vector page width");
  colorReader.end();
  assertions += 2;
  assertThrows(
    () => colorRecipe.chroma("!load", "colors.json"),
    "recipe chroma path loader is unavailable",
  );
  assertThrows(
    () => colorRecipe.chroma("spot", "#000000", "separation"),
    "recipe Separation colors are unavailable",
  );
  assertThrows(
    () => new Recipe("input.pdf"),
    "recipe path input is unavailable",
  );
  assertions += 3;

  var parityRecipe = new Recipe({ compress: false }).createPage(240, 220);
  var layoutOverflows = 0;
  parityRecipe
    .rectangle(10, 20, 50, 30, {
      useGivenCoords: true,
      borderRadius: [1, 2, 3, 4],
      fill: "#ff0000",
    })
    .n_gon(110, 60, 20, 5, {
      stroke: "#000000",
      rotation: 20,
      rotationVertice: 2,
      debug: true,
    })
    .layout("first-parity", 10, 100, 90, 20, { columns: 2, gap: 10 })
    .layout("second-parity", 10, 150, 90, 40, { columns: 1 })
    .text("one two three four", 10, 100, {
      font: "browser-arial",
      hilite: true,
      textBox: { width: 90, textAlign: "justify top", wrap: "clip" },
    })
    .text("a\nb\nc", {
      font: "browser-arial",
      layout: "first-parity",
      overflow: () => {
        layoutOverflows += 1;
        return { layout: "second-parity", column: 0 };
      },
    })
    .table(110, 120, [{ left: "a", right: "b" }], {
      font: "browser-arial",
      header: { alignToData: true },
      columns: [
        { name: "left", width: 50, cell: { textAlign: "right top" } },
        {
          name: "right",
          width: 50,
          hcell: { textAlign: "center top" },
        },
      ],
    })
    .endPage();
  var parityReader = (await createMuhammaraWasm()).createReader(
    parityRecipe.endPDF(),
  );
  equal(parityReader.getPagesCount(), 1, "browser recipe parity page count");
  assert(
    parityReader.extractPageText(0).length >= 6,
    "browser recipe parity text output",
  );
  equal(layoutOverflows, 1, "browser recipe layout overflow order");
  parityReader.end();
  assertions += 3;

  var formWriter = muhammara.createWriter({ compress: false });
  var form = formWriter.createFormXObject(0, 0, 20, 20);
  var formContext = form.getContentContext();
  var formStream = form.getContentStream();
  var formStreamWriter = formStream.getWriteStream();
  var formBytes = new TextEncoder().encode("q 0 1 0 rg 0 0 20 20 re f Q\n");
  equal(
    formStreamWriter.write(formBytes),
    formBytes.length,
    "form stream write count",
  );
  assertions += 1;
  formContext.q().re(1, 1, 2, 2).f().Q();
  var formPage = formWriter.createPage(0, 0, 100, 100);
  var formPageContext = formWriter.startPageContentContext(formPage);
  var formName = formPage
    .getResourcesDictionary()
    .addFormXObjectMapping(form.id);
  assert(/^Fm/.test(formName), "form resource mapping name");
  assertions += 1;
  formWriter.endFormXObject(form);
  assertThrows(
    () => form.getContentStream(),
    "closed form content stream is stale",
  );
  assertThrows(
    () => formStream.getWriteStream(),
    "closed form stream is stale",
  );
  assertThrows(
    () => formStreamWriter.write(formBytes),
    "closed form stream writer is stale",
  );
  assertThrows(() => formContext.f(), "closed form context is stale");
  assertions += 4;
  formPageContext.doXObject(formName);
  formWriter.writePage(formPage);
  var formPdf = formWriter.end();
  var formReader = muhammara.createReader(formPdf);
  var parsedFormStream = formReader.parseNewObject(form.id).toPDFStream();
  var parsedFormBytes = new Uint8Array(
    formReader.startReadingFromStream(parsedFormStream).read(1024),
  );
  assert(
    new TextDecoder()
      .decode(parsedFormBytes)
      .includes(new TextDecoder().decode(formBytes)),
    "parsed form stream contains written bytes",
  );
  assertions += 1;
  var formPageStream = formReader
    .queryDictionaryObject(formReader.parsePageDictionary(0), "Contents")
    .toPDFStream();
  assert(
    new TextDecoder()
      .decode(
        new Uint8Array(
          formReader.startReadingFromStream(formPageStream).read(1024),
        ),
      )
      .includes(`/${formName} Do`),
    "page content places mapped form",
  );
  assertions += 1;
  formReader.end();

  var modifier = muhammara.createWriterToModify(pdf);
  var pageModifier = modifier.createPageModifier(0);
  pageModifier.startContext().getContext().q().re(30, 30, 10, 10).f().Q();
  pageModifier.endContext().writePage();
  var modified = modifier.end();
  var modifiedReader = muhammara.createReader(modified);
  equal(modifiedReader.getPagesCount(), 1, "modified reader page count");
  assertions += 1;
  assert(modified.length > pdf.length, "modifier appended PDF content");
  assertions += 1;
  modifiedReader.end();

  var replacementWriter = muhammara.createWriterToModify(pdf);
  var originalReader = muhammara.createReader(pdf);
  var sourceObjectId = originalReader
    .parsePage(0)
    .getDictionary()
    .toPDFDictionary()
    .queryObject("Contents")
    .toPDFIndirectObjectReference()
    .getObjectID();
  originalReader.end();
  var objects = replacementWriter.getObjectsContext();
  var replacementObjectId = objects.startNewIndirectObject();
  var replacementStream = objects.startPDFStream();
  replacementStream
    .getWriteStream()
    .write(new TextEncoder().encode("% browser replacement\n"));
  objects.endPDFStream(replacementStream).endIndirectObject();
  equal(
    replacementWriter.replaceObject(0, sourceObjectId, replacementObjectId),
    replacementWriter,
    "replacement writer result",
  );
  var replacementPdf = replacementWriter.end();
  var replacementReader = muhammara.createReader(replacementPdf);
  equal(
    replacementReader
      .parsePage(0)
      .getDictionary()
      .toPDFDictionary()
      .queryObject("Contents")
      .toPDFIndirectObjectReference()
      .getObjectID(),
    replacementObjectId,
    "replacement object used by page",
  );
  replacementReader.end();
  assertions += 2;

  var exampleAssets = {
    font: fontBytes,
    jpeg: new Uint8Array(
      await (
        await fetch(
          "/packages/native/tests/TestMaterials/images/soundcloud_logo.jpg",
        )
      ).arrayBuffer(),
    ),
    png: imageBytes,
    tiff: new Uint8Array(
      await (
        await fetch(
          "/packages/native/tests/TestMaterials/images/tiff/multipage.tif",
        )
      ).arrayBuffer(),
    ),
  };
  var example = await runExampleWorkflow({ assets: exampleAssets });
  equal(
    example.lowLevel.summary.composedPages,
    3,
    "executable example low-level pages",
  );
  equal(example.recipe.summary.pages, 3, "executable example Recipe pages");
  equal(
    example.recipe.summary.splitParts,
    3,
    "executable example Recipe split",
  );
  assert(
    example.lowLevel.bytes instanceof Uint8Array &&
      example.recipe.bytes instanceof Uint8Array,
    "executable example byte outputs",
  );
  var urlLifecycle = validateObjectUrlLifecycle();
  equal(urlLifecycle.created, 2, "example object URLs created");
  equal(urlLifecycle.revoked, 2, "example object URLs revoked");
  assertions += 6;

  return { assertions };
}

function assertThrows(callback, message) {
  try {
    callback();
  } catch {
    return;
  }
  throw new Error(message);
}
