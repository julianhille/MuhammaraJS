import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";
import { imagePlacements, placedPageForms } from "./image-placement.mjs";

// A 200 by 100 page and a 100 by 300 page, so the drawn size shows which page
// `page` placed. The native Recipe tests assert the same placements.
const PAGE_BOXES = [
  [0, 0, 200, 100],
  [0, 0, 100, 300],
];

// [options, corners of the placed page] for image("doc", 50, 60, options) on a
// 400 by 500 page, corners listed bottom-left, bottom-right, top-right,
// top-left in PDF coordinates.
const PDF_PLACEMENTS = [
  [
    { width: 100 },
    [
      [50, 390],
      [150, 390],
      [150, 440],
      [50, 440],
    ],
  ],
  [
    { scale: 0.5, width: 300, align: "center center" },
    [
      [0, 415],
      [100, 415],
      [100, 465],
      [0, 465],
    ],
  ],
  [
    { height: 90, page: 2 },
    [
      [50, 350],
      [80, 350],
      [80, 440],
      [50, 440],
    ],
  ],
  [
    { width: 100, height: 100 },
    [
      [50, 390],
      [150, 390],
      [150, 440],
      [50, 440],
    ],
  ],
  [
    // A negative width mirrors the page.
    { width: -100 },
    [
      [50, 490],
      [-50, 490],
      [-50, 440],
      [50, 440],
    ],
  ],
  [
    { width: 100, height: 100, keepAspectRatio: 0 },
    [
      [50, 340],
      [150, 340],
      [150, 440],
      [50, 440],
    ],
  ],
  [
    { width: 100, height: 100, keepAspectRatio: false },
    [
      [50, 340],
      [150, 340],
      [150, 440],
      [50, 440],
    ],
  ],
  [
    // Right by half the width and down by half the height.
    { width: 100, align: "right bottom" },
    [
      [100, 365],
      [200, 365],
      [200, 415],
      [100, 415],
    ],
  ],
  [
    { width: 100, rotation: 30, rotationOrigin: [10, 10] },
    [
      [-5.36, 383.4],
      [81.24, 333.4],
      [106.24, 376.7],
      [19.64, 426.7],
    ],
  ],
  [
    { width: 100, rotation: -45, skewY: 8 },
    [
      [50, 390],
      [120.71, 460.71],
      [90.32, 501.03],
      [19.61, 430.32],
    ],
  ],
];

/**
 * Builds a Recipe PDF in memory.
 * @param {function(Recipe): Recipe} build - Adds the pages.
 * @returns {Promise<Uint8Array>} The PDF bytes.
 */
async function recipeBytes(build) {
  var Recipe = await getRecipe();
  return build(new Recipe({ compress: false })).endPDF();
}

describe("Recipe image placement", function () {
  var muhammara;
  var Recipe;
  var base;

  before(async function () {
    muhammara = await createMuhammaraWasm();
    Recipe = await getRecipe();
    var source = await recipeBytes((recipe) =>
      recipe
        .createPage(200, 100)
        .rectangle(10, 10, 50, 20, { fill: "#ff0000" })
        .endPage()
        .createPage(100, 300)
        .rectangle(10, 10, 20, 50, { fill: "#0000ff" })
        .endPage(),
    );
    writeOutput("image-placement-source", source);
    Recipe.registerPdf("doc", source);
    // Two images of different sizes.
    Recipe.registerImage(
      "two-images",
      new Uint8Array(
        await readFile("tests/TestMaterials/images/tiff/dscf0013.tif"),
      ),
      "tiff",
    );
    base = await recipeBytes((recipe) => recipe.createPage(400, 500).endPage());
  });

  after(function () {
    Recipe.unregisterPdf("doc");
    Recipe.unregisterImage("two-images");
  });

  it("places a PDF page sized, fitted and aligned like an image", async function () {
    for (var [options, corners] of PDF_PLACEMENTS) {
      var bytes = await recipeBytes((recipe) =>
        recipe
          .createPage(400, 500)
          .image("doc", 50, 60, { ...options })
          .endPage(),
      );
      assert.deepEqual(
        imagePlacements(muhammara, bytes, { pageBoxes: PAGE_BOXES }),
        [{ kind: "page", corners, opacity: 1 }],
        JSON.stringify(options),
      );
    }
  });

  it("places a PDF page on an edited page like on a new one", function () {
    PDF_PLACEMENTS.forEach(([options, corners], index) => {
      var bytes = new Recipe(base, { compress: false })
        .editPage(1)
        .image("doc", 50, 60, { ...options })
        .endPage()
        .endPDF();
      writeOutput(`image-placement-edit-${index}`, bytes);
      assert.deepEqual(
        imagePlacements(muhammara, bytes, { pageBoxes: PAGE_BOXES }),
        [{ kind: "page", corners, opacity: 1 }],
        JSON.stringify(options),
      );
    });
  });

  it("resolves center coordinates before aligning a raster image", async function () {
    var bytes = await recipeBytes((recipe) =>
      recipe
        .createPage(400, 500)
        .image("logo", "center", "center", {
          width: 100,
          align: "center center",
        })
        .endPage(),
    );
    assert.deepEqual(imagePlacements(muhammara, bytes), [
      {
        kind: "image",
        corners: [
          [150, 212.5],
          [250, 212.5],
          [250, 287.5],
          [150, 287.5],
        ],
        opacity: 1,
      },
    ]);
  });

  it("reuses one form per PDF page on new, edited, and added pages", async function () {
    var bytes = await recipeBytes((recipe) =>
      recipe
        .createPage(400, 500)
        .image("doc", 10, 10, { width: 50 })
        .image("doc", 10, 100, { width: 60 })
        .image("doc", 10, 200, { width: 50, page: 2 })
        .endPage(),
    );
    assert.equal(placedPageForms(muhammara, bytes, PAGE_BOXES), 2);

    var edited = new Recipe(base)
      .editPage(1)
      .image("doc", 10, 10, { width: 50 })
      .image("doc", 10, 100, { width: 60 })
      .image("doc", 10, 200, { width: 50, page: 2 })
      .endPage()
      .endPDF();
    writeOutput("image-placement-reuse", edited);
    assert.equal(placedPageForms(muhammara, edited, PAGE_BOXES), 2);

    // A page created on a source document draws through the modifier too.
    var created = new Recipe(base, { compress: false })
      .createPage(400, 500)
      .image("doc", 50, 60, { width: 100 })
      .image("doc", 10, 200, { width: 50 })
      .endPage()
      .endPDF();
    writeOutput("image-placement-created", created);

    // An edited page keeps its own copy of what it drew, so the asset can be
    // replaced or removed before the page ends.
    Recipe.registerPdf("replaced", base);
    var replacing = new Recipe(base)
      .editPage(1)
      .image("replaced", 10, 10, { width: 50 });
    Recipe.registerPdf("replaced", base);
    replacing.image("replaced", 10, 100, { width: 50 });
    Recipe.unregisterPdf("replaced");
    replacing.endPage().endPDF();

    // So does a new page, which keeps its own copy of what it drew.
    Recipe.registerPdf("replaced", base);
    var created2 = new Recipe()
      .createPage(400, 500)
      .image("replaced", 10, 10, { width: 50 });
    Recipe.registerPdf("replaced", base);
    created2.image("replaced", 10, 100, { width: 50 });
    Recipe.unregisterPdf("replaced");
    created2.endPage().endPDF();
    assert.equal(placedPageForms(muhammara, created, PAGE_BOXES), 1);
    assert.deepEqual(
      imagePlacements(muhammara, created, {
        pageIndex: 1,
        pageBoxes: PAGE_BOXES,
      })[0],
      { kind: "page", corners: PDF_PLACEMENTS[0][1], opacity: 1 },
    );
  });

  it("frames the image box beneath and above the image", async function () {
    var bytes = await recipeBytes((recipe) =>
      recipe
        .createPage(400, 500)
        .image("doc", 50, 60, {
          width: 100,
          fill: "#eeeeee",
          stroke: "#000000",
          lineWidth: 4,
          dash: [3],
          lineCap: Recipe.LineCap.BUTT,
          lineJoin: Recipe.LineJoin.MITER,
          rotation: 20,
          opacity: 0.5,
        })
        .rectangle(10, 10, 5, 5, { fill: "#000000" })
        .endPage(),
    );
    var box = [
      [50, 390],
      [143.97, 355.8],
      [161.07, 402.78],
      [67.1, 436.98],
    ];
    assert.deepEqual(
      imagePlacements(muhammara, bytes, { pageBoxes: PAGE_BOXES }),
      [
        {
          kind: "fill",
          corners: box,
          color: { space: "rgb", values: [0.933, 0.933, 0.933] },
          opacity: 0.5,
        },
        { kind: "page", corners: box, opacity: 0.5 },
        {
          kind: "stroke",
          corners: [
            [52.56, 391.2],
            [142.77, 358.36],
            [158.51, 401.59],
            [68.3, 434.42],
          ],
          lineWidth: 4,
          cap: 0,
          join: 0,
          dash: [3],
          color: { space: "rgb", values: [0, 0, 0] },
          opacity: 0.5,
        },
        {
          kind: "fill",
          corners: [
            [10, 485],
            [15, 485],
            [15, 490],
            [10, 490],
          ],
          color: { space: "rgb", values: [0, 0, 0] },
          opacity: 1,
        },
      ],
    );
    // A mirrored image is framed where it is drawn.
    var mirrored = await recipeBytes((recipe) =>
      recipe
        .createPage(400, 500)
        .image("doc", 200, 60, {
          width: -100,
          fill: "#eeeeee",
          stroke: "#000000",
          lineWidth: 4,
        })
        .endPage(),
    );
    assert.deepEqual(
      imagePlacements(muhammara, mirrored, { pageBoxes: PAGE_BOXES }).map(
        (placement) => [placement.kind, placement.corners],
      ),
      [
        [
          "fill",
          [
            [100, 440],
            [200, 440],
            [200, 490],
            [100, 490],
          ],
        ],
        [
          "page",
          [
            [200, 490],
            [100, 490],
            [100, 440],
            [200, 440],
          ],
        ],
        [
          "stroke",
          [
            [102, 442],
            [198, 442],
            [198, 488],
            [102, 488],
          ],
        ],
      ],
    );
  });

  it("outlines with color and draws no frame without a color", async function () {
    var bytes = await recipeBytes((recipe) =>
      recipe
        .createPage(400, 500)
        .image("doc", 50, 60, { width: 100, lineWidth: 3, dash: [2] })
        .image("doc", 50, 60, { width: 100, color: "#ff0000", skewX: 12 })
        .endPage(),
    );
    // Only `color` frames the image; `colour` is no option.
    var colour = await recipeBytes((recipe) =>
      recipe
        .createPage(400, 500)
        .image("doc", 50, 60, { width: 100, colour: "#ff0000" })
        .endPage(),
    );
    assert.deepEqual(
      imagePlacements(muhammara, colour, { pageBoxes: PAGE_BOXES }).map(
        (placement) => placement.kind,
      ),
      ["page"],
    );

    // `stroke` wins over `color`; a non-numeric opacity keeps the current one.
    var both = await recipeBytes((recipe) =>
      recipe
        .createPage(400, 500)
        .image("doc", 50, 60, {
          width: 100,
          fill: "#eeeeee",
          stroke: "#0000ff",
          color: "#ff0000",
          opacity: NaN,
        })
        .endPage(),
    );
    assert.deepEqual(
      imagePlacements(muhammara, both, { pageBoxes: PAGE_BOXES }).map(
        (placement) => [placement.kind, placement.color, placement.opacity],
      ),
      [
        ["fill", { space: "rgb", values: [0.933, 0.933, 0.933] }, 1],
        ["page", undefined, 1],
        ["stroke", { space: "rgb", values: [0, 0, 1] }, 1],
      ],
    );
    assert.deepEqual(
      imagePlacements(muhammara, bytes, { pageBoxes: PAGE_BOXES }),
      [
        {
          kind: "page",
          corners: [
            [50, 390],
            [150, 390],
            [150, 440],
            [50, 440],
          ],
          opacity: 1,
        },
        {
          kind: "page",
          corners: [
            [50, 390],
            [150, 411.26],
            [150, 461.26],
            [50, 440],
          ],
          opacity: 1,
        },
        {
          kind: "stroke",
          corners: [
            [51, 391.21],
            [149, 412.04],
            [149, 460.04],
            [51, 439.21],
          ],
          lineWidth: 2,
          cap: 1,
          join: 1,
          dash: [],
          color: { space: "rgb", values: [1, 0, 0] },
          opacity: 1,
        },
      ],
    );
  });

  it("outlines the image box for debug", async function () {
    var bytes = await recipeBytes((recipe) =>
      recipe
        .createPage(400, 500)
        .image("doc", 50, 60, { width: 100, debug: true })
        .endPage(),
    );
    assert.deepEqual(
      imagePlacements(muhammara, bytes, { pageBoxes: PAGE_BOXES })[1],
      {
        kind: "stroke",
        corners: [
          [50.5, 390.5],
          [149.5, 390.5],
          [149.5, 439.5],
          [50.5, 439.5],
        ],
        lineWidth: 1,
        cap: 1,
        join: 1,
        dash: [],
        color: { space: "rgb", values: [0, 1, 0] },
        opacity: 1,
      },
    );
  });

  it("links the image box at center coordinates and takes null options", async function () {
    var bytes = await recipeBytes((recipe) =>
      recipe
        .createPage(400, 500)
        .image("doc", "center", "center", {
          width: 100,
          link: "https://image.example.com",
        })
        .image("doc", 10, 10, null)
        .image("doc", 50, 60, {
          width: 100,
          align: "right bottom",
          link: "https://bottom.example.com",
        })
        .endPage(),
    );
    assert.match(
      Buffer.from(bytes).toString("latin1"),
      /\/Rect \[ 200 200 300 250 \]/,
    );
    assert.match(
      Buffer.from(bytes).toString("latin1"),
      /\/Rect \[ 100 365 200 415 \]/,
    );
    assert.equal(
      imagePlacements(muhammara, bytes, { pageBoxes: PAGE_BOXES }).length,
      3,
    );
  });

  it("places pages with a moved media box or a rotation in their box", async function () {
    // A page whose media box starts at 100, 100, and one turned by 90 degrees.
    var turned = await recipeBytes((recipe) =>
      recipe
        .createPage(200, 100)
        .setPageBox(muhammara.ePDFPageBoxMediaBox, 100, 100, 300, 200)
        .rectangle(10, 10, 50, 20, { fill: "#ff0000" })
        .endPage()
        .createPage(200, 100)
        .rotate(90)
        .rectangle(10, 10, 50, 20, { fill: "#0000ff" })
        .endPage(),
    );
    writeOutput("image-placement-turned-source", turned);
    Recipe.registerPdf("turned", turned);
    try {
      var bytes = await recipeBytes((recipe) =>
        recipe
          .createPage(400, 500)
          .image("turned", 50, 60, { width: 100, stroke: "#000000" })
          .image("turned", 200, 60, {
            width: 100,
            page: 2,
            stroke: "#000000",
          })
          // Numeric strings are sizes.
          .image("turned", 50, 300, {
            width: "100",
            height: "30",
            stroke: "#000000",
          })
          .endPage(),
      );
      assert.deepEqual(
        imagePlacements(muhammara, bytes, {
          pageBoxes: [
            [100, 100, 300, 200],
            [0, 0, 200, 100],
          ],
        }),
        [
          {
            kind: "page",
            corners: [
              [50, 390],
              [150, 390],
              [150, 440],
              [50, 440],
            ],
            opacity: 1,
          },
          {
            kind: "stroke",
            corners: [
              [51, 391],
              [149, 391],
              [149, 439],
              [51, 439],
            ],
            lineWidth: 2,
            cap: 1,
            join: 1,
            dash: [],
            color: { space: "rgb", values: [0, 0, 0] },
            opacity: 1,
          },
          {
            kind: "page",
            corners: [
              [200, 440],
              [200, 240],
              [300, 240],
              [300, 440],
            ],
            opacity: 1,
          },
          {
            kind: "stroke",
            corners: [
              [201, 241],
              [299, 241],
              [299, 439],
              [201, 439],
            ],
            lineWidth: 2,
            cap: 1,
            join: 1,
            dash: [],
            color: { space: "rgb", values: [0, 0, 0] },
            opacity: 1,
          },
          {
            kind: "page",
            corners: [
              [50, 170],
              [110, 170],
              [110, 200],
              [50, 200],
            ],
            opacity: 1,
          },
          {
            kind: "stroke",
            corners: [
              [51, 171],
              [109, 171],
              [109, 199],
              [51, 199],
            ],
            lineWidth: 2,
            cap: 1,
            join: 1,
            dash: [],
            color: { space: "rgb", values: [0, 0, 0] },
            opacity: 1,
          },
        ],
      );
      var recipe = new Recipe().createPage(400, 500);
      ["wide", Infinity].forEach((width) =>
        assert.throws(() => recipe.image("turned", 0, 0, { width }), {
          name: "RangeError",
          message: "image width must be a finite number",
        }),
      );
      recipe.endPage().endPDF();
    } finally {
      Recipe.unregisterPdf("turned");
    }
  });

  it("rejects an unknown name, page, or colorspace before drawing", async function () {
    var bytes = await recipeBytes((recipe) => {
      recipe.createPage(400, 500);
      assert.throws(
        () => recipe.image("doc", 0, 0, { page: 6 }),
        /Unknown image: doc/,
      );
      assert.throws(() => recipe.image("missing", 0, 0), /Unknown image/);
      assert.throws(
        () => recipe.image("two-images", 0, 0, { page: 3 }),
        /Unknown image: two-images/,
      );
      [0, -1, 1.5, "1", NaN, 2 ** 32 + 1].forEach((page) =>
        assert.throws(() => recipe.image("doc", 0, 0, { page }), {
          name: "RangeError",
          message: "image page must be an integer from 1 to 4294967296",
        }),
      );
      assert.throws(
        () =>
          recipe.image("doc", 0, 0, { stroke: "#000000", colorspace: "bogus" }),
        { name: "TypeError", message: "Unknown colorspace: bogus" },
      );
      assert.throws(() => recipe.image("doc", 0, 0, { rotation: "none" }), {
        name: "TypeError",
        message: "rotation must be a finite number",
      });
      assert.throws(
        () => recipe.image("doc", 0, 0, { stroke: "#000000", miterLimit: 0 }),
        {
          name: "RangeError",
          message: "miterLimit must be a number of at least 1",
        },
      );
      return recipe.endPage();
    });
    assert.deepEqual(
      imagePlacements(muhammara, bytes, { pageBoxes: PAGE_BOXES }),
      [],
    );
    // The modifier reports an unreadable image differently; the message is
    // the same.
    var edited = new Recipe(base).editPage(1);
    assert.throws(
      () => edited.image("two-images", 0, 0, { page: 3 }),
      /Unknown image: two-images/,
    );
    edited.endPage().endPDF();
  });

  it("selects the image of a multi-image TIFF", async function () {
    var bytes = await recipeBytes((recipe) =>
      recipe
        .createPage(400, 500)
        .image("two-images", 10, 10, { scale: 0.5, page: 2 })
        .endPage(),
    );
    assert.deepEqual(imagePlacements(muhammara, bytes), [
      {
        kind: "image",
        corners: [
          [10, 430],
          [90, 430],
          [90, 490],
          [10, 490],
        ],
        opacity: 1,
      },
    ]);
  });
});
