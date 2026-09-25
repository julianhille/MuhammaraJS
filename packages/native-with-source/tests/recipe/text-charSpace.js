const assert = require("node:assert/strict");
const Recipe = require("@muhammara/native-with-source").Recipe;
const { Word } = require("@muhammara/native-core/lib/recipe/text.helper");
const path = require("path");

describe("Text", () => {
  it("counts spacing between retained Unicode characters", () => {
    const options = { charSpace: 2 };

    assert.equal(new Word(" ab", options).charSpacing, 4);
    assert.equal(new Word("ab ", options).charSpacing, 4);
    assert.equal(new Word("a b", options).charSpacing, 4);
    assert.equal(new Word(" ab ", options).charSpacing, 6);
    assert.equal(new Word("\u00a0ab\u00a0", options).charSpacing, 6);
    assert.equal(new Word("\u{1f600}", options).charSpacing, 0);
    assert.equal(new Word("A\u{1f600}B", options).charSpacing, 4);
  });

  it("Simple text", (done) => {
    const output = path.join(__dirname, "../output/text-charSpace.pdf");
    const recipe = new Recipe("new", output);
    const lorem =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. \
Etiam in suscipit purus. Vestibulum ante ipsum primis in faucibus orci luctus \
et ultrices posuere cubilia Curae; Vivamus nec hendrerit felis. Morbi aliquam \
facilisis risus eu lacinia. Sed eu leo in turpis fringilla hendrerit.";

    let x = 20;
    let y = 40;
    let w = 180;

    recipe.createPage("letter");
    const boundaryPlain = recipe.textDimensions(" ab ");
    const boundarySpaced = recipe.textDimensions(" ab ", { charSpace: 2 });
    const unicodePlain = recipe.textDimensions("A\u{1f600}B");
    const unicodeSpaced = recipe.textDimensions("A\u{1f600}B", {
      charSpace: 2,
    });

    assert.equal(boundarySpaced.xMax, boundaryPlain.xMax + 6);
    assert.equal(unicodeSpaced.xMax, unicodePlain.xMax + 4);

    recipe
      .text("charSpace: 0", x + 40, y - 20, { color: "red" })
      .text("charSpace: 1", x + 45 + w, y - 20, { color: "blue" })
      .text("charSpace: 2", x + 50 + w * 2, y - 20, { color: "green" })
      .text(lorem, x, y, {
        charSpace: 0,
        textBox: {
          width: w,
          textAlign: "left",
          style: { width: 0.5, color: "red" },
        },
      })
      .text(lorem, x + w + 5, y, {
        charSpace: 1,
        textBox: {
          width: w,
          textAlign: "left",
          style: { width: 0.5, color: "blue" },
        },
      })
      .text(lorem, x + (w + 5) * 2, y, {
        charSpace: 2,
        textBox: {
          width: w,
          textAlign: "left",
          style: { width: 0.5, color: "green" },
        },
      });

    y = 280;
    recipe
      .text('textAlign: "justify"', x, y - 20, { color: "#00" })
      .text(lorem, x, y, {
        charSpace: 0,
        textBox: {
          width: w,
          textAlign: "justify",
          style: { width: 0.5, color: "red" },
        },
      })
      .text(lorem, x + w + 5, y, {
        charSpace: 1,
        textBox: {
          width: w,
          textAlign: "justify",
          style: { width: 0.5, color: "blue" },
        },
      })
      .text(lorem, x + (w + 5) * 2, y, {
        charSpace: 2,
        textBox: {
          width: w,
          textAlign: "justify",
          style: { width: 0.5, color: "green" },
        },
      });

    y = 520;
    recipe
      .text('textAlign: "center"', x, y - 20, { color: "#00" })
      .text(lorem, x, y, {
        charSpace: 0,
        textBox: {
          width: w,
          textAlign: "center",
          style: { width: 0.5, color: "red" },
        },
      })
      .text(lorem, x + w + 5, y, {
        charSpace: 1,
        textBox: {
          width: w,
          textAlign: "center",
          style: { width: 0.5, color: "blue" },
        },
      })
      .text(lorem, x + (w + 5) * 2, y, {
        charSpace: 2,
        textBox: {
          width: w,
          textAlign: "center",
          style: { width: 0.5, color: "green" },
        },
      })
      .endPage()
      .endPDF(done);
  });
});
