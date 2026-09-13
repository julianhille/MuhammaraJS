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

function nestedNonzeroGenerationPdf(options = {}) {
  var pageLabels = options.pageLabels || "indirect";
  var pageTreeGeneration = options.nonzeroGeneration ? 1 : 0;
  var catalogPageLabels = {
    direct: "/PageLabels << /Nums [0 << /P (A-) >> 1 << /P (B-) >>] >>",
    indirect: "/PageLabels 4 0 R",
    "unicode-hex": "/PageLabels 4 0 R",
    "unicode-literal": "/PageLabels 4 0 R",
    cycle: "/PageLabels 4 0 R",
    null: "/PageLabels null",
  }[pageLabels];
  var pdf = "%PDF-1.4\n";
  var offsets = {};
  function object(id, generation, body) {
    offsets[id] = [Buffer.byteLength(pdf), generation];
    pdf += `${id} ${generation} obj\n${body}\nendobj\n`;
  }
  object(
    1,
    0,
    `<< /Type /Catalog /Pages 2 ${pageTreeGeneration} R ${catalogPageLabels}${
      options.openAction ? " /OpenAction [3 1 R /Fit]" : ""
    } >>`,
  );
  object(
    2,
    pageTreeGeneration,
    `<< /Type /Pages /Kids [5 ${pageTreeGeneration} R 6 0 R] /Count 2 >>`,
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
      : pageLabels === "unicode-hex"
        ? "<< /Nums [0 << /P <FEFF0041002D> >> 1 << /P <FEFF0042002D> >>] >>"
        : pageLabels === "unicode-literal"
          ? "<< /Nums [0 << /P (\\376\\377\\000\\101\\000\\055) >> 1 << /P (\\376\\377\\000\\102\\000\\055) >>] >>"
          : "<< /Nums [0 << /P (A-) >> 1 << /P (B-) >>] >>",
  );
  object(
    5,
    pageTreeGeneration,
    `<< /Type /Pages /Parent 2 ${pageTreeGeneration} R /Kids [3 1 R] /Count 1 /Rotate 90 /Resources << /ProcSet [/PDF] >> >>`,
  );
  object(
    6,
    0,
    `<< /Type /Page /Parent 2 ${pageTreeGeneration} R /MediaBox [0 0 102 200] >>`,
  );
  var xrefOffset = Buffer.byteLength(pdf);
  pdf += "xref\n0 7\n0000000000 65535 f \n";
  for (var id = 1; id <= 6; id += 1) {
    pdf += offsets[id]
      ? `${String(offsets[id][0]).padStart(10, "0")} ${String(
          offsets[id][1],
        ).padStart(5, "0")} n \n`
      : "0000000000 65535 f \n";
  }
  pdf += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf));
}

describe("Recipe deletePage", function () {
  var Recipe;

  before(async function () {
    Recipe = await getRecipe();
  });

  it("deletes selected original pages from nested page trees", async function () {
    var recipe = new Recipe(createSource(Recipe));
    assert.equal(recipe.deletePage([11, 2, 4, 4]), recipe);
    assert.equal(recipe.deletePage(1), recipe);
    var bytes = recipe.endPDF();

    assert.deepEqual(
      await pageWidths(bytes),
      [103, 105, 106, 107, 108, 109, 110, 112],
    );
    assert.equal(recipe.metadata.pages, 8);
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
    assert.throws(
      () => new Recipe(source).createPage().deletePage(1),
      /cannot be combined/,
    );
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

  it("disposes the modifier when later finalization fails", function () {
    var recipe = new Recipe(nestedNonzeroGenerationPdf()).deletePage(1);
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
});
