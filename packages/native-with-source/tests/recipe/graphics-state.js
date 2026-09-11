const assert = require("chai").assert;
const muhammara = require("@muhammara/native-with-source");
const Recipe = muhammara.Recipe;

describe("Recipe graphics state", () => {
  it("rotates subsequent content around a Recipe coordinate", (done) => {
    const recipe = new Recipe(Buffer.from("new"), null, { compress: false });
    recipe
      .createPage(200, 300)
      .rotateContent(90, 30, 40)
      .rectangle(0, 0, 10, 10, { fill: "#000000" })
      .endPage()
      .endPDF((bytes) => {
        const reader = muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(bytes),
        );
        const page = reader.parsePage(0).getDictionary();
        const contents = reader.queryDictionaryObject(page, "Contents");
        const contentObjects =
          contents.getType() === muhammara.ePDFObjectArray
            ? Array.from(
                { length: contents.toPDFArray().getLength() },
                (_, index) => contents.toPDFArray().queryObject(index),
              )
            : [contents];
        const content = contentObjects
          .map((contentObject) => {
            if (
              contentObject.getType() ===
              muhammara.ePDFObjectIndirectObjectReference
            ) {
              contentObject = reader.parseNewObject(
                contentObject.toPDFIndirectObjectReference().getObjectID(),
              );
            }
            const stream = reader.startReadingFromStream(
              contentObject.toPDFStream(),
            );
            const chunks = [];
            while (stream.notEnded())
              chunks.push(Buffer.from(stream.read(4096)));
            return Buffer.concat(chunks).toString("latin1");
          })
          .join("");
        reader.end();
        assert.match(content, /1 0 0 1 30 260 cm/);
        assert.match(content, /0 1 -1 0 0 0 cm/);
        done();
      });
  });
});
