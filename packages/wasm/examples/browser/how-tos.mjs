import { createMuhammaraWasm, createRecipe } from "./module-options.mjs";
import { throwIfCancelled } from "./lifecycle.mjs";

export var HOW_TO_EXAMPLES = [
  {
    id: "annotations",
    label: "Annotations",
    title: "Add review annotations",
    description:
      "Create highlights, a bordered review region, underlined text markup, a comment, and a threaded reply.",
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
    id: "html-lists",
    label: "HTML lists",
    title: "Render nested HTML lists",
    description:
      "Render unordered, ordered, nested, formatted, and linked list items without a DOM.",
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
    id: "form-gray",
    label: "Grayscale form",
    title: "Draw a grayscale form XObject",
    description:
      "Create a reusable form XObject with a grayscale fill, then place it on a page.",
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
    id: "delete-pages",
    label: "Delete pages",
    title: "Remove selected PDF pages",
    description:
      "Create a three-page PDF in memory, remove the middle page, and verify the retained page sizes.",
    assets: [],
    expectedPages: 2,
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
      "Render headers, wrapped cells, borders, and structured records with bundled Roboto, or upload your own font.",
    assets: ["font"],
  },
  {
    id: "passwords",
    label: "Passwords",
    title: "Add and change PDF passwords (view: view, owner: edit)",
    description:
      "Encrypt a byte-first Recipe PDF, then decrypt a verification copy with recrypt.",
    assets: [],
  },
  {
    id: "replace-text",
    label: "Replace text",
    title: "Replace page text",
    description:
      "Create a source page, replace non-ASCII text through its font, and verify the original placement survives.",
    assets: ["font"],
    requirement: "Requires a TTF or OTF font upload.",
  },
  {
    id: "watermark",
    label: "Watermark",
    title: "Watermark every page of a PDF",
    description:
      "Stamp diagonal, semi-transparent text across every page of your PDF, or of a built-in two-page sample.",
    assets: ["pdf", "watermark", "font"],
    expectedPages: 2,
  },
  {
    id: "find-text",
    label: "Find text",
    title: "Find and highlight text in a PDF",
    description:
      "Search the text operations of your PDF, or of a built-in sample, and add a Highlight annotation over every match.",
    assets: ["pdf", "search"],
    expectedPages: 2,
  },
  {
    id: "inspect-pdf",
    label: "Inspect PDF",
    title: "Inspect a PDF and render a report",
    description:
      "Read the version, metadata, page geometry, resources, and bookmarks of your PDF, or of a built-in sample, into a one-page report.",
    assets: ["pdf"],
  },
];

var SAMPLE_BOOKMARKS = ["Service agreement", "Pricing appendix"];

var MAX_MATCHES = 500;
// Share of the font size above and below the baseline that a highlight covers.
var HIGHLIGHT_ASCENT = 0.8;
var HIGHLIGHT_DESCENT = 0.25;

/**
 * Returns a required asset or fails the example.
 * @template T
 * @param {T|undefined} value - The asset.
 * @param {string} message - Error message when it is missing.
 * @returns {T} The asset.
 * @throws {Error} If the asset is missing.
 */
function assertAsset(value, message) {
  if (!value) throw new Error(message);
  return value;
}

/**
 * Parses a generated PDF back and summarizes it.
 * @param {Uint8Array<ArrayBuffer>} bytes - PDF bytes.
 * @param {object} [details={}] - Extra summary values; `expectedPageWidths` is checked.
 * @returns {Promise<object>} Page count, object count, PDF level, page widths, and `details`.
 * @throws {Error} If the page widths differ from `expectedPageWidths`.
 */
async function summarize(bytes, details = {}) {
  var muhammara = await createMuhammaraWasm();
  var reader = muhammara.createReader(bytes);
  try {
    var pageWidths = Array.from(
      { length: reader.getPagesCount() },
      (_, index) => {
        var box = reader.getPageBox(index);
        return box[2] - box[0];
      },
    );
    if (
      details.expectedPageWidths &&
      pageWidths.join(",") !== details.expectedPageWidths.join(",")
    ) {
      throw new Error(`Unexpected page widths: ${pageWidths.join(", ")}`);
    }
    return {
      pages: reader.getPagesCount(),
      objects: reader.getObjectsCount(),
      pdfLevel: reader.getPDFLevel(),
      pageWidths,
      ...details,
    };
  } finally {
    reader.end();
    muhammara.disposeAssets();
  }
}

/**
 * Builds the browser example for review annotations.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 */
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
        height: 162,
        text: "This section needs approval",
        title: "Design review",
        color: "#dc2626",
        border: { width: 3, dash: [7, 4] },
      })
      .text("Approved wording is underlined for review.", 78, 352, {
        size: 12,
        color: "#102a43",
        title: "Reviewer",
        underline: { text: "Approved", color: "#16a34a" },
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
        annotations: [
          "Highlight",
          "Square",
          "Underline text markup",
          "Text comment",
          "Reply",
        ],
      }),
    };
  } finally {
    recipe.dispose();
    Recipe.disposeAssets();
  }
}

/**
 * Builds the browser example for links.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 */
async function linksExample() {
  var Recipe = await createRecipe();
  var recipe = new Recipe({ compress: false });
  try {
    Recipe.registerImage(
      "link-image",
      Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        ),
        (character) => character.charCodeAt(0),
      ),
      "png",
    );
    recipe
      .createPage(595, 842)
      .rectangle(0, 0, 595, 842, { fill: "#eef2ff", useGivenCoords: true })
      .rectangle(65, 100, 465, 120, {
        fill: "#102a43",
        borderRadius: 16,
        link: "https://github.com/julianhille/MuhammaraJS",
      })
      .text("Open MuhammaraJS", 95, 135, {
        color: "#ffffff",
        size: 22,
        link: "https://github.com/julianhille/MuhammaraJS",
      })
      .image("link-image", 470, 130, {
        width: 36,
        height: 36,
        keepAspectRatio: false,
        link: "https://github.com/julianhille/MuhammaraJS",
      })
      .rectangle(65, 255, 220, 150, {
        fill: "#bd412d",
        borderRadius: 16,
        link: "https://www.npmjs.com/package/@muhammara/wasm",
      })
      .rectangle(310, 255, 220, 150, {
        fill: "#2c7a7b",
        borderRadius: 16,
        link: "https://muhammarajs-wasm.readthedocs.io/",
      })
      .star(175, 330, 40, 6, { fill: "#facf9b", rotation: 15 })
      .n_gon(420, 330, 42, 8, { fill: "#dbeafe" })
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

/**
 * Builds the browser example for nested, formatted, and linked HTML lists.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 */
async function htmlListsExample() {
  var Recipe = await createRecipe();
  var recipe = new Recipe({ compress: false });
  try {
    recipe
      .createPage(420, 320)
      .text("Worker-safe HTML lists", 36, 36, { size: 22, color: "#102a43" })
      .text(
        "<ul><li>DOM-free parsing</li><li><b>Inline emphasis</b></li>" +
          '<li><a href="https://github.com/julianhille/MuhammaraJS">Linked item</a>' +
          "<ol><li>Scoped numbering</li><li>Nested indentation</li></ol></li></ul>",
        36,
        82,
        { html: true, size: 14, textBox: { width: 330 } },
      )
      .endPage();
    var bytes = recipe.endPDF();
    return {
      bytes,
      filename: "muhammara-html-lists.pdf",
      summary: await summarize(bytes, {
        howTo: "Render nested HTML lists",
        listTypes: ["unordered", "ordered", "nested"],
      }),
    };
  } finally {
    recipe.dispose();
    Recipe.disposeAssets();
  }
}

/**
 * Builds the browser example for page boxes.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 * @throws {Error} If writing fails; the writer is disposed first.
 */
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

/**
 * Builds the browser example for a gray form XObject.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 */
async function formGrayExample() {
  var muhammara = await createMuhammaraWasm();
  var writer = muhammara.createWriter({ compress: false });
  try {
    var form = writer.createFormXObject(0, 0, 240, 140);
    form.getContentContext().drawRectangle(0, 0, 240, 140, {
      color: 0x00000099,
      colorspace: "gray",
      type: "fill",
    });
    writer.endFormXObject(form);

    var page = writer.createPage(0, 0, 595, 842);
    writer
      .startPageContentContext(page)
      .q()
      .cm(1, 0, 0, 1, 178, 351)
      .doXObject(form)
      .Q();
    writer.writePage(page);
    var bytes = writer.end();
    return {
      bytes,
      filename: "muhammara-grayscale-form.pdf",
      summary: await summarize(bytes, {
        howTo: "Draw a grayscale form XObject",
        colorspace: "gray",
      }),
    };
  } finally {
    muhammara.disposeAssets();
  }
}

/**
 * Builds the browser example for a rotated page.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 */
async function rotatedPageExample() {
  var muhammara = await createMuhammaraWasm();
  var Recipe = await createRecipe();
  var recipe = new Recipe({ compress: false });
  try {
    recipe
      .createPage(420, 600)
      .setPageBox(muhammara.ePDFPageBoxMediaBox, 10, 20, 430, 620)
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

/**
 * Builds the browser example for image transformations.
 * @param {import("./lifecycle.mjs").ExampleAssets} assets - Optional byte assets.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 * @throws {Error} If a required asset is missing.
 */
async function imageTransformExample(assets) {
  /** @type {[Uint8Array, string] | null} */
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

/**
 * Builds the browser example for a table.
 * @param {import("./lifecycle.mjs").ExampleAssets} assets - Optional byte assets.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 * @throws {Error} If a required asset is missing.
 */
async function tableExample(assets) {
  var Recipe = await createRecipe({ defaultFont: assets.font });
  var recipe = new Recipe({ compress: false });
  try {
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
          fontSize: 11,
          header: true,
          border: { width: 1, color: "#c2410c" },
          columns: [
            { name: "item", width: 220, cell: { padding: 9 } },
            { name: "status", width: 95, cell: { padding: 9 } },
            { name: "surface", width: 140, cell: { padding: 9 } },
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
        font: assets.font ? "Uploaded font" : "Roboto (bundled)",
        rows: 5,
        columns: 3,
      }),
    };
  } finally {
    recipe.dispose();
    Recipe.disposeAssets();
  }
}

/**
 * Builds the browser example for password protection.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 */
async function passwordsExample() {
  var Recipe = await createRecipe();
  var recipe = new Recipe({ compress: false });
  try {
    recipe
      .createPage(595, 300)
      .rectangle(0, 0, 595, 300, { fill: "#eff6ff", useGivenCoords: true })
      .rectangle(62, 78, 471, 144, {
        fill: "#ffffff",
        stroke: "#1d4ed8",
        lineWidth: 2,
        borderRadius: 12,
      })
      .endPage()
      .encrypt({
        userPassword: "view",
        ownerPassword: "edit",
        userProtectionFlag: 4,
      });
    var bytes = recipe.endPDF();
    var muhammara = await createMuhammaraWasm();
    try {
      var verificationCopy = muhammara.recrypt(bytes, { password: "view" });
      return {
        bytes,
        filename: "muhammara-passwords.pdf",
        summary: await summarize(verificationCopy, {
          howTo: "Add and change PDF passwords",
          password: "view",
        }),
      };
    } finally {
      muhammara.disposeAssets();
    }
  } finally {
    recipe.dispose();
    Recipe.disposeAssets();
  }
}

/**
 * Builds the browser example for text replacement.
 * @param {import("./lifecycle.mjs").ExampleAssets} assets - Optional byte assets.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 * @throws {Error} If a required asset is missing.
 */
async function replaceTextExample(assets) {
  assertAsset(
    assets.font,
    "Choose a TTF or OTF font before running the text replacement example",
  );
  var muhammara = await createMuhammaraWasm();
  var Recipe = await createRecipe();
  var recipe;
  try {
    muhammara.registerFont("replace-text-font", assets.font);
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 595, 300);
    writer
      .startPageContentContext(page)
      .BT()
      .Tf(writer.getFontForBytes("replace-text-font"), 24)
      .Tm(1, 0, 0, 1, 72, 180)
      .Tj("Status: in Prüfung")
      // Embedded fonts are subset, so the replacement glyphs must already
      // be on the page.
      .Tm(1, 0, 0, 1, 72, 120)
      .Tj("Status: geprüft")
      .ET();
    writer.writePage(page);
    recipe = new Recipe(writer.end());
    var bytes = recipe
      .replaceText("Status: in Prüfung", "Status: geprüft", 1)
      .endPDF();
    var reader = muhammara.createReader(bytes);
    var text = reader.extractPageText(0);
    reader.end();
    return {
      bytes,
      filename: "muhammara-replace-text.pdf",
      summary: await summarize(bytes, {
        howTo: "Replace page text",
        replacement: text[0]?.text,
        textMatrix: text[0]?.textMatrix,
      }),
    };
  } finally {
    recipe?.dispose();
    muhammara.unregisterFont("replace-text-font");
    muhammara.disposeAssets();
    Recipe.disposeAssets();
  }
}

/**
 * Builds the browser example for page deletion.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 */
async function deletePagesExample() {
  var Recipe = await createRecipe();
  var sourceRecipe = new Recipe({ compress: false });
  var recipe;
  try {
    sourceRecipe
      .createPage(300, 420)
      .rectangle(30, 30, 240, 360, { fill: "#dbeafe" })
      .endPage()
      .createPage(320, 440)
      .rectangle(30, 30, 260, 380, { fill: "#fee2e2" })
      .endPage()
      .createPage(340, 460)
      .rectangle(30, 30, 280, 400, { fill: "#dcfce7" })
      .endPage();
    recipe = new Recipe(sourceRecipe.endPDF()).deletePage(2);
    var bytes = recipe.endPDF();
    return {
      bytes,
      filename: "muhammara-delete-pages.pdf",
      summary: await summarize(bytes, {
        howTo: "Delete pages",
        removedPage: 2,
        expectedPageWidths: [300, 340],
      }),
    };
  } finally {
    recipe?.dispose();
    sourceRecipe.dispose();
    Recipe.disposeAssets();
  }
}

/**
 * Builds the two-page sample PDF, with bookmarks and document metadata, that
 * the PDF-reading examples use when no PDF is uploaded.
 * @returns {Promise<Uint8Array<ArrayBuffer>>} The sample PDF bytes.
 */
async function samplePdf() {
  var muhammara = await createMuhammaraWasm();
  var Recipe = await createRecipe();
  var recipe = new Recipe({ compress: false });
  var infoRecipe;
  var heading = { size: 26, color: "#102a43" };
  var body = { size: 12, color: "#334e68" };
  try {
    recipe
      .createPage(595, 842)
      .text("Service agreement", 72, 80, heading)
      .text("Draft for review", 72, 124, { size: 14, color: "#bd412d" })
      .text(
        "This Draft describes how the supplier delivers the service.",
        72,
        172,
        body,
      )
      .text("Both parties sign once the Draft is approved.", 72, 196, body)
      .endPage()
      .createPage(595, 842)
      .text("Pricing appendix", 72, 80, heading)
      .text("Draft pricing, valid for 30 days.", 72, 124, body)
      .endPage();
    var outlined = addBookmarks(muhammara, recipe.endPDF(), SAMPLE_BOOKMARKS);
    infoRecipe = new Recipe(outlined, { compress: false });
    return infoRecipe
      .info({
        title: "Service agreement",
        author: "MuhammaraJS browser example",
        subject: "Sample for the PDF-reading how-tos",
        keywords: "sample, draft",
      })
      .custom("Status", "Draft")
      .endPDF();
  } finally {
    infoRecipe?.dispose();
    recipe.dispose();
    Recipe.disposeAssets();
    muhammara.disposeAssets();
  }
}

/**
 * Adds one bookmark per page through the low-level modifier. The catalog is
 * rewritten with an `Outlines` entry; the sample's catalog holds only `Type`
 * and `Pages`, so no other catalog entry is lost.
 * @param {Awaited<ReturnType<typeof createMuhammaraWasm>>} muhammara - Loaded Wasm API.
 * @param {Uint8Array<ArrayBuffer>} bytes - Source PDF bytes.
 * @param {string[]} titles - Bookmark titles, one per page in page order.
 * @returns {Uint8Array<ArrayBuffer>} The PDF with bookmarks.
 * @throws {Error} If modifying fails; the modifier is disposed first.
 */
function addBookmarks(muhammara, bytes, titles) {
  var writer = muhammara.createWriterToModify(bytes, { compress: false });
  try {
    var parser = writer.getModifiedFileParser();
    var trailer = parser.getTrailer();
    var catalogId = trailer
      .queryObject("Root")
      .toPDFIndirectObjectReference()
      .getObjectID();
    var pagesId = parser
      .queryDictionaryObject(trailer, "Root")
      .toPDFDictionary()
      .queryObject("Pages")
      .toPDFIndirectObjectReference()
      .getObjectID();
    var objects = writer.getObjectsContext();
    var outlinesId = objects.allocateNewObjectID();
    var itemIds = titles.map(() => objects.allocateNewObjectID());

    objects.startModifiedIndirectObject(catalogId);
    objects
      .endDictionary(
        objects
          .startDictionary()
          .writeKey("Type")
          .writeNameValue("Catalog")
          .writeKey("Pages")
          .writeObjectReferenceValue(pagesId)
          .writeKey("Outlines")
          .writeObjectReferenceValue(outlinesId),
      )
      .endIndirectObject();

    objects.startNewIndirectObject(outlinesId);
    objects
      .endDictionary(
        objects
          .startDictionary()
          .writeKey("Type")
          .writeNameValue("Outlines")
          .writeKey("First")
          .writeObjectReferenceValue(itemIds[0])
          .writeKey("Last")
          .writeObjectReferenceValue(itemIds[itemIds.length - 1])
          .writeKey("Count")
          .writeNumberValue(titles.length),
      )
      .endIndirectObject();

    titles.forEach((title, index) => {
      objects.startNewIndirectObject(itemIds[index]);
      var item = objects
        .startDictionary()
        .writeKey("Title")
        .writeLiteralStringValue(title)
        .writeKey("Parent")
        .writeObjectReferenceValue(outlinesId);
      if (index > 0)
        item.writeKey("Prev").writeObjectReferenceValue(itemIds[index - 1]);
      if (index < titles.length - 1)
        item.writeKey("Next").writeObjectReferenceValue(itemIds[index + 1]);
      // A direct destination: [page /Fit].
      item.writeKey("Dest");
      objects
        .startArray()
        .writeIndirectObjectReference(parser.getPageObjectID(index))
        .writeName("Fit")
        .endArray()
        .endLine();
      objects.endDictionary(item).endIndirectObject();
    });
    return writer.end();
  } catch (error) {
    writer.dispose();
    throw error;
  }
}

/**
 * Returns the uploaded PDF, or the built-in sample when none was chosen.
 * @param {import("./lifecycle.mjs").ExampleAssets} assets - Optional byte assets.
 * @returns {Promise<{bytes: Uint8Array<ArrayBuffer>, origin: string}>} The PDF and where it came from.
 */
async function sourcePdf(assets) {
  return assets.pdf
    ? { bytes: assets.pdf, origin: "Uploaded PDF" }
    : { bytes: await samplePdf(), origin: "Built-in sample" };
}

/**
 * Builds the browser example that watermarks every page of a PDF.
 * @param {import("./lifecycle.mjs").ExampleAssets} assets - Optional byte assets.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 */
async function watermarkExample(assets) {
  var source = await sourcePdf(assets);
  var label = assets.watermark?.trim() || "CONFIDENTIAL";
  var muhammara = await createMuhammaraWasm();
  var reader = muhammara.createReader(source.bytes);
  var pageCount;
  try {
    pageCount = reader.getPagesCount();
  } finally {
    reader.end();
    muhammara.disposeAssets();
  }
  var Recipe = await createRecipe({ defaultFont: assets.font });
  var recipe = new Recipe(source.bytes, { compress: false });
  try {
    for (var pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      // pageInfo() swaps width and height for 90- and 270-degree pages.
      var page = recipe.pageInfo(pageNumber);
      var centerX = page.width / 2;
      var centerY = page.height / 2;
      // Run the text along the diagonal and size it to 60% of its length,
      // capped so that a short label stays inside the page.
      var angle = (Math.atan2(page.height, page.width) * 180) / Math.PI;
      var size = Math.min(
        Math.min(page.width, page.height) / 3,
        (100 * 0.6 * Math.hypot(page.width, page.height)) /
          recipe.textDimensions(label, { size: 100 }).width,
      );
      recipe
        .editPage(pageNumber)
        .opacity(0.25)
        .text(label, centerX, centerY, {
          size,
          color: "#dc2626",
          align: "center center",
          rotation: angle,
          rotationOrigin: [centerX, centerY],
        })
        .endPage();
    }
    var bytes = recipe.endPDF();
    return {
      bytes,
      filename: "muhammara-watermarked.pdf",
      summary: await summarize(bytes, {
        howTo: "Watermark every page",
        source: source.origin,
        watermark: label,
        watermarkedPages: pageCount,
        font: assets.font ? "Uploaded font" : "Roboto (bundled)",
      }),
    };
  } finally {
    recipe.dispose();
    Recipe.disposeAssets();
  }
}

/**
 * One occurrence of the searched text inside a text-showing operation.
 * @typedef {object} TextMatch
 * @property {number} pageNumber - One-based page number.
 * @property {number[]} mediaBox - The page's MediaBox.
 * @property {string} prefix - Operation text before the match.
 * @property {number} x - Operation origin, in PDF page coordinates.
 * @property {number} baseline - Operation baseline, in PDF page coordinates.
 * @property {number} sizeX - Horizontal font size after the text matrix.
 * @property {number} sizeY - Vertical font size after the text matrix.
 */

/**
 * Lists every occurrence of a string in the text operations of a PDF.
 * Rotated pages and rotated, skewed, or mirrored text are skipped, because
 * their highlights would need more than a translated, scaled rectangle.
 * @param {Awaited<ReturnType<typeof createMuhammaraWasm>>} muhammara - Loaded Wasm API.
 * @param {Uint8Array<ArrayBuffer>} bytes - PDF bytes.
 * @param {string} query - Text to find.
 * @returns {{matches: TextMatch[], skippedRotatedPages: number[], skippedTransformedMatches: number}} The matches, capped at `MAX_MATCHES`, and what was skipped.
 */
function findText(muhammara, bytes, query) {
  var reader = muhammara.createReader(bytes);
  var result = {
    matches: [],
    skippedRotatedPages: [],
    skippedTransformedMatches: 0,
  };
  try {
    for (var index = 0; index < reader.getPagesCount(); index++) {
      var geometry = reader.getPageInfo(index);
      if (geometry.rotate % 360 !== 0) {
        result.skippedRotatedPages.push(index + 1);
        continue;
      }
      for (var element of reader.extractPageText(index)) {
        var [scaleX, skewY, skewX, scaleY, x, baseline] = element.textMatrix;
        // Match the text decoded through the font, so non-ASCII queries and
        // composite-font text are found too.
        var offset = element.text.indexOf(query);
        for (
          ;
          offset !== -1;
          offset = element.text.indexOf(query, offset + 1)
        ) {
          if (skewY || skewX || scaleX <= 0 || scaleY <= 0) {
            result.skippedTransformedMatches++;
            continue;
          }
          if (result.matches.length === MAX_MATCHES) return result;
          result.matches.push({
            pageNumber: index + 1,
            mediaBox: geometry.mediaBox,
            prefix: element.text.slice(0, offset),
            x,
            baseline,
            sizeX: element.fontSize * scaleX,
            sizeY: element.fontSize * scaleY,
          });
        }
      }
    }
    return result;
  } finally {
    reader.end();
  }
}

/**
 * Builds the browser example that finds text and highlights every match.
 * @param {import("./lifecycle.mjs").ExampleAssets} assets - Optional byte assets.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 */
async function findTextExample(assets) {
  var source = await sourcePdf(assets);
  var query = assets.search?.trim() || "Draft";
  var muhammara = await createMuhammaraWasm();
  var found;
  try {
    found = findText(muhammara, source.bytes, query);
  } finally {
    muhammara.disposeAssets();
  }
  var Recipe = await createRecipe();
  var recipe = new Recipe(source.bytes, { compress: false });
  try {
    var editing;
    for (var match of found.matches) {
      if (match.pageNumber !== editing) {
        if (editing) recipe.endPage();
        recipe.editPage(match.pageNumber);
        editing = match.pageNumber;
      }
      // extractPageText() reports no glyph widths, so measure with Recipe's
      // bundled font: exact for the sample, an estimate for other fonts.
      // textDimensions() returns glyph bounds, which drop trailing spaces, so
      // the prefix advance is the difference of the two right edges.
      var end = recipe.textDimensions(query, { size: match.sizeX }).xMax;
      var start =
        recipe.textDimensions(match.prefix + query, { size: match.sizeX })
          .xMax - end;
      // annot() places the rectangle's bottom-left corner at (x, y).
      recipe.annot(
        match.x - match.mediaBox[0] + start,
        match.mediaBox[3] - match.baseline + HIGHLIGHT_DESCENT * match.sizeY,
        Recipe.AnnotSubtype.HIGHLIGHT,
        {
          width: end,
          height: (HIGHLIGHT_ASCENT + HIGHLIGHT_DESCENT) * match.sizeY,
          color: "#fde047",
          opacity: 0.5,
          title: "Find text",
          text: `Matched "${query}"`,
        },
      );
    }
    if (editing) recipe.endPage();
    var bytes = recipe.endPDF();
    return {
      bytes,
      filename: "muhammara-find-text.pdf",
      summary: await summarize(bytes, {
        howTo: "Find and highlight text",
        source: source.origin,
        query,
        matches: found.matches.length,
        limitReached: found.matches.length === MAX_MATCHES,
        highlightedPages: [
          ...new Set(found.matches.map((item) => item.pageNumber)),
        ],
        firstMatches: found.matches.slice(0, 10).map((item) => ({
          page: item.pageNumber,
          x: item.x,
          baseline: item.baseline,
        })),
        skippedRotatedPages: found.skippedRotatedPages,
        skippedTransformedMatches: found.skippedTransformedMatches,
      }),
    };
  } finally {
    recipe.dispose();
    Recipe.disposeAssets();
  }
}

// Bounds that keep the inspector's work and its one-page report finite on
// untrusted uploads, including outline cycles.
var MAX_INSPECTED_PAGES = 50;
var MAX_BOOKMARKS = 50;
var MAX_BOOKMARK_DEPTH = 8;
var REPORT_INFO_ROWS = 8;
var REPORT_PAGE_ROWS = 6;
var REPORT_BOOKMARK_ROWS = 6;
var REPORT_VALUE_LENGTH = 70;

var XObjectSubtype = Object.freeze({ IMAGE: "Image", FORM: "Form" });

// Standard Info keys, in report order; custom keys follow alphabetically.
var INFO_KEY_ORDER = [
  "Title",
  "Author",
  "Subject",
  "Keywords",
  "Creator",
  "Producer",
  "CreationDate",
  "ModDate",
  "Trapped",
];

/**
 * Reads a dictionary entry, resolving it when it is an indirect reference.
 * @param {import("../../index.js").PDFReader} reader - Open reader.
 * @param {import("../../index.js").PDFDictionary} dictionary - Dictionary to read.
 * @param {string} key - Entry name.
 * @returns {import("../../index.js").PDFObject|undefined} The entry, or undefined when it is missing.
 */
function entry(reader, dictionary, key) {
  return dictionary.exists(key)
    ? reader.queryDictionaryObject(dictionary, key)
    : undefined;
}

/**
 * Converts a PDF string, name, number, or boolean to a plain value that
 * outlives the reader.
 * @param {import("../../index.js").PDFObject|undefined} object - PDF object.
 * @returns {string|number|boolean|undefined} Its value.
 */
function pdfValue(object) {
  if (!object) return undefined;
  var string = object.toPDFLiteralString() || object.toPDFHexString();
  return string ? string.toText() : (object.value ?? object.toString());
}

/**
 * Reads the document Info dictionary.
 * @param {import("../../index.js").PDFReader} reader - Open reader.
 * @returns {Record<string, string|number|boolean|undefined>} Info entries by key.
 */
function readInfo(reader) {
  var info = entry(reader, reader.getTrailer(), "Info")?.toPDFDictionary();
  if (!info) return {};
  var rank = (key) => {
    var index = INFO_KEY_ORDER.indexOf(key);
    return index === -1 ? INFO_KEY_ORDER.length : index;
  };
  return Object.fromEntries(
    Object.keys(info.toJSObject())
      .sort(
        (left, right) => rank(left) - rank(right) || left.localeCompare(right),
      )
      .map((key) => [key, pdfValue(entry(reader, info, key))]),
  );
}

/**
 * Counts a page's image and form XObjects. Resources inherited from the page
 * tree are not followed.
 * @param {import("../../index.js").PDFReader} reader - Open reader.
 * @param {import("../../index.js").PDFDictionary} page - Page dictionary.
 * @returns {{images: number, forms: number}} XObject counts.
 */
function countXObjects(reader, page) {
  var counts = { images: 0, forms: 0 };
  var resources = entry(reader, page, "Resources")?.toPDFDictionary();
  var xObjects =
    resources && entry(reader, resources, "XObject")?.toPDFDictionary();
  if (!xObjects) return counts;
  for (var name of Object.keys(xObjects.toJSObject())) {
    var stream = entry(reader, xObjects, name)?.toPDFStream();
    var subtype =
      stream && pdfValue(entry(reader, stream.getDictionary(), "Subtype"));
    if (subtype === XObjectSubtype.IMAGE) counts.images++;
    else if (subtype === XObjectSubtype.FORM) counts.forms++;
  }
  return counts;
}

/**
 * Summarizes the geometry, text, annotations, and XObjects of the first
 * `MAX_INSPECTED_PAGES` pages.
 * @param {import("../../index.js").PDFReader} reader - Open reader.
 * @returns {object[]} One summary per page.
 */
function inspectPages(reader) {
  var count = Math.min(reader.getPagesCount(), MAX_INSPECTED_PAGES);
  return Array.from({ length: count }, (_, index) => {
    var geometry = reader.getPageInfo(index);
    var page = reader.parsePageDictionary(index);
    return {
      page: index + 1,
      width: geometry.width,
      height: geometry.height,
      rotate: geometry.rotate,
      textOperations: reader.extractPageText(index).length,
      annotations:
        entry(reader, page, "Annots")?.toPDFArray()?.getLength() ?? 0,
      ...countXObjects(reader, page),
    };
  });
}

/**
 * Reads the document outline. Only direct `[page ...]` destinations resolve
 * to a page number; named destinations and actions report `null`.
 * @param {import("../../index.js").PDFReader} reader - Open reader.
 * @returns {object[]} Bookmark trees of `{ title, page, children }`.
 */
function readBookmarks(reader) {
  var pageNumbers = new Map();
  for (var index = 0; index < reader.getPagesCount(); index++) {
    pageNumbers.set(reader.getPageObjectID(index), index + 1);
  }
  var catalog = entry(reader, reader.getTrailer(), "Root")?.toPDFDictionary();
  var outlines =
    catalog && entry(reader, catalog, "Outlines")?.toPDFDictionary();
  var first = outlines && entry(reader, outlines, "First")?.toPDFDictionary();
  var budget = { remaining: MAX_BOOKMARKS };
  return first ? readBookmarkItems(reader, first, pageNumbers, budget, 0) : [];
}

/**
 * Reads one outline level and its children, until the shared budget ends.
 * @param {import("../../index.js").PDFReader} reader - Open reader.
 * @param {import("../../index.js").PDFDictionary} item - First item of the level.
 * @param {Map<number, number>} pageNumbers - One-based page numbers by page object ID.
 * @param {{remaining: number}} budget - Items still allowed, shared by all levels.
 * @param {number} depth - Nesting depth of this level.
 * @returns {object[]} Bookmark trees of `{ title, page, children }`.
 */
function readBookmarkItems(reader, item, pageNumbers, budget, depth) {
  var items = [];
  while (item && budget.remaining > 0) {
    budget.remaining--;
    var page = entry(reader, item, "Dest")
      ?.toPDFArray()
      ?.queryObject(0)
      ?.toPDFIndirectObjectReference();
    var first =
      depth < MAX_BOOKMARK_DEPTH &&
      entry(reader, item, "First")?.toPDFDictionary();
    items.push({
      title: String(pdfValue(entry(reader, item, "Title")) ?? ""),
      page: (page && pageNumbers.get(page.getObjectID())) ?? null,
      children: first
        ? readBookmarkItems(reader, first, pageNumbers, budget, depth + 1)
        : [],
    });
    item = entry(reader, item, "Next")?.toPDFDictionary();
  }
  return items;
}

/**
 * Flattens bookmark trees into rows, marking depth with a leading dash.
 * @param {object[]} items - Bookmark trees.
 * @param {number} [depth=0] - Depth of `items`.
 * @returns {{title: string, page: number|null}[]} One row per bookmark.
 */
function flattenBookmarks(items, depth = 0) {
  return items.flatMap((item) => [
    { title: `${"- ".repeat(depth)}${item.title}`, page: item.page },
    ...flattenBookmarks(item.children, depth + 1),
  ]);
}

/**
 * Shortens a value to one report cell.
 * @param {*} value - Any value.
 * @returns {string} The value as text, at most `REPORT_VALUE_LENGTH` characters.
 */
function cellText(value) {
  var text = String(value ?? "");
  return text.length > REPORT_VALUE_LENGTH
    ? `${text.slice(0, REPORT_VALUE_LENGTH - 3)}...`
    : text;
}

/**
 * Limits table rows to fit the one-page report, replacing the overflow with a
 * count row, and fills an empty table with a placeholder row.
 * @param {Record<string, string>[]} rows - Table rows.
 * @param {string} column - First column name, which holds the placeholder text.
 * @param {number} limit - Maximum rows, including the count row.
 * @param {number} [total=rows.length] - Number of items the rows stand for.
 * @returns {Record<string, string>[]} The rows to draw.
 */
function reportRows(rows, column, limit, total = rows.length) {
  if (!rows.length) return [{ [column]: "None" }];
  if (total <= limit) return rows;
  return [
    ...rows.slice(0, limit - 1),
    { [column]: `+ ${total - limit + 1} more` },
  ];
}

/**
 * Builds table options with fixed column widths.
 * @param {[string, number][]} columns - Column names and widths.
 * @returns {object} Recipe table options.
 */
function reportTable(columns) {
  return {
    fontSize: 9,
    color: "#243b53",
    header: { fontSize: 9, color: "#102a43" },
    border: { width: 0.75, color: "#9fb3c8" },
    columns: columns.map(([name, width]) => ({
      name,
      width,
      cell: { padding: 5 },
    })),
  };
}

/**
 * Draws the one-page inspection report.
 * @param {import("../../index.js").Recipe} recipe - New Recipe document.
 * @param {string} origin - Where the inspected PDF came from.
 * @param {object} inspected - Values read from the inspected PDF.
 * @returns {void}
 */
function renderReport(recipe, origin, inspected) {
  var heading = { size: 14, color: "#102a43" };
  var round = (value) => Math.round(value * 100) / 100;
  var bookmarks = flattenBookmarks(inspected.bookmarks);
  recipe
    .createPage(595, 842)
    .text("PDF inspection report", 48, 48, { size: 24, color: "#102a43" })
    .text(
      `${origin}: PDF ${inspected.pdfLevel}, ${inspected.pages} pages, ` +
        `${inspected.objects} objects` +
        (inspected.encrypted ? ", encrypted (contents not read)" : ""),
      48,
      84,
      { size: 11, color: "#486581" },
    )
    .text("Document information", 48, 118, heading)
    .table(
      48,
      140,
      reportRows(
        Object.entries(inspected.info).map(([key, value]) => ({
          Entry: key,
          Value: cellText(value),
        })),
        "Entry",
        REPORT_INFO_ROWS,
      ),
      reportTable([
        ["Entry", 130],
        ["Value", 369],
      ]),
    );
  var y = recipe.position.y + 26;
  recipe.text("Pages", 48, y, heading).table(
    48,
    y + 22,
    reportRows(
      inspected.pageDetails.map((page) => ({
        Page: String(page.page),
        Size: `${round(page.width)} x ${round(page.height)}`,
        Rotate: String(page.rotate),
        "Text ops": String(page.textOperations),
        Annotations: String(page.annotations),
        Images: String(page.images),
        Forms: String(page.forms),
      })),
      "Page",
      REPORT_PAGE_ROWS,
      inspected.pages,
    ),
    reportTable([
      ["Page", 50],
      ["Size", 109],
      ["Rotate", 55],
      ["Text ops", 70],
      ["Annotations", 85],
      ["Images", 65],
      ["Forms", 65],
    ]),
  );
  y = recipe.position.y + 26;
  recipe
    .text("Bookmarks", 48, y, heading)
    .table(
      48,
      y + 22,
      reportRows(
        bookmarks.map((bookmark) => ({
          Bookmark: cellText(bookmark.title),
          Page: bookmark.page === null ? "-" : String(bookmark.page),
        })),
        "Bookmark",
        REPORT_BOOKMARK_ROWS,
      ),
      reportTable([
        ["Bookmark", 429],
        ["Page", 70],
      ]),
    )
    .endPage();
}

/**
 * Builds the browser example that inspects a PDF and renders a report.
 * @param {import("./lifecycle.mjs").ExampleAssets} assets - Optional byte assets.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The report PDF and the inspected values.
 */
async function inspectPdfExample(assets) {
  var source = await sourcePdf(assets);
  var muhammara = await createMuhammaraWasm();
  var reader = muhammara.createReader(source.bytes);
  var inspected;
  try {
    // Copy everything into plain values: reader objects die with end().
    // Without its password an encrypted PDF's strings and page tree cannot
    // be decrypted, so only the unencrypted file structure is reported.
    var encrypted = reader.isEncrypted();
    inspected = {
      pdfLevel: reader.getPDFLevel(),
      pages: reader.getPagesCount(),
      objects: reader.getObjectsCount(),
      encrypted,
      info: encrypted ? {} : readInfo(reader),
      pageDetails: encrypted ? [] : inspectPages(reader),
      bookmarks: encrypted ? [] : readBookmarks(reader),
    };
  } finally {
    reader.end();
    muhammara.disposeAssets();
  }
  var Recipe = await createRecipe();
  var recipe = new Recipe({ compress: false });
  try {
    renderReport(recipe, source.origin, inspected);
    var bytes = recipe.endPDF();
    return {
      bytes,
      filename: "muhammara-inspection-report.pdf",
      summary: await summarize(bytes, {
        howTo: "Inspect a PDF",
        source: source.origin,
        inspected,
      }),
    };
  } finally {
    recipe.dispose();
    Recipe.disposeAssets();
  }
}

var runners = {
  annotations: annotationsExample,
  links: linksExample,
  "html-lists": htmlListsExample,
  "page-boxes": pageBoxesExample,
  "form-gray": formGrayExample,
  "rotated-page": rotatedPageExample,
  "delete-pages": deletePagesExample,
  "image-transform": imageTransformExample,
  table: tableExample,
  passwords: passwordsExample,
  "replace-text": replaceTextExample,
  watermark: watermarkExample,
  "find-text": findTextExample,
  "inspect-pdf": inspectPdfExample,
};

/**
 * Runs one how-to example.
 * @param {string} id - How-to id from `HOW_TO_EXAMPLES`.
 * @param {import("./lifecycle.mjs").ExampleOptions} [options={}] - Assets, signal, and progress.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The PDF and its summary.
 * @throws {Error} If `id` is unknown.
 * @throws {DOMException} If the run is cancelled.
 */
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
