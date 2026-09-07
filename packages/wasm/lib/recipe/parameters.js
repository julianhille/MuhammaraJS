/** Standard page sizes in PDF points. */
export var mediumSizes = {
  executive: [521.86, 756],
  folio: [612, 936],
  legal: [612, 1008],
  letter: [612, 792],
  ledger: [792, 1224],
  tabloid: [792, 1224],
  a0: [2383.94, 3370.39],
  a1: [1683.78, 2383.94],
  a2: [1190.55, 1683.78],
  a3: [841.89, 1190.55],
  a4: [595.28, 841.89],
  a5: [419.53, 595.28],
  a6: [297.64, 419.53],
  a7: [209.76, 297.64],
  a8: [147.4, 209.76],
  a9: [104.88, 147.4],
  a10: [73.7, 104.88],
  b0: [2834.65, 4008.19],
  b1: [2004.09, 2834.65],
  b2: [1417.32, 2004.09],
  b3: [1000.63, 1417.32],
  b4: [708.66, 1000.63],
  b5: [498.9, 708.66],
  b6: [354.33, 498.9],
  b7: [249.45, 354.33],
  b8: [175.75, 249.45],
  b9: [124.72, 175.75],
  b10: [87.87, 124.72],
  c0: [2599.37, 3676.54],
  c1: [1836.85, 2599.37],
  c2: [1298.27, 1836.85],
  c3: [918.43, 1298.27],
  c4: [649.13, 918.43],
  c5: [459.21, 649.13],
  c6: [323.15, 459.21],
  c7: [229.61, 323.15],
  c8: [161.57, 229.61],
  c9: [113.39, 161.57],
  c10: [79.37, 113.39],
  ra0: [2437.8, 3458.27],
  ra1: [1729.13, 2437.8],
  ra2: [1218.9, 1729.13],
  ra3: [864.57, 1218.9],
  ra4: [609.45, 864.57],
  sra0: [2551.18, 3628.35],
  sra1: [1814.17, 2551.18],
  sra2: [1275.59, 1814.17],
  sra3: [907.09, 1275.59],
  sra4: [637.8, 907.09],
};

/** Normalizes a Recipe PDF version to a supported native version number. */
export function recipeVersion(version) {
  if (typeof version === "number" && version >= 1 && version < 3) {
    version *= 10;
  }
  return Number.isInteger(version) &&
    ((version >= 10 && version <= 17) || version === 20)
    ? version
    : 17;
}

/** Initializes mutable state for a newly created Recipe instance. */
export function initializeRecipe(recipe, options) {
  recipe.options = options;
  recipe.default = {
    pageSize: mediumSizes.letter.slice(),
    pageMargin: { left: 72, right: 72, top: 72, bottom: 72 },
    mediumSizes,
  };
  recipe._pageHeight = 0;
  recipe._pageWidth = 0;
  recipe._margin = { ...recipe.default.pageMargin };
  recipe._cursor = { x: 0, y: 0 };
  recipe._pages = [];
  recipe._annotations = [];
  recipe._info = {};
  recipe._endedBytes = null;
  recipe._sourceMode = false;
  recipe._isNewPDF = true;
  recipe._editingPage = false;
  recipe._page = null;
  recipe._pageContext = null;
  recipe._activePageNumber = 0;
}
