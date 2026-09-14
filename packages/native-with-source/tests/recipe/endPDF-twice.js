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
});
