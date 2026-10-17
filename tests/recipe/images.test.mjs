import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { annotations } from "../support/pdf.mjs";
import {
  imagePlacements,
  pdfSource,
  placedPageForms,
} from "../support/images.mjs";

// A 200 by 100 page and a 100 by 300 page, so the drawn size shows which page
// `page` placed.
var PAGE_BOXES = [
  [0, 0, 200, 100],
  [0, 0, 100, 300],
];

// [options, corners of the placed page] for image(source, 50, 60, options) on
// a 400 by 500 page, corners listed bottom-left, bottom-right, top-right,
// top-left in PDF coordinates.
var PDF_PLACEMENTS = [
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
 * The kinds of the placements, for asserting what a page draws.
 * @param {object[]} placements - The placements.
 * @returns {string[]} Their kinds.
 */
function kinds(placements) {
  return placements.map((placement) => placement.kind);
}

describeEnds("Recipe images", function (end) {
  it("places images on edited pages of an existing PDF", function () {
    var myCats = end.image("recipe/myCats.jpg");
    var wiki = end.image("recipe/wiki.png");
    var bytes = end
      .openRecipe("recipe/test.pdf")
      .editPage(1)
      .image(myCats, "center", "center", {
        width: 300,
        height: 300,
        keepAspectRatio: false,
        opacity: 1,
        align: "center center",
      })
      .image(myCats, 500, 210, {
        scale: 0.1,
        rotation: -90,
      })
      .rectangle(500, 210, 73, 97, {
        rotation: -90,
        color: "#ff0000",
      })
      .image(myCats, "center", 600, {
        scale: 0.1,
        align: "center center",
        rotation: 45,
        rotationOrigin: [270, 550],
        skewY: 10,
      })
      .rectangle(270, 550, 73, 97, {
        rotation: 45,
        rotationOrigin: [270, 550],
        skewY: 10,
      })
      .image(wiki, 0, 0, {
        width: 300,
        height: 300,
        opacity: 0.7,
      })
      .endPage()
      .editPage(2)
      .rectangle(0, 0, 800, 800, {
        color: [22, 48, 9],
      })
      .image(wiki, "center", "center", {
        width: 300,
        height: 300,
        align: "center center",
      })
      .endPage()
      .endPDF();
    writeOutput(end, "images-edited", bytes);
    var images = imagePlacements(end, bytes).filter(
      (placement) => placement.kind === "image",
    );
    assert.deepEqual(images, [
      {
        kind: "image",
        corners: [
          [156, 246],
          [456, 246],
          [456, 546],
          [156, 546],
        ],
        opacity: 1,
      },
      // Turned counter-clockwise around its bottom-left corner.
      {
        kind: "image",
        corners: [
          [500, 486],
          [500, 558],
          [404, 558],
          [404, 486],
        ],
        opacity: 1,
      },
      {
        kind: "image",
        corners: [
          [200.7, 172.7],
          [251.62, 121.79],
          [331.47, 177.7],
          [280.56, 228.62],
        ],
        opacity: 1,
      },
      {
        kind: "image",
        corners: [
          [0, 492],
          [300, 492],
          [300, 792],
          [0, 792],
        ],
        opacity: 0.7,
      },
    ]);
    // The second page keeps its own images and gets the new one on top.
    var second = imagePlacements(end, bytes, { pageIndex: 1 });
    assert.deepEqual(second.at(-1), {
      kind: "image",
      corners: [
        [156, 246],
        [456, 246],
        [456, 546],
        [156, 546],
      ],
      opacity: 1,
    });
    assert.equal(kinds(second).filter((kind) => kind === "image").length, 11);
  });

  it("draws a transparent PNG at each requested opacity", function () {
    var wiki = end.image("recipe/wiki.png");
    var recipe = end.openRecipe("recipe/test.pdf").editPage(1);
    [50, 250, 450].forEach((y, index) =>
      recipe.image(wiki, "center", y, {
        width: 300,
        height: 300,
        align: "center center",
        opacity: [1, 0.6, 0.3][index],
      }),
    );
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "images-transparent-png", bytes);
    assert.deepEqual(
      imagePlacements(end, bytes).map((placement) => [
        placement.corners[0],
        placement.opacity,
      ]),
      [
        [[156, 592], 1],
        [[156, 392], 0.6],
        [[156, 192], 0.3],
      ],
    );
  });

  describe("placement", function () {
    var source;
    var base;
    var logo;
    var twoImages;

    before(function () {
      source = pdfSource(
        end,
        "images-placement-source",
        end
          .newRecipe({ compress: false })
          .createPage(200, 100)
          .rectangle(10, 10, 50, 20, { fill: "#ff0000" })
          .endPage()
          .createPage(100, 300)
          .rectangle(10, 10, 20, 50, { fill: "#0000ff" })
          .endPage()
          .endPDF(),
      );
      base = end
        .newRecipe({ compress: false })
        .createPage(400, 500)
        .endPage()
        .endPDF();
      logo = end.image("images/png/pnglogo-grr.png");
      // Two images of different sizes.
      twoImages = end.image("images/tiff/dscf0013.tif");
    });

    /**
     * Build a new PDF without compression.
     * @param {function(object): object} build - Adds the pages.
     * @returns {Uint8Array} The PDF bytes.
     */
    function recipeBytes(build) {
      return build(end.newRecipe({ compress: false })).endPDF();
    }

    it("places a PDF page sized, fitted and aligned like an image", function () {
      PDF_PLACEMENTS.forEach(([options, corners]) => {
        var bytes = recipeBytes((recipe) =>
          recipe
            .createPage(400, 500)
            .image(source, 50, 60, { ...options })
            .endPage(),
        );
        assert.deepEqual(
          imagePlacements(end, bytes, { pageBoxes: PAGE_BOXES }),
          [{ kind: "page", corners, opacity: 1 }],
          JSON.stringify(options),
        );
      });
    });

    it("places a PDF page on an edited page like on a new one", function () {
      PDF_PLACEMENTS.forEach(([options, corners], index) => {
        var bytes = end
          .openRecipe(base, { compress: false })
          .editPage(1)
          .image(source, 50, 60, { ...options })
          .endPage()
          .endPDF();
        writeOutput(end, `images-placement-edit-${index}`, bytes);
        assert.deepEqual(
          imagePlacements(end, bytes, { pageBoxes: PAGE_BOXES }),
          [{ kind: "page", corners, opacity: 1 }],
          JSON.stringify(options),
        );
      });
    });

    it("resolves center coordinates before aligning a raster image", function () {
      var bytes = recipeBytes((recipe) =>
        recipe
          .createPage(400, 500)
          .image(logo, "center", "center", {
            width: 100,
            align: "center center",
          })
          .endPage(),
      );
      assert.deepEqual(imagePlacements(end, bytes), [
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

    it("embeds each placed PDF page once on new, edited, and added pages", function () {
      var bytes = recipeBytes((recipe) =>
        recipe
          .createPage(400, 500)
          .image(source, 10, 10, { width: 50 })
          .image(source, 10, 100, { width: 60 })
          .image(source, 10, 200, { width: 50, page: 2 })
          .endPage(),
      );
      assert.equal(placedPageForms(end, bytes, PAGE_BOXES), 2);

      var edited = end
        .openRecipe(base)
        .editPage(1)
        .image(source, 10, 10, { width: 50 })
        .image(source, 10, 100, { width: 60 })
        .image(source, 10, 200, { width: 50, page: 2 })
        .endPage()
        .endPDF();
      writeOutput(end, "images-placement-reuse", edited);
      assert.equal(placedPageForms(end, edited, PAGE_BOXES), 2);

      // A page created on a source document.
      var created = end
        .openRecipe(base, { compress: false })
        .createPage(400, 500)
        .image(source, 50, 60, { width: 100 })
        .image(source, 10, 200, { width: 50 })
        .endPage()
        .endPDF();
      writeOutput(end, "images-placement-created", created);
      assert.equal(placedPageForms(end, created, PAGE_BOXES), 1);
      assert.deepEqual(
        imagePlacements(end, created, {
          pageIndex: 1,
          pageBoxes: PAGE_BOXES,
        })[0],
        { kind: "page", corners: PDF_PLACEMENTS[0][1], opacity: 1 },
      );
    });

    it("frames the image box beneath and above the image", function () {
      var LineCap = end.Recipe.LineCap;
      var LineJoin = end.Recipe.LineJoin;
      var bytes = recipeBytes((recipe) =>
        recipe
          .createPage(400, 500)
          .image(source, 50, 60, {
            width: 100,
            fill: "#eeeeee",
            stroke: "#000000",
            lineWidth: 4,
            dash: [3],
            lineCap: LineCap.BUTT,
            lineJoin: LineJoin.MITER,
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
      assert.deepEqual(imagePlacements(end, bytes, { pageBoxes: PAGE_BOXES }), [
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
      ]);
      // A mirrored image is framed where it is drawn.
      var mirrored = recipeBytes((recipe) =>
        recipe
          .createPage(400, 500)
          .image(source, 200, 60, {
            width: -100,
            fill: "#eeeeee",
            stroke: "#000000",
            lineWidth: 4,
          })
          .endPage(),
      );
      assert.deepEqual(
        imagePlacements(end, mirrored, { pageBoxes: PAGE_BOXES }).map(
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

    it("outlines with color and draws no frame without a color", function () {
      var bytes = recipeBytes((recipe) =>
        recipe
          .createPage(400, 500)
          .image(source, 50, 60, { width: 100, lineWidth: 3, dash: [2] })
          .image(source, 50, 60, { width: 100, color: "#ff0000", skewX: 12 })
          .endPage(),
      );
      // Only `color` frames the image; `colour` is no option.
      var colour = recipeBytes((recipe) =>
        recipe
          .createPage(400, 500)
          .image(source, 50, 60, { width: 100, colour: "#ff0000" })
          .endPage(),
      );
      assert.deepEqual(
        kinds(imagePlacements(end, colour, { pageBoxes: PAGE_BOXES })),
        ["page"],
      );

      // `stroke` wins over `color`; a non-numeric opacity keeps the current one.
      var both = recipeBytes((recipe) =>
        recipe
          .createPage(400, 500)
          .image(source, 50, 60, {
            width: 100,
            fill: "#eeeeee",
            stroke: "#0000ff",
            color: "#ff0000",
            opacity: NaN,
          })
          .endPage(),
      );
      assert.deepEqual(
        imagePlacements(end, both, { pageBoxes: PAGE_BOXES }).map(
          (placement) => [placement.kind, placement.color, placement.opacity],
        ),
        [
          ["fill", { space: "rgb", values: [0.933, 0.933, 0.933] }, 1],
          ["page", undefined, 1],
          ["stroke", { space: "rgb", values: [0, 0, 1] }, 1],
        ],
      );
      assert.deepEqual(imagePlacements(end, bytes, { pageBoxes: PAGE_BOXES }), [
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
      ]);
    });

    it("outlines the image box for debug", function () {
      var bytes = recipeBytes((recipe) =>
        recipe
          .createPage(400, 500)
          .image(source, 50, 60, { width: 100, debug: true })
          .endPage(),
      );
      assert.deepEqual(
        imagePlacements(end, bytes, { pageBoxes: PAGE_BOXES })[1],
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

    it("links the image box at center coordinates and takes null options", function () {
      var bytes = recipeBytes((recipe) =>
        recipe
          .createPage(400, 500)
          .image(source, "center", "center", {
            width: 100,
            link: "https://image.example.com",
          })
          .image(source, 10, 10, null)
          .image(source, 50, 60, {
            width: 100,
            align: "right bottom",
            link: "https://bottom.example.com",
          })
          .endPage(),
      );
      assert.deepEqual(
        annotations(end, bytes).map((annot) => [annot.Rect, annot.A.URI]),
        [
          [[200, 200, 300, 250], "https://image.example.com"],
          [[100, 365, 200, 415], "https://bottom.example.com"],
        ],
      );
      assert.equal(
        imagePlacements(end, bytes, { pageBoxes: PAGE_BOXES }).length,
        3,
      );
    });

    it("places pages with a moved media box or a rotation in their box", function () {
      var M = end.muhammara;
      // A page whose media box starts at 100, 100, and one turned by 90 degrees.
      var turned = pdfSource(
        end,
        "images-placement-turned-source",
        recipeBytes((recipe) =>
          recipe
            .createPage(200, 100)
            .setPageBox(M.ePDFPageBoxMediaBox, 100, 100, 300, 200)
            .rectangle(10, 10, 50, 20, { fill: "#ff0000" })
            .endPage()
            .createPage(200, 100)
            .rotate(90)
            .rectangle(10, 10, 50, 20, { fill: "#0000ff" })
            .endPage(),
        ),
      );
      var bytes = recipeBytes((recipe) =>
        recipe
          .createPage(400, 500)
          .image(turned, 50, 60, { width: 100, stroke: "#000000" })
          .image(turned, 200, 60, { width: 100, page: 2, stroke: "#000000" })
          // Numeric strings are sizes.
          .image(turned, 50, 300, {
            width: "100",
            height: "30",
            stroke: "#000000",
          })
          .endPage(),
      );
      var frame = {
        lineWidth: 2,
        cap: 1,
        join: 1,
        dash: [],
        color: { space: "rgb", values: [0, 0, 0] },
        opacity: 1,
      };
      assert.deepEqual(
        imagePlacements(end, bytes, {
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
            ...frame,
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
            ...frame,
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
            ...frame,
          },
        ],
      );
      var recipe = end.newRecipe().createPage(400, 500);
      ["wide", Infinity].forEach((width) =>
        assert.throws(() => recipe.image(turned, 0, 0, { width }), {
          name: "RangeError",
          message: "image width must be a finite number",
        }),
      );
      recipe.endPage().endPDF();
    });

    it("rejects a missing image, page, or colorspace before drawing", function () {
      var missing =
        end.name === "native" ? end.image("missing.pdf") : "missing";
      var bytes = recipeBytes((recipe) => {
        recipe.createPage(400, 500);
        assert.throws(() => recipe.image(source, 0, 0, { page: 6 }), {
          name: "Error",
          message: `Unknown image: ${source}`,
        });
        assert.throws(() => recipe.image(missing, 0, 0), {
          name: "Error",
          message: `Unknown image: ${missing}`,
        });
        // Bytes are no image name or path.
        assert.throws(
          () => recipe.image(new Uint8Array([255, 216]), 0, 0),
          /Unknown image/,
        );
        assert.throws(() => recipe.image(twoImages, 0, 0, { page: 3 }), {
          name: "Error",
          message: `Unknown image: ${twoImages}`,
        });
        [0, -1, 1.5, "1", NaN, 2 ** 32 + 1].forEach((page) =>
          assert.throws(() => recipe.image(source, 0, 0, { page }), {
            name: "RangeError",
            message: "image page must be an integer from 1 to 4294967296",
          }),
        );
        // Wasm rejects its prereleases' zero-based `index`; native ignores
        // the option, as each always has.
        if (end.name === "wasm") {
          [0, 1].forEach((index) =>
            assert.throws(() => recipe.image(source, 0, 0, { index }), {
              name: "TypeError",
              message:
                "image index was replaced by the one-based page option; pass page: index + 1",
            }),
          );
        }
        assert.throws(
          () =>
            recipe.image(source, 0, 0, {
              stroke: "#000000",
              colorspace: "bogus",
            }),
          { name: "TypeError", message: "Unknown colorspace: bogus" },
        );
        assert.throws(() => recipe.image(source, 0, 0, { rotation: "none" }), {
          name: "TypeError",
          message: "rotation must be a finite number",
        });
        assert.throws(
          () =>
            recipe.image(source, 0, 0, { stroke: "#000000", miterLimit: 0 }),
          {
            name: "RangeError",
            message: "miterLimit must be a number of at least 1",
          },
        );
        return recipe.endPage();
      });
      assert.deepEqual(
        imagePlacements(end, bytes, { pageBoxes: PAGE_BOXES }),
        [],
      );
      // An edited page reports an unreadable image the same way.
      var edited = end.openRecipe(base).editPage(1);
      assert.throws(() => edited.image(twoImages, 0, 0, { page: 3 }), {
        name: "Error",
        message: `Unknown image: ${twoImages}`,
      });
      edited.endPage().endPDF();
    });

    it("selects the image of a multi-image TIFF", function () {
      var bytes = recipeBytes((recipe) =>
        recipe
          .createPage(400, 500)
          .image(twoImages, 10, 10, { scale: 0.5, page: 2 })
          .endPage(),
      );
      assert.deepEqual(imagePlacements(end, bytes), [
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

    it("does not add keepAspectRatio to the caller's options", function () {
      var options = { width: 50 };
      recipeBytes((recipe) =>
        recipe.createPage(400, 500).image(logo, 10, 10, options).endPage(),
      );
      assert.equal("keepAspectRatio" in options, false);
    });
  });
});
