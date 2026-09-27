import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

function createSource(Recipe, pages = 12) {
  var recipe = new Recipe();
  try {
    for (var page = 1; page <= pages; page += 1) {
      recipe
        .createPage(100 + page, 200 + page)
        .rectangle(10, 10, page, page, { fill: "#000000" })
        .endPage();
    }
    return recipe.endPDF();
  } finally {
    recipe.dispose();
  }
}

async function pageWidths(bytes) {
  var muhammara = await createMuhammaraWasm();
  var reader = muhammara.createReader(bytes);
  try {
    return Array.from(
      { length: reader.getPagesCount() },
      (_, index) => reader.getPageBox(index)[2],
    );
  } finally {
    reader.end();
    muhammara.disposeAssets();
  }
}

async function pageRectangleSizes(bytes) {
  var muhammara = await createMuhammaraWasm();
  var reader = muhammara.createReader(bytes);
  try {
    return Array.from({ length: reader.getPagesCount() }, (_, index) => {
      var page = reader.parsePageDictionary(index);
      var chunks = [];
      var contents = reader.queryDictionaryObject(page, "Contents");
      var contentObjects = contents.toPDFArray()?.toJSArray() || [contents];
      contentObjects.forEach((contentObject) => {
        var reference = contentObject.toPDFIndirectObjectReference();
        if (reference) {
          contentObject = reader.parseNewObject(reference.getObjectID());
        }
        var stream = reader.startReadingFromStream(contentObject.toPDFStream());
        while (stream.notEnded()) chunks.push(...stream.read(4096));
      });
      var source = Buffer.from(chunks).toString("latin1");
      var match = source.match(/(\d+) \1 re/);
      assert.ok(match, source);
      return Number(match[1]);
    });
  } finally {
    reader.end();
    muhammara.disposeAssets();
  }
}

function nestedNonzeroGenerationPdf(options = {}) {
  var pageLabels = options.pageLabels || "indirect";
  var catalogGeneration = options.catalogGeneration ? 1 : 0;
  var pageTreeGeneration = options.nonzeroGeneration ? 1 : 0;
  var labelReference = options.pageLabelReference ? " /VendorCustom 3 1 R" : "";
  var catalogPageLabels = {
    direct: "/PageLabels << /Nums [0 << /P (A-) >> 1 << /P (B-) >>] >>",
    indirect: "/PageLabels 4 0 R",
    "indirect-values": "/PageLabels 4 0 R",
    "chained-values": "/PageLabels 4 0 R",
    kids: "/PageLabels 4 0 R",
    "unicode-hex": "/PageLabels 4 0 R",
    "unicode-literal": "/PageLabels 4 0 R",
    start: "/PageLabels 4 0 R",
    cycle: "/PageLabels 4 0 R",
    null: "/PageLabels null",
    "chained-null": "/PageLabels 4 0 R",
  }[pageLabels];
  var pdf = "%PDF-1.4\n";
  var offsets = {};
  function object(id, generation, body) {
    offsets[id] = [Buffer.byteLength(pdf), generation];
    pdf += `${id} ${generation} obj\n${body}\nendobj\n`;
  }
  object(
    1,
    catalogGeneration,
    `<< /Type /Catalog /Pages 2 ${pageTreeGeneration} R ${catalogPageLabels}${
      options.openAction ? " /OpenAction [3 1 R /Fit]" : ""
    } >>`,
  );
  object(
    2,
    pageTreeGeneration,
    options.duplicatePageReference
      ? `<< /Type /Pages /Kids [5 ${pageTreeGeneration} R] /Count 2 >>`
      : `<< /Type /Pages /Kids [5 ${pageTreeGeneration} R 6 0 R${
          options.nonzeroSibling ? " 10 1 R" : ""
        }] /Count ${options.nonzeroSibling ? 3 : 2}${
          options.pageTreeReference ? " /CustomPageRef 6 0 R" : ""
        }${options.rootParent ? " /Parent 3 1 R" : ""} >>`,
  );
  object(
    3,
    1,
    `<< /Type /Page /Parent 5 ${pageTreeGeneration} R /MediaBox [0 0 101 200] >>`,
  );
  object(
    4,
    0,
    pageLabels === "cycle"
      ? "<< /Kids [4 0 R] >>"
      : pageLabels === "chained-null"
        ? "8 0 R"
        : pageLabels === "kids"
          ? "<< /Kids [8 0 R 9 0 R] /Limits [0 1] >>"
          : pageLabels === "indirect-values"
            ? "<< /Nums [10 0 R << /S 11 0 R /P 12 0 R /St 13 0 R >>] >>"
            : pageLabels === "chained-values"
              ? "18 0 R"
              : pageLabels === "start"
                ? "<< /Nums [0 << /S /D /St 5 >>] >>"
                : pageLabels === "unicode-hex"
                  ? "<< /Nums [0 << /P <FEFF0041002D> >> 1 << /P <FEFF0042002D> >>] >>"
                  : pageLabels === "unicode-literal"
                    ? "<< /Nums [0 << /P (\\376\\377\\000\\101\\000\\055) >> 1 << /P (\\376\\377\\000\\102\\000\\055) >>] >>"
                    : `<< /Nums [0 << /P (A-)${labelReference} >> 1 << /P (B-) >>] >>`,
  );
  object(
    5,
    pageTreeGeneration,
    `<< /Type /Pages /Parent 2 ${pageTreeGeneration} R /Kids [3 1 R${
      options.duplicatePageReference ? " 3 1 R" : ""
    }] /Count ${options.duplicatePageReference ? 2 : 1} /Rotate 90 /Resources << /ProcSet [/PDF] >> >>`,
  );
  object(
    6,
    0,
    `<< /Type /Page /Parent ${
      options.invalidParent ? "3 1" : `2 ${pageTreeGeneration}`
    } R /MediaBox [0 0 102 200]${
      options.annotation ? " /Annots [7 1 R]" : ""
    } >>`,
  );
  if (options.annotation) {
    object(7, 1, "<< /Type /Annot /Subtype /Text /Rect [1 1 10 10] >>");
  }
  if (pageLabels === "kids") {
    object(8, 0, "<< /Nums [0 << /P (A-) >>] /Limits [0 0] >>");
    object(9, 0, "<< /Nums [1 << /P (B-) >>] /Limits [1 1] >>");
  }
  if (pageLabels === "chained-null") object(8, 0, "null");
  if (pageLabels === "indirect-values") {
    object(10, 0, "0");
    object(11, 0, "/D");
    object(12, 0, "(A-)");
    object(13, 0, "5");
  }
  if (pageLabels === "chained-values") {
    object(10, 0, "14 0 R");
    object(11, 0, "15 0 R");
    object(12, 0, "16 0 R");
    object(13, 0, "17 0 R");
    object(14, 0, "0");
    object(15, 0, "/D");
    object(16, 0, "(A-)");
    object(17, 0, "5");
    object(18, 0, "<< /Nums 19 0 R >>");
    object(19, 0, "[10 0 R 20 0 R]");
    object(20, 0, "21 0 R");
    object(21, 0, "<< /S 11 0 R /P 12 0 R /St 13 0 R >>");
  }
  if (options.nonzeroSibling) {
    object(10, 1, "<< /Type /Pages /Parent 2 0 R /Kids [11 0 R] /Count 1 >>");
    object(11, 0, "<< /Type /Page /Parent 10 1 R /MediaBox [0 0 103 200] >>");
  }
  var objectCount =
    pageLabels === "chained-values"
      ? 22
      : pageLabels === "chained-null"
        ? 9
        : pageLabels === "indirect-values"
          ? 14
          : options.nonzeroSibling
            ? 12
            : pageLabels === "kids"
              ? 10
              : 8;
  var xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objectCount}\n0000000000 65535 f \n`;
  for (var id = 1; id < objectCount; id += 1) {
    pdf += offsets[id]
      ? `${String(offsets[id][0]).padStart(10, "0")} ${String(
          offsets[id][1],
        ).padStart(5, "0")} n \n`
      : "0000000000 65535 f \n";
  }
  pdf += `trailer\n<< /Size ${objectCount} /Root 1 ${catalogGeneration} R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf));
}

function nonzeroGenerationTextPdf() {
  var pdf = "%PDF-1.4\n";
  var offsets = {};
  function object(id, generation, body) {
    offsets[id] = [Buffer.byteLength(pdf), generation];
    pdf += `${id} ${generation} obj\n${body}\nendobj\n`;
  }
  var content = "BT\n/F1 12 Tf\n(Before) Tj\nET\n";
  object(1, 0, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, 0, "<< /Type /Pages /Kids [3 1 R 4 0 R] /Count 2 >>");
  object(
    3,
    1,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> >> >> /Contents 5 0 R >>",
  );
  object(4, 0, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>");
  object(
    5,
    0,
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  );
  var xrefOffset = Buffer.byteLength(pdf);
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (var id = 1; id <= 5; id += 1) {
    pdf += `${String(offsets[id][0]).padStart(10, "0")} ${String(
      offsets[id][1],
    ).padStart(5, "0")} n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf));
}

/**
 * Builds a three-page PDF whose second page (object 4) is referenced by an
 * open action, an outline item with a child, a named destination, a link
 * annotation, a direct link annotation on page 3, a form widget and a
 * structure element, and writes it to tests/output.
 * @returns {Uint8Array} The PDF bytes.
 */
function referencedPagesPdf() {
  var pdf = "%PDF-1.7\n";
  var offsets = [];
  var object = (id, body) => {
    offsets[id] = Buffer.byteLength(pdf);
    pdf += `${id} 0 obj\n${body}\nendobj\n`;
  };
  object(
    1,
    "<< /Type /Catalog /Pages 2 0 R /OpenAction [4 0 R /Fit] /Outlines 6 0 R /Names << /Dests 9 0 R >> /AcroForm 10 0 R /StructTreeRoot 12 0 R >>",
  );
  object(2, "<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>");
  object(
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 101 201] /Annots [14 0 R] >>",
  );
  object(
    4,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 102 202] /Annots [11 0 R] /StructParents 0 >>",
  );
  object(
    5,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 103 203] /Annots [<< /Type /Annot /Subtype /Link /Rect [0 0 10 10] /A << /S /GoTo /D [4 0 R /Fit] >> >>] >>",
  );
  object(6, "<< /Type /Outlines /First 7 0 R /Last 7 0 R /Count 2 >>");
  object(
    7,
    "<< /Title (Two) /Parent 6 0 R /Dest [4 0 R /Fit] /First 8 0 R /Last 8 0 R /Count 1 >>",
  );
  object(8, "<< /Title (Three) /Parent 7 0 R /Dest [5 0 R /Fit] >>");
  object(9, "<< /Names [(three) [5 0 R /Fit] (two) [4 0 R /Fit]] >>");
  object(10, "<< /Fields [11 0 R] >>");
  object(
    11,
    "<< /Type /Annot /Subtype /Widget /FT /Tx /T (field) /Rect [0 0 10 10] /P 4 0 R >>",
  );
  object(12, "<< /Type /StructTreeRoot /K 13 0 R >>");
  object(13, "<< /Type /StructElem /S /P /P 12 0 R /Pg 4 0 R /K 0 >>");
  object(
    14,
    "<< /Type /Annot /Subtype /Link /Rect [0 0 10 10] /Dest [4 0 R /XYZ 0 0 0] >>",
  );
  var xrefOffset = Buffer.byteLength(pdf);
  pdf += "xref\n0 15\n0000000000 65535 f \n";
  for (var id = 1; id <= 14; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 15 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  var bytes = new Uint8Array(Buffer.from(pdf));
  writeOutput("deletePage-fixture-referenced-pages", bytes);
  return bytes;
}

/**
 * Collects the object IDs reachable from the trailer's catalog.
 * @param {object} muhammara - The Wasm module, for its type constants.
 * @param {PDFReader} reader - A PDF reader.
 * @returns {Set<number>} The reachable object IDs.
 */
function reachableObjectIDs(muhammara, reader) {
  var reachable = new Set();
  var pending = [reader.getTrailer().queryObject("Root")];
  while (pending.length) {
    var value = pending.pop();
    var type = value.getType();
    if (type === muhammara.ePDFObjectIndirectObjectReference) {
      var objectID = value.toPDFIndirectObjectReference().getObjectID();
      if (reachable.has(objectID)) continue;
      reachable.add(objectID);
      pending.push(reader.parseNewObject(objectID));
    } else if (type === muhammara.ePDFObjectArray) {
      pending.push(...value.toPDFArray().toJSArray());
    } else if (type === muhammara.ePDFObjectDictionary) {
      pending.push(...Object.values(value.toPDFDictionary().toJSObject()));
    } else if (type === muhammara.ePDFObjectStream) {
      pending.push(value.toPDFStream().getDictionary());
    }
  }
  return reachable;
}

describe("Recipe deletePage", function () {
  var Recipe;

  before(async function () {
    Recipe = await getRecipe();
  });

  it("deletes selected original pages from nested page trees", async function () {
    var source = createSource(Recipe);
    writeOutput("deletePage-selected-source", source);
    var recipe = new Recipe(source);
    var metadata = recipe.metadata;
    assert.equal(recipe.deletePage([11, 2, 4, 4]), recipe);
    assert.equal(recipe.deletePage(1), recipe);
    var bytes = recipe.endPDF();
    writeOutput("delete-pages", bytes);

    assert.deepEqual(
      await pageWidths(bytes),
      [103, 105, 106, 107, 108, 109, 110, 112],
    );
    assert.deepEqual(
      await pageRectangleSizes(bytes),
      [3, 5, 6, 7, 8, 9, 10, 12],
    );
    assert.equal(recipe.metadata.pages, 8);
    assert.equal(recipe.metadata, metadata);
    assert.equal(metadata.pages, 8);
    assert.equal(recipe.metadata[1].pageNumber, 1);
    assert.equal(recipe.metadata[8].pageNumber, 8);
    assert.equal(recipe.endPDF(), bytes);
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(bytes);
    try {
      for (var page = 0; page < reader.getPagesCount(); page += 1) {
        assert.equal(reader.parsePageDictionary(page).exists("Contents"), true);
      }
    } finally {
      reader.end();
    }
  });

  it("rejects invalid deletion requests", function () {
    assert.throws(() => new Recipe().deletePage(1), /existing PDF/);
    var source = createSource(Recipe);
    writeOutput("deletePage-invalid-requests-source", source);
    [0, -1, 1.5, "1", 13].forEach((pageNumber) => {
      assert.throws(
        () => new Recipe(source).deletePage(pageNumber),
        /pageNumber/,
      );
    });
    assert.throws(
      () =>
        new Recipe(source).deletePage(
          Array.from({ length: 12 }, (_, index) => index + 1),
        ),
      /At least one page/,
    );
    var singlePageSource = createSource(Recipe, 1);
    writeOutput(
      "deletePage-invalid-requests-single-page-source",
      singlePageSource,
    );
    assert.throws(
      () => new Recipe(singlePageSource).deletePage(1),
      /At least one page/,
    );
    assert.throws(
      () => new Recipe(source).deletePage(1).createPage(),
      /cannot be combined/,
    );
    var created = new Recipe(source).createPage();
    assert.throws(
      () => created.deletePage(1),
      /deletePage cannot be combined with createPage/,
    );
    created.dispose();

    Recipe.registerPdf("delete-conflict", source);
    var appended = new Recipe(source).appendPage("delete-conflict");
    assert.throws(
      () => appended.deletePage(1),
      /deletePage cannot be combined with appendPage/,
    );
    appended.dispose();

    var failedAppend = new Recipe(source);
    failedAppend.writer.appendPDFPagesFromPDF = () => {
      throw new Error("injected append failure");
    };
    assert.throws(
      () => failedAppend.appendPage("delete-conflict"),
      /injected append failure/,
    );
    // A failed appendPage() must not block deletePage(): the flag is only set
    // once the native append actually succeeds, matching native-core.
    assert.doesNotThrow(() => failedAppend.deletePage(1));
    failedAppend.dispose();

    var invalidRange = new Recipe(source);
    assert.throws(
      () => invalidRange.appendPage("delete-conflict", [[2]]),
      /one-based inclusive page numbers/,
    );
    assert.doesNotThrow(() => invalidRange.deletePage(1));
    invalidRange.dispose();

    var belowRange = new Recipe(source);
    assert.throws(
      () => belowRange.appendPage("delete-conflict", 0.5),
      /one-based inclusive page numbers/,
    );
    assert.doesNotThrow(() => belowRange.deletePage(1));
    belowRange.dispose();
    Recipe.unregisterPdf("delete-conflict");

    var disposed = new Recipe(source);
    disposed.dispose();
    assert.throws(() => disposed.deletePage(1), /after disposal/);
  });

  it("rejects page composition in either order", function () {
    var source = createSource(Recipe);
    writeOutput("deletePage-composition-source", source);
    Recipe.registerPdf("delete-composition", source);
    try {
      var appendThenDelete = new Recipe(source).appendPage(
        "delete-composition",
        1,
      );
      assert.throws(
        () => appendThenDelete.deletePage(1),
        /cannot be combined with appendPage/,
      );
      appendThenDelete.dispose();

      var deleteThenAppend = new Recipe(source).deletePage(1);
      assert.throws(
        () => deleteThenAppend.appendPage("delete-composition", 1),
        /cannot be combined with deletePage/,
      );
      deleteThenAppend.dispose();

      var insertThenDelete = new Recipe(source).insertPage(
        0,
        "delete-composition",
        1,
      );
      assert.throws(
        () => insertThenDelete.deletePage(1),
        /cannot be combined with insertPage/,
      );
      insertThenDelete.dispose();

      var deleteThenInsert = new Recipe(source).deletePage(1);
      assert.throws(
        () => deleteThenInsert.insertPage(0, "delete-composition", 1),
        /cannot be combined with deletePage/,
      );
      deleteThenInsert.dispose();
    } finally {
      Recipe.unregisterPdf("delete-composition");
    }
  });

  it("preserves retained page generations and remaps page labels", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = nestedNonzeroGenerationPdf();
    writeOutput("deletePage-generations-source", source);
    var generationBytes = new Recipe(source).deletePage(2).endPDF();
    writeOutput("deletePage-generations", generationBytes);
    var reader = muhammara.createReader(generationBytes);
    try {
      assert.equal(reader.getPagesCount(), 1);
      assert.equal(reader.getPageInfo(0).rotate, 90);
      var catalog = reader
        .queryDictionaryObject(reader.getTrailer(), "Root")
        .toPDFDictionary();
      assert.equal(
        catalog.toJSObject().Pages.toPDFIndirectObjectReference().getVersion(),
        0,
      );
      var nestedReference = reader
        .queryDictionaryObject(
          reader.parseNewObject(2).toPDFDictionary(),
          "Kids",
        )
        .toPDFArray()
        .toJSArray()[0]
        .toPDFIndirectObjectReference();
      assert.equal(nestedReference.getVersion(), 0);
      var retainedPageReference = reader
        .queryDictionaryObject(
          reader.parseNewObject(5).toPDFDictionary(),
          "Kids",
        )
        .toPDFArray()
        .toJSArray()[0]
        .toPDFIndirectObjectReference();
      assert.equal(retainedPageReference.getVersion(), 1);
    } finally {
      reader.end();
    }

    var source = nestedNonzeroGenerationPdf();
    writeOutput("deletePage-generations-labels-source", source);
    var labelBytes = new Recipe(source).deletePage(1).endPDF();
    writeOutput("deletePage-generations-labels", labelBytes);
    reader = muhammara.createReader(labelBytes);
    try {
      var labelCatalog = reader
        .queryDictionaryObject(reader.getTrailer(), "Root")
        .toPDFDictionary();
      var labels = reader
        .queryDictionaryObject(labelCatalog, "PageLabels")
        .toPDFDictionary();
      var numbers = reader.queryDictionaryObject(labels, "Nums").toPDFArray();
      assert.equal(numbers.toJSArray()[0].toNumber(), 0);
      assert.equal(
        reader
          .queryArrayObject(numbers, 1)
          .toPDFDictionary()
          .toJSObject()
          .P.toText(),
        "B-",
      );
    } finally {
      reader.end();
    }
  });

  it("preserves page-label range starts while renumbering", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = nestedNonzeroGenerationPdf({ pageLabels: "start" });
    writeOutput("deletePage-label-start-source", source);
    var bytes = new Recipe(source).deletePage(1).endPDF();
    writeOutput("deletePage-label-start", bytes);
    var reader = muhammara.createReader(bytes);
    try {
      var catalog = reader
        .queryDictionaryObject(reader.getTrailer(), "Root")
        .toPDFDictionary();
      var labels = reader
        .queryDictionaryObject(catalog, "PageLabels")
        .toPDFDictionary();
      var numbers = reader.queryDictionaryObject(labels, "Nums").toPDFArray();
      var label = reader
        .queryArrayObject(numbers, 1)
        .toPDFDictionary()
        .toJSObject();
      assert.equal(numbers.toJSArray()[0].toNumber(), 0);
      assert.equal(label.S.toPDFName().value, "D");
      assert.equal(label.St.toNumber(), 6);
    } finally {
      reader.end();
      muhammara.disposeAssets();
    }
  });

  it("flattens and remaps recursive page labels", async function () {
    var source = nestedNonzeroGenerationPdf({ pageLabels: "kids" });
    writeOutput("deletePage-label-kids-source", source);
    var recipe = new Recipe(source).deletePage(1);
    var muhammara = await createMuhammaraWasm();
    var bytes = recipe.endPDF();
    writeOutput("deletePage-label-kids", bytes);
    var reader = muhammara.createReader(bytes);
    try {
      var catalog = reader
        .queryDictionaryObject(reader.getTrailer(), "Root")
        .toPDFDictionary();
      var labels = reader
        .queryDictionaryObject(catalog, "PageLabels")
        .toPDFDictionary();
      var numbers = reader.queryDictionaryObject(labels, "Nums").toPDFArray();
      assert.equal(numbers.toJSArray()[0].toNumber(), 0);
      assert.equal(
        reader
          .queryArrayObject(numbers, 1)
          .toPDFDictionary()
          .toJSObject()
          .P.toText(),
        "B-",
      );
      assert.equal(labels.exists("Kids"), false);
    } finally {
      reader.end();
      recipe.dispose();
      muhammara.disposeAssets();
    }
  });

  it("preserves indirect page-label keys and values", async function () {
    var muhammara = await createMuhammaraWasm();
    for (var pageLabels of ["indirect-values", "chained-values"]) {
      var source = nestedNonzeroGenerationPdf({ pageLabels });
      writeOutput(`deletePage-label-${pageLabels}-source`, source);
      var recipe = new Recipe(source).deletePage(2);
      var bytes = recipe.endPDF();
      writeOutput(`deletePage-label-${pageLabels}`, bytes);
      var reader = muhammara.createReader(bytes);
      try {
        var catalog = reader
          .queryDictionaryObject(reader.getTrailer(), "Root")
          .toPDFDictionary();
        var numbers = reader
          .queryDictionaryObject(
            reader
              .queryDictionaryObject(catalog, "PageLabels")
              .toPDFDictionary(),
            "Nums",
          )
          .toPDFArray();
        var label = reader
          .queryArrayObject(numbers, 1)
          .toPDFDictionary()
          .toJSObject();
        assert.equal(numbers.toJSArray()[0].toNumber(), 0);
        assert.equal(label.S.toPDFName().value, "D");
        assert.equal(label.P.toText(), "A-");
        assert.equal(label.St.toNumber(), 5);
      } finally {
        reader.end();
        recipe.dispose();
      }
    }
    muhammara.disposeAssets();
  });

  it("does not rewrite untouched nonzero-generation page-tree branches", async function () {
    var source = nestedNonzeroGenerationPdf({ nonzeroSibling: true });
    writeOutput("deletePage-untouched-branch-source", source);
    var recipe = new Recipe(source).deletePage(2);
    try {
      var bytes = recipe.endPDF();
      writeOutput("deletePage-untouched-branch", bytes);
      assert.deepEqual(await pageWidths(bytes), [101, 103]);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects page trees that require nonzero-generation rewrites", async function () {
    var source = nestedNonzeroGenerationPdf({ nonzeroGeneration: true });
    writeOutput("deletePage-nonzero-generation-source", source);
    var recipe = new Recipe(source);
    try {
      assert.throws(() => recipe.deletePage(2), /nonzero-generation objects/);
      // A rejected deletion is not queued, so the Recipe still ends.
      var bytes = recipe.endPDF();
      writeOutput("deletePage-rejected-nonzero-tree", bytes);
      assert.deepEqual(await pageWidths(bytes), [101, 102]);
    } finally {
      recipe.dispose();
    }
  });

  it("accepts direct page labels with a nonzero-generation catalog", async function () {
    // PageLabels are attached when the catalog is written, never by
    // rewriting the catalog object in place, so its generation never matters.
    var source = nestedNonzeroGenerationPdf({
      catalogGeneration: true,
      pageLabels: "direct",
    });
    writeOutput("deletePage-direct-labels-nonzero-catalog-source", source);
    var recipe = new Recipe(source).deletePage(2);
    try {
      var bytes = recipe.endPDF();
      writeOutput("deletePage-direct-labels-nonzero-catalog", bytes);
      assert.deepEqual(await pageWidths(bytes), [101]);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects edited retained pages with nonzero generations", function () {
    var source = nestedNonzeroGenerationPdf();
    writeOutput("deletePage-edited-retained-nonzero-source", source);
    var recipe = new Recipe(source).editPage(1).endPage();
    // Editing after the deletion is queued is caught when the PDF ends.
    var editedLater = new Recipe(source).deletePage(2).editPage(1).endPage();
    try {
      assert.throws(() => recipe.deletePage(2), /nonzero-generation objects/);
      assert.throws(() => editedLater.endPDF(), /nonzero-generation objects/);
      assert.throws(() => editedLater.endPDF(), /nonzero-generation objects/);
    } finally {
      recipe.dispose();
      editedLater.dispose();
    }
  });

  it("allows deleting an edited page with a nonzero generation", async function () {
    // The edited page is dropped entirely, not rewritten, so its own
    // generation must not block the deletion.
    var source = nestedNonzeroGenerationPdf();
    writeOutput("deletePage-edited-deleted-nonzero-source", source);
    var recipe = new Recipe(source).editPage(1).endPage().deletePage(1);
    try {
      var bytes = recipe.endPDF();
      writeOutput("deletePage-edited-deleted-nonzero", bytes);
      assert.deepEqual(await pageWidths(bytes), [102]);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects replaced text on nonzero-generation pages", function () {
    var source = nonzeroGenerationTextPdf();
    writeOutput("deletePage-replaced-text-nonzero-source", source);
    var recipe = new Recipe(source).replaceText("Before", "After", 1);
    try {
      assert.throws(() => recipe.deletePage(2), /nonzero-generation objects/);
    } finally {
      recipe.dispose();
    }
  });

  it("deletes one occurrence of a duplicated page reference", async function () {
    var source = nestedNonzeroGenerationPdf({ duplicatePageReference: true });
    writeOutput("deletePage-duplicate-reference-source", source);
    var recipe = new Recipe(source).deletePage(1);
    var bytes = recipe.endPDF();
    writeOutput("deletePage-duplicate-reference", bytes);
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(bytes);
    try {
      assert.equal(reader.getPagesCount(), 1);
      assert.equal(reader.getPageObjectID(0), 3);
    } finally {
      reader.end();
      recipe.dispose();
      muhammara.disposeAssets();
    }
  });

  it("remaps direct page labels and accepts null page labels", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = nestedNonzeroGenerationPdf({ pageLabels: "direct" });
    writeOutput("deletePage-direct-labels-source", source);
    var directBytes = new Recipe(source).deletePage(1).endPDF();
    writeOutput("deletePage-direct-labels", directBytes);
    var reader = muhammara.createReader(directBytes);
    try {
      var catalog = reader
        .queryDictionaryObject(reader.getTrailer(), "Root")
        .toPDFDictionary();
      var numbers = reader
        .queryDictionaryObject(
          reader.queryDictionaryObject(catalog, "PageLabels").toPDFDictionary(),
          "Nums",
        )
        .toPDFArray();
      assert.equal(numbers.toJSArray()[0].toNumber(), 0);
      assert.equal(
        reader
          .queryArrayObject(numbers, 1)
          .toPDFDictionary()
          .toJSObject()
          .P.toText(),
        "B-",
      );
    } finally {
      reader.end();
    }

    var source = nestedNonzeroGenerationPdf({ pageLabels: "null" });
    writeOutput("deletePage-null-labels-source", source);
    var nullBytes = new Recipe(source).deletePage(1).endPDF();
    writeOutput("deletePage-null-labels", nullBytes);
    assert.deepEqual(await pageWidths(nullBytes), [102]);
    var source = nestedNonzeroGenerationPdf({ pageLabels: "chained-null" });
    writeOutput("deletePage-chained-null-labels-source", source);
    var chainedNullBytes = new Recipe(source).deletePage(1).endPDF();
    writeOutput("deletePage-chained-null-labels", chainedNullBytes);
    assert.deepEqual(await pageWidths(chainedNullBytes), [102]);
    muhammara.disposeAssets();
  });

  it("preserves Unicode page-label bytes and string forms", async function () {
    var muhammara = await createMuhammaraWasm();
    for (var [pageLabels, stringCast] of [
      ["unicode-literal", "toPDFLiteralString"],
      ["unicode-hex", "toPDFHexString"],
    ]) {
      var source = nestedNonzeroGenerationPdf({ pageLabels });
      writeOutput(`deletePage-unicode-${pageLabels}-source`, source);
      var bytes = new Recipe(source).deletePage(1).endPDF();
      writeOutput(`deletePage-unicode-${pageLabels}`, bytes);
      var reader = muhammara.createReader(bytes);
      try {
        var catalog = reader
          .queryDictionaryObject(reader.getTrailer(), "Root")
          .toPDFDictionary();
        var numbers = reader
          .queryDictionaryObject(
            reader
              .queryDictionaryObject(catalog, "PageLabels")
              .toPDFDictionary(),
            "Nums",
          )
          .toPDFArray();
        assert.equal(numbers.toJSArray()[0].toNumber(), 0);
        var prefix = reader
          .queryArrayObject(numbers, 1)
          .toPDFDictionary()
          .toJSObject()
          .P[stringCast]();
        assert.equal(prefix.toText(), "B-");
        assert.deepEqual(
          Array.from(prefix.toBytesArray()),
          [254, 255, 0, 66, 0, 45],
        );
      } finally {
        reader.end();
      }
    }
    muhammara.disposeAssets();
  });

  it("rejects deletion after finalization", function () {
    var source = createSource(Recipe);
    writeOutput("deletePage-after-finalization-source", source);
    var recipe = new Recipe(source);
    writeOutput("deletePage-after-finalization", recipe.deletePage(1).endPDF());
    assert.throws(() => recipe.deletePage(2), /after endPDF/);
    recipe.dispose();
  });

  it("rejects cyclic page labels", async function () {
    var recipe = new Recipe(
      nestedNonzeroGenerationPdf({ pageLabels: "cycle" }),
    );
    try {
      assert.throws(() => recipe.deletePage(1), /acyclic PageLabels/);
      var bytes = recipe.endPDF();
      writeOutput("deletePage-rejected-cyclic-labels", bytes);
      assert.deepEqual(await pageWidths(bytes), [101, 102]);
    } finally {
      recipe.dispose();
    }
  });

  it("disposes the writer when a queued deletion fails at endPDF", function () {
    var recipe = new Recipe(nestedNonzeroGenerationPdf())
      .deletePage(2)
      .editPage(1)
      .endPage();
    var writerDisposed = false;
    var disposeWriter = recipe.writer.dispose.bind(recipe.writer);
    recipe.writer.dispose = () => {
      writerDisposed = true;
      disposeWriter();
    };
    try {
      var endError;
      assert.throws(() => {
        try {
          recipe.endPDF();
        } catch (error) {
          endError = error;
          throw error;
        }
      }, /nonzero-generation objects/);
      assert.equal(writerDisposed, true);
      assert.equal(recipe.metadata.pages, 2);
      assert.deepEqual(Array.from(recipe._deletedPages), [2]);
      assert.throws(
        () => recipe.endPDF(),
        (error) => error === endError,
      );
      assert.throws(() => recipe.deletePage(2), /after endPDF/);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects references from retained structures to deleted pages", async function () {
    var source = nestedNonzeroGenerationPdf({ openAction: true });
    writeOutput("deletePage-open-action-source", source);
    var recipe = new Recipe(source);
    try {
      assert.throws(
        () => recipe.deletePage(1),
        /referenced by retained document structures/,
      );
      // The rejected deletion leaves the Recipe usable.
      var bytes = recipe.endPDF();
      writeOutput("deletePage-rejected-open-action", bytes);
      assert.deepEqual(await pageWidths(bytes), [101, 102]);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects references from retained page-tree metadata", function () {
    var source = nestedNonzeroGenerationPdf({ pageTreeReference: true });
    writeOutput("deletePage-page-tree-reference-source", source);
    var recipe = new Recipe(source);
    try {
      assert.throws(
        () => recipe.deletePage(2),
        /referenced by retained document structures/,
      );
      assert.throws(
        () => recipe.deletePage(2, { pruneReferences: true }),
        /cannot prune references held by the page tree/,
      );
    } finally {
      recipe.dispose();
    }
  });

  it("rejects a page referenced by outlines, links, forms and structure", async function () {
    var recipe = new Recipe(referencedPagesPdf());
    try {
      assert.throws(
        () => recipe.deletePage(2),
        /referenced by retained document structures/,
      );
      var bytes = recipe.endPDF();
      writeOutput("deletePage-rejected-referenced-page", bytes);
      assert.deepEqual(await pageWidths(bytes), [101, 102, 103]);
    } finally {
      recipe.dispose();
    }
  });

  it("prunes references to deleted pages with pruneReferences", async function () {
    var recipe = new Recipe(referencedPagesPdf()).deletePage(2, {
      pruneReferences: true,
    });
    var muhammara = await createMuhammaraWasm();
    var reader;
    try {
      var bytes = recipe.endPDF();
      writeOutput("deletePage-prune-references", bytes);
      assert.deepEqual(await pageWidths(bytes), [101, 103]);
      reader = muhammara.createReader(bytes);
      var object = (id) =>
        reader.parseNewObject(id).toPDFDictionary().toJSObject();
      // Nothing retained reaches the deleted page any more.
      assert.equal(reachableObjectIDs(muhammara, reader).has(4), false);

      var catalog = reader
        .queryDictionaryObject(reader.getTrailer(), "Root")
        .toPDFDictionary()
        .toJSObject();
      assert.equal(catalog.OpenAction.getType(), muhammara.ePDFObjectNull);
      // The outline item keeps its title and child, without a target.
      assert.equal(object(7).Title.value, "Two");
      assert.equal("Dest" in object(7), false);
      assert.equal("First" in object(7), true);
      assert.equal("Dest" in object(8), true);
      var names = object(9).Names.toJSArray();
      assert.equal(names[1].toJSArray().length, 2);
      assert.equal(names[3].getType(), muhammara.ePDFObjectNull);
      assert.equal("P" in object(11), false);
      assert.equal(object(11).T.value, "field");
      assert.equal("Pg" in object(13), false);
      assert.equal("Dest" in object(14), false);
      // The changed direct annotation and its action become indirect objects.
      var resolve = (value) =>
        value.getType() === muhammara.ePDFObjectIndirectObjectReference
          ? reader.parseNewObject(
              value.toPDFIndirectObjectReference().getObjectID(),
            )
          : value;
      var annotation = resolve(
        reader.parsePage(1).getDictionary().toJSObject().Annots.toJSArray()[0],
      )
        .toPDFDictionary()
        .toJSObject();
      assert.equal(annotation.Subtype.value, "Link");
      assert.deepEqual(
        Object.keys(resolve(annotation.A).toPDFDictionary().toJSObject()),
        ["S"],
      );
    } finally {
      reader?.end();
      recipe.dispose();
      muhammara.disposeAssets();
    }
  });

  it("keeps pruning enabled for every queued deletion", async function () {
    var recipe = new Recipe(referencedPagesPdf())
      .deletePage(3, { pruneReferences: true })
      .deletePage(2);
    try {
      var bytes = recipe.endPDF();
      writeOutput("deletePage-prune-queued", bytes);
      assert.deepEqual(await pageWidths(bytes), [101]);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects pruning a reference held by an edited page", function () {
    var edited = new Recipe(referencedPagesPdf()).editPage(3).endPage();
    var editedLater = new Recipe(referencedPagesPdf())
      .deletePage(2, { pruneReferences: true })
      .editPage(3)
      .endPage();
    try {
      assert.throws(
        () => edited.deletePage(2, { pruneReferences: true }),
        /held by a page edited in this Recipe/,
      );
      assert.throws(
        () => editedLater.endPDF(),
        /held by a page edited in this Recipe/,
      );
    } finally {
      edited.dispose();
      editedLater.dispose();
    }
  });

  it("validates deletePage options", function () {
    var recipe = new Recipe(referencedPagesPdf());
    try {
      [null, true, "prune", []].forEach((options) =>
        assert.throws(() => recipe.deletePage(3, options), {
          name: "TypeError",
          message: "deletePage expects an options object",
        }),
      );
      assert.throws(() => recipe.deletePage(3, { pruneReferences: "yes" }), {
        name: "TypeError",
        message: "deletePage pruneReferences must be a boolean",
      });
    } finally {
      recipe.dispose();
    }
  });

  it("rejects page-tree children with an incorrect parent", function () {
    var recipe = new Recipe(
      nestedNonzeroGenerationPdf({ invalidParent: true }),
    );
    try {
      assert.throws(() => recipe.deletePage(1), /valid page tree/);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects a root page tree with a parent", function () {
    var recipe = new Recipe(nestedNonzeroGenerationPdf({ rootParent: true }));
    try {
      assert.throws(() => recipe.deletePage(1), /valid page tree/);
    } finally {
      recipe.dispose();
    }
  });

  it("ignores discarded page-label fields that reference deleted pages", async function () {
    var source = nestedNonzeroGenerationPdf({ pageLabelReference: true });
    writeOutput("deletePage-discarded-label-reference-source", source);
    var recipe = new Recipe(source).deletePage(1);
    try {
      var bytes = recipe.endPDF();
      writeOutput("deletePage-discarded-label-reference", bytes);
      assert.deepEqual(await pageWidths(bytes), [102]);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects active pages before deletion finalization", function () {
    var source = createSource(Recipe);
    writeOutput("deletePage-active-page-source", source);
    var recipe = new Recipe(source).editPage(1).deletePage(2);
    var writerDisposed = false;
    var disposeWriter = recipe.writer.dispose.bind(recipe.writer);
    recipe.writer.dispose = () => {
      writerDisposed = true;
      disposeWriter();
    };
    try {
      assert.throws(() => recipe.endPDF(), /Finish the current page/);
      assert.equal(writerDisposed, false);
      recipe.endPage();
      var bytes = recipe.endPDF();
      writeOutput("deletePage-active-page", bytes);
      assert.ok(bytes instanceof Uint8Array);
    } finally {
      recipe.dispose();
    }
  });

  it("disposes the modifier when later finalization fails", function () {
    var source = nestedNonzeroGenerationPdf();
    writeOutput("deletePage-modifier-dispose-source", source);
    var recipe = new Recipe(source).deletePage(1);
    var metadata = recipe.metadata;
    var writerDisposed = false;
    var disposeWriter = recipe.writer.dispose.bind(recipe.writer);
    recipe.writer.dispose = () => {
      writerDisposed = true;
      disposeWriter();
    };
    recipe._writeCanonicalInfo = () => {
      throw new Error("injected info failure");
    };
    try {
      var endError;
      assert.throws(() => {
        try {
          recipe.endPDF();
        } catch (error) {
          endError = error;
          throw error;
        }
      }, /injected info failure/);
      assert.equal(writerDisposed, true);
      assert.equal(recipe.metadata, metadata);
      assert.equal(metadata.pages, 2);
      assert.deepEqual(Array.from(recipe._deletedPages), [1]);
      assert.throws(
        () => recipe.endPDF(),
        (error) => error === endError,
      );
      assert.throws(() => recipe.deletePage(2), /after endPDF/);
    } finally {
      recipe.dispose();
    }
  });

  it("keeps queued annotations on their retained page", async function () {
    var source = createSource(Recipe);
    writeOutput("deletePage-retained-annotations-source", source);
    var bytes = new Recipe(source)
      .editPage(2)
      .comment("Retained", 10, 10)
      .endPage()
      .deletePage(1)
      .endPDF();
    writeOutput("deletePage-retained-annotations", bytes);
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(bytes);
    try {
      assert.equal(reader.parsePageDictionary(0).exists("Annots"), true);
      assert.equal(reader.parsePageDictionary(1).exists("Annots"), false);
    } finally {
      reader.end();
    }
  });

  it("preserves existing annotation generations on retained pages", async function () {
    var source = nestedNonzeroGenerationPdf({ annotation: true });
    writeOutput("deletePage-annotation-generations-source", source);
    var recipe = new Recipe(source)
      .editPage(2)
      .comment("New", 10, 10)
      .endPage()
      .deletePage(1);
    var bytes = recipe.endPDF();
    writeOutput("deletePage-annotation-generations", bytes);
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(bytes);
    try {
      var annotations = reader
        .queryDictionaryObject(reader.parsePageDictionary(0), "Annots")
        .toPDFArray()
        .toJSArray();
      assert.equal(annotations.length, 2);
      assert.equal(
        annotations[0].toPDFIndirectObjectReference().getVersion(),
        1,
      );
    } finally {
      reader.end();
      recipe.dispose();
      muhammara.disposeAssets();
    }
  });
});
