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
