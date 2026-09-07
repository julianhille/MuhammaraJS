const assert = require("assert");
const fs = require("fs");
const path = require("path");
const HummusRecipe = require("@muhammara/native-with-source").Recipe;

const header = (output) => {
  const buffer = Buffer.alloc(8);
  const file = fs.openSync(output, "r");
  try {
    fs.readSync(file, buffer, 0, buffer.length, 0);
  } finally {
    fs.closeSync(file);
  }
  return buffer.toString("latin1");
};

const write = (name, options) => {
  const output = path.join(__dirname, `../output/version-${name}.pdf`);
  new HummusRecipe("new", output, options).createPage().endPage().endPDF();
  return header(output);
};

describe("Version", () => {
  it("writes the requested pdf version", () => {
    assert.strictEqual(write("1-5", { version: 1.5 }), "%PDF-1.5");
    assert.strictEqual(write("2-0", { version: 2.0 }), "%PDF-2.0");
  });

  it("falls back to 1.7 for unsupported versions", () => {
    assert.strictEqual(write("default", {}), "%PDF-1.7");
    assert.strictEqual(write("1-9", { version: 1.9 }), "%PDF-1.7");
  });
});
