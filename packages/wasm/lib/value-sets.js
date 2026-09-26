/**
 * Finite string values accepted by public options. Compare against these
 * instead of repeating the literals; index.d.ts declares the matching types.
 */

/** Device color spaces for drawing and Recipe color options. */
export var DeviceColorSpace = Object.freeze({
  RGB: "rgb",
  GRAY: "gray",
  CMYK: "cmyk",
});

/** How `drawImage()` fits an image into its bounding box. */
export var ImageFitPolicy = Object.freeze({
  ALWAYS: "always",
  OVERFLOW: "overflow",
});

/** How `Tj()`, `Quote()`, `DoubleQuote()`, and `TJ()` encode string text. */
export var TextEncoding = Object.freeze({
  TEXT: "text",
  CODE: "code",
  HEX: "hex",
});

/** Page box names for `PDFPage` box properties and `PDFReader#getPageBox()`. */
export var PageBox = Object.freeze({
  MEDIA: "media",
  CROP: "crop",
  BLEED: "bleed",
  TRIM: "trim",
  ART: "art",
});

/**
 * Recipe color spaces: the device color spaces plus Separation, which the
 * Wasm Recipe recognizes only to reject it.
 */
export var RecipeColorSpace = Object.freeze({
  ...DeviceColorSpace,
  SEPARATION: "separation",
});

/** Paint operation that finishes a low-level drawing helper path. */
export var DrawingPathType = Object.freeze({
  STROKE: "stroke",
  FILL: "fill",
  CLIP: "clip",
});

/** How a Recipe text box handles text that does not fit its width. */
export var RecipeTextWrap = Object.freeze({
  AUTO: "auto",
  CLIP: "clip",
  TRIM: "trim",
  ELLIPSIS: "ellipsis",
});

/** Horizontal placement keyword for Recipe text and images. */
export var RecipeHorizontalAlignment = Object.freeze({
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
});

/** Vertical placement keyword for Recipe text, images, and text boxes. */
export var RecipeVerticalAlignment = Object.freeze({
  TOP: "top",
  CENTER: "center",
  BOTTOM: "bottom",
});

/** Horizontal alignment of the lines inside a Recipe text box. */
export var RecipeTextAlignment = Object.freeze({
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
  JUSTIFY: "justify",
});

/** How Recipe triangle() traits define the triangle: sides, angles, or vertices. */
export var RecipeTriangleTrait = Object.freeze({
  SSS: "sss",
  SAS: "sas",
  ASA: "asa",
  VTX: "vtx",
});

/** Triangle point that Recipe triangle() places at its coordinates. */
export var RecipeTrianglePosition = Object.freeze({
  A: "a",
  B: "b",
  C: "c",
  CENTROID: "centroid",
  CIRCUMCENTER: "circumcenter",
  INCENTER: "incenter",
});

/** Arrow point that Recipe arrow() places at its coordinates. */
export var RecipeArrowAnchor = Object.freeze({
  HEAD: "head",
  TAIL: "tail",
});

/** Named Recipe arrow head shapes; 0, 1, and 2 select the same shapes. */
export var RecipeArrowType = Object.freeze({
  TRIANGLE: "triangle",
  DART: "dart",
  KITE: "kite",
});

/** Recipe path line cap: butt, round, or projecting square. */
export var RecipeLineCap = Object.freeze({
  BUTT: "butt",
  ROUND: "round",
  SQUARE: "square",
});

/** Recipe path line join: miter, round, or bevel. */
export var RecipeLineJoin = Object.freeze({
  MITER: "miter",
  ROUND: "round",
  BEVEL: "bevel",
});

/** Which Recipe table rows a `row` style applies to. */
export var RecipeTableRowParity = Object.freeze({
  EVEN: "even",
  ODD: "odd",
});

/** Orientation of a Recipe page, from its rotated width and height. */
export var RecipePageLayout = Object.freeze({
  PORTRAIT: "portrait",
  LANDSCAPE: "landscape",
});

/** Output format of Recipe structure(); `{ json: true }` also selects JSON. */
export var RecipeStructureFormat = Object.freeze({
  STRING: "string",
  JSON: "json",
});

/** Recipe font style spellings; the one-letter forms are the registry keys. */
export var RecipeFontStyle = Object.freeze({
  REGULAR: "regular",
  BOLD: "bold",
  ITALIC: "italic",
  BOLD_ITALIC: "bold-italic",
  R: "r",
  B: "b",
  I: "i",
  BI: "bi",
});

/** Where `replaceObject()` replaces references: `global` means every page. */
export var ObjectReplacementScope = Object.freeze({
  GLOBAL: "global",
});

/** Image or document format reported by `getImageType()`. */
export var PDFImageType = Object.freeze({
  PDF: "PDF",
  JPG: "JPG",
  TIFF: "TIFF",
  PNG: "PNG",
});
