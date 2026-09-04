const assert = require("assert");
const path = require("path");
const Recipe = require("@muhammara/native-with-source").Recipe;

describe("Text box clipping", () => {
  it("clips complete lines and reports the remainder", (done) => {
    const output = path.join(__dirname, "../output/text-box-clipping.pdf");
    const recipe = new Recipe("new", output);
    let callbackRecipe;
    let clipResult;

    recipe
      .createPage("letter")
      .text(
        "First line of text that fits. Second line of text that must be clipped.",
        50,
        50,
        {
          size: 12,
          textBox: {
            width: 200,
            height: 15,
            clipIfExceedsBox: true,
            onClip: (currentRecipe, result) => {
              callbackRecipe = currentRecipe;
              clipResult = result;
            },
          },
        },
      )
      .endPage()
      .endPDF(() => {
        assert.strictEqual(callbackRecipe, recipe);
        assert.strictEqual(clipResult.clipped, true);
        assert.strictEqual(clipResult.linesWritten, 1);
        assert.ok(clipResult.remainder.length > 0);
        assert.deepStrictEqual(clipResult.bounds, {
          x: 50,
          y: 50,
          width: 200,
          height: 15,
        });
        done();
      });
  });

  it("warns when onClip is configured without clipping", (done) => {
    const output = path.join(__dirname, "../output/text-box-clip-warning.pdf");
    const recipe = new Recipe("new", output);
    const originalWarn = console.warn;
    let warning;
    console.warn = (message) => {
      warning = message;
    };

    recipe
      .createPage("letter")
      .text("Text", 50, 50, {
        textBox: { width: 100, height: 20, onClip: () => {} },
      })
      .endPage()
      .endPDF(() => {
        console.warn = originalWarn;
        assert.strictEqual(
          warning,
          "textBox.onClip will not be called unless textBox.clipIfExceedsBox is true.",
        );
        done();
      });
  });
});
