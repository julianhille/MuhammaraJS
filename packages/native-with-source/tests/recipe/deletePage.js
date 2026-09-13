const assert = require("chai").assert;
const fs = require("fs");
const path = require("path");
const muhammara = require("@muhammara/native-with-source");
const Recipe = muhammara.Recipe;

function createSource(output, pages = 12) {
  const recipe = new Recipe("new", output);
  for (let page = 1; page <= pages; page += 1) {
    recipe
      .createPage(100 + page, 200 + page)
      .rectangle(10, 10, page, page, { fill: "#000000" })
      .endPage();
  }
  recipe.endPDF();
}

function pageWidths(source) {
  const reader = muhammara.createReader(
    source instanceof Buffer
      ? new muhammara.PDFRStreamForBuffer(source)
      : source,
  );
  try {
    return Array.from(
      { length: reader.getPagesCount() },
      (_, index) => reader.parsePage(index).getMediaBox()[2],
    );
  } finally {
    reader.end();
  }
}

function nestedNonzeroGenerationPdf(options = {}) {
  const pageLabels = options.pageLabels || "indirect";
  const pageTreeGeneration = options.nonzeroGeneration ? 1 : 0;
  const catalogPageLabels = {
    direct: "/PageLabels << /Nums [0 << /P (A-) >> 1 << /P (B-) >>] >>",
    indirect: "/PageLabels 4 0 R",
    "unicode-hex": "/PageLabels 4 0 R",
    "unicode-literal": "/PageLabels 4 0 R",
    cycle: "/PageLabels 4 0 R",
    null: "/PageLabels null",
  }[pageLabels];
  let pdf = "%PDF-1.4\n";
  const offsets = {};
  const object = (id, generation, body) => {
    offsets[id] = [Buffer.byteLength(pdf), generation];
    pdf += `${id} ${generation} obj\n${body}\nendobj\n`;
  };
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
    `<< /Type /Page /Parent 2 ${pageTreeGeneration} R /MediaBox [0 0 102 200]${
      options.annotation ? " /Annots [7 1 R]" : ""
    } >>`,
  );
  if (options.annotation) {
    object(7, 1, "<< /Type /Annot /Subtype /Text /Rect [1 1 10 10] >>");
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += "xref\n0 8\n0000000000 65535 f \n";
  for (let id = 1; id <= 7; id += 1) {
    pdf += offsets[id]
      ? `${String(offsets[id][0]).padStart(10, "0")} ${String(
          offsets[id][1],
        ).padStart(5, "0")} n \n`
      : "0000000000 65535 f \n";
  }
  pdf += `trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

describe("Recipe deletePage", () => {
  const source = path.join(__dirname, "../output/delete-pages-source.pdf");

  beforeEach(() => createSource(source));

  it("deletes selected original pages from nested page trees", () => {
    const output = path.join(__dirname, "../output/delete-pages.pdf");
    const recipe = new Recipe(source, output);
    assert.equal(recipe.deletePage([11, 2, 4, 4]), recipe);
    assert.equal(recipe.deletePage(1), recipe);
    recipe.endPDF();

    assert.deepEqual(
      pageWidths(output),
      [103, 105, 106, 107, 108, 109, 110, 112],
    );
    assert.equal(recipe.metadata.pages, 8);
    assert.equal(recipe.metadata[1].pageNumber, 1);
    assert.equal(recipe.metadata[8].pageNumber, 8);
    const reader = muhammara.createReader(output);
    try {
      for (let page = 0; page < reader.getPagesCount(); page += 1) {
        assert.isTrue(
          reader.parsePage(page).getDictionary().exists("Contents"),
        );
      }
    } finally {
      reader.end();
    }
  });

  it("supports Buffer sources", () => {
    const recipe = new Recipe(fs.readFileSync(source)).deletePage([1, 12]);
    recipe.endPDF((bytes) => {
      assert.deepEqual(
        pageWidths(bytes),
        [102, 103, 104, 105, 106, 107, 108, 109, 110, 111],
      );
    });
  });

  it("preserves retained page generations and remaps page labels", () => {
    const sourceBytes = nestedNonzeroGenerationPdf();
    new Recipe(sourceBytes).deletePage(2).endPDF((bytes) => {
      const reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(bytes),
      );
      try {
        assert.equal(reader.getPagesCount(), 1);
        assert.equal(reader.parsePage(0).getRotate(), 90);
        const catalog = reader
          .queryDictionaryObject(reader.getTrailer(), "Root")
          .toPDFDictionary();
        const pagesReference = catalog
          .toJSObject()
          .Pages.toPDFIndirectObjectReference();
        assert.equal(pagesReference.getVersion(), 0);
        const nestedReference = reader
          .queryDictionaryObject(
            reader.parseNewObject(2).toPDFDictionary(),
            "Kids",
          )
          .toPDFArray()
          .toJSArray()[0]
          .toPDFIndirectObjectReference();
        assert.equal(nestedReference.getVersion(), 0);
        const retainedPageReference = reader
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
    });

    new Recipe(sourceBytes).deletePage(1).endPDF((bytes) => {
      const reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(bytes),
      );
      try {
        const catalog = reader
          .queryDictionaryObject(reader.getTrailer(), "Root")
          .toPDFDictionary();
        const labels = reader
          .queryDictionaryObject(catalog, "PageLabels")
          .toPDFDictionary();
        const numbers = reader
          .queryDictionaryObject(labels, "Nums")
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
    });
  });

  it("rejects page trees that require nonzero-generation rewrites", () => {
    const recipe = new Recipe(
      nestedNonzeroGenerationPdf({ nonzeroGeneration: true }),
    ).deletePage(2);

    assert.throws(() => recipe.endPDF(), /nonzero-generation objects/);
    assert.throws(() => recipe.endPDF(), /nonzero-generation objects/);
  });

  it("remaps direct page labels and accepts null page labels", () => {
    new Recipe(nestedNonzeroGenerationPdf({ pageLabels: "direct" }))
      .deletePage(1)
      .endPDF((bytes) => {
        const reader = muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(bytes),
        );
        try {
          const catalog = reader
            .queryDictionaryObject(reader.getTrailer(), "Root")
            .toPDFDictionary();
          const numbers = reader
            .queryDictionaryObject(
              reader
                .queryDictionaryObject(catalog, "PageLabels")
                .toPDFDictionary(),
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
      });

    new Recipe(nestedNonzeroGenerationPdf({ pageLabels: "null" }))
      .deletePage(1)
      .endPDF((bytes) => {
        assert.deepEqual(pageWidths(bytes), [102]);
      });
  });

  it("preserves Unicode page-label bytes and string forms", () => {
    [
      ["unicode-literal", "toPDFLiteralString"],
      ["unicode-hex", "toPDFHexString"],
    ].forEach(([pageLabels, stringCast]) => {
      new Recipe(nestedNonzeroGenerationPdf({ pageLabels }))
        .deletePage(1)
        .endPDF((bytes) => {
          const reader = muhammara.createReader(
            new muhammara.PDFRStreamForBuffer(bytes),
          );
          try {
            const catalog = reader
              .queryDictionaryObject(reader.getTrailer(), "Root")
              .toPDFDictionary();
            const numbers = reader
              .queryDictionaryObject(
                reader
                  .queryDictionaryObject(catalog, "PageLabels")
                  .toPDFDictionary(),
                "Nums",
              )
              .toPDFArray();
            assert.equal(numbers.toJSArray()[0].toNumber(), 0);
            const prefix = reader
              .queryArrayObject(numbers, 1)
              .toPDFDictionary()
              .toJSObject()
              .P[stringCast]();
            assert.equal(prefix.toText(), "B-");
            assert.deepEqual(prefix.toBytesArray(), [254, 255, 0, 66, 0, 45]);
          } finally {
            reader.end();
          }
        });
    });
  });

  it("preserves existing annotation generations on retained pages", () => {
    new Recipe(nestedNonzeroGenerationPdf({ annotation: true }))
      .editPage(2)
      .comment("New", 10, 10)
      .endPage()
      .deletePage(1)
      .endPDF((bytes) => {
        const reader = muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(bytes),
        );
        try {
          const annotations = reader
            .queryDictionaryObject(
              reader.parsePage(0).getDictionary(),
              "Annots",
            )
            .toPDFArray()
            .toJSArray();
          assert.equal(annotations.length, 2);
          assert.equal(
            annotations[0].toPDFIndirectObjectReference().getVersion(),
            1,
          );
        } finally {
          reader.end();
        }
      });
  });

  it("is idempotent and rejects deletion after finalization", () => {
    const output = path.join(__dirname, "../output/delete-pages-ended.pdf");
    const recipe = new Recipe(source, output).deletePage(1);
    recipe.endPDF();
    assert.doesNotThrow(() => recipe.endPDF());
    assert.throws(() => recipe.deletePage(2), /after endPDF/);
  });

  it("keeps queued annotations on their retained page", () => {
    const output = path.join(
      __dirname,
      "../output/delete-pages-annotation.pdf",
    );
    new Recipe(source, output)
      .editPage(2)
      .comment("Retained", 10, 10)
      .endPage()
      .deletePage(1)
      .endPDF();
    const reader = muhammara.createReader(output);
    try {
      assert.isTrue(reader.parsePage(0).getDictionary().exists("Annots"));
      assert.isFalse(reader.parsePage(1).getDictionary().exists("Annots"));
    } finally {
      reader.end();
    }
  });

  it("rejects invalid deletion requests", () => {
    const newRecipe = new Recipe(
      "new",
      path.join(__dirname, "../output/new-delete.pdf"),
    );
    assert.throws(() => newRecipe.deletePage(1), /existing PDF/);
    newRecipe.endPDF();
    [0, -1, 1.5, "1", 13].forEach((pageNumber) => {
      const recipe = new Recipe(
        source,
        path.join(__dirname, `../output/invalid-delete-${pageNumber}.pdf`),
      );
      assert.throws(() => recipe.deletePage(pageNumber), /pageNumber/);
      recipe.endPDF();
    });
    const allPagesRecipe = new Recipe(
      source,
      path.join(__dirname, "../output/invalid-delete-all.pdf"),
    );
    assert.throws(
      () =>
        allPagesRecipe.deletePage(
          Array.from({ length: 12 }, (_, index) => index + 1),
        ),
      /At least one page/,
    );
    allPagesRecipe.endPDF();
    const onePage = path.join(__dirname, "../output/delete-only-page.pdf");
    createSource(onePage, 1);
    const onePageRecipe = new Recipe(
      onePage,
      path.join(__dirname, "../output/invalid-delete-only-page.pdf"),
    );
    assert.throws(() => onePageRecipe.deletePage(1), /At least one page/);
    onePageRecipe.endPDF();

    const deleteThenCreate = new Recipe(
      source,
      path.join(__dirname, "../output/delete-then-create.pdf"),
    );
    deleteThenCreate.deletePage(1);
    assert.throws(() => deleteThenCreate.createPage(), /cannot be combined/);
    deleteThenCreate.endPDF();

    const createThenDelete = new Recipe(
      source,
      path.join(__dirname, "../output/create-then-delete.pdf"),
    );
    createThenDelete.createPage();
    assert.throws(() => createThenDelete.deletePage(1), /cannot be combined/);
    createThenDelete.endPage().endPDF();
  });

  it("does not block deletion after failed composition calls", () => {
    const appendRecipe = new Recipe(
      source,
      path.join(__dirname, "../output/delete-after-failed-append.pdf"),
    );
    assert.throws(() => appendRecipe.appendPage(`${source}.missing`));
    assert.doesNotThrow(() => appendRecipe.deletePage(1));
    appendRecipe.endPDF();

    const insertRecipe = new Recipe(
      source,
      path.join(__dirname, "../output/delete-after-empty-insert.pdf"),
    );
    insertRecipe.insertPage(0);
    assert.doesNotThrow(() => insertRecipe.deletePage(1));
    insertRecipe.endPDF();
  });

  it("rejects cyclic page labels", () => {
    const output = path.join(__dirname, "../output/cyclic-page-labels.pdf");
    const recipe = new Recipe(
      nestedNonzeroGenerationPdf({ pageLabels: "cycle" }),
      output,
    ).deletePage(1);
    let writerAborted = false;
    let readerEnded = false;
    const abortWriter = recipe.writer._abort.bind(recipe.writer);
    const endReader = recipe.pdfReader.end.bind(recipe.pdfReader);
    recipe.writer._abort = () => {
      writerAborted = true;
      return abortWriter();
    };
    recipe.pdfReader.end = () => {
      readerEnded = true;
      return endReader();
    };

    const error = assert.throws(() => recipe.endPDF(), /acyclic PageLabels/);
    assert.isTrue(writerAborted);
    assert.isTrue(readerEnded);
    assert.strictEqual(recipe.pdfReader, null);
    assert.throws(() => recipe.endPDF(), error.message);
    assert.throws(() => recipe.deletePage(2), /after endPDF/);
  });

  it("rejects references from retained structures to deleted pages", () => {
    const recipe = new Recipe(
      nestedNonzeroGenerationPdf({ openAction: true }),
    ).deletePage(1);

    assert.throws(
      () => recipe.endPDF(),
      /referenced by retained document structures/,
    );
    assert.throws(
      () => recipe.endPDF(),
      /referenced by retained document structures/,
    );
  });

  it("aborts and releases the reader when later finalization fails", () => {
    const recipe = new Recipe(
      nestedNonzeroGenerationPdf(),
      path.join(__dirname, "../output/delete-later-failure.pdf"),
    ).deletePage(1);
    let writerAborted = false;
    let readerEnded = false;
    const abortWriter = recipe.writer._abort.bind(recipe.writer);
    const endReader = recipe.pdfReader.end.bind(recipe.pdfReader);
    recipe.writer._abort = () => {
      writerAborted = true;
      return abortWriter();
    };
    recipe.pdfReader.end = () => {
      readerEnded = true;
      return endReader();
    };
    recipe._writeInfo = () => {
      throw new Error("injected info failure");
    };

    const error = assert.throws(() => recipe.endPDF(), /injected info failure/);
    assert.isTrue(writerAborted);
    assert.isTrue(readerEnded);
    assert.strictEqual(recipe.pdfReader, null);
    assert.throws(() => recipe.endPDF(), error.message);
    assert.throws(() => recipe.deletePage(2), /after endPDF/);
  });
});
