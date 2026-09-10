/** Verify actual browser requests, with the bundled font unavailable initially. */
export async function validateFontLoading(browser, baseUrl) {
  var page = await browser.newPage();
  var requests = 0;
  var blockFont = true;
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.url().endsWith("/fonts/Roboto-Regular.js")) {
      requests++;
      if (blockFont) return request.abort();
    }
    return request.continue();
  });
  try {
    await page.goto(`${baseUrl}/packages/wasm/examples/browser/index.html`);
    await page.evaluate(async () => {
      var { createMuhammaraWasm, createRecipe } =
        await import("../../index.js");
      var muhammara = await createMuhammaraWasm();
      var fontBytes = new Uint8Array(
        await (
          await fetch(
            "/packages/native-with-source/tests/TestMaterials/fonts/arial.ttf",
          )
        ).arrayBuffer(),
      );
      var CustomRecipe = await createRecipe({
        defaultFont: new Blob([fontBytes]),
      });
      var NamedRecipe = await createRecipe({ defaultFont: false });
      NamedRecipe.registerFont("body", fontBytes);
      for (var [Recipe, options] of [
        [CustomRecipe, {}],
        [NamedRecipe, { font: "body" }],
      ]) {
        var recipe = new Recipe().createPage("letter");
        try {
          var bytes = recipe
            .text("Custom font", 72, 72, options)
            .endPage()
            .endPDF();
          var reader = muhammara.createReader(bytes);
          try {
            if (reader.extractPageText(0)[0].content !== "Custom font") {
              throw new Error("Custom default font did not render");
            }
          } finally {
            reader.end();
          }
        } finally {
          recipe.dispose();
          Recipe.disposeAssets();
        }
      }
      muhammara.disposeAssets();
    });
    if (requests !== 0) {
      throw new Error("Low-level/custom-font usage requested bundled Roboto");
    }
    blockFont = false;
    await page.evaluate(async () => {
      var { createRecipe } = await import("../../index.js");
      var Recipe = await createRecipe();
      var recipe = new Recipe().createPage("letter");
      try {
        var bytes = recipe.text("Default font", 72, 72).endPage().endPDF();
        if (!new TextDecoder().decode(bytes).includes("Roboto-Regular")) {
          throw new Error("Bundled default font did not render");
        }
      } finally {
        recipe.dispose();
        Recipe.disposeAssets();
      }
    });
    if (requests !== 1) {
      throw new Error(`Expected one lazy Roboto request, got ${requests}`);
    }
    return { customFontRequests: 0, bundledFontRequests: requests };
  } finally {
    await page.close();
  }
}
