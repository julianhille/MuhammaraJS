const path = require("path");
const muhammara = require("@muhammara/native-with-source");
const Recipe = muhammara.Recipe;

/**
 * Reads a page's content streams as one string.
 * @param {string} file - The PDF file.
 * @param {number} [pageIndex=0] - The page index.
 * @returns {string} The decoded page content.
 */
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
      .join("\n");
  } finally {
    reader.end();
  }
}

/**
 * Lists the text runs drawn on a page, in drawing order.
 * @param {string} file - The PDF file.
 * @param {number} [pageIndex=0] - The page index.
 * @returns {Array<{text: string, x: number, y: number, color: string}>} The runs with their
 *   text-matrix position in PDF points and fill color.
 */
function drawnRuns(file, pageIndex = 0) {
  const content = pageContent(file, pageIndex);
  return [
    ...content.matchAll(
      /(-?[\d.]+) (-?[\d.]+) Tm[^()<>]*?(?:\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f]*)>) Tj/g,
    ),
  ].map((match) => ({
    text:
      match[3]?.replace(/\\(.)/g, "$1") ??
      Buffer.from(match[4], "hex").toString("latin1"),
    x: Number(match[1]),
    y: Number(match[2]),
    // The last fill color set before the run.
    color: content.slice(0, match.index).match(/[^]*\s(\S+ \S+ \S+) rg\s/)?.[1],
  }));
}

/**
 * Draws on one 400 x 400 page and returns the runs it drew.
 * @param {string} name - Output file name without extension.
 * @param {function(Recipe): void} draw - Draws on the page.
 * @returns {Array<{text: string, x: number, y: number}>} The drawn runs.
 */
function drawRuns(name, draw) {
  const output = path.join(__dirname, `../output/${name}.pdf`);
  const recipe = new Recipe("new", output);
  recipe.createPage(400, 400);
  draw(recipe);
  recipe.endPage();
  recipe.endPDF();
  return drawnRuns(output);
}

module.exports = { pageContent, drawnRuns, drawRuns };
