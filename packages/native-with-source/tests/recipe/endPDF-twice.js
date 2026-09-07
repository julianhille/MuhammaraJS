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
});
