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
