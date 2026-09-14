import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";

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
  var content = "BT\n(Before) Tj\nET\n";
  object(1, 0, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, 0, "<< /Type /Pages /Kids [3 1 R 4 0 R] /Count 2 >>");
  object(
    3,
    1,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 5 0 R >>",
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

describe("Recipe deletePage", function () {
  var Recipe;

  before(async function () {
    Recipe = await getRecipe();
  });

  it("deletes selected original pages from nested page trees", async function () {
    var recipe = new Recipe(createSource(Recipe));
    var metadata = recipe.metadata;
    assert.equal(recipe.deletePage([11, 2, 4, 4]), recipe);
    assert.equal(recipe.deletePage(1), recipe);
    var bytes = recipe.endPDF();

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
    assert.throws(
      () => new Recipe(createSource(Recipe, 1)).deletePage(1),
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
    var generationBytes = new Recipe(nestedNonzeroGenerationPdf())
      .deletePage(2)
      .endPDF();
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

    var labelBytes = new Recipe(nestedNonzeroGenerationPdf())
      .deletePage(1)
      .endPDF();
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
    var bytes = new Recipe(nestedNonzeroGenerationPdf({ pageLabels: "start" }))
      .deletePage(1)
      .endPDF();
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
    var recipe = new Recipe(
      nestedNonzeroGenerationPdf({ pageLabels: "kids" }),
    ).deletePage(1);
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(recipe.endPDF());
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
      var recipe = new Recipe(
        nestedNonzeroGenerationPdf({ pageLabels }),
      ).deletePage(2);
      var reader = muhammara.createReader(recipe.endPDF());
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
    var recipe = new Recipe(
      nestedNonzeroGenerationPdf({ nonzeroSibling: true }),
    ).deletePage(2);
    try {
      assert.deepEqual(await pageWidths(recipe.endPDF()), [101, 103]);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects page trees that require nonzero-generation rewrites", function () {
    var recipe = new Recipe(
      nestedNonzeroGenerationPdf({ nonzeroGeneration: true }),
    ).deletePage(2);
    try {
      assert.throws(() => recipe.endPDF(), /nonzero-generation objects/);
      assert.throws(() => recipe.endPDF(), /nonzero-generation objects/);
    } finally {
      recipe.dispose();
    }
  });

  it("accepts direct page labels with a nonzero-generation catalog", async function () {
    // Unlike native-core, wasm's writer always attaches PageLabels through
    // _setPageLabelsObject() rather than rewriting the catalog object in
    // place, so the catalog's own generation never matters here.
    var recipe = new Recipe(
      nestedNonzeroGenerationPdf({
        catalogGeneration: true,
        pageLabels: "direct",
      }),
    ).deletePage(2);
    try {
      assert.deepEqual(await pageWidths(recipe.endPDF()), [101]);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects edited retained pages with nonzero generations", function () {
    var recipe = new Recipe(nestedNonzeroGenerationPdf())
      .editPage(1)
      .endPage()
      .deletePage(2);
    try {
      assert.throws(() => recipe.endPDF(), /nonzero-generation objects/);
      assert.throws(() => recipe.endPDF(), /nonzero-generation objects/);
    } finally {
      recipe.dispose();
    }
  });

  it("allows deleting an edited page with a nonzero generation", async function () {
    // The edited page is dropped entirely, not rewritten, so its own
    // generation must not block the deletion.
    var recipe = new Recipe(nestedNonzeroGenerationPdf())
      .editPage(1)
      .endPage()
      .deletePage(1);
    try {
      assert.deepEqual(await pageWidths(recipe.endPDF()), [102]);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects replaced text on nonzero-generation pages", function () {
    var recipe = new Recipe(nonzeroGenerationTextPdf())
      .replaceText("Before", "After", 1)
      .deletePage(2);
    try {
      assert.throws(() => recipe.endPDF(), /nonzero-generation objects/);
      assert.throws(() => recipe.endPDF(), /nonzero-generation objects/);
    } finally {
      recipe.dispose();
    }
  });

  it("deletes one occurrence of a duplicated page reference", async function () {
    var recipe = new Recipe(
      nestedNonzeroGenerationPdf({ duplicatePageReference: true }),
    ).deletePage(1);
    var bytes = recipe.endPDF();
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
    var directBytes = new Recipe(
      nestedNonzeroGenerationPdf({ pageLabels: "direct" }),
    )
      .deletePage(1)
      .endPDF();
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

    var nullBytes = new Recipe(
      nestedNonzeroGenerationPdf({ pageLabels: "null" }),
    )
      .deletePage(1)
      .endPDF();
    assert.deepEqual(await pageWidths(nullBytes), [102]);
    var chainedNullBytes = new Recipe(
      nestedNonzeroGenerationPdf({ pageLabels: "chained-null" }),
    )
      .deletePage(1)
      .endPDF();
    assert.deepEqual(await pageWidths(chainedNullBytes), [102]);
    muhammara.disposeAssets();
  });

  it("preserves Unicode page-label bytes and string forms", async function () {
    var muhammara = await createMuhammaraWasm();
    for (var [pageLabels, stringCast] of [
      ["unicode-literal", "toPDFLiteralString"],
      ["unicode-hex", "toPDFHexString"],
    ]) {
      var bytes = new Recipe(nestedNonzeroGenerationPdf({ pageLabels }))
        .deletePage(1)
        .endPDF();
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
    var recipe = new Recipe(createSource(Recipe));
    recipe.deletePage(1).endPDF();
    assert.throws(() => recipe.deletePage(2), /after endPDF/);
    recipe.dispose();
  });

  it("rejects cyclic page labels", function () {
    var recipe = new Recipe(
      nestedNonzeroGenerationPdf({ pageLabels: "cycle" }),
    ).deletePage(1);
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
      }, /acyclic PageLabels/);
      assert.equal(writerDisposed, true);
      assert.equal(recipe.metadata.pages, 2);
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

  it("rejects references from retained structures to deleted pages", function () {
    var recipe = new Recipe(
      nestedNonzeroGenerationPdf({ openAction: true }),
    ).deletePage(1);
    try {
      assert.throws(
        () => recipe.endPDF(),
        /referenced by retained document structures/,
      );
      assert.throws(
        () => recipe.endPDF(),
        /referenced by retained document structures/,
      );
    } finally {
      recipe.dispose();
    }
  });

  it("rejects references from retained page-tree metadata", function () {
    var recipe = new Recipe(
      nestedNonzeroGenerationPdf({ pageTreeReference: true }),
    ).deletePage(2);
    try {
      assert.throws(
        () => recipe.endPDF(),
        /referenced by retained document structures/,
      );
      assert.throws(
        () => recipe.endPDF(),
        /referenced by retained document structures/,
      );
    } finally {
      recipe.dispose();
    }
  });

  it("rejects page-tree children with an incorrect parent", function () {
    var recipe = new Recipe(
      nestedNonzeroGenerationPdf({ invalidParent: true }),
    ).deletePage(1);
    try {
      assert.throws(() => recipe.endPDF(), /valid page tree/);
      assert.throws(() => recipe.endPDF(), /valid page tree/);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects a root page tree with a parent", function () {
    var recipe = new Recipe(
      nestedNonzeroGenerationPdf({ rootParent: true }),
    ).deletePage(1);
    try {
      assert.throws(() => recipe.endPDF(), /valid page tree/);
      assert.throws(() => recipe.endPDF(), /valid page tree/);
    } finally {
      recipe.dispose();
    }
  });

  it("ignores discarded page-label fields that reference deleted pages", async function () {
    var recipe = new Recipe(
      nestedNonzeroGenerationPdf({ pageLabelReference: true }),
    ).deletePage(1);
    try {
      assert.deepEqual(await pageWidths(recipe.endPDF()), [102]);
    } finally {
      recipe.dispose();
    }
  });

  it("rejects active pages before deletion finalization", function () {
    var recipe = new Recipe(createSource(Recipe)).editPage(1).deletePage(2);
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
      assert.ok(recipe.endPDF() instanceof Uint8Array);
    } finally {
      recipe.dispose();
    }
  });

  it("disposes the modifier when later finalization fails", function () {
    var recipe = new Recipe(nestedNonzeroGenerationPdf()).deletePage(1);
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
    var bytes = new Recipe(createSource(Recipe))
      .editPage(2)
      .comment("Retained", 10, 10)
      .endPage()
      .deletePage(1)
      .endPDF();
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
    var recipe = new Recipe(nestedNonzeroGenerationPdf({ annotation: true }))
      .editPage(2)
      .comment("New", 10, 10)
      .endPage()
      .deletePage(1);
    var bytes = recipe.endPDF();
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
