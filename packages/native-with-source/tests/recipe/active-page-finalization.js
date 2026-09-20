// Covers the call sequences from issue #732: endPDF() and appendPage() reached
// with a page still open. Both finish that page, so the document keeps it
// instead of losing it to a writer that cannot finalize around an open
// content stream.
const path = require("path");
const { expect } = require("chai");
const muhammara = require("@muhammara/native-with-source");
const Recipe = muhammara.Recipe;

/** Reads a written document's page count through a released reader. */
function pageCount(file) {
  const reader = muhammara.createReader(file);
  try {
    return reader.getPagesCount();
  } finally {
    reader.end();
  }
}

/** Concatenates a page's content streams as latin1 text. */
function pageContent(file, pageIndex = 0) {
  const reader = muhammara.createReader(file);
  try {
    const page = reader.parsePage(pageIndex).getDictionary();
    const contents = reader.queryDictionaryObject(page, "Contents");
    const streams =
      contents.getType() === muhammara.ePDFObjectArray
        ? contents
            .toPDFArray()
            .toJSArray()
            .map((entry) =>
              reader
                .parseNewObject(
                  entry.toPDFIndirectObjectReference().getObjectID(),
                )
                .toPDFStream(),
            )
        : [contents.toPDFStream()];
    return streams
      .map((stream) => {
        const readStream = reader.startReadingFromStream(stream);
        let text = "";
        while (readStream.notEnded()) {
          text += Buffer.from(readStream.read(4096)).toString("latin1");
        }
        return text;
      })
      .join("");
  } finally {
    reader.end();
  }
}

describe("Recipe finalization with an active page", () => {
  const source = path.join(
    __dirname,
    "../TestMaterials/recipe/compressed.tracemonkey-pldi-09.pdf",
  );

  it("finishes an empty active page on endPDF", () => {
    const output = path.join(__dirname, "../output/active-page-empty.pdf");
    const recipe = new Recipe("new", output);
    recipe.createPage(600, 800);

    recipe.endPDF();

    expect(pageCount(output)).to.equal(1);
  });

  it("keeps the active page's content when endPDF finishes it", () => {
    const output = path.join(__dirname, "../output/active-page-text.pdf");
    const recipe = new Recipe("new", output);
    recipe.createPage(600, 800).text("hi", 10, 10);

    recipe.endPDF();

    expect(pageCount(output)).to.equal(1);
    expect(pageContent(output)).to.match(/Tj|TJ/);
  });

  it("matches an explicit endPage for page count and content", () => {
    const implicitOutput = path.join(
      __dirname,
      "../output/active-page-implicit.pdf",
    );
    const explicitOutput = path.join(
      __dirname,
      "../output/active-page-explicit.pdf",
    );
    const implicit = new Recipe("new", implicitOutput);
    implicit.createPage(600, 800).text("hi", 10, 10);
    implicit.endPDF();
    const explicit = new Recipe("new", explicitOutput);
    explicit.createPage(600, 800).text("hi", 10, 10).endPage();
    explicit.endPDF();

    expect(pageCount(implicitOutput)).to.equal(pageCount(explicitOutput));
    expect(pageContent(implicitOutput)).to.equal(pageContent(explicitOutput));
  });

  it("finishes the active page before appending, keeping both pages in order", () => {
    const output = path.join(__dirname, "../output/active-page-append.pdf");
    const recipe = new Recipe("new", output);
    recipe.createPage(600, 800).text("hi", 10, 10);
    recipe.appendPage(source, 1);

    recipe.endPDF();

    expect(pageCount(output)).to.equal(2);
    const reader = muhammara.createReader(output);
    try {
      expect(reader.parsePage(0).getMediaBox()).to.deep.equal([0, 0, 600, 800]);
    } finally {
      reader.end();
    }
  });

  it("leaves the active page open when appendPage rejects its selection", () => {
    const output = path.join(__dirname, "../output/active-page-rejected.pdf");
    const recipe = new Recipe("new", output);
    recipe.createPage(600, 800).text("hi", 10, 10);

    expect(() => recipe.appendPage(source, [0])).to.throw(RangeError);

    // The page survived the rejection, so drawing continues on it.
    recipe.text("still here", 10, 40);
    recipe.endPDF();

    expect(pageCount(output)).to.equal(1);
  });

  it("finishes an edited source page on endPDF", () => {
    const output = path.join(__dirname, "../output/active-page-edit.pdf");
    const recipe = new Recipe(source, output);
    recipe.editPage(1).text("edited", 10, 50);

    recipe.endPDF();

    expect(pageCount(output)).to.equal(pageCount(source));
  });

  it("still reports a page left open while pages are marked for deletion", () => {
    const output = path.join(__dirname, "../output/active-page-deleted.pdf");
    const recipe = new Recipe(source, output);
    recipe.editPage(1).deletePage(2);

    expect(() => recipe.endPDF()).to.throw(/Finish the current page/);
    // The guard runs before finalization, so the document still recovers.
    expect(() => recipe.endPage().endPDF()).to.not.throw();
  });
});
