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
export var ImageFit = Object.freeze({
  ALWAYS: "always",
  OVERFLOW: "overflow",
});

/** How `Tj()`, `Quote()`, `DoubleQuote()`, and `TJ()` encode string text. */
export var EEncoding = Object.freeze({
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
export var Colorspace = Object.freeze({
  RGB: "rgb",
  CMYK: "cmyk",
  GRAY: "gray",
  SEPARATION: "separation",
});

/** Paint operation that finishes a low-level drawing helper path. */
export var DrawingPathType = Object.freeze({
  STROKE: "stroke",
  FILL: "fill",
  CLIP: "clip",
});

/** How a Recipe text box handles text that does not fit its width. */
export var TextWrap = Object.freeze({
  AUTO: "auto",
  CLIP: "clip",
  TRIM: "trim",
  ELLIPSIS: "ellipsis",
});

/** Horizontal placement keyword for Recipe text and images. */
export var HorizontalAlign = Object.freeze({
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
});

/** Vertical placement keyword for Recipe text, images, and text boxes. */
export var VerticalAlign = Object.freeze({
  TOP: "top",
  CENTER: "center",
  BOTTOM: "bottom",
});

/** Horizontal alignment of the lines inside a Recipe text box. */
export var TextAlign = Object.freeze({
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
  JUSTIFY: "justify",
});

/** How Recipe triangle() traits define the triangle: sides, angles, or vertices. */
export var TriangleTrait = Object.freeze({
  SSS: "sss",
  SAS: "sas",
  ASA: "asa",
  VTX: "vtx",
});

/** Triangle point that Recipe triangle() places at its coordinates. */
export var TrianglePosition = Object.freeze({
  A: "a",
  B: "b",
  C: "c",
  CENTROID: "centroid",
  CIRCUMCENTER: "circumcenter",
  INCENTER: "incenter",
});

/** Arrow point that Recipe arrow() places at its coordinates. */
export var ArrowAt = Object.freeze({
  HEAD: "head",
  TAIL: "tail",
});

/** Named Recipe arrow head shapes; 0, 1, and 2 select the same shapes. */
export var ArrowType = Object.freeze({
  TRIANGLE: "triangle",
  DART: "dart",
  KITE: "kite",
});

/** Recipe path line cap: butt, round, or projecting square. */
export var LineCap = Object.freeze({
  BUTT: "butt",
  ROUND: "round",
  SQUARE: "square",
});

/** Recipe path line join: miter, round, or bevel. */
export var LineJoin = Object.freeze({
  MITER: "miter",
  ROUND: "round",
  BEVEL: "bevel",
});

/** Which Recipe table rows a `row` style applies to. */
export var TableRowNth = Object.freeze({
  EVEN: "even",
  ODD: "odd",
});

/** Orientation of a Recipe page, from its rotated width and height. */
export var PageLayout = Object.freeze({
  PORTRAIT: "portrait",
  LANDSCAPE: "landscape",
});

/** Output format of Recipe structure(); `{ json: true }` also selects JSON. */
export var StructureFormat = Object.freeze({
  STRING: "string",
  JSON: "json",
});

/** Recipe font style spellings; the one-letter forms are the registry keys. */
export var FontStyle = Object.freeze({
  REGULAR: "regular",
  BOLD: "bold",
  ITALIC: "italic",
  BOLD_ITALIC: "bold-italic",
});

/** Short FontStyle spellings, also the font registry keys; internal, not exported. */
export var FontStyleKey = Object.freeze({
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

/** Format of an image registered by name; internal, not exported. */
export var RegisteredImageFormat = Object.freeze({
  JPEG: "jpeg",
  PNG: "png",
  TIFF: "tiff",
});

/** PDF line cap styles for `J()`, with the native member names. */
export var LineCapStyle = Object.freeze({
  LINECAP_BUTT: 0,
  LINECAP_ROUND: 1,
  LINECAP_SQUARE: 2,
});

/** Tokens `endArray()` writes after an array, with the native member names. */
export var ETokenSeparator = Object.freeze({
  eTokenSeparatorSpace: 0,
  eTokenSeparatorEndLine: 1,
  eTokenSeparatorNone: 2,
});

/** Annotation flag names for Recipe annotation `flag`; letter case is ignored. */
export var AnnotFlag = Object.freeze({
  INVISIBLE: "invisible",
  HIDDEN: "hidden",
  PRINT: "print",
  NO_ZOOM: "nozoom",
  NO_ROTATE: "norotate",
  NO_VIEW: "noview",
  READ_ONLY: "readonly",
  LOCKED: "locked",
  TOGGLE_NO_VIEW: "togglenoview",
  LOCKED_CONTENTS: "lockedcontents",
});

/** Standard icon names for Recipe text annotations. */
export var AnnotIcon = Object.freeze({
  COMMENT: "Comment",
  KEY: "Key",
  NOTE: "Note",
  HELP: "Help",
  NEW_PARAGRAPH: "NewParagraph",
  PARAGRAPH: "Paragraph",
  INSERT: "Insert",
});

/**
 * Named page sizes for `createPage()`, matched case-insensitively; a "-size"
 * suffix is ignored.
 * @readonly
 * @enum {string}
 */
export var PageSize = Object.freeze({
  EXECUTIVE: "executive",
  FOLIO: "folio",
  LEGAL: "legal",
  LETTER: "letter",
  LEDGER: "ledger",
  TABLOID: "tabloid",
  A0: "a0",
  A1: "a1",
  A2: "a2",
  A3: "a3",
  A4: "a4",
  A5: "a5",
  A6: "a6",
  A7: "a7",
  A8: "a8",
  A9: "a9",
  A10: "a10",
  B0: "b0",
  B1: "b1",
  B2: "b2",
  B3: "b3",
  B4: "b4",
  B5: "b5",
  B6: "b6",
  B7: "b7",
  B8: "b8",
  B9: "b9",
  B10: "b10",
  C0: "c0",
  C1: "c1",
  C2: "c2",
  C3: "c3",
  C4: "c4",
  C5: "c5",
  C6: "c6",
  C7: "c7",
  C8: "c8",
  C9: "c9",
  C10: "c10",
  RA0: "ra0",
  RA1: "ra1",
  RA2: "ra2",
  RA3: "ra3",
  RA4: "ra4",
  SRA0: "sra0",
  SRA1: "sra1",
  SRA2: "sra2",
  SRA3: "sra3",
  SRA4: "sra4",
});

/**
 * User access permission names for `permission()` (ISO 32000-1, table 22).
 * @readonly
 * @enum {string}
 */
export var Permission = Object.freeze({
  PRINT: "print",
  MODIFY: "modify",
  COPY: "copy",
  EDIT: "edit",
  FILL_FORM: "fillform",
  EXTRACT: "extract",
  ASSEMBLE: "assemble",
  PRINT_BEST: "printbest",
});

/**
 * Named Recipe coordinates.
 * @readonly
 * @enum {string}
 */
export var Coordinate = Object.freeze({
  /** The horizontal or vertical center of the page. */
  CENTER: "center",
});

/**
 * Annotation subtypes (ISO 32000-1, 12.5.6).
 * @readonly
 * @enum {string}
 */
export var AnnotSubtype = Object.freeze({
  TEXT: "Text",
  LINK: "Link",
  FREE_TEXT: "FreeText",
  LINE: "Line",
  SQUARE: "Square",
  CIRCLE: "Circle",
  POLYGON: "Polygon",
  POLY_LINE: "PolyLine",
  HIGHLIGHT: "Highlight",
  UNDERLINE: "Underline",
  SQUIGGLY: "Squiggly",
  STRIKE_OUT: "StrikeOut",
  CARET: "Caret",
  STAMP: "Stamp",
  INK: "Ink",
  POPUP: "Popup",
  FILE_ATTACHMENT: "FileAttachment",
  SOUND: "Sound",
  MOVIE: "Movie",
  SCREEN: "Screen",
  WIDGET: "Widget",
  PRINTER_MARK: "PrinterMark",
  TRAP_NET: "TrapNet",
  WATERMARK: "Watermark",
  THREE_D: "3D",
  REDACT: "Redact",
  PROJECTION: "Projection",
  RICH_MEDIA: "RichMedia",
});

/**
 * Special `chroma()` names that run a command instead of naming a color.
 * @readonly
 * @enum {string}
 */
export var ChromaCommand = Object.freeze({
  /** Merge the color definitions from the JSON file given as the value. */
  LOAD: "!load",
});

/** File extensions for sniffed image and PDF bytes; internal, not exported. */
export var AssetExtension = Object.freeze({
  JPEG: "jpg",
  PNG: "png",
  TIFF: "tiff",
  PDF: "pdf",
});
