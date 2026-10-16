import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { annotations, withReader } from "../support/pdf.mjs";
import {
  numberedPdf,
  pageLabels,
  pageWidths,
  pdfSource,
  squareSizes,
} from "../support/composition.mjs";

/**
 * Builds a two-page PDF with a nested, partly nonzero-generation page tree.
 * @param {object} [options] - Fixture variations.
 * @returns {Uint8Array} The PDF bytes.
 */
function nestedNonzeroGenerationPdf(options = {}) {
  var pageLabelsKind = options.pageLabels || "indirect";
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
  }[pageLabelsKind];
  var pdf = "%PDF-1.4\n";
  var offsets = {};
  var object = (id, generation, body) => {
    offsets[id] = [Buffer.byteLength(pdf), generation];
    pdf += `${id} ${generation} obj\n${body}\nendobj\n`;
  };
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
    {
      cycle: "<< /Kids [4 0 R] >>",
      "chained-null": "8 0 R",
      kids: "<< /Kids [8 0 R 9 0 R] /Limits [0 1] >>",
      "indirect-values":
        "<< /Nums [10 0 R << /S 11 0 R /P 12 0 R /St 13 0 R >>] >>",
      "chained-values": "18 0 R",
      start: "<< /Nums [0 << /S /D /St 5 >>] >>",
      "unicode-hex":
        "<< /Nums [0 << /P <FEFF0041002D> >> 1 << /P <FEFF0042002D> >>] >>",
      "unicode-literal":
        "<< /Nums [0 << /P (\\376\\377\\000\\101\\000\\055) >> 1 << /P (\\376\\377\\000\\102\\000\\055) >>] >>",
    }[pageLabelsKind] ||
      `<< /Nums [0 << /P (A-)${labelReference} >> 1 << /P (B-) >>] >>`,
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
  if (pageLabelsKind === "kids") {
    object(8, 0, "<< /Nums [0 << /P (A-) >>] /Limits [0 0] >>");
    object(9, 0, "<< /Nums [1 << /P (B-) >>] /Limits [1 1] >>");
  }
  if (pageLabelsKind === "chained-null") object(8, 0, "null");
  if (pageLabelsKind === "indirect-values") {
    object(10, 0, "0");
    object(11, 0, "/D");
    object(12, 0, "(A-)");
    object(13, 0, "5");
  }
  if (pageLabelsKind === "chained-values") {
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
  var objectCount = Math.max(...Object.keys(offsets).map(Number)) + 1;
  if (objectCount < 8) objectCount = 8;
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

/**
 * Builds a two-page PDF whose first page has generation 1 and a text stream.
 * @returns {Uint8Array} The PDF bytes.
 */
function nonzeroGenerationTextPdf() {
  var pdf = "%PDF-1.4\n";
  var offsets = {};
  var object = (id, generation, body) => {
    offsets[id] = [Buffer.byteLength(pdf), generation];
    pdf += `${id} ${generation} obj\n${body}\nendobj\n`;
  };
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
 * structure element.
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
  return new Uint8Array(Buffer.from(pdf));
}

/**
 * Replaces one unique span of a fixture with bytes of the same length, so
 * the xref offsets stay valid.
 * @param {Uint8Array} bytes - The fixture.
 * @param {string} from - The span to replace.
 * @param {string} to - The replacement, as long as `from`.
 * @returns {Uint8Array} The changed fixture.
 */
function replaceSpan(bytes, from, to) {
  var text = Buffer.from(bytes).toString("latin1");
  assert.equal(from.length, to.length);
  assert.equal(text.split(from).length, 2);
  return new Uint8Array(Buffer.from(text.replace(from, to), "latin1"));
}

/**
 * Collect the object IDs reachable from the trailer's catalog.
 * @param {object} end - The end, for its object type constants.
 * @param {object} reader - A PDF reader.
 * @returns {Set<number>} The reachable object IDs.
 */
function reachableObjectIDs(end, reader) {
  var M = end.muhammara;
  var reachable = new Set();
  var pending = [reader.getTrailer().queryObject("Root")];
  while (pending.length) {
    var value = pending.pop();
    var type = value.getType();
    if (type === M.ePDFObjectIndirectObjectReference) {
      var objectID = value.toPDFIndirectObjectReference().getObjectID();
      if (reachable.has(objectID)) continue;
      reachable.add(objectID);
      pending.push(reader.parseNewObject(objectID));
    } else if (type === M.ePDFObjectArray) {
      pending.push(...value.toPDFArray().toJSArray());
    } else if (type === M.ePDFObjectDictionary) {
      pending.push(...Object.values(value.toPDFDictionary().toJSObject()));
    } else if (type === M.ePDFObjectStream) {
      pending.push(value.toPDFStream().getDictionary());
    }
  }
  return reachable;
}

/**
 * The generation of the first kid of a page-tree node.
 * @param {object} reader - A PDF reader.
 * @param {number} objectID - The page-tree node.
 * @returns {number} The generation of its first kid reference.
 */
function firstKidGeneration(reader, objectID) {
  return reader
    .queryDictionaryObject(
      reader.parseNewObject(objectID).toPDFDictionary(),
      "Kids",
    )
    .toPDFArray()
    .toJSArray()[0]
    .toPDFIndirectObjectReference()
    .getVersion();
}

/**
 * Capture the error a call throws.
 * @param {function(): *} call - The call.
 * @returns {Error} The thrown error.
 */
function thrown(call) {
  try {
    call();
  } catch (error) {
    return error;
  }
  assert.fail("expected the call to throw");
}

describeEnds("Recipe deletePage", function (end) {
  var source;

  before(function () {
    source = numberedPdf(end);
    writeOutput(end, "deletePage-source", source);
  });

  it("deletes selected original pages from nested page trees", function () {
    var recipe = end.openRecipe(source);
    var metadata = recipe.metadata;
    assert.equal(recipe.deletePage([11, 2, 4, 4]), recipe);
    assert.equal(recipe.deletePage(1), recipe);
    var bytes = recipe.endPDF();
    writeOutput(end, "deletePage-selected", bytes);

    assert.deepEqual(
      pageWidths(end, bytes),
      [103, 105, 106, 107, 108, 109, 110, 112],
    );
    assert.deepEqual(squareSizes(end, bytes), [3, 5, 6, 7, 8, 9, 10, 12]);
    assert.equal(recipe.metadata, metadata);
    assert.equal(metadata.pages, 8);
    assert.equal(recipe.metadata[1].pageNumber, 1);
    assert.equal(recipe.metadata[8].pageNumber, 8);
    // Later calls return the same result instead of finalizing again.
    assert.equal(recipe.endPDF(), bytes);
    withReader(end, bytes, (reader) => {
      for (var page = 0; page < reader.getPagesCount(); page += 1) {
        assert.equal(reader.parsePageDictionary(page).exists("Contents"), true);
      }
    });
  });

  it("deletes the first and last pages", function () {
    var bytes = end.openRecipe(source).deletePage([1, 12]).endPDF();
    writeOutput(end, "deletePage-first-and-last", bytes);
    assert.deepEqual(
      pageWidths(end, bytes),
      [102, 103, 104, 105, 106, 107, 108, 109, 110, 111],
    );
  });

  it("preserves retained page generations and remaps page labels", function () {
    var fixture = nestedNonzeroGenerationPdf();
    var generations = end.openRecipe(fixture).deletePage(2).endPDF();
    writeOutput(end, "deletePage-retained-generations", generations);
    withReader(end, generations, (reader) => {
      assert.equal(reader.getPagesCount(), 1);
      assert.equal(reader.parsePage(0).getRotate(), 90);
      var catalog = reader
        .queryDictionaryObject(reader.getTrailer(), "Root")
        .toPDFDictionary();
      assert.equal(
        catalog.toJSObject().Pages.toPDFIndirectObjectReference().getVersion(),
        0,
      );
      assert.equal(firstKidGeneration(reader, 2), 0);
      assert.equal(firstKidGeneration(reader, 5), 1);
    });

    var labels = end.openRecipe(fixture).deletePage(1).endPDF();
    writeOutput(end, "deletePage-remapped-labels", labels);
    var [entry] = pageLabels(end, labels).entries;
    assert.equal(entry.start, 0);
    assert.equal(entry.P, "B-");
  });

  it("preserves page-label range starts while renumbering", function () {
    var bytes = end
      .openRecipe(nestedNonzeroGenerationPdf({ pageLabels: "start" }))
      .deletePage(1)
      .endPDF();
    writeOutput(end, "deletePage-label-range-start", bytes);
    var [entry] = pageLabels(end, bytes).entries;
    assert.equal(entry.start, 0);
    assert.equal(entry.S, "D");
    assert.equal(entry.St, 6);
  });

  it("flattens and remaps recursive page labels", function () {
    var bytes = end
      .openRecipe(nestedNonzeroGenerationPdf({ pageLabels: "kids" }))
      .deletePage(1)
      .endPDF();
    writeOutput(end, "deletePage-flattened-labels", bytes);
    var labels = pageLabels(end, bytes);
    assert.equal(labels.entries[0].start, 0);
    assert.equal(labels.entries[0].P, "B-");
    assert.equal(labels.kids, false);
  });

  it("preserves indirect page-label keys and values", function () {
    ["indirect-values", "chained-values"].forEach((kind) => {
      var bytes = end
        .openRecipe(nestedNonzeroGenerationPdf({ pageLabels: kind }))
        .deletePage(2)
        .endPDF();
      writeOutput(end, `deletePage-${kind}-labels`, bytes);
      var [entry] = pageLabels(end, bytes).entries;
      assert.equal(entry.start, 0);
      assert.equal(entry.S, "D");
      assert.equal(entry.P, "A-");
      assert.equal(entry.St, 5);
    });
  });

  it("does not rewrite untouched nonzero-generation page-tree branches", function () {
    var bytes = end
      .openRecipe(nestedNonzeroGenerationPdf({ nonzeroSibling: true }))
      .deletePage(2)
      .endPDF();
    writeOutput(end, "deletePage-untouched-nonzero-branch", bytes);
    assert.deepEqual(pageWidths(end, bytes), [101, 103]);
  });

  it("rejects page trees that require nonzero-generation rewrites", function () {
    var recipe = end.openRecipe(
      nestedNonzeroGenerationPdf({ nonzeroGeneration: true }),
    );
    assert.throws(() => recipe.deletePage(2), /nonzero-generation objects/);
    // A rejected deletion is not queued, so the Recipe still ends.
    var bytes = recipe.endPDF();
    writeOutput(end, "deletePage-rejected-nonzero-tree", bytes);
    assert.deepEqual(pageWidths(end, bytes), [101, 102]);
  });

  it("accepts direct page labels with a nonzero-generation catalog", function () {
    // PageLabels are attached when the catalog is written, never by
    // rewriting the catalog object in place, so its generation never matters.
    var bytes = end
      .openRecipe(
        nestedNonzeroGenerationPdf({
          catalogGeneration: true,
          pageLabels: "direct",
        }),
      )
      .deletePage(2)
      .endPDF();
    writeOutput(end, "deletePage-direct-labels-nonzero-catalog", bytes);
    assert.deepEqual(pageWidths(end, bytes), [101]);
  });

  it("rejects edited retained pages with nonzero generations", function () {
    var fixture = nestedNonzeroGenerationPdf();
    var recipe = end.openRecipe(fixture).editPage(1).endPage();
    assert.throws(() => recipe.deletePage(2), /nonzero-generation objects/);

    // Editing after the deletion is queued is caught when the PDF ends.
    var editedLater = end
      .openRecipe(fixture)
      .deletePage(2)
      .editPage(1)
      .endPage();
    assert.throws(() => editedLater.endPDF(), /nonzero-generation objects/);
    assert.throws(() => editedLater.endPDF(), /nonzero-generation objects/);
  });

  it("allows deleting an edited page with a nonzero generation", function () {
    // The edited page is dropped entirely, not rewritten, so its own
    // generation must not block the deletion.
    var bytes = end
      .openRecipe(nestedNonzeroGenerationPdf())
      .editPage(1)
      .endPage()
      .deletePage(1)
      .endPDF();
    writeOutput(end, "deletePage-edited-nonzero-page", bytes);
    assert.deepEqual(pageWidths(end, bytes), [102]);
  });

  it("rejects replaced text on nonzero-generation pages", function () {
    var recipe = end
      .openRecipe(nonzeroGenerationTextPdf())
      .replaceText("Before", "After", 1);
    assert.throws(() => recipe.deletePage(2), /nonzero-generation objects/);
  });

  it("deletes one occurrence of a duplicated page reference", function () {
    var bytes = end
      .openRecipe(nestedNonzeroGenerationPdf({ duplicatePageReference: true }))
      .deletePage(1)
      .endPDF();
    writeOutput(end, "deletePage-duplicate-reference", bytes);
    withReader(end, bytes, (reader) => {
      assert.equal(reader.getPagesCount(), 1);
      assert.equal(reader.getPageObjectID(0), 3);
    });
  });

  it("remaps direct page labels and accepts null page labels", function () {
    var direct = end
      .openRecipe(nestedNonzeroGenerationPdf({ pageLabels: "direct" }))
      .deletePage(1)
      .endPDF();
    writeOutput(end, "deletePage-direct-labels", direct);
    var [entry] = pageLabels(end, direct).entries;
    assert.equal(entry.start, 0);
    assert.equal(entry.P, "B-");

    ["null", "chained-null"].forEach((kind) => {
      var bytes = end
        .openRecipe(nestedNonzeroGenerationPdf({ pageLabels: kind }))
        .deletePage(1)
        .endPDF();
      writeOutput(end, `deletePage-${kind}-labels`, bytes);
      assert.deepEqual(pageWidths(end, bytes), [102]);
    });
  });

  it("preserves Unicode page-label bytes and string forms", function () {
    [
      ["unicode-literal", "literal"],
      ["unicode-hex", "hex"],
    ].forEach(([kind, prefixType]) => {
      var bytes = end
        .openRecipe(nestedNonzeroGenerationPdf({ pageLabels: kind }))
        .deletePage(1)
        .endPDF();
      writeOutput(end, `deletePage-${kind}-labels`, bytes);
      var [entry] = pageLabels(end, bytes).entries;
      assert.equal(entry.start, 0);
      assert.equal(entry.prefixType, prefixType);
      assert.equal(entry.P, "B-");
      assert.deepEqual(entry.prefixBytes, [254, 255, 0, 66, 0, 45]);
    });
  });

  it("preserves existing annotation generations on retained pages", function () {
    var bytes = end
      .openRecipe(nestedNonzeroGenerationPdf({ annotation: true }))
      .editPage(2)
      .comment("New", 10, 10)
      .endPage()
      .deletePage(1)
      .endPDF();
    writeOutput(end, "deletePage-annotation-generations", bytes);
    withReader(end, bytes, (reader) => {
      var annots = reader
        .queryDictionaryObject(reader.parsePageDictionary(0), "Annots")
        .toPDFArray()
        .toJSArray();
      assert.equal(annots.length, 2);
      assert.equal(annots[0].toPDFIndirectObjectReference().getVersion(), 1);
    });
  });

  it("is idempotent and rejects deletion after finalization", function () {
    var recipe = end.openRecipe(source).deletePage(1);
    var bytes = recipe.endPDF();
    writeOutput(end, "deletePage-ended", bytes);
    assert.equal(recipe.endPDF(), bytes);
    assert.throws(() => recipe.deletePage(2), /after endPDF/);
  });

  it("keeps queued annotations on their retained page", function () {
    var bytes = end
      .openRecipe(source)
      .editPage(2)
      .comment("Retained", 10, 10)
      .endPage()
      .deletePage(1)
      .endPDF();
    writeOutput(end, "deletePage-annotation", bytes);
    assert.equal(annotations(end, bytes, 0).length, 1);
    assert.equal(annotations(end, bytes, 0)[0].Contents, "Retained");
    assert.deepEqual(annotations(end, bytes, 1), []);
  });

  it("rejects invalid deletion requests", function () {
    var created = end.newRecipe();
    assert.throws(() => created.deletePage(1), /existing PDF/);
    created.createPage(100, 100).endPage().endPDF();

    [0, -1, 1.5, "1", 13].forEach((pageNumber) => {
      var recipe = end.openRecipe(source);
      assert.throws(() => recipe.deletePage(pageNumber), {
        name: "RangeError",
        message: /pageNumber/,
      });
      recipe.endPDF();
    });
    var allPages = end.openRecipe(source);
    assert.throws(
      () =>
        allPages.deletePage(
          Array.from({ length: 12 }, (_, index) => index + 1),
        ),
      /At least one page/,
    );
    allPages.endPDF();
    var onePage = end.openRecipe(numberedPdf(end, 1));
    assert.throws(() => onePage.deletePage(1), /At least one page/);
    onePage.endPDF();

    var deleteThenCreate = end.openRecipe(source).deletePage(1);
    assert.throws(() => deleteThenCreate.createPage(), /cannot be combined/);
    deleteThenCreate.endPDF();

    var createThenDelete = end.openRecipe(source);
    createThenDelete.createPage();
    assert.throws(
      () => createThenDelete.deletePage(1),
      /deletePage cannot be combined with createPage/,
    );
    createThenDelete.endPage().endPDF();
  });

  it("does not block deletion after failed composition calls", function () {
    var other = pdfSource(end, "deletePage-composition-source", source);

    var missing = end.openRecipe(source);
    assert.throws(() => missing.appendPage("deletePage-missing.pdf"));
    assert.doesNotThrow(() => missing.deletePage(1));
    missing.endPDF();

    [[[2, 1]], [[2]], 1.5, 0.5].forEach((pages) => {
      var recipe = end.openRecipe(source);
      assert.throws(() => recipe.appendPage(other, pages), {
        name: "RangeError",
        message: /one-based inclusive page numbers/,
      });
      assert.doesNotThrow(() => recipe.deletePage(1));
      recipe.endPDF();
    });

    var insert = end.openRecipe(source);
    // insertPage() rejects incomplete arguments immediately rather than
    // queueing nothing and failing later at endPDF(); either way, a rejected
    // insertPage() call must not block a later deletePage().
    assert.throws(() => insert.insertPage(0), {
      name: "TypeError",
      message: "insertPage requires pdfSrc and srcPageNumber",
    });
    assert.doesNotThrow(() => insert.deletePage(1));
    insert.endPDF();
  });

  it("rejects page composition in either order", function () {
    var other = pdfSource(end, "deletePage-composition-order-source", source);

    var appendThenDelete = end.openRecipe(source).appendPage(other, 1);
    assert.throws(
      () => appendThenDelete.deletePage(1),
      /cannot be combined with appendPage/,
    );
    appendThenDelete.endPDF();

    var deleteThenAppend = end.openRecipe(source).deletePage(1);
    assert.throws(
      () => deleteThenAppend.appendPage(other, 1),
      /cannot be combined with deletePage/,
    );
    deleteThenAppend.endPDF();

    var insertThenDelete = end.openRecipe(source).insertPage(0, other, 1);
    assert.throws(
      () => insertThenDelete.deletePage(1),
      /cannot be combined with insertPage/,
    );
    insertThenDelete.endPDF();

    var deleteThenInsert = end.openRecipe(source).deletePage(1);
    assert.throws(
      () => deleteThenInsert.insertPage(0, other, 1),
      /cannot be combined with deletePage/,
    );
    deleteThenInsert.endPDF();
  });

  it("rejects cyclic page labels", function () {
    var recipe = end.openRecipe(
      nestedNonzeroGenerationPdf({ pageLabels: "cycle" }),
    );
    assert.throws(() => recipe.deletePage(1), /acyclic PageLabels/);
    var bytes = recipe.endPDF();
    writeOutput(end, "deletePage-rejected-cyclic-labels", bytes);
    assert.deepEqual(pageWidths(end, bytes), [101, 102]);
  });

  it("retires the Recipe when a queued deletion fails at endPDF", function () {
    var recipe = end
      .openRecipe(nestedNonzeroGenerationPdf())
      .deletePage(2)
      .editPage(1)
      .endPage();
    var error = thrown(() => recipe.endPDF());
    assert.match(error.message, /nonzero-generation objects/);
    // The deletion did not happen, so the metadata still has both pages.
    assert.equal(recipe.metadata.pages, 2);
    assert.throws(
      () => recipe.endPDF(),
      (later) => later === error,
    );
    assert.throws(() => recipe.deletePage(2), /after endPDF/);
  });

  it("restores the metadata when finalization fails after the deletion", function () {
    var recipe = end.openRecipe(nestedNonzeroGenerationPdf()).deletePage(1);
    var metadata = recipe.metadata;
    // Fail the step that runs after the page tree was rewritten.
    recipe._writeInfo = () => {
      throw new Error("injected info failure");
    };
    var error = thrown(() => recipe.endPDF());
    assert.equal(error.message, "injected info failure");
    assert.equal(recipe.metadata, metadata);
    assert.equal(metadata.pages, 2);
    assert.equal(metadata[2].pageNumber, 2);
    assert.throws(
      () => recipe.endPDF(),
      (later) => later === error,
    );
    assert.throws(() => recipe.deletePage(2), /after endPDF/);
  });

  it("rejects references from retained structures to deleted pages", function () {
    var recipe = end.openRecipe(
      nestedNonzeroGenerationPdf({ openAction: true }),
    );
    assert.throws(
      () => recipe.deletePage(1),
      /referenced by retained document structures/,
    );
    // The rejected deletion leaves the Recipe usable.
    var bytes = recipe.endPDF();
    writeOutput(end, "deletePage-rejected-open-action", bytes);
    assert.deepEqual(pageWidths(end, bytes), [101, 102]);
  });

  it("rejects references from retained page-tree metadata", function () {
    var recipe = end.openRecipe(
      nestedNonzeroGenerationPdf({ pageTreeReference: true }),
    );
    assert.throws(
      () => recipe.deletePage(2),
      /referenced by retained document structures/,
    );
    assert.throws(
      () => recipe.deletePage(2, { pruneReferences: true }),
      /cannot prune references held by the page tree/,
    );
  });

  it("rejects a page referenced by outlines, links, forms and structure", function () {
    var recipe = end.openRecipe(referencedPagesPdf());
    assert.throws(
      () => recipe.deletePage(2),
      /referenced by retained document structures/,
    );
    var bytes = recipe.endPDF();
    writeOutput(end, "deletePage-rejected-referenced-page", bytes);
    assert.deepEqual(pageWidths(end, bytes), [101, 102, 103]);
  });

  it("prunes references to deleted pages with pruneReferences", function () {
    var M = end.muhammara;
    var bytes = end
      .openRecipe(referencedPagesPdf())
      .deletePage(2, { pruneReferences: true })
      .endPDF();
    writeOutput(end, "deletePage-prune-references", bytes);
    assert.deepEqual(pageWidths(end, bytes), [101, 103]);
    withReader(end, bytes, (reader) => {
      var object = (id) =>
        reader.parseNewObject(id).toPDFDictionary().toJSObject();
      var resolve = (value) =>
        value.getType() === M.ePDFObjectIndirectObjectReference
          ? reader.parseNewObject(
              value.toPDFIndirectObjectReference().getObjectID(),
            )
          : value;
      // Nothing retained reaches the deleted page any more.
      assert.equal(reachableObjectIDs(end, reader).has(4), false);

      var catalog = reader
        .queryDictionaryObject(reader.getTrailer(), "Root")
        .toPDFDictionary()
        .toJSObject();
      assert.equal(catalog.OpenAction.getType(), M.ePDFObjectNull);
      // The outline item keeps its title and child, without a target.
      assert.equal(object(7).Title.value, "Two");
      assert.equal("Dest" in object(7), false);
      assert.equal("First" in object(7), true);
      assert.equal("Dest" in object(8), true);
      var names = object(9).Names.toJSArray();
      assert.equal(names[1].toJSArray().length, 2);
      assert.equal(names[3].getType(), M.ePDFObjectNull);
      assert.equal("P" in object(11), false);
      assert.equal(object(11).T.value, "field");
      assert.equal("Pg" in object(13), false);
      assert.equal("Dest" in object(14), false);
      // The changed direct annotation and its action become indirect objects.
      var annotation = resolve(
        reader.parsePageDictionary(1).toJSObject().Annots.toJSArray()[0],
      )
        .toPDFDictionary()
        .toJSObject();
      assert.equal(annotation.Subtype.value, "Link");
      assert.deepEqual(
        Object.keys(resolve(annotation.A).toPDFDictionary().toJSObject()),
        ["S"],
      );
    });
  });

  it("keeps pruning enabled for every queued deletion", function () {
    var bytes = end
      .openRecipe(referencedPagesPdf())
      .deletePage(3, { pruneReferences: true })
      .deletePage(2)
      .endPDF();
    writeOutput(end, "deletePage-prune-queued", bytes);
    assert.deepEqual(pageWidths(end, bytes), [101]);
  });

  it("rejects pruning a reference held by an edited page", function () {
    var edited = end.openRecipe(referencedPagesPdf()).editPage(3).endPage();
    assert.throws(
      () => edited.deletePage(2, { pruneReferences: true }),
      /held by a page edited in this Recipe/,
    );
    var editedLater = end
      .openRecipe(referencedPagesPdf())
      .deletePage(2, { pruneReferences: true })
      .editPage(3)
      .endPage();
    assert.throws(
      () => editedLater.endPDF(),
      /held by a page edited in this Recipe/,
    );
  });

  it("validates deletePage options", function () {
    var recipe = end.openRecipe(referencedPagesPdf());
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
  });

  it("rejects page-tree children with an incorrect parent", function () {
    var recipe = end.openRecipe(
      nestedNonzeroGenerationPdf({ invalidParent: true }),
    );
    assert.throws(() => recipe.deletePage(1), /valid page tree/);
  });

  it("rejects a root page tree with a parent", function () {
    var recipe = end.openRecipe(
      nestedNonzeroGenerationPdf({ rootParent: true }),
    );
    assert.throws(() => recipe.deletePage(1), /valid page tree/);
  });

  it("ignores discarded page-label fields that reference deleted pages", function () {
    var bytes = end
      .openRecipe(nestedNonzeroGenerationPdf({ pageLabelReference: true }))
      .deletePage(1)
      .endPDF();
    writeOutput(end, "deletePage-discarded-label-reference", bytes);
    assert.deepEqual(pageWidths(end, bytes), [102]);
  });

  it("rejects active pages before deletion finalization", function () {
    var recipe = end.openRecipe(source).editPage(1).deletePage(2);
    assert.throws(() => recipe.endPDF(), /Finish the current page/);
    // The guard runs before finalization, so the Recipe still ends.
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "deletePage-after-active-page", bytes);
    assert.deepEqual(
      pageWidths(end, bytes),
      [101, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112],
    );
  });

  it("rejects a page-label prefix that is not a string", function () {
    var recipe = end.openRecipe(
      replaceSpan(nestedNonzeroGenerationPdf(), "/P (B-)", "/P 1234"),
    );
    assert.throws(() => recipe.deletePage(1), /valid PageLabels entries/);
  });
});
