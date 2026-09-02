import { createMuhammaraWasm } from "./module-options.mjs";
import { throwIfCancelled } from "./lifecycle.mjs";

var encoder = new TextEncoder();

function assert(condition, message) {
  if (!condition) throw new Error(`Low-level validation failed: ${message}`);
}

function exactArrayBuffer(bytes) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

function registerAssets(muhammara, assets) {
  if (assets.font)
    muhammara.registerFont("example-font", exactArrayBuffer(assets.font));
  if (assets.png) muhammara.registerImage("example-png", assets.png, "png");
  if (assets.tiff) muhammara.registerImage("example-tiff", assets.tiff, "tiff");
}

async function registerAsyncAssets(muhammara, assets) {
  if (assets.jpeg)
    await muhammara.registerImageAsync(
      "example-jpeg",
      new Blob([assets.jpeg], { type: "image/jpeg" }),
      "jpeg",
    );
}

function rawExampleObject(writer) {
  var objects = writer.getObjectsContext();
  var id = objects.startNewIndirectObject();
  var dictionary = objects.startDictionary();
  dictionary
    .writeKey("Type")
    .writeNameValue("ExampleData")
    .writeKey("Purpose")
    .writeLiteralStringValue("raw byte stream");
  var stream = objects.startUnfilteredPDFStream(dictionary);
  stream.getWriteStream().write(encoder.encode("browser example payload\n"));
  objects.endPDFStream(stream);
  return id;
}

function drawPage(muhammara, writer, assets) {
  var page = new muhammara.PDFPage(0, 0, 595, 842);
  page.cropBox = [18, 18, 577, 824];
  page.trimBox = [24, 24, 571, 818];
  page.rotate = 0;
  var context = writer.startPageContentContext(page);

  context
    .q()
    .rg(0.05, 0.22, 0.3)
    .re(0, 0, 595, 842)
    .f()
    .Q()
    .q()
    .re(48, 520, 499, 230)
    .W()
    .n()
    .setOpacity(0.88)
    .rg(0.95, 0.63, 0.18)
    .m(30, 520)
    .c(180, 800, 420, 420, 570, 740)
    .l(570, 500)
    .h()
    .f()
    .Q()
    .q()
    .RG(0.85, 0.95, 1)
    .w(2)
    .d([8, 5], 0)
    .drawPath(
      [
        [70, 470],
        [260, 430],
        [510, 485],
      ],
      { color: 0xffffff, width: 2 },
    )
    .Q();

  var metrics;
  if (assets.font) {
    var font = writer.getFontForBytes("example-font");
    metrics = {
      dimensions: font.calculateTextDimensions("Muhammara Wasm", 28),
      font: font.getFontMetrics(28),
    };
    context
      .BT()
      .Tf(font, 28)
      .Tc(0.4)
      .Tm(1, 0, 0, 1, 64, 782)
      .Tj("Muhammara Wasm")
      .ET()
      .writeText("byte-first PDF in a page or module Worker", 64, 752, {
        font,
        size: 12,
        color: 0xffffff,
      });
  } else {
    context.writeFreeCode(
      "BT /Fallback 18 Tf 1 0 0 1 64 782 Tm (Muhammara Wasm) Tj ET\n",
    );
  }

  if (assets.jpeg)
    context.drawImage(64, 285, "example-jpeg", {
      transformation: { width: 130, height: 110, proportional: true },
    });
  if (assets.png)
    context.drawImage(225, 285, "example-png", {
      transformation: { width: 130, height: 110, proportional: true },
    });
  if (assets.tiff) {
    var count = writer.getImagePagesCount("example-tiff");
    context.drawImage(390, 285, "example-tiff", {
      index: Math.min(1, count - 1),
      transformation: { width: 130, height: 110, proportional: true },
    });
    writer.createFormXObjectFromTIFF("example-tiff", {
      pageIndex: 0,
      grayscaleTreatment: {
        asColorMap: true,
        oneColor: [15, 85, 110],
        zeroColor: [255, 255, 255],
      },
    });
  }

  var badge = writer.createFormXObject(0, 0, 150, 44);
  badge
    .getContentContext()
    .q()
    .rg(0.94, 0.25, 0.22)
    .drawRectangle(0, 0, 150, 44, { type: "fill", color: 0xef4444 })
    .Q();
  writer.endFormXObject(badge);
  context.q().cm(1, 0, 0, 1, 64, 195).doXObject(badge).Q();

  writer.attachURLLinktoCurrentPage(
    "https://github.com/julianhille/MuhammaraJS",
    64,
    195,
    214,
    239,
  );
  var annotationId = writer.createAnnotation("Highlight", 60, 775, 330, 810, {
    contents: "Generated entirely from browser-owned bytes",
    title: "Muhammara Wasm example",
    color: [1, 0.75, 0.2],
    opacity: 0.35,
    quadPoints: [60, 810, 330, 810, 60, 775, 330, 775],
  });
  writer.writePage(page);
  return { annotationId, metrics };
}

function inspect(muhammara, bytes, expectedPages, rawId, annotationId) {
  var reader = muhammara.createReader(bytes);
  try {
    assert(reader.getPagesCount() === expectedPages, "unexpected page count");
    assert(
      reader.getPageInfo(0).mediaBox[2] === 595,
      "media box was not retained",
    );
    assert(
      reader.parsePage(0).getDictionary().toPDFDictionary(),
      "page dictionary",
    );
    var raw = reader.parseNewObject(rawId).toPDFStream();
    assert(
      raw?.getDictionary().queryObject("Type").value === "ExampleData",
      "raw object",
    );
    assert(
      reader
        .parseNewObject(annotationId)
        .toPDFDictionary()
        .queryObject("Subtype").value === "Highlight",
      "annotation object",
    );
    var parserStream = reader.getParserStream().setPosition(0);
    assert(
      parserStream.read(5).join(",") === "37,80,68,70,45",
      "PDF header bytes",
    );
    return {
      pages: reader.getPagesCount(),
      level: reader.getPDFLevel(),
      objects: reader.getObjectsCount(),
      text: reader.extractPageText(0).map((entry) => entry.content),
    };
  } finally {
    reader.end();
  }
}

function modify(muhammara, source, assets) {
  var modifier = muhammara.createWriterToModify(source, { compress: false });
  try {
    var page = modifier.createPageModifier(0, true);
    var context = page.startContext().getContext();
    context.q().rg(0.94, 0.25, 0.22).re(470, 760, 70, 28).f().Q();
    if (assets.font) {
      context.writeText("edited", 482, 769, {
        font: modifier.getFontForBytes("example-font"),
        size: 10,
        color: 0xffffff,
      });
    }
    page
      .attachURLLinktoCurrentPage(
        "https://www.npmjs.com/package/@muhammara/wasm",
        470,
        760,
        540,
        788,
      )
      .endContext()
      .writePage();
    return modifier.end();
  } catch (error) {
    modifier.dispose();
    throw error;
  }
}

async function compose(muhammara, source) {
  var writer = muhammara.createWriter({ compress: true });
  try {
    var copying = writer.createPDFCopyingContext(source);
    copying.appendPDFPageFromPDF(0);
    var copiedFormId = copying.createFormXObjectFromPDFPage(
      0,
      [0, 0, 595, 842],
      [0.32, 0, 0, 0.32, 0, 0],
    );
    copying.end();

    var embeddedIds = writer.createFormXObjectsFromPDF(
      source,
      muhammara.ePDFPageBoxMediaBox,
      {
        type: muhammara.eRangeTypeSpecific,
        specificRanges: [[0, 0]],
      },
    );
    var page = writer.createPage(0, 0, 595, 842);
    writer.mergePDFPagesToPage(page, source, {
      type: muhammara.eRangeTypeSpecific,
      specificRanges: [[0, 0]],
    });
    writer
      .startPageContentContext(page)
      .q()
      .cm(0.45, 0, 0, 0.45, 315, 40)
      .doXObject(
        page.getResourcesDictionary().addFormXObjectMapping(copiedFormId),
      )
      .Q()
      .q()
      .cm(0.2, 0, 0, 0.2, 445, 640)
      .doXObject(
        page.getResourcesDictionary().addFormXObjectMapping(embeddedIds[0]),
      )
      .Q();
    writer.writePage(page);
    await writer.appendPDFPagesFromPDFAsync(
      new Blob([source], { type: "application/pdf" }),
    );
    return writer.end();
  } catch (error) {
    writer.dispose();
    throw error;
  }
}

export async function runLowLevelExample({
  assets = {},
  signal,
  progress = () => {},
} = {}) {
  progress("Loading the low-level WebAssembly API", 8);
  var muhammara = await createMuhammaraWasm();
  throwIfCancelled(signal);
  try {
    registerAssets(muhammara, assets);
    await registerAsyncAssets(muhammara, assets);
    progress(
      "Writing content, forms, images, links, metadata, and raw objects",
      24,
    );
    var writer = muhammara.createWriter({
      compress: false,
      version: muhammara.ePDFVersion14,
    });
    var rawId;
    var drawn;
    var source;
    try {
      var info = writer.getDocumentContext().getInfoDictionary();
      info.title = "Muhammara Wasm executable browser example";
      info.author = "MuhammaraJS contributors";
      info.subject = "Byte-first low-level API";
      info.addAdditionalInfoEntry("ExampleMode", "page-and-module-worker");
      rawId = rawExampleObject(writer);
      drawn = drawPage(muhammara, writer, assets);
      source = writer.end();
    } catch (error) {
      writer.dispose();
      throw error;
    }
    var sourceSummary = inspect(
      muhammara,
      source,
      1,
      rawId,
      drawn.annotationId,
    );
    throwIfCancelled(signal);
    progress("Modifying and composing byte-backed PDFs", 48);
    var modified = modify(muhammara, source, assets);
    var composed = await compose(muhammara, modified);
    var composedReader = await muhammara.createReaderAsync(
      new File([composed], "composed.pdf", { type: "application/pdf" }),
    );
    var pages = composedReader.getPagesCount();
    composedReader.end();
    assert(pages === 3, "copy, merge, embed, and append page count");
    return {
      bytes: composed,
      source,
      modified,
      summary: {
        ...sourceSummary,
        composedPages: pages,
        metrics: drawn.metrics,
      },
    };
  } finally {
    var cleanup = {
      font: muhammara.unregisterFont("example-font"),
      jpeg: muhammara.unregisterImage("example-jpeg"),
      png: muhammara.unregisterImage("example-png"),
      tiff: muhammara.unregisterImage("example-tiff"),
    };
    muhammara.disposeAssets();
    progress("Low-level assets disposed", 55, cleanup);
  }
}
