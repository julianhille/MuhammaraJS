var muhammara = require("@muhammara/native");

// Re-encrypts a document without blocking the event loop. The returned promise
// resolves once the new file has been written.
async function recryptWithoutBlocking(inputPath, outputPath, options) {
  await muhammara.recryptAsync(inputPath, outputPath, options);
  return outputPath;
}

// The same, for callers that already hold the document in memory.
async function recryptBufferWithoutBlocking(sourceBuffer, outputPath, options) {
  var target = new muhammara.PDFWStreamForFile(outputPath);

  await muhammara.recryptAsync(
    new muhammara.PDFRStreamForBuffer(sourceBuffer),
    target,
    options,
  );
  await new Promise(function (resolve) {
    target.close(resolve);
  });

  return outputPath;
}

// Recipe's asynchronous ending, which uses recryptAsync for the encryption step.
async function encryptRecipeWithoutBlocking(outputPath, encryption) {
  var recipe = new muhammara.Recipe("new", outputPath);
  recipe
    .createPage(595, 842)
    .text("encrypted asynchronously", 50, 50)
    .endPage();
  recipe.encrypt(encryption);

  await recipe.endPDFAsync();
  return outputPath;
}

module.exports = {
  recryptWithoutBlocking,
  recryptBufferWithoutBlocking,
  encryptRecipeWithoutBlocking,
};
