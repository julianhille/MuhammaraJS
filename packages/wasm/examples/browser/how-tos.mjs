import { createMuhammaraWasm, createRecipe } from "./module-options.mjs";
import { throwIfCancelled } from "./lifecycle.mjs";

export var HOW_TO_EXAMPLES = [
  {
    id: "annotations",
    label: "Annotations",
    title: "Add review annotations",
    description:
      "Create highlights, a bordered review region, a comment, and a threaded reply.",
    assets: [],
  },
  {
    id: "links",
    label: "Links",
    title: "Add clickable URL regions",
    description:
      "Turn visible cards into links while keeping Recipe's top-left coordinates explicit.",
    assets: [],
  },
  {
    id: "page-boxes",
    label: "Page boxes",
    title: "Set and visualize page boxes",
    description:
      "Write MediaBox, CropBox, BleedBox, TrimBox, and ArtBox values and draw their boundaries.",
    assets: [],
  },
  {
    id: "rotated-page",
    label: "Rotation",
    title: "Add content to a rotated page",
    description:
      "Rotate the page by 90 degrees and place calibrated shapes and an annotation in visual coordinates.",
    assets: [],
  },
  {
    id: "image-transform",
    label: "Images",
    title: "Place and transform an image",
    description:
      "Upload one JPEG, PNG, or TIFF and compare fitted, rotated, skewed, and translucent placements.",
    assets: ["jpeg", "png", "tiff"],
    requirement: "Requires at least one JPEG, PNG, or TIFF upload.",
  },
  {
    id: "table",
    label: "Tables",
    title: "Create a styled data table",
    description:
      "Upload a TTF or OTF font, then render headers, wrapped cells, borders, and structured records.",
    assets: ["font"],
    requirement: "Requires a TTF or OTF font upload.",
  },
];

function assertAsset(value, message) {
  if (!value) throw new Error(message);
  return value;
}

async function summarize(bytes, details = {}) {
  var muhammara = await createMuhammaraWasm();
  var reader = muhammara.createReader(bytes);
  try {
    return {
      pages: reader.getPagesCount(),
      objects: reader.getObjectsCount(),
      pdfLevel: reader.getPDFLevel(),
      ...details,
    };
  } finally {
    reader.end();
    muhammara.disposeAssets();
  }
}

async function annotationsExample() {
  var Recipe = await createRecipe();
  var recipe = new Recipe({ compress: false });
  try {
    recipe
      .createPage(595, 842)
      .rectangle(0, 0, 595, 842, { fill: "#f8f3e8", useGivenCoords: true })
      .rectangle(58, 92, 479, 72, { fill: "#dbeafe", borderRadius: 8 })
      .rectangle(58, 205, 479, 190, {
        fill: "#ffffff",
        stroke: "#102a43",
        lineWidth: 2,
        borderRadius: 12,
      })
      .rectangle(78, 238, 310, 20, { fill: "#fef3c7" })
      .rectangle(78, 278, 395, 20, { fill: "#e2e8f0" })
      .rectangle(78, 318, 245, 20, { fill: "#e2e8f0" })
      .annot(76, 234, "Highlight", {
        width: 316,
        height: 28,
        text: "Highlighted for review",
        title: "Reviewer",
        color: "#fde047",
        opacity: 0.45,
      })
      .annot(66, 214, "Square", {
        width: 425,
        height: 145,
        text: "This section needs approval",
        title: "Design review",
        color: "#dc2626",
        border: { width: 3, dash: [7, 4] },
      })
      .comment("Please confirm the highlighted section.", 505, 225, {
        title: "Muhammara reviewer",
        richText: true,
        open: true,
        color: "#f97316",
        replies: [{ text: "Confirmed in the browser example." }],
      })
      .endPage();
    var bytes = recipe.endPDF();
    return {
      bytes,
      filename: "muhammara-annotations.pdf",
      summary: await summarize(bytes, {
        howTo: "Add review annotations",
        annotations: ["Highlight", "Square", "Text comment", "Reply"],
      }),
    };
  } finally {
    recipe.dispose();
    Recipe.disposeAssets();
  }
}

async function linksExample() {
  var Recipe = await createRecipe();
  var recipe = new Recipe({ compress: false });
  try {
    recipe
      .createPage(595, 842)
      .rectangle(0, 0, 595, 842, { fill: "#eef2ff", useGivenCoords: true })
      .rectangle(65, 100, 465, 120, {
        fill: "#102a43",
        borderRadius: 16,
      })
      .rectangle(65, 255, 220, 150, {
        fill: "#bd412d",
        borderRadius: 16,
      })
      .rectangle(310, 255, 220, 150, {
        fill: "#2c7a7b",
        borderRadius: 16,
      })
      .star(175, 330, 40, 6, { fill: "#facf9b", rotation: 15 })
      .n_gon(420, 330, 42, 8, { fill: "#dbeafe" })
      .link("https://github.com/julianhille/MuhammaraJS", 65, 100, 465, 120)
      .link("https://www.npmjs.com/package/@muhammara/wasm", 65, 255, 220, 150)
      .link("https://muhammarajs.readthedocs.io/", 310, 255, 220, 150)
      .endPage();
    var bytes = recipe.endPDF();
    return {
      bytes,
      filename: "muhammara-links.pdf",
      summary: await summarize(bytes, {
        howTo: "Add URL links",
        links: 3,
        coordinateSystem: "Recipe top-left coordinates",
      }),
    };
  } finally {
    recipe.dispose();
    Recipe.disposeAssets();
  }
}

async function pageBoxesExample() {
  var muhammara = await createMuhammaraWasm();
  var writer = muhammara.createWriter({ compress: false });
  try {
    var page = new muhammara.PDFPage(0, 0, 595, 842);
    page.cropBox = [18, 18, 577, 824];
    page.bleedBox = [26, 26, 569, 816];
    page.trimBox = [38, 38, 557, 804];
    page.artBox = [58, 58, 537, 784];
    var context = writer.startPageContentContext(page);
    context
      .q()
      .rg(0.97, 0.95, 0.9)
      .re(0, 0, 595, 842)
      .f()
      .Q()
      .q()
      .RG(0.86, 0.15, 0.15)
      .w(6)
      .re(21, 21, 553, 797)
      .S()
      .Q()
      .q()
      .RG(0.96, 0.55, 0.1)
      .w(5)
      .re(29, 29, 537, 783)
      .S()
      .Q()
      .q()
      .RG(0.05, 0.55, 0.35)
      .w(4)
      .re(40, 40, 515, 762)
      .S()
      .Q()
      .q()
      .RG(0.1, 0.35, 0.85)
      .w(3)
      .re(60, 60, 475, 722)
      .S()
      .Q();
    writer.writePage(page);
    var bytes = writer.end();
    return {
      bytes,
      filename: "muhammara-page-boxes.pdf",
      summary: await summarize(bytes, {
        howTo: "Set page boxes",
        mediaBox: page.mediaBox,
        cropBox: page.cropBox,
        bleedBox: page.bleedBox,
        trimBox: page.trimBox,
        artBox: page.artBox,
      }),
    };
  } catch (error) {
    writer.dispose();
    throw error;
  } finally {
    muhammara.disposeAssets();
  }
}

async function rotatedPageExample() {
  var Recipe = await createRecipe();
  var recipe = new Recipe({ compress: false });
  try {
    recipe
      .createPage(420, 600)
      .setPageBox("media", 10, 20, 430, 620)
      .rotate(90)
      .rectangle(0, 0, 600, 420, { fill: "#f0fdfa", useGivenCoords: true })
      .rectangle(35, 35, 250, 125, {
        fill: "#99f6e4",
        stroke: "#0f766e",
        lineWidth: 3,
        borderRadius: 14,
      })
      .star(395, 210, 85, 7, { fill: "#fb7185", rotation: 10 })
      .line(35, 350, 550, 350, {
        stroke: "#102a43",
        lineWidth: 5,
        dash: [14, 8],
      })
      .annot(325, 100, "Square", {
        width: 180,
        height: 95,
        text: "Calibrated on a rotated page",
        color: "#7c3aed",
        borderWidth: 4,
      })
      .endPage();
    var bytes = recipe.endPDF();
    return {
      bytes,
      filename: "muhammara-rotated-page.pdf",
      summary: await summarize(bytes, {
        howTo: "Add content to rotated pages",
        rotation: 90,
        mediaBoxOrigin: [10, 20],
      }),
    };
  } finally {
    recipe.dispose();
    Recipe.disposeAssets();
  }
}

async function imageTransformExample(assets) {
  var selected = assets.png
    ? [assets.png, "png"]
    : assets.jpeg
      ? [assets.jpeg, "jpeg"]
      : assets.tiff
        ? [assets.tiff, "tiff"]
        : null;
  assertAsset(
    selected,
    "Choose a JPEG, PNG, or TIFF file before running the image example",
  );
  var Recipe = await createRecipe();
  var recipe = new Recipe({ compress: false });
  try {
    Recipe.registerImage("how-to-image", selected[0], selected[1]);
    recipe
      .createPage(595, 842)
      .rectangle(0, 0, 595, 842, { fill: "#f8fafc", useGivenCoords: true })
      .rectangle(45, 55, 505, 700, { stroke: "#102a43", lineWidth: 2 })
      .image("how-to-image", 150, 185, {
        width: 220,
        height: 180,
        align: "center center",
        keepAspectRatio: true,
      })
      .image("how-to-image", 430, 185, {
        width: 190,
        height: 150,
        align: "center center",
        keepAspectRatio: true,
        rotation: 14,
      })
      .image("how-to-image", 160, 500, {
        width: 210,
        height: 170,
        align: "center center",
        keepAspectRatio: true,
        skewX: 12,
        opacity: 0.68,
      })
      .image("how-to-image", 430, 500, {
        width: 190,
        height: 170,
        align: "center center",
        keepAspectRatio: false,
        rotation: -8,
        opacity: 0.82,
      })
      .endPage();
    var bytes = recipe.endPDF();
    return {
      bytes,
      filename: "muhammara-image-transforms.pdf",
      summary: await summarize(bytes, {
        howTo: "Place and transform images",
        sourceType: selected[1],
        placements: ["fit", "rotate", "skew and opacity", "stretch"],
      }),
    };
  } finally {
    recipe.dispose();
    Recipe.unregisterImage("how-to-image");
    Recipe.disposeAssets();
  }
}

async function tableExample(assets) {
  assertAsset(
    assets.font,
    "Choose a TTF or OTF font before running the table example",
  );
  var Recipe = await createRecipe();
  var recipe = new Recipe({ compress: false });
  try {
    Recipe.registerFont("how-to-font", assets.font);
    recipe
      .createPage(595, 842)
      .rectangle(0, 0, 595, 842, { fill: "#fff7ed", useGivenCoords: true })
      .rectangle(42, 42, 511, 758, {
        fill: "#ffffff",
        stroke: "#9a3412",
        lineWidth: 2,
        borderRadius: 12,
      })
      .text("Browser-generated project table", 62, 72, {
        font: "how-to-font",
        fontSize: 24,
        color: "#7c2d12",
      })
      .table(
        62,
        130,
        [
          { item: "Annotations", status: "Ready", surface: "Recipe" },
          { item: "Clickable links", status: "Ready", surface: "Both APIs" },
          { item: "Page boxes", status: "Ready", surface: "Low-level" },
          { item: "Image transforms", status: "Ready", surface: "Recipe" },
          {
            item: "Long wrapped content demonstrates measured row heights",
            status: "Verified",
            surface: "Browser and Worker",
          },
        ],
        {
          font: "how-to-font",
          fontSize: 11,
          header: true,
          border: { width: 1, color: "#c2410c" },
          padding: 9,
          columns: [
            { name: "item", width: 220 },
            { name: "status", width: 95 },
            { name: "surface", width: 140 },
          ],
        },
      )
      .endPage();
    var bytes = recipe.endPDF();
    return {
      bytes,
      filename: "muhammara-table.pdf",
      summary: await summarize(bytes, {
        howTo: "Create tables",
        rows: 5,
        columns: 3,
      }),
    };
  } finally {
    recipe.dispose();
    Recipe.unregisterFont("how-to-font");
    Recipe.disposeAssets();
  }
}

var runners = {
  annotations: annotationsExample,
  links: linksExample,
  "page-boxes": pageBoxesExample,
  "rotated-page": rotatedPageExample,
  "image-transform": imageTransformExample,
  table: tableExample,
};

export async function runHowToExample(id, options = {}) {
  var runner = runners[id];
  if (!runner) throw new Error(`Unknown browser example: ${id}`);
  var progress = options.progress || (() => {});
  throwIfCancelled(options.signal);
  progress(`Running ${id.replaceAll("-", " ")} how-to`, 20);
  var result = await runner(options.assets || {});
  throwIfCancelled(options.signal);
  progress("PDF generated and parsed back successfully", 100);
  return result;
}
