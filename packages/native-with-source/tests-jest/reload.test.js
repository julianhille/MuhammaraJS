// A second test file loads the package again in a fresh module registry.
const muhammara = require("@muhammara/native-with-source");

test("loads the package again in another test file", () => {
  const writerStream = new muhammara.PDFWStreamForBuffer();
  const writer = muhammara.createWriter(writerStream);
  writer.writePage(writer.createPage(0, 0, 595, 842));
  writer.end();

  const reader = muhammara.createReader(
    new muhammara.PDFRStreamForBuffer(writerStream.buffer),
  );
  expect(reader.getPagesCount()).toBe(1);
  expect(typeof muhammara.Recipe).toBe("function");
});
