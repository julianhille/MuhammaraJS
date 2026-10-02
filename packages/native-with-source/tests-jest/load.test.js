// Jest keeps its own module registry and ignores require.cache (issue #881).
const muhammara = require("@muhammara/native-with-source");

test("loads the package and its Recipe", () => {
  expect(typeof muhammara.createWriter).toBe("function");
  expect(typeof muhammara.Recipe).toBe("function");
});

test("creates a PDF with Recipe", () => {
  const recipe = new muhammara.Recipe(Buffer.from("new"));
  recipe.createPage("letter-size").text("Hello Jest", 100, 100).endPage();
  const output = recipe.endPDF((buffer) => buffer);

  expect(output.subarray(0, 5).toString()).toBe("%PDF-");
  const pages = new muhammara.Recipe(output).read();
  expect(pages.pages).toBe(1);
});
