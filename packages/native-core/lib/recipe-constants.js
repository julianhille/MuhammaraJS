// Named values for Recipe string options. Recipe exposes each object as a
// static property, for example Recipe.AnnotSubtype.HIGHLIGHT; the plain
// strings stay accepted.

/**
 * Colorspaces accepted by the `colorspace` options of Recipe.
 * @readonly
 * @enum {string}
 */
var Colorspace = Object.freeze({
  RGB: "rgb",
  CMYK: "cmyk",
  GRAY: "gray",
  SEPARATION: "separation",
});

/**
 * Annotation subtypes (ISO 32000-1, 12.5.6).
 * @readonly
 * @enum {string}
 */
var AnnotSubtype = Object.freeze({
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
 * Annotation flag names (ISO 32000-1, 12.5.3). Matched case-insensitively.
 * @readonly
 * @enum {string}
 */
var AnnotFlag = Object.freeze({
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

/**
 * Text annotation icon names (ISO 32000-1, 12.5.6.4).
 * @readonly
 * @enum {string}
 */
var AnnotIcon = Object.freeze({
  COMMENT: "Comment",
  KEY: "Key",
  NOTE: "Note",
  HELP: "Help",
  NEW_PARAGRAPH: "NewParagraph",
  PARAGRAPH: "Paragraph",
  INSERT: "Insert",
});

/**
 * Special `chroma()` names that run a command instead of naming a color.
 * @readonly
 * @enum {string}
 */
var ChromaCommand = Object.freeze({
  /** Merge the color definitions from the JSON file given as the value. */
  LOAD: "!load",
});

/**
 * Named Recipe coordinates.
 * @readonly
 * @enum {string}
 */
var Coordinate = Object.freeze({
  /** The horizontal or vertical center of the page. */
  CENTER: "center",
});

/**
 * User access permission names for `permission()` (ISO 32000-1, table 22).
 * @readonly
 * @enum {string}
 */
var Permission = Object.freeze({
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
 * Font styles for `registerFont()`. The short forms r, b, i and bi are
 * accepted as aliases.
 * @readonly
 * @enum {string}
 */
var FontStyle = Object.freeze({
  REGULAR: "regular",
  BOLD: "bold",
  ITALIC: "italic",
  BOLD_ITALIC: "bold-italic",
});

/**
 * Horizontal alignments, used as the first word of the image `align` option.
 * @readonly
 * @enum {string}
 */
var HorizontalAlign = Object.freeze({
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
});

/**
 * Vertical alignments, used as the second word of the image `align` option.
 * @readonly
 * @enum {string}
 */
var VerticalAlign = Object.freeze({
  TOP: "top",
  CENTER: "center",
  BOTTOM: "bottom",
});

/**
 * Page orientations reported in page metadata.
 * @readonly
 * @enum {string}
 */
var PageLayout = Object.freeze({
  PORTRAIT: "portrait",
  LANDSCAPE: "landscape",
});

/**
 * Named page sizes for `createPage()`, matched case-insensitively; a "-size"
 * suffix is ignored.
 * @readonly
 * @enum {string}
 */
var PageSize = Object.freeze({
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
 * How `triangle()` traits define the triangle. Matched case-insensitively.
 * @readonly
 * @enum {string}
 */
var TriangleTrait = Object.freeze({
  /** Three side lengths. */
  SSS: "sss",
  /** Side, included angle, side: [sideA, angle C, sideB]. */
  SAS: "sas",
  /** Angle, side, angle: [angle B, sideC, angle A]. */
  ASA: "asa",
  /** Three vertex points [x, y]. */
  VTX: "vtx",
});

/**
 * The point of a triangle placed at the `triangle()` coordinates. Matched
 * case-insensitively.
 * @readonly
 * @enum {string}
 */
var TrianglePosition = Object.freeze({
  A: "a",
  B: "b",
  C: "c",
  CENTROID: "centroid",
  CIRCUMCENTER: "circumcenter",
  INCENTER: "incenter",
});

/**
 * The arrow point placed at the `arrow()` coordinates; the center when omitted.
 * @readonly
 * @enum {string}
 */
var ArrowAt = Object.freeze({
  HEAD: "head",
  TAIL: "tail",
});

/**
 * Arrow head shapes for the `arrow()` type option. The numbers 0, 1 and 2
 * are accepted as aliases.
 * @readonly
 * @enum {string}
 */
var ArrowType = Object.freeze({
  TRIANGLE: "triangle",
  DART: "dart",
  KITE: "kite",
});

/**
 * Line cap styles for the `lineCap` options.
 * @readonly
 * @enum {string}
 */
var LineCap = Object.freeze({
  BUTT: "butt",
  ROUND: "round",
  SQUARE: "square",
});

/**
 * Line join styles for the `lineJoin` options.
 * @readonly
 * @enum {string}
 */
var LineJoin = Object.freeze({
  MITER: "miter",
  ROUND: "round",
  BEVEL: "bevel",
});

/**
 * Which table rows the `row` options apply to; all rows when omitted.
 * @readonly
 * @enum {string}
 */
var TableRowNth = Object.freeze({
  EVEN: "even",
  ODD: "odd",
});

/**
 * How text that does not fit a text-box line is handled. `true` is accepted
 * for AUTO and `false` for ELLIPSIS.
 * @readonly
 * @enum {string}
 */
var TextWrap = Object.freeze({
  /** Wrap onto the next line. */
  AUTO: "auto",
  /** Cut the line at the box edge. */
  CLIP: "clip",
  /** Drop the words that do not fit. */
  TRIM: "trim",
  /** Replace the text that does not fit with "...". */
  ELLIPSIS: "ellipsis",
});

/**
 * Horizontal alignments of text inside a text box, the first word of the
 * `textAlign` option.
 * @readonly
 * @enum {string}
 */
var TextAlign = Object.freeze({
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
  JUSTIFY: "justify",
});

module.exports = {
  TextWrap,
  TextAlign,
  TableRowNth,
  LineCap,
  LineJoin,
  ArrowAt,
  ArrowType,
  TriangleTrait,
  TrianglePosition,
  PageLayout,
  PageSize,
  HorizontalAlign,
  VerticalAlign,
  FontStyle,
  Permission,
  Coordinate,
  Colorspace,
  AnnotSubtype,
  AnnotFlag,
  AnnotIcon,
  ChromaCommand,
};
