import { createMuhammaraWasm, createRecipe } from "./module-options.mjs";
import { throwIfCancelled } from "./lifecycle.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(`Recipe validation failed: ${message}`);
}

export async function runRecipeExample({
  source,
  assets = {},
  signal,
  progress = () => {},
}) {
  progress("Loading Recipe and registering byte assets", 62);
  var Recipe = await createRecipe();
  var recipe;
  var editing;
  try {
    if (assets.font)
      await Recipe.registerFontAsync(
        "example-font",
        new File([assets.font], "example.ttf", { type: "font/ttf" }),
      );
    if (assets.png)
      Recipe.registerImage(
        "example-png",
        assets.png.buffer.slice(
          assets.png.byteOffset,
          assets.png.byteOffset + assets.png.byteLength,
        ),
        "png",
      );
    await Recipe.registerPdfAsync(
      "low-level-source",
      new Blob([source], { type: "application/pdf" }),
    );
    throwIfCancelled(signal);
    recipe = new Recipe({ compress: false });
    recipe
      .info({
        title: "Muhammara Wasm Recipe example",
        author: "MuhammaraJS contributors",
      })
      .custom("Workflow", "browser-and-worker")
      .appendPage("low-level-source", 1)
      .createPage(595, 842, { left: 54, right: 54, top: 52, bottom: 52 })
      .chroma("ink", "#102a43")
      .rectangle(0, 0, 595, 842, { fill: "#f5efe2", useGivenCoords: true })
      .rectangle(42, 42, 511, 758, {
        stroke: "ink",
        lineWidth: 2,
        borderRadius: 12,
      })
      .star(505, 92, 28, 6, { fill: "#e85d3f", rotation: 15 })
      .lineStyle({ width: 2, dash: [5, 3] })
      .line(58, 155, 537, 155, { stroke: "#2c7a7b" });
    if (assets.font) {
      recipe
        .text("A practical byte-first document", 62, 72, {
          font: "example-font",
          fontSize: 25,
          color: "#102a43",
          underline: true,
        })
        .layout("story", 62, 185, 471, 165, { columns: 2, gap: 24 })
        .text(
          "<b>Recipe</b> keeps layout expressive while every font, image, and PDF remains browser-owned bytes.<br>It runs unchanged in a module Worker.",
          {
            font: "example-font",
            fontSize: 11,
            html: true,
            layout: "story",
            textBox: { padding: 6, style: { fill: "#ffffff" } },
          },
        )
        .table(
          62,
          390,
          [
            {
              surface: "Input",
              contract: "Uint8Array / ArrayBuffer / Blob / File",
            },
            { surface: "Output", contract: "owned Uint8Array" },
            { surface: "Cleanup", contract: "end(), dispose(), unregister*()" },
          ],
          {
            font: "example-font",
            fontSize: 9,
            header: true,
            border: true,
            columns: [
              { name: "surface", width: 110 },
              { name: "contract", width: 345 },
            ],
          },
        );
    }
    if (assets.png)
      recipe.image("example-png", 405, 650, {
        width: 110,
        height: 90,
        proportional: true,
        align: "center center",
        opacity: 0.82,
      });
    recipe
      .link("https://github.com/julianhille/MuhammaraJS", 62, 740, 250, 24)
      .comment("Created by the module Worker-safe Recipe facade", 530, 785, {
        title: "Muhammara Wasm",
        open: false,
      })
      .endPage()
      .createPage(595, 842)
      .overlay("low-level-source", { page: 1, fitWidth: true, opacity: 0.24 })
      .endPage();
    var first = recipe.endPDF();
    assert(recipe.endPDF() === first, "endPDF must be idempotent");
    progress("Editing Recipe output from its Uint8Array", 82);
    editing = new Recipe(first, { compress: false });
    editing
      .editPage(1)
      .rectangle(390, 760, 145, 34, { fill: "#102a43", opacity: 0.9 })
      .endPage();
    var bytes = editing.endPDF();
    var structure = editing.structure("json");
    assert(structure.pages === 3, "edited structure page count");
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(bytes);
    var pages = reader.getPagesCount();
    reader.end();
    muhammara.disposeAssets();
    assert(pages === 3, "edited output parse-back page count");
    return {
      bytes,
      summary: {
        pages,
        structure,
        splitParts: editing.split("example-part").length,
        inspectedSource: Recipe.inspectPdf("low-level-source"),
      },
    };
  } finally {
    recipe?.dispose();
    editing?.dispose();
    Recipe.unregisterFont("example-font");
    Recipe.unregisterImage("example-png");
    Recipe.unregisterPdf("low-level-source");
    Recipe.disposeAssets();
    progress("Recipe owners and registered assets disposed", 94);
  }
}
