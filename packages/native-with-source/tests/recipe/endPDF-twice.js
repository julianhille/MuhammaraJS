const path = require("path");
const { expect } = require("chai");
const Recipe = require("@muhammara/native-with-source").Recipe;

describe("endPDF called twice", () => {
  it("should not throw when endPDF is called twice", (done) => {
    const output = path.join(__dirname, "../output/endPDF-twice.pdf");
    const recipe = new Recipe("new", output);

    recipe.createPage("letter").endPage().endPDF();

    expect(() => {
      recipe.endPDF();
    }).to.not.throw();

    done();
  });

  it("invokes repeated callbacks with the completed buffer", () => {
    const recipe = new Recipe(Buffer.from("new"));
    let firstOutput;
    const firstResult = recipe
      .createPage("letter")
      .endPage()
      .endPDF((output) => {
        firstOutput = output;
        return "first";
      });
    let secondOutput;
    const secondResult = recipe.endPDF((output) => {
      secondOutput = output;
      return "second";
    });

    expect(firstResult).to.equal("first");
    expect(secondResult).to.equal("second");
    expect(secondOutput.equals(firstOutput)).to.equal(true);
  });

  it("retires the writer and releases the reader after finalization fails", () => {
    const source = path.join(
      __dirname,
      "../TestMaterials/recipe/createWithBuffer.pdf",
    );
    const output = path.join(__dirname, "../output/endPDF-failure.pdf");
    const recipe = new Recipe(source, output);
    let writerAborted = false;
    let readerEnded = false;
    const endReader = recipe.pdfReader.end.bind(recipe.pdfReader);
    recipe.writer._abort = () => {
      writerAborted = true;
    };
    recipe.pdfReader.end = () => {
      readerEnded = true;
      return endReader();
    };
    const finalizationError = new Error("injected finalization failure");
    recipe._writeInfo = () => {
      throw finalizationError;
    };

    expect(() => recipe.endPDF()).to.throw("injected finalization failure");
    expect(writerAborted).to.equal(true);
    expect(readerEnded).to.equal(true);
    expect(recipe.pdfReader).to.equal(null);
    expect(recipe.ended).to.equal(true);
    expect(recipe.endError).to.equal(finalizationError);
    expect(() => recipe.endPDF()).to.throw(finalizationError);
  });
});
