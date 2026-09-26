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

module.exports = {
  Permission,
  Coordinate,
  Colorspace,
  AnnotSubtype,
  AnnotFlag,
  AnnotIcon,
  ChromaCommand,
};
