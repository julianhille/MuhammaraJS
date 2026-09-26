/** Browser-only, byte-first WebAssembly API. It intentionally excludes Node paths and streams. */
export interface BlobLike {
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
  slice(start?: number, end?: number, contentType?: string): BlobLike;
}
export type ByteSource = Uint8Array | ArrayBuffer | PDFRStreamForBuffer;
export type AsyncByteSource = ByteSource | BlobLike;
export type PDFRectangle = [
  lowerLeftX: number,
  lowerLeftY: number,
  upperRightX: number,
  upperRightY: number,
];
export type PDFMatrix = [number, number, number, number, number, number];
/** Glyph entries shown without text encoding: `[glyphId, unicodeCodePoint]` pairs. */
export type Glyph = Array<[number, number]>;
/** How text-showing operators encode string text: the `EEncoding` values. */
export type EEncoding = "text" | "code" | "hex";
export declare const EEncoding: {
  readonly TEXT: "text";
  readonly CODE: "code";
  readonly HEX: "hex";
};
/** @deprecated Use `EEncoding`, the native name. */
export type TextEncoding = EEncoding;
export type PageBox = "media" | "crop" | "bleed" | "trim" | "art";
export declare const PageBox: {
  readonly MEDIA: "media";
  readonly CROP: "crop";
  readonly BLEED: "bleed";
  readonly TRIM: "trim";
  readonly ART: "art";
};
export type PDFPageBoxType = 0 | 1 | 2 | 3 | 4;
export type PDFVersion = 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 20;
export type RecryptPDFVersion = 0 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;
export type RecipePDFVersion =
  | 1
  | 1.1
  | 1.2
  | 1.3
  | 1.4
  | 1.5
  | 1.6
  | 1.7
  | 2
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 20;

export interface WriterOptions {
  version?: PDFVersion;
  /** Enables Flate compression for streams. Defaults to true. */
  compress?: boolean;
}
/** Options accepted by the byte-first equivalent of native `recrypt`. */
export interface PDFRecryptOptions {
  password?: string;
  /** PDF 1.0 through 1.7 encryption version. PDF 2.0/AES-256 is unavailable. */
  version?: RecryptPDFVersion;
  /** Enables Flate compression for streams. Defaults to true. */
  compress?: boolean;
  /** Unsupported filesystem logging option. */
  log?: string;
  userPassword?: string;
  ownerPassword?: string;
  userProtectionFlag?: number;
}
export type RecipeFontStyle =
  "regular" | "bold" | "italic" | "bold-italic" | "r" | "b" | "i" | "bi";
export type RecipeCoordinate = number | "center";
export type RecipePosition = [number, number];
/** Device color space of a drawing or Recipe color option. */
export type DeviceColorSpace = "rgb" | "gray" | "cmyk";
export declare const DeviceColorSpace: {
  readonly RGB: "rgb";
  readonly GRAY: "gray";
  readonly CMYK: "cmyk";
};
/** Device color spaces Recipe draws with in WebAssembly. */
export type RecipeDeviceColorSpace = DeviceColorSpace;
/** How `drawImage()` fits an image: always scale, or only shrink when it overflows. */
export type ImageFit = "always" | "overflow";
export declare const ImageFit: {
  readonly ALWAYS: "always";
  readonly OVERFLOW: "overflow";
};
/**
 * Every Recipe color space, including Separation. WebAssembly Recipe keeps
 * Separation entries in `knownColors` but throws when asked to draw with them.
 */
export type RecipeColorSpace = RecipeDeviceColorSpace | "separation";
export type RecipePermissionName =
  | "print"
  | "modify"
  | "copy"
  | "edit"
  | "fillform"
  | "extract"
  | "assemble"
  | "printbest";
/** Known permission names with string compatibility for composed flag lists. */
export type RecipePermission = RecipePermissionName | (string & {});
export interface RecipeMargins {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}
export interface RecipeOptions {
  /** PDF version; canonical decimal levels 1.0 through 1.7 and 2.0, and integer enums 10 through 17 and 20, are accepted. */
  version?: RecipePDFVersion;
  /** Enables stream compression. Defaults to true. */
  compress?: boolean;
  author?: string;
  title?: string;
  subject?: string;
  keywords?: string | string[];
  colorspace?: RecipeDeviceColorSpace;
  password?: string;
  ownerPassword?: string;
  userPassword?: string;
  userProtectionFlag?: number;
}
export interface RecipeEncryptOptions {
  [key: string]: unknown;
  password?: string;
  ownerPassword?: string;
  userPassword?: string;
  userProtectionFlag?: number;
}
export type RecipeColor = string | number[];
export type RecipeKnownColors = Record<
  RecipeColorSpace,
  Record<string, string>
>;
/** A Recipe extension method; `this` is the Recipe it is called on. */
export type RecipeExtension<
  Arguments extends unknown[] = never[],
  Result = unknown,
> = (this: Recipe, ...args: Arguments) => Result;
/** Recipe path line cap: butt, round, or projecting square. */
export type RecipeLineCap = "butt" | "round" | "square";
/** Recipe path line join: miter, round, or bevel. */
export type RecipeLineJoin = "miter" | "round" | "bevel";
export interface RecipePathOptions {
  /** Make the rendered path's bounding rectangle open this URL. */
  link?: string;
  color?: RecipeColor;
  colour?: RecipeColor;
  stroke?: RecipeColor;
  fill?: RecipeColor;
  colorspace?: RecipeDeviceColorSpace;
  colorName?: string;
  width?: number;
  lineWidth?: number;
  opacity?: number;
  dash?: number[];
  dashPhase?: number;
  lineCap?: RecipeLineCap;
  lineJoin?: RecipeLineJoin;
  miterLimit?: number;
  rotation?: number;
  rotationOrigin?: [number, number];
  skewX?: number;
  skewY?: number;
  /** Use native PDF bottom-left coordinates for this path. */
  useGivenCoords?: boolean;
  /** Draw shape-specific diagnostic geometry. */
  debug?: boolean | number;
}
export interface RecipeImageOptions extends RecipePathOptions {
  width?: number;
  height?: number;
  scale?: number;
  keepAspectRatio?: boolean;
  align?: RecipeImageAlign;
  index?: number;
}
export interface RecipeRectangleOptions extends RecipePathOptions {
  borderRadius?:
    | number
    | [number]
    | [number, number]
    | [number, number, number]
    | [number, number, number, number];
}
export interface RecipeArcOptions extends RecipePathOptions {
  sector?: boolean;
}
export interface RecipeNGonOptions extends RecipePathOptions {
  rotationVertice?: number;
}
export type RecipeArrowType = 0 | 1 | 2 | "triangle" | "dart" | "kite";
export type RecipeArrowAnchor = "head" | "tail";
export interface RecipeArrowOptions extends RecipePathOptions {
  head?:
    | number
    | readonly [number]
    | readonly [number, number]
    | readonly [number, number, number];
  shaft?: number | readonly [number] | readonly [number, number];
  double?: boolean;
  type?: RecipeArrowType;
  at?: RecipeArrowAnchor;
}
/**
 * Matches known runtime values in lower case, UPPER CASE, and Capitalized
 * form. The runtime lowercases the whole value, so any casing works there.
 */
export type RecipeCaseInsensitive<Value extends string> =
  Lowercase<Value> | Uppercase<Value> | Capitalize<Lowercase<Value>>;
export type RecipeTriangleTrait = RecipeCaseInsensitive<
  "sss" | "sas" | "asa" | "vtx"
>;
export type RecipeTriangleMeasurementTrait = RecipeCaseInsensitive<
  "sss" | "sas" | "asa"
>;
export type RecipeTriangleVertexTrait = RecipeCaseInsensitive<"vtx">;
export type RecipeTrianglePosition = RecipeCaseInsensitive<
  "a" | "b" | "c" | "centroid" | "circumcenter" | "incenter"
>;
/** Three sides, or sides and angles in degrees, selected by the trait. */
export type RecipeTriangleMeasurements = readonly [number, number, number];
export type RecipeTriangleVertices = readonly [
  readonly [number, number],
  readonly [number, number],
  readonly [number, number],
];
export type RecipeMutableTriangleVertices = [
  [number, number],
  [number, number],
  [number, number],
];
export interface RecipeTriangleBaseOptions extends RecipePathOptions {
  position?: RecipeTrianglePosition;
  flipX?: boolean;
  flipY?: boolean;
}
export type RecipeTriangleMeasurementOptions = RecipeTriangleBaseOptions &
  (
    | {
        traitID: RecipeTriangleMeasurementTrait;
        traitsID?: RecipeTriangleTrait;
      }
    | { traitID?: undefined; traitsID?: RecipeTriangleMeasurementTrait }
  );
export type RecipeTriangleVertexIdentifier =
  | { traitID: RecipeTriangleVertexTrait; traitsID?: RecipeTriangleTrait }
  | { traitID?: undefined; traitsID: RecipeTriangleVertexTrait };
export type RecipeTriangleVertexOptions = RecipeTriangleBaseOptions &
  RecipeTriangleVertexIdentifier;
/** Vertex options for readonly vertices, which cannot be repositioned or flipped. */
export type RecipeTriangleUnpositionedVertexOptions = Omit<
  RecipeTriangleBaseOptions,
  "position" | "flipX" | "flipY"
> & {
  position?: undefined;
  flipX?: false;
  flipY?: false;
} & RecipeTriangleVertexIdentifier;
export type RecipeTriangleOptions =
  RecipeTriangleMeasurementOptions | RecipeTriangleVertexOptions;
export interface RecipeLineStyleOptions {
  width?: number;
  lineWidth?: number;
  cap?: number;
  join?: number;
  miterLimit?: number;
  dash?: number[];
  dashPhase?: number;
}
/** Annotation flag name for Recipe annotation `flag`; letter case is ignored. */
export type RecipeAnnotationFlag =
  | "invisible"
  | "hidden"
  | "print"
  | "nozoom"
  | "norotate"
  | "noview"
  | "readonly"
  | "locked"
  | "togglenoview"
  | "lockedcontents";
/** Standard icon name for Recipe text annotations. */
export type RecipeAnnotationIcon =
  "Comment" | "Key" | "Note" | "Help" | "NewParagraph" | "Paragraph" | "Insert";
/** Annotation subtype for `annot()`; known subtypes match case-insensitively. */
export type RecipeAnnotationSubtype =
  | "Text"
  | "Link"
  | "FreeText"
  | "Line"
  | "Square"
  | "Circle"
  | "Polygon"
  | "PolyLine"
  | "Highlight"
  | "Underline"
  | "Squiggly"
  | "StrikeOut"
  | "Caret"
  | "Stamp"
  | "Ink"
  | "Popup"
  | "FileAttachment"
  | "Sound"
  | "Movie"
  | "Screen"
  | "Widget"
  | "PrinterMark"
  | "TrapNet"
  | "Watermark"
  | "3D"
  | "Redact"
  | "Projection"
  | "RichMedia";
export interface RecipeAnnotationOptions {
  text?: string;
  contents?: string;
  title?: string;
  subject?: string;
  date?: string | Date;
  icon?: RecipeAnnotationIcon;
  name?: string;
  color?: RecipeColor;
  border?: number | { width?: number; dash?: number[] };
  borderWidth?: number;
  borderDash?: number[];
  quadPoints?: number[];
  flag?: RecipeAnnotationFlag | number;
  flags?: number;
  open?: boolean;
  opacity?: number;
  richText?: boolean;
  /** Replies inherit parent metadata; opacity defaults to 1 and richText to false independently. */
  replies?: RecipeAnnotationOptions[];
  followOriginalPageRotation?: boolean;
  width?: number;
  height?: number;
}
export interface RecipeOverlayOptions {
  page?: number;
  scale?: number;
  keepAspectRatio?: boolean;
  fitWidth?: boolean;
  fitHeight?: boolean;
}
/** Horizontal placement keyword for Recipe text and images. */
export type RecipeHorizontalAlignment = "left" | "center" | "right";
/** Vertical placement keyword for Recipe text, images, and text boxes. */
export type RecipeVerticalAlignment = "top" | "center" | "bottom";
/** Horizontal alignment of the lines inside a Recipe text box. */
export type RecipeTextAlignment = RecipeHorizontalAlignment | "justify";
/** How a Recipe text box handles text that does not fit its width. */
/** Named page size for `createPage()`, case-insensitive; other names use the default size. */
export type RecipePageSize =
  | "executive"
  | "folio"
  | "legal"
  | "letter"
  | "ledger"
  | "tabloid"
  | "a0"
  | "a1"
  | "a2"
  | "a3"
  | "a4"
  | "a5"
  | "a6"
  | "a7"
  | "a8"
  | "a9"
  | "a10"
  | "b0"
  | "b1"
  | "b2"
  | "b3"
  | "b4"
  | "b5"
  | "b6"
  | "b7"
  | "b8"
  | "b9"
  | "b10"
  | "c0"
  | "c1"
  | "c2"
  | "c3"
  | "c4"
  | "c5"
  | "c6"
  | "c7"
  | "c8"
  | "c9"
  | "c10"
  | "ra0"
  | "ra1"
  | "ra2"
  | "ra3"
  | "ra4"
  | "sra0"
  | "sra1"
  | "sra2"
  | "sra3"
  | "sra4"
  | (string & {});
/** Text-box alignment: a `Recipe.TextAlign` value, optionally followed by a space and a `Recipe.VerticalAlign` value. */
export type RecipeTextBoxAlign =
  RecipeTextAlignment | `${RecipeTextAlignment} ${RecipeVerticalAlignment}`;
/** Image and text alignment: a `Recipe.HorizontalAlign` value, optionally followed by a `Recipe.VerticalAlign` value. */
export type RecipeImageAlign =
  | RecipeHorizontalAlignment
  | `${RecipeHorizontalAlignment} ${RecipeVerticalAlignment}`;
export type RecipeTextWrap = "auto" | "clip" | "trim" | "ellipsis";
export interface RecipeTextBox {
  width?: number;
  height?: number;
  minHeight?: number;
  padding?: number | [number, number?, number?, number?];
  lineHeight?: number;
  /** `clip` retains and clips the source, `trim` omits its non-fitting suffix, and `ellipsis` replaces it with `...`. */
  wrap?: boolean | RecipeTextWrap;
  textAlign?: RecipeTextBoxAlign;
  /** Render only complete lines that fit within this fixed-height text box. */
  clipIfExceedsBox?: boolean;
  /** Called after clipping leaves source text unrendered. */
  onClip?: (recipe: Recipe, result: RecipeTextBoxClipResult) => void;
  style?: RecipePathOptions & { borderRadius?: number | number[] };
}
export interface RecipeTextBoxClipResult {
  remainder: string;
  linesWritten: number;
  clipped: true;
  bounds: { x: number; y: number; width: number; height: number };
}
/** Text-markup annotation options for `highlight`, `underline`, `strikeOut`, and `squiggly`, as in native Recipe. */
export interface RecipeTextMarkupOptions extends Pick<
  RecipeAnnotationOptions,
  "opacity" | "replies"
> {
  /** Annotation contents. */
  text?: string;
  /** Annotation color; defaults to yellow for highlight, red for strikeOut, and green otherwise. */
  color?: RecipeColor;
}
export interface RecipeTextOptions
  extends
    RecipePathOptions,
    Pick<
      RecipeAnnotationOptions,
      "title" | "open" | "richText" | "flag" | "icon" | "date" | "subject"
    > {
  /** Text fill color: `#gg`, `#rrggbb`, `#ccmmyykk`, `%r,g,b` percentages, a 0-255 component array, or a name registered with `chroma()`. Missing or unknown colors use `#1777d1`. */
  color?: RecipeColor;
  /** Font family; uses createRecipe's default font when omitted (bundled Roboto unless configured). */
  font?: string;
  /** Font size in points for text() and textDimensions(); defaults to 14 when both fontSize and size are omitted. A size that is not greater than zero throws RangeError. */
  fontSize?: number;
  /** Alternative font size in points; defaults to 14 when both size and fontSize are omitted. A size that is not greater than zero throws RangeError. */
  size?: number;
  bold?: boolean;
  italic?: boolean;
  charSpace?: number;
  html?: boolean;
  flow?: boolean;
  align?: RecipeImageAlign;
  layout?: string | number;
  /** Adds a Highlight annotation over each drawn run. */
  highlight?: boolean | RecipeTextMarkupOptions;
  /** Visual text background, distinct from the Highlight annotation option. */
  hilite?: boolean | RecipePathOptions;
  /** Adds an Underline annotation; HTML `<u>` draws a line instead. */
  underline?: boolean | RecipeTextMarkupOptions;
  /** Adds a StrikeOut annotation; HTML `<del>`, `<s>`, and `<strike>` draw a line instead. */
  strikeOut?: boolean | RecipeTextMarkupOptions;
  /** Adds a Squiggly annotation. */
  squiggly?: boolean | RecipeTextMarkupOptions;
  textBox?: RecipeTextBox;
  cell?: RecipeTextBox;
  overflow?: (
    recipe: Recipe,
  ) =>
    | boolean
    | { column?: number | [number, number]; layout?: string | number }
    | void;
}
/** Per-annotation options for `highlight`, `underline`, `strikeOut`, and `squiggly`. */
export interface RecipeTextMarkupOptions extends Pick<
  RecipeAnnotationOptions,
  "opacity" | "replies"
> {
  /** Annotation contents. */
  text?: string;
  /** Annotation color; defaults to yellow for Highlight, red for StrikeOut, and green otherwise. */
  color?: RecipeColor;
}
export interface RecipeHtmlTextObject {
  value: string;
  styles: Partial<RecipeTextOptions>;
  /** Leading-space count for the lines of this flat visual fragment; `0` ends list indentation. */
  indent?: number;
}
/** Record field names a table column can name, including numeric keys as strings. */
export type RecipeTableField<RecordType extends object> =
  RecordType extends unknown
    ? RecordType extends readonly unknown[]
      ? number extends RecordType["length"]
        ? `${number}`
        : Extract<keyof RecordType, `${number}`>
      : | Extract<keyof RecordType, string>
        | `${Extract<keyof RecordType, number>}`
    : never;
export type RecipeTableColumnField<RecordType extends object> = Exclude<
  RecipeTableField<RecordType>,
  ""
>;
export type RecipeTableFieldValue<
  RecordType extends object,
  Field extends RecipeTableField<RecordType>,
> = RecordType extends unknown
  ? Field extends keyof RecordType
    ? RecordType[Field]
    : Field extends `${infer NumericField extends number}`
      ? NumericField extends keyof RecordType
        ? RecordType[NumericField]
        : undefined
      : undefined
  : never;
/** Table column options. `cell` is the column's only body text box, as in native Recipe. */
export interface RecipeTableColumn<
  RecordType extends object = RecipeTableRow,
  Field extends RecipeTableColumnField<RecordType> =
    RecipeTableColumnField<RecordType>,
> extends Omit<RecipeTextOptions, "font" | "textBox"> {
  name: Field;
  font?: string;
  text?: string;
  width?: number;
  /** Cell text-box options, including onClip callbacks preserved during table layout. */
  cell?: RecipeTextBox;
  /** Header text styles, independent of body styles; booleans use the default header style. Table-level header options take precedence. */
  header?: boolean | RecipeTextOptions;
  /** Final header text-box overrides, applied after header styles and alignToData. */
  hcell?: RecipeTextBox;
  /** Returns cell text options, or a falsy value to keep the defaults. */
  renderer?: (
    this: void,
    /** The own cell value; missing, inherited, and nullish values arrive as `""`. */
    text: undefined extends RecipeTableFieldValue<RecordType, Field>
      ? Exclude<RecipeTableFieldValue<RecordType, Field>, null | undefined> | ""
      : null extends RecipeTableFieldValue<RecordType, Field>
        ? | Exclude<RecipeTableFieldValue<RecordType, Field>, null | undefined>
          | ""
        : RecipeTableFieldValue<RecordType, Field>,
    record: RecordType,
    field: Field,
    row: number,
  ) => RecipeTextOptions | false | null | "" | 0 | void;
}
/**
 * One column definition per record field, so each `renderer` receives the
 * value type of its own `name` rather than the union of every field's type.
 */
export type RecipeTableColumnOptions<
  RecordType extends object = RecipeTableRow,
> = {
  [Field in RecipeTableColumnField<RecordType>]: RecipeTableColumn<
    RecordType,
    Field
  >;
}[RecipeTableColumnField<RecordType>];
export type RecipeTableRow = Record<string, unknown>;
/** Table options. Like native Recipe, a table-level `cell` is not accepted; style cells per column or row. */
/** Which Recipe table rows a `row` style applies to. */
export type RecipeTableRowParity = "even" | "odd";
export interface RecipeTableOptions<
  RecordType extends object = RecipeTableRow,
> extends Omit<RecipeTextOptions, "overflow" | "cell"> {
  /** Per-segment height, bounded by the page bottom margin. Measurements include padding and minimum/fixed cell heights. */
  height?: number;
  /** Comma-separated names are trimmed; array entries preserve exact keys. */
  order?:
    | string
    | RecipeTableField<RecordType>[]
    | readonly [
        RecipeTableField<RecordType>,
        ...RecipeTableField<RecordType>[],
      ];
  columns?: readonly RecipeTableColumnOptions<RecordType>[];
  /** Enables headers and overrides column header styles; body text styles are not inherited. */
  header?:
    | boolean
    | (RecipeTextOptions & { alignToData?: boolean; cell?: RecipeTextBox });
  border?: boolean | RecipePathOptions;
  row?: RecipeTextOptions & {
    nth?: RecipeTableRowParity;
    cell?: RecipeTextBox;
  };
  /** Called once per overflow. A continuing destination must fit the row and repeated header or table() throws RangeError; ending the page without starting another throws Error. */
  overflow?: (
    this: Recipe,
    recipe: Recipe,
    row: number,
  ) => boolean | { position?: readonly [number, number] } | void;
}
export interface RecipeLayoutOptions {
  /** Number of equal-width columns to divide the layout width into. */
  columns?: number;
  /** Space between columns in points. Defaults to 18. */
  gap?: number;
  reset?: boolean;
}
export type RecipePageSelection = number | (number | [number, number])[];
export interface RecipeSplitResult {
  name: string;
  bytes: Uint8Array;
}
export interface RecipeStructure {
  pages: number;
  encrypted: boolean;
  objects: number;
}
export type RecipeStructureFormat = "string" | "json" | { json?: boolean };
export interface RemoveTextOptions {
  /** Also remove text from the Form XObjects the page paints, including nested forms. Defaults to `false`. */
  forms?: boolean;
}
/** Orientation of a Recipe page, from its rotated width and height. */
export type RecipePageLayout = "portrait" | "landscape";
export interface RecipePageInfo {
  pageNumber: number;
  mediaBox: PDFRectangle;
  rotate: number;
  /** Recipe-coordinate width, with MediaBox axes swapped for 90/270-degree rotation. */
  width: number;
  /** Recipe-coordinate height, with MediaBox axes swapped for 90/270-degree rotation. */
  height: number;
  layout: RecipePageLayout;
  size: [number, number];
  offsetX: number;
  offsetY: number;
}
export interface RecipeMetadata {
  pages: number;
  [page: number]: RecipePageInfo;
}
export interface RecipePdfInspection {
  pages: number;
  level: number;
  encrypted: boolean;
  [page: number]: RecipePageInfo;
}
export interface Recipe {
  readonly options: RecipeOptions;
  readonly default: {
    pageSize: [number, number];
    pageMargin: Required<RecipeMargins>;
    mediumSizes: Record<string, [number, number]>;
  };
  /** The last moveTo or lineTo path position in Recipe coordinates. */
  readonly position: { x: number; y: number };
  /** A per-Recipe copy of the built-in named device colors. */
  readonly knownColors: RecipeKnownColors;
  register<Arguments extends unknown[], Result>(
    key: string,
    callback: RecipeExtension<Arguments, Result>,
  ): this;
  /** Registers a named function under its `name`. */
  register<Arguments extends unknown[], Result>(
    callback: RecipeExtension<Arguments, Result>,
  ): this;
  registerFont(name: string, bytes: ByteSource, type?: RecipeFontStyle): this;
  registerFontAsync(
    name: string,
    bytes: AsyncByteSource,
    type?: RecipeFontStyle,
  ): Promise<this>;
  htmlToTextObjects(
    html: string,
    options?: Partial<RecipeTextOptions>,
  ): RecipeHtmlTextObject[];
  createPage(width?: number, height?: number, margins?: RecipeMargins): this;
  createPage(
    size: RecipePageSize,
    rotation?: number,
    margins?: RecipeMargins,
  ): this;
  endPage(): this;
  margins(): Required<RecipeMargins>;
  margins(margins: RecipeMargins): this;
  margins(left?: number, right?: number, top?: number, bottom?: number): this;
  pageInfo(pageNumber: number): RecipePageInfo | null;
  /** Returns document Info metadata, matching the Node Recipe API. */
  getPageInfo(): Record<string, unknown> | InfoDictionary;
  /** Returns geometry for the current Recipe page. */
  getCurrentPageInfo(): RecipePageInfo | null;
  /** Inspects PDF metadata without changing this Recipe's output state. Blob/File input requires readAsync. */
  read(source: ByteSource): RecipeMetadata;
  readAsync(source: AsyncByteSource): Promise<RecipeMetadata>;
  /** Starts a prepend-safe editing context for an existing one-based page number. */
  editPage(pageNumber: number): this;
  /** Replaces literal `(...) Tj` operands in an existing page's single content stream. */
  replaceText(text: string, replacement: string, pageNumber: number): this;
  /** Removes shown text from an existing page's content streams, and optionally its Form XObjects. */
  removeText(pageNumber: number, options?: RemoveTextOptions): this;
  deletePage(pageNumbers: number | number[]): this;
  pauseContext(): this;
  resumeContext(): this;
  setPageBox(
    box: PDFPageBoxType,
    left: number,
    bottom: number,
    right: number,
    top: number,
  ): this;
  rotate(rotation: number): this;
  rotateContent(degrees: number, x?: number, y?: number): this;
  chroma(
    name: string,
    value: RecipeColor,
    colorspace?: RecipeDeviceColorSpace | "",
  ): this;
  line(coordinates: [number, number][], options?: RecipePathOptions): this;
  line(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options?: RecipePathOptions,
  ): this;
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number, options?: RecipePathOptions): this;
  polygon(coordinates: [number, number][], options?: RecipePathOptions): this;
  rectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    options?: RecipeRectangleOptions,
  ): this;
  circle(
    x: number,
    y: number,
    radius: number,
    options?: RecipePathOptions,
  ): this;
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    options?: RecipePathOptions,
  ): this;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle?: number,
    endAngle?: number,
    options?: RecipeArcOptions,
  ): this;
  pie(
    x: number,
    y: number,
    radius: number,
    startAngle?: number,
    endAngle?: number,
    options?: RecipePathOptions,
  ): this;
  n_gon(
    cx: number,
    cy: number,
    radius: number,
    options?: RecipeNGonOptions,
  ): this;
  n_gon(
    cx: number,
    cy: number,
    radius: number,
    sides?: number,
    options?: RecipeNGonOptions,
  ): this;
  star(
    cx: number,
    cy: number,
    radius: number,
    options?: RecipePathOptions,
  ): this;
  star(
    cx: number,
    cy: number,
    radius: number,
    points?: number,
    options?: RecipePathOptions,
  ): this;
  arrow(x: number, y: number, options?: RecipeArrowOptions): this;
  triangle(
    x: number,
    y: number,
    traits: RecipeTriangleMeasurements,
    options?: RecipeTriangleMeasurementOptions,
  ): this;
  triangle(
    x: number,
    y: number,
    traits: RecipeTriangleVertices,
    options: RecipeTriangleUnpositionedVertexOptions,
  ): this;
  triangle(
    x: number,
    y: number,
    traits: RecipeMutableTriangleVertices,
    options: RecipeTriangleVertexOptions,
  ): this;
  lineStyle(options?: RecipeLineStyleOptions): this;
  lineWidth(width: number): this;
  opacity(value: number): this;
  fill(): this;
  stroke(): this;
  fillAndStroke(): this;
  text(value?: string, options?: RecipeTextOptions): this;
  text(
    value: string,
    x: RecipeCoordinate,
    y: RecipeCoordinate,
    options?: RecipeTextOptions,
  ): this;
  textDimensions(value: string, options?: RecipeTextOptions): TextDimensions;
  movedown(lines?: number, returnCoords?: false): this;
  movedown(lines: number, returnCoords: true): RecipePosition;
  layout(
    id: string | number,
    x?: number,
    y?: number,
    width?: number,
    height?: number,
    options?: RecipeLayoutOptions,
  ): this;
  table<RecordType extends object>(
    x: number,
    y: number,
    contents: readonly RecordType[],
    options?: RecipeTableOptions<RecordType>,
  ): this;
  image(
    name: string,
    x: RecipeCoordinate,
    y: RecipeCoordinate,
    options?: RecipeImageOptions,
  ): this;
  appendPage(name: string, pages?: RecipePageSelection): this;
  overlay(name: string, options?: RecipeOverlayOptions): this;
  overlay(name: string, x: number, options?: RecipeOverlayOptions): this;
  overlay(
    name: string,
    x?: number,
    y?: number,
    options?: RecipeOverlayOptions,
  ): this;
  /** Adds an ASCII URL link; coordinates and dimensions must be finite. */
  link(url: string, x: number, y: number, width: number, height: number): this;
  comment(
    text: string,
    x: RecipeCoordinate,
    y: RecipeCoordinate,
    options?: RecipeAnnotationOptions,
  ): this;
  annot(
    x: RecipeCoordinate,
    y: RecipeCoordinate,
    subtype: RecipeAnnotationSubtype,
    options?: RecipeAnnotationOptions,
  ): this;
  info(): Record<string, unknown>;
  info(options: Record<string, unknown>): this;
  custom(key: string, value: unknown): this;
  insertPage(
    afterPageNumber: number,
    name: string,
    sourcePageNumber: number,
  ): this;
  split(prefix?: string): RecipeSplitResult[];
  structure(format?: RecipeStructureFormat): string | RecipeStructure;
  permission(flags?: RecipePermission): number;
  encrypt(options?: RecipeEncryptOptions): this;
  endPDF(callback?: (bytes: Uint8Array) => void): Uint8Array;
  dispose(): void;
}
/**
 * Recipe types under the native names, one per `Recipe` value set, for example
 * `Recipe.TextWrap` for the values of the `Recipe.TextWrap` constants.
 */
export declare namespace Recipe {
  type TextWrap = RecipeTextWrap;
  type TextAlign = RecipeTextAlignment;
  type HorizontalAlign = RecipeHorizontalAlignment;
  type VerticalAlign = RecipeVerticalAlignment;
  type TextBoxAlign = RecipeTextBoxAlign;
  type ImageAlign = RecipeImageAlign;
  type TableRowNth = RecipeTableRowParity;
  type LineCap = RecipeLineCap;
  type LineJoin = RecipeLineJoin;
  type ArrowAt = RecipeArrowAnchor;
  type ArrowType = Exclude<RecipeArrowType, number>;
  type TriangleTrait = RecipeTriangleTrait;
  type TrianglePosition = RecipeTrianglePosition;
  type PageLayout = RecipePageLayout;
  type PageSize = RecipePageSize;
  type FontStyle = Exclude<RecipeFontStyle, "r" | "b" | "i" | "bi">;
  type RecipeFontStyle = import("./index.js").RecipeFontStyle;
  type Permission = RecipePermissionName;
  type PermissionName = RecipePermissionName;
  type PermissionList = RecipePermission;
  type Coordinate = "center";
  type RecipeCoordinate = import("./index.js").RecipeCoordinate;
  type Color = RecipeColor;
  type DeviceColorspace = RecipeDeviceColorSpace;
  type DeviceColorSpace = RecipeDeviceColorSpace;
  type Colorspace = RecipeColorSpace;
  type AnnotSubtype = RecipeAnnotationSubtype;
  type AnnotFlag = RecipeAnnotationFlag;
  type AnnotOptionsFlag = RecipeAnnotationFlag;
  type AnnotIcon = RecipeAnnotationIcon;
  type AnnotOptionsIcon = RecipeAnnotationIcon;
  type ChromaCommand = "!load";
  /** Wasm-only: the `Recipe.StructureFormat` values. */
  type StructureFormat = "string" | "json";
  // Option and helper types under their native names.
  type RecipeOptions = import("./index.js").RecipeOptions;
  type RecipeMargins = import("./index.js").RecipeMargins;
  type CaseInsensitive<Value extends string> = RecipeCaseInsensitive<Value>;
  type ExtensionCallback<
    Arguments extends unknown[] = unknown[],
    Result = unknown,
  > = RecipeExtension<Arguments, Result>;
  type EndPDFCallback = (bytes: Uint8Array) => void;
  type InfoOptions = Record<string, unknown>;
  type Metadata = RecipeMetadata;
  type ReadMetadata = RecipeMetadata;
  type MetadataPage = RecipePageInfo;
  type ReadMetadataPage = RecipePageInfo;
  type EncryptOptions = RecipeEncryptOptions;
  type OverlayOptions = RecipeOverlayOptions;
  type LayoutOptions = RecipeLayoutOptions;
  type ImageOptions = RecipeImageOptions;
  type HtmlTextObject = RecipeHtmlTextObject;
  type TextOptions = RecipeTextOptions;
  type TextMarkupOptions = RecipeTextMarkupOptions;
  type TextBox = RecipeTextBox;
  type TextBoxStyle = NonNullable<RecipeTextBox["style"]>;
  type TextBoxClipResult = RecipeTextBoxClipResult;
  type TextOverflowCallback = Extract<
    NonNullable<RecipeTextOptions["overflow"]>,
    (...args: never[]) => unknown
  >;
  type TextOverflowInstructions = Exclude<
    ReturnType<TextOverflowCallback>,
    boolean
  >;
  type AnnotOptions = RecipeAnnotationOptions;
  type CommentOptions = RecipeAnnotationOptions;
  type AnnotReply = RecipeAnnotationOptions;
  /** @deprecated Use `AnnotFlag`; comments accept the same flags. */
  type CommentOptionsFlag = RecipeAnnotationFlag;
  type PathOptions = RecipePathOptions;
  type DrawingOptions = RecipePathOptions;
  type SkewOptions = Pick<RecipePathOptions, "skewX" | "skewY">;
  type TransformOptions = Pick<
    RecipePathOptions,
    "skewX" | "skewY" | "rotation" | "rotationOrigin"
  >;
  type TransformedPathOptions = RecipePathOptions;
  type LinkFillOptions = Pick<RecipePathOptions, "link" | "fill">;
  type LineOptions = RecipePathOptions;
  type LineToOptions = RecipePathOptions;
  type LineStyleOptions = RecipeLineStyleOptions;
  type PolygonOptions = RecipePathOptions;
  type ShapeOptions = RecipePathOptions;
  type CircleOptions = RecipePathOptions;
  type EllipseOptions = RecipePathOptions;
  type RectangleOptions = RecipeRectangleOptions;
  type BorderRadius = NonNullable<RecipeRectangleOptions["borderRadius"]>;
  type NGonOptions = RecipeNGonOptions;
  type ArrowOptions = RecipeArrowOptions;
  type TriangleOptions = RecipeTriangleOptions;
  type TriangleBaseOptions = RecipeTriangleBaseOptions;
  type TriangleMeasurementOptions = RecipeTriangleMeasurementOptions;
  type TriangleVertexOptions = RecipeTriangleVertexOptions;
  type TriangleUnpositionedVertexOptions =
    RecipeTriangleUnpositionedVertexOptions;
  type TriangleVertexIdentifier = RecipeTriangleVertexIdentifier;
  type TriangleMeasurements = RecipeTriangleMeasurements;
  type TriangleVertices = RecipeTriangleVertices;
  type MutableTriangleVertices = RecipeMutableTriangleVertices;
  type TriangleMeasurementTrait = RecipeTriangleMeasurementTrait;
  type TriangleVertexTrait = RecipeTriangleVertexTrait;
  type TableOptions<RecordType extends object = RecipeTableRow> =
    RecipeTableOptions<RecordType>;
  type TableColumnDefinition = RecipeTableColumn;
  type TableColumnOptions = RecipeTableColumnOptions;
  type TableField<RecordType extends object> = RecipeTableField<RecordType>;
  type TableColumnField<RecordType extends object> =
    RecipeTableColumnField<RecordType>;
  type TableFieldValue<
    RecordType extends object,
    Field extends RecipeTableField<RecordType>,
  > = RecipeTableFieldValue<RecordType, Field>;
}
export interface RecipeConstructor {
  /** How text that does not fit a text-box line is handled. */
  readonly TextWrap: {
    readonly AUTO: "auto";
    readonly CLIP: "clip";
    readonly TRIM: "trim";
    readonly ELLIPSIS: "ellipsis";
  };
  /** Horizontal alignments of text inside a text box. */
  readonly TextAlign: {
    readonly LEFT: "left";
    readonly CENTER: "center";
    readonly RIGHT: "right";
    readonly JUSTIFY: "justify";
  };
  /** Which table rows the `row` options apply to. */
  readonly TableRowNth: {
    readonly EVEN: "even";
    readonly ODD: "odd";
  };
  /** Line cap styles for the `lineCap` options. */
  readonly LineCap: {
    readonly BUTT: "butt";
    readonly ROUND: "round";
    readonly SQUARE: "square";
  };
  /** Line join styles for the `lineJoin` options. */
  readonly LineJoin: {
    readonly MITER: "miter";
    readonly ROUND: "round";
    readonly BEVEL: "bevel";
  };
  /** The arrow point placed at the `arrow()` coordinates. */
  readonly ArrowAt: {
    readonly HEAD: "head";
    readonly TAIL: "tail";
  };
  /** Arrow head shapes for the `arrow()` type option. */
  readonly ArrowType: {
    readonly TRIANGLE: "triangle";
    readonly DART: "dart";
    readonly KITE: "kite";
  };
  /** How `triangle()` traits define the triangle. */
  readonly TriangleTrait: {
    readonly SSS: "sss";
    readonly SAS: "sas";
    readonly ASA: "asa";
    readonly VTX: "vtx";
  };
  /** The triangle point placed at the `triangle()` coordinates. */
  readonly TrianglePosition: {
    readonly A: "a";
    readonly B: "b";
    readonly C: "c";
    readonly CENTROID: "centroid";
    readonly CIRCUMCENTER: "circumcenter";
    readonly INCENTER: "incenter";
  };
  /** Page orientations reported in page metadata. */
  readonly PageLayout: {
    readonly PORTRAIT: "portrait";
    readonly LANDSCAPE: "landscape";
  };
  /** Named page sizes for `createPage()`. */
  readonly PageSize: {
    readonly EXECUTIVE: "executive";
    readonly FOLIO: "folio";
    readonly LEGAL: "legal";
    readonly LETTER: "letter";
    readonly LEDGER: "ledger";
    readonly TABLOID: "tabloid";
    readonly A0: "a0";
    readonly A1: "a1";
    readonly A2: "a2";
    readonly A3: "a3";
    readonly A4: "a4";
    readonly A5: "a5";
    readonly A6: "a6";
    readonly A7: "a7";
    readonly A8: "a8";
    readonly A9: "a9";
    readonly A10: "a10";
    readonly B0: "b0";
    readonly B1: "b1";
    readonly B2: "b2";
    readonly B3: "b3";
    readonly B4: "b4";
    readonly B5: "b5";
    readonly B6: "b6";
    readonly B7: "b7";
    readonly B8: "b8";
    readonly B9: "b9";
    readonly B10: "b10";
    readonly C0: "c0";
    readonly C1: "c1";
    readonly C2: "c2";
    readonly C3: "c3";
    readonly C4: "c4";
    readonly C5: "c5";
    readonly C6: "c6";
    readonly C7: "c7";
    readonly C8: "c8";
    readonly C9: "c9";
    readonly C10: "c10";
    readonly RA0: "ra0";
    readonly RA1: "ra1";
    readonly RA2: "ra2";
    readonly RA3: "ra3";
    readonly RA4: "ra4";
    readonly SRA0: "sra0";
    readonly SRA1: "sra1";
    readonly SRA2: "sra2";
    readonly SRA3: "sra3";
    readonly SRA4: "sra4";
  };
  /** Horizontal alignments. */
  readonly HorizontalAlign: {
    readonly LEFT: "left";
    readonly CENTER: "center";
    readonly RIGHT: "right";
  };
  /** Vertical alignments. */
  readonly VerticalAlign: {
    readonly TOP: "top";
    readonly CENTER: "center";
    readonly BOTTOM: "bottom";
  };
  /** Font styles for `registerFont()`. */
  readonly FontStyle: {
    readonly REGULAR: "regular";
    readonly BOLD: "bold";
    readonly ITALIC: "italic";
    readonly BOLD_ITALIC: "bold-italic";
  };
  /** User access permission names for `permission()`. */
  readonly Permission: {
    readonly PRINT: "print";
    readonly MODIFY: "modify";
    readonly COPY: "copy";
    readonly EDIT: "edit";
    readonly FILL_FORM: "fillform";
    readonly EXTRACT: "extract";
    readonly ASSEMBLE: "assemble";
    readonly PRINT_BEST: "printbest";
  };
  /** Named coordinates, accepted wherever a `RecipeCoordinate` is. */
  readonly Coordinate: {
    readonly CENTER: "center";
  };
  /** Colorspaces accepted by the `colorspace` options. */
  readonly Colorspace: {
    readonly RGB: "rgb";
    readonly CMYK: "cmyk";
    readonly GRAY: "gray";
    readonly SEPARATION: "separation";
  };
  /** Annotation subtypes for `annot()`. */
  readonly AnnotSubtype: {
    readonly TEXT: "Text";
    readonly LINK: "Link";
    readonly FREE_TEXT: "FreeText";
    readonly LINE: "Line";
    readonly SQUARE: "Square";
    readonly CIRCLE: "Circle";
    readonly POLYGON: "Polygon";
    readonly POLY_LINE: "PolyLine";
    readonly HIGHLIGHT: "Highlight";
    readonly UNDERLINE: "Underline";
    readonly SQUIGGLY: "Squiggly";
    readonly STRIKE_OUT: "StrikeOut";
    readonly CARET: "Caret";
    readonly STAMP: "Stamp";
    readonly INK: "Ink";
    readonly POPUP: "Popup";
    readonly FILE_ATTACHMENT: "FileAttachment";
    readonly SOUND: "Sound";
    readonly MOVIE: "Movie";
    readonly SCREEN: "Screen";
    readonly WIDGET: "Widget";
    readonly PRINTER_MARK: "PrinterMark";
    readonly TRAP_NET: "TrapNet";
    readonly WATERMARK: "Watermark";
    readonly THREE_D: "3D";
    readonly REDACT: "Redact";
    readonly PROJECTION: "Projection";
    readonly RICH_MEDIA: "RichMedia";
  };
  /** Annotation flag names for the `flag` options. */
  readonly AnnotFlag: {
    readonly INVISIBLE: "invisible";
    readonly HIDDEN: "hidden";
    readonly PRINT: "print";
    readonly NO_ZOOM: "nozoom";
    readonly NO_ROTATE: "norotate";
    readonly NO_VIEW: "noview";
    readonly READ_ONLY: "readonly";
    readonly LOCKED: "locked";
    readonly TOGGLE_NO_VIEW: "togglenoview";
    readonly LOCKED_CONTENTS: "lockedcontents";
  };
  /** Special `chroma()` names that run a command instead of naming a color. */
  readonly ChromaCommand: {
    readonly LOAD: "!load";
  };
  /** Text annotation icons for the `icon` option. */
  readonly AnnotIcon: {
    readonly COMMENT: "Comment";
    readonly KEY: "Key";
    readonly NOTE: "Note";
    readonly HELP: "Help";
    readonly NEW_PARAGRAPH: "NewParagraph";
    readonly PARAGRAPH: "Paragraph";
    readonly INSERT: "Insert";
  };
  /** Output formats of `structure()`; Wasm-only. */
  readonly StructureFormat: {
    readonly STRING: "string";
    readonly JSON: "json";
  };
  new (options?: RecipeOptions): Recipe;
  new (source: ByteSource, options?: RecipeOptions): Recipe;
  registerFont(name: string, bytes: ByteSource, style?: RecipeFontStyle): void;
  registerFontAsync(
    name: string,
    bytes: AsyncByteSource,
    style?: RecipeFontStyle,
  ): Promise<void>;
  registerImage(name: string, bytes: ByteSource, extension: string): void;
  registerImageAsync(
    name: string,
    bytes: AsyncByteSource,
    extension: string,
  ): Promise<void>;
  registerPdf(name: string, bytes: ByteSource): void;
  registerPdfAsync(name: string, bytes: AsyncByteSource): Promise<void>;
  unregisterFont(name: string, style?: RecipeFontStyle): boolean;
  unregisterImage(name: string): boolean;
  unregisterPdf(name: string): boolean;
  disposeAssets(): void;
  splitPdf(name: string, prefix?: string): RecipeSplitResult[];
  inspectPdf(name: string): RecipePdfInspection;
  permission(flags?: RecipePermission): number;
}
export interface TextOptions {
  encoding?: EEncoding;
}
export type PageRange = [start: number, end: number];
export type PageRangeOptions =
  | { type?: 0; specificRanges?: never }
  | { type: 1; specificRanges: [PageRange, ...PageRange[]] };
export interface ImageDimensions {
  width: number;
  height: number;
}
export interface TextDimensions {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  width: number;
  height: number;
}
export interface FontMetrics {
  pixelsPerEm: { x: number; y: number; xScale: number; yScale: number };
  ascender: number;
  descender: number;
  height: number;
  max_advance: number;
}
export interface AnnotationOptions {
  contents?: string;
  title?: string;
  name?: string;
  color?:
    [] | [number] | [number, number, number] | [number, number, number, number];
  borderWidth?: number;
  borderDash?: number[];
  border?: { width?: number; dash?: number[] };
  quadPoints?: number[];
  flags?: number;
  open?: boolean;
  opacity?: number;
}
/**
 * Paint operation a drawing helper finishes its path with. `"stroke"` is the
 * default when `type` is omitted, `"fill"` fills the path, and `"clip"`
 * intersects the clipping region without painting; scope it with q()/Q().
 * `null` selects no paint operation and ends the path unpainted.
 */
export type DrawingPathType = "stroke" | "fill" | "clip" | null;
export declare const DrawingPathType: {
  readonly STROKE: "stroke";
  readonly FILL: "fill";
  readonly CLIP: "clip";
};
/** PDF line cap style for `J()`: 0 butt, 1 round, 2 projecting square. */
export type LineCapStyle = 0 | 1 | 2;
export declare const LineCapStyle: {
  readonly LINECAP_BUTT: 0;
  readonly LINECAP_ROUND: 1;
  readonly LINECAP_SQUARE: 2;
};
/** Info dictionary `/Trapped` state: the `EInfoTrapped*` constants. */
export type EInfoTrapped = 0 | 1 | 2;
/** Token written after an array by `endArray()`: the `eTokenSeparator*` constants. */
export type ETokenSeparator = 0 | 1 | 2;
export declare const ETokenSeparator: {
  readonly eTokenSeparatorSpace: 0;
  readonly eTokenSeparatorEndLine: 1;
  readonly eTokenSeparatorNone: 2;
};
/** Parsed PDF object type: the `ePDFObject*` constants. */
export type PDFObjectType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
/** Cross-reference entry kind: the `eXrefEntry*` constants. */
export type XrefEntryType = 0 | 1 | 2 | 3;
/** Procedure set name for `addProcsetResource()`: the `KProcset*`/`kProcset*` constants. */
export type ProcsetName = "ImageB" | "ImageC" | "ImageI" | "PDF" | "Text";
/** Page range selection kind: the `eRangeType*` constants. */
export type ERangeType = 0 | 1;
/** Image or document format reported by `getImageType()`. */
export type PDFImageType = "PDF" | "JPG" | "TIFF" | "PNG";
export declare const PDFImageType: {
  readonly PDF: "PDF";
  readonly JPG: "JPG";
  readonly TIFF: "TIFF";
  readonly PNG: "PNG";
};
/** PDF line join style for `j()`: 0 miter, 1 round, 2 bevel. */
export type LineJoinStyle = 0 | 1 | 2;
/**
 * PDF text rendering mode for `Tr()`: 0 fill, 1 stroke, 2 fill and stroke,
 * 3 invisible, 4 to 6 the same plus clipping, 7 clip only.
 */
export type TextRenderingMode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface DrawPathOptions {
  color?: ColorValue;
  colorspace?: DeviceColorSpace;
  type?: DrawingPathType;
  width?: number;
  close?: boolean;
}
export interface WriteTextOptions extends DrawPathOptions {
  font: PDFUsedFont;
  size?: number;
  underline?: boolean;
}
export interface DrawImageOptions {
  index?: number;
  transformation?:
    | PDFMatrix
    | {
        width: number;
        height: number;
        proportional?: boolean;
        fit?: ImageFit;
      };
}
export interface TIFFOptions {
  pageIndex?: number;
  objectId?: number;
  bwTreatment?: {
    asImageMask?: boolean;
    oneColor?: [number, number, number] | [number, number, number, number];
  };
  grayscaleTreatment?: {
    asColorMap?: boolean;
    oneColor?: [number, number, number] | [number, number, number, number];
    zeroColor?: [number, number, number] | [number, number, number, number];
  };
}
export type PDFFormOptions = PageRangeOptions & {
  transformation?: PDFMatrix;
  additionalObjectIds?: number[];
};
export interface JPGImageInformation {
  samplesWidth: number;
  samplesHeight: number;
  colorComponentsCount: number;
  JFIFInformationExists: boolean;
  ExifInformationExists: boolean;
  PhotoshopInformationExists: boolean;
  JFIFUnit?: number;
  JFIFXDensity?: number;
  JFIFYDensity?: number;
  ExifUnit?: number;
  ExifXDensity?: number;
  ExifYDensity?: number;
  PhotoshopXDensity?: number;
  PhotoshopYDensity?: number;
}

export class PDFRStreamForBuffer {
  constructor(bytes: ByteSource);
  /** Returns a copy of at most `amount` bytes from the current position. */
  read(amount: number): Uint8Array;
  notEnded(): boolean;
  setPosition(position: number): void;
  setPositionFromEnd(position: number): void;
  skip(amount: number): void;
  getCurrentPosition(): number;
  moveStartPosition(position: number): void;
}
export class PDFWStreamForBuffer {
  constructor();
  buffer: Uint8Array;
  write(bytes: ByteSource): number;
  getCurrentPosition(): number;
  toUint8Array(): Uint8Array;
  toArrayBuffer(): ArrayBuffer;
  toBlob(type?: string): BlobLike;
}
export class ByteReader extends PDFRStreamForBuffer {}
export class ByteReaderWithPosition extends PDFRStreamForBuffer {}
export class ByteWriter extends PDFWStreamForBuffer {}
export class ByteWriterWithPosition extends PDFWStreamForBuffer {}

declare class PDFPage {
  constructor(left?: number, bottom?: number, right?: number, top?: number);
  mediaBox: PDFRectangle;
  cropBox?: PDFRectangle;
  bleedBox?: PDFRectangle;
  trimBox?: PDFRectangle;
  artBox?: PDFRectangle;
  rotate?: number;
  getResourcesDictionary(): ResourcesDictionary;
}
declare class PDFTextString {
  constructor(value?: string | ByteSource | number[]);
  toBytesArray(): number[];
  toString(): string;
  fromString(value: string): this;
}
declare class PDFDate {
  constructor(value?: string | Date);
  toString(): string;
  setToCurrentTime(): this;
}
export type { PDFDate, PDFPage, PDFTextString };
export interface PDFUsedFont {
  /** Measure a string, or a list of glyph ids. */
  calculateTextDimensions(
    text: string | number[],
    size?: number,
  ): TextDimensions;
  getFontMetrics(size?: number): FontMetrics;
}
export interface ByteWriteStream {
  write(bytes: ByteSource): number;
  getCurrentPosition?(): number;
}
export interface PDFStream {
  getWriteStream(): ByteWriteStream;
}
export interface ResourcesDictionary {
  addProcsetResource(name: ProcsetName): void;
  addExtGStateMapping(id: number): string;
  addFontMapping(id: number): string;
  addColorSpaceMapping(id: number): string;
  addPatternMapping(id: number): string;
  addPropertyMapping(id: number): string;
  addXObjectMapping(id: number): string;
  addFormXObjectMapping(id: number): string;
  addImageXObjectMapping(id: number): string;
  addShadingMapping(id: number): string;
}
export interface DictionaryContext {
  writeKey(key: string): this;
  writeNameValue(value: string): this;
  writeLiteralStringValue(value: string | Uint8Array | ArrayBuffer): this;
  writeHexStringValue(value: string | Uint8Array | ArrayBuffer): this;
  writeNumberValue(value: number): this;
  writeBooleanValue(value: boolean): this;
  writeObjectReferenceValue(id: number): this;
  writeNullValue(): this;
  writeRectangleValue(value: PDFRectangle): this;
  writeRectangleValue(
    left: number,
    bottom: number,
    right: number,
    top: number,
  ): this;
}
export interface ObjectsContext {
  allocateNewObjectID(): number;
  startNewIndirectObject(): number;
  startNewIndirectObject(id: number): this;
  endIndirectObject(): this;
  startModifiedIndirectObject(id: number): this;
  deleteObject(id: number): this;
  startDictionary(): DictionaryContext;
  endDictionary(dictionary: DictionaryContext): this;
  startArray(): this;
  endArray(separator?: ETokenSeparator): this;
  writeNumber(value: number): this;
  writeIndirectObjectReference(id: number, generation?: number): this;
  writeBoolean(value: boolean): this;
  writeName(value: string): this;
  writeLiteralString(value: string | Uint8Array | ArrayBuffer): this;
  writeHexString(value: string | Uint8Array | ArrayBuffer): this;
  writeKeyword(value: string): this;
  writeComment(value: string): this;
  endLine(): this;
  setCompressStreams(value: boolean): this;
  startPDFStream(dictionary?: DictionaryContext): PDFStream;
  startUnfilteredPDFStream(dictionary?: DictionaryContext): PDFStream;
  endPDFStream(stream: PDFStream): this;
  startFreeContext(): ByteWriteStream;
  endFreeContext(): this;
}

export interface ContentContext {
  getAssociatedPage?(): PDFPage;
  getCurrentPageContentStream?(): PDFStream;
  writeFreeCode(code: string): this;
  setOpacity(opacity: number): this;
  b(): this;
  B(): this;
  bStar(): this;
  BStar(): this;
  s(): this;
  S(): this;
  f(): this;
  F(): this;
  fStar(): this;
  n(): this;
  m(x: number, y: number): this;
  l(x: number, y: number): this;
  c(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
  ): this;
  v(x2: number, y2: number, x3: number, y3: number): this;
  y(x1: number, y1: number, x3: number, y3: number): this;
  h(): this;
  re(x: number, y: number, width: number, height: number): this;
  q(): this;
  Q(): this;
  cm(...matrix: PDFMatrix): this;
  w(lineWidth: number): this;
  J(value: LineCapStyle): this;
  j(value: LineJoinStyle): this;
  M(value: number): this;
  d(dash: number[], phase?: number): this;
  g(value: number): this;
  G(gray: number): this;
  rg(red: number, green: number, blue: number): this;
  RG(red: number, green: number, blue: number): this;
  k(cyan: number, magenta: number, yellow: number, black: number): this;
  K(cyan: number, magenta: number, yellow: number, black: number): this;
  W(): this;
  WStar(): this;
  BT(): this;
  ET(): this;
  Tm(...matrix: PDFMatrix): this;
  Td(x: number, y: number): this;
  TD(x: number, y: number): this;
  TStar(): this;
  Tc(value: number): this;
  Tw(value: number): this;
  Tz(value: number): this;
  TL(value: number): this;
  Tr(value: TextRenderingMode): this;
  Ts(value: number): this;
  Tf(font: PDFUsedFont | string, size: number): this;
  Tj(text: string, options?: TextOptions): this;
  Tj(glyphs: Glyph): this;
  Quote(text: string, options?: TextOptions): this;
  Quote(glyphs: Glyph): this;
  DoubleQuote(
    wordSpace: number,
    characterSpace: number,
    text: string,
    options?: TextOptions,
  ): this;
  DoubleQuote(wordSpace: number, characterSpace: number, glyphs: Glyph): this;
  TJ(
    ...items:
      | [string | number | Glyph, ...(string | number | Glyph)[]]
      | [string | number | Glyph, ...(string | number | Glyph)[], TextOptions]
  ): this;
  ri(name: string): this;
  i(value: number): this;
  gs(name: string): this;
  CS(name: string): this;
  cs(name: string): this;
  SC(...components: number[]): this;
  /** Color components, optionally followed by a pattern name. */
  SCN(...components: [number, ...number[]]): this;
  SCN(...componentsAndPattern: [number, ...number[], string]): this;
  SCN(components: number[], pattern?: string): this;
  sc(...components: number[]): this;
  /** Color components, optionally followed by a pattern name. */
  scn(...components: [number, ...number[]]): this;
  scn(...componentsAndPattern: [number, ...number[], string]): this;
  scn(components: number[], pattern?: string): this;
  doXObject(xObject: string | number | FormXObject | ImageXObject): this;
  /** Require at least two complete finite coordinate pairs; invalid input emits no operators. */
  drawPath(points: [number, number][], options?: DrawPathOptions): this;
  /** Require complete finite coordinate pairs, optionally followed by an options object. */
  drawPath(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    ...coordinatesAndOptions: [...number[], DrawPathOptions] | number[]
  ): this;
  /** Coordinates, radius, and calculated circle geometry must remain finite. */
  drawCircle(
    x: number,
    y: number,
    radius: number,
    options?: DrawPathOptions,
  ): this;
  /** Coordinates and edge length must be finite. */
  drawSquare(
    x: number,
    y: number,
    edge: number,
    options?: DrawPathOptions,
  ): this;
  /** Coordinates and dimensions must be finite. */
  drawRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    options?: DrawPathOptions,
  ): this;
  /** Coordinates and calculated underline geometry must be finite; font size must be positive and finite. */
  writeText(
    text: string,
    x: number,
    y: number,
    options: WriteTextOptions,
  ): this;
  drawImage(
    x: number,
    y: number,
    image: string | ByteSource,
    options?: DrawImageOptions,
  ): this;
  drawImageAsync(
    x: number,
    y: number,
    image: AsyncByteSource,
    options?: DrawImageOptions,
  ): Promise<this>;
}
export interface ImageXObject {
  readonly id: number;
}
export interface CompletedFormXObject {
  readonly id: number;
}
export interface FormXObject {
  readonly id: number;
  getContentContext(): ContentContext;
  getContentStream(): PDFStream;
  getResourcesDictionary(): ResourcesDictionary;
  getResourcesDictinary(): ResourcesDictionary;
}
export interface DocumentContext {
  getInfoDictionary(): InfoDictionary;
}
export interface InfoDictionary {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  trapped: EInfoTrapped;
  addAdditionalInfoEntry(key: string, value: string): void;
  removeAdditionalInfoEntry(key: string): void;
  clearAdditionalInfoEntries(): void;
  getAdditionalInfoEntry(key: string): string;
  getAdditionalInfoEntries(): Record<string, string>;
  setCreationDate(value: string | Date | PDFDate): void;
  setModDate(value: string | Date | PDFDate): void;
}

export interface PDFByteReader {
  /** Returns a copy of at most `amount` decoded or raw stream bytes. */
  read(amount: number): Uint8Array;
  notEnded(): boolean;
  /** Immediately releases this Wasm stream reader without ending its parent PDF reader. */
  dispose(): this;
}
export interface PositionedPDFByteReader extends PDFByteReader {
  setPosition(position: number): this;
  setPositionFromEnd(position: number): this;
  skip(amount: number): this;
  getCurrentPosition(): number;
}
export interface PDFObjectParser {
  parseNewObject(): PDFObject | undefined;
  end(): void;
}
export interface PDFObject {
  getType(): PDFObjectType;
  value: string | number | boolean | undefined;
  toString(): string;
  toNumber(): number | undefined;
  toPDFArray(): PDFArray | undefined;
  toPDFDictionary(): PDFDictionary | undefined;
  toPDFStream(): PDFStreamInput | undefined;
  toPDFIndirectObjectReference(): PDFIndirectObjectReference | undefined;
  toPDFBoolean(): PDFObject | undefined;
  toPDFLiteralString(): PDFStringObject | undefined;
  toPDFHexString(): PDFStringObject | undefined;
  toPDFNull(): PDFObject | undefined;
  toPDFName(): PDFObject | undefined;
  toPDFInteger(): PDFObject | undefined;
  toPDFReal(): PDFObject | undefined;
  toPDFSymbol(): PDFObject | undefined;
}
export interface PDFArray extends PDFObject {
  getLength(): number;
  queryObject(index: number): PDFObject | undefined;
  toJSArray(): PDFObject[];
}
export interface PDFDictionary extends PDFObject {
  exists(key: string): boolean;
  queryObject(key: string): PDFObject;
  toJSObject(): Record<string, PDFObject>;
}
export interface PDFStreamInput extends PDFObject {
  getDictionary(): PDFDictionary;
  getStreamContentStart(): number;
}
export interface PDFIndirectObjectReference extends PDFObject {
  getObjectID(): number;
  getVersion(): number;
}
export interface PDFStringObject extends PDFObject {
  toBytesArray(): Uint8Array;
  toText(): string;
}
export interface PDFPageInput {
  getDictionary(): PDFDictionary;
  getMediaBox(): PDFRectangle;
  getCropBox(): PDFRectangle;
  getTrimBox(): PDFRectangle;
  getBleedBox(): PDFRectangle;
  getArtBox(): PDFRectangle;
  getRotate(): number;
}
/** A text-showing operation in page content-stream drawing order. */
export interface PDFTextElement {
  /** Raw content-string bytes represented as one-byte JavaScript code units. */
  content: string;
  fontResource: string;
  fontSize: number;
  /** The text-to-page matrix after applying the active graphics CTM. */
  textMatrix: [number, number, number, number, number, number];
}
export type PDFPageContentItemType = 0 | 1 | 2 | 3;

/** A content-stream operation that produces a page mark. */
export interface PDFPageContentItem {
  type: PDFPageContentItemType;
  operation: string;
}

/**
 * Per-call extraction budget. Every field is clamped to a built-in ceiling,
 * so a caller may tighten a limit but never raise it above the default.
 * Omitted fields keep the ceiling.
 */
export interface PDFExtractionLimits {
  /** Extracted elements or items. Default and ceiling: 100000. */
  maxElements?: number;
  /** Pending operands per operator. Default and ceiling: 1024. */
  maxOperands?: number;
  /** Total extracted text. Default and ceiling: 16777216 (16 MiB). */
  maxTextBytes?: number;
  /** Content-stream objects parsed. Default and ceiling: 1000000. */
  maxParsedObjects?: number;
}
/** @deprecated Renamed to PDFExtractionLimits, which both extractors share. */
export type PDFTextExtractionLimits = PDFExtractionLimits;
/** A cross-reference entry read by `PDFReader#getXrefEntry()`. */
export interface PDFXrefEntry {
  objectPosition: number;
  revision: number;
  type: XrefEntryType;
}
/** Media box, rotation, and unrotated size read by `PDFReader#getPageInfo()`. */
export interface PDFPageGeometry {
  mediaBox: PDFRectangle;
  rotate: number;
  width: number;
  height: number;
}
export interface PDFReader {
  getPagesCount(): number;
  getPageObjectID(index: number): number;
  getPDFLevel(): number;
  getObjectsCount(): number;
  isEncrypted(): boolean;
  getXrefSize(): number;
  getXrefPosition(): number;
  getXrefEntry(id: number): PDFXrefEntry;
  getTrailerEntryType(key: string): PDFObjectType | null;
  getTrailer(): PDFDictionary;
  queryDictionaryObject(
    dictionary: PDFDictionary,
    key: string,
  ): PDFObject | undefined;
  queryArrayObject(array: PDFArray, index: number): PDFObject | undefined;
  parseNewObject(id: number): PDFObject;
  parsePageDictionary(index: number): PDFDictionary;
  parsePage(index: number): PDFPageInput;
  /**
   * Returns text-showing operations in PDF content-stream drawing order.
   * Does not decode font character maps or calculate glyph bounds.
   *
   * Throws when the page exceeds the extraction budget. `limits` may only
   * tighten the defaults: higher values are clamped to the built-in ceilings
   * of 1,000,000 content objects, 100,000 text operations, 1024 operands, and
   * 16 MiB of text.
   */
  extractPageText(
    pageIndex: number,
    limits?: PDFExtractionLimits,
  ): PDFTextElement[];
  /**
   * Returns every direct content-stream operation that produces a page mark.
   * White-on-white content is included; non-painting operations are excluded.
   *
   * Shares `extractPageText`'s budget and clamping. `limits.maxTextBytes` is
   * accepted for signature parity but has no effect here, because items carry
   * an operator name rather than extracted text.
   */
  extractPageContentItems(
    pageIndex: number,
    limits?: PDFExtractionLimits,
  ): PDFPageContentItem[];
  startReadingObjectsFromStream(stream: PDFStreamInput): PDFObjectParser;
  startReadingObjectsFromStreams(streams: PDFArray): PDFObjectParser;
  startReadingFromStream(stream: PDFStreamInput): PDFByteReader;
  startReadingFromStreamForPlainCopying(stream: PDFStreamInput): PDFByteReader;
  getParserStream(): PositionedPDFByteReader;
  /** Available on readers obtained from a document copying context. */
  getSourceDocumentStream(): PositionedPDFByteReader;
  getPageInfo(index: number): PDFPageGeometry;
  getPageBox(index: number, box?: PageBox): PDFRectangle;
  end(): this;
}
export interface CopyingObjectOperations {
  copyObject(id: number): number;
  copyDirectObjectWithDeepCopy(object: PDFObject): number[];
  copyNewObjectsForDirectObject(ids: number[]): this;
  getCopiedObjectID(id: number): number;
  getCopiedObjects(): Record<string, number>;
  replaceSourceObjects(mapping: Record<string, number>): this;
}
export interface DocumentCopyingContext extends CopyingObjectOperations {
  getSourceDocumentParser(): PDFReader;
  getSourceDocumentStream(): PositionedPDFByteReader;
  copyDirectObjectAsIs(object: PDFObject): this;
  appendPDFPageFromPDF(index: number): number;
  appendPDFPagesFromPDF(start: number, end: number): this;
  mergePDFPageToPage(page: PDFPage, index: number): this;
  createFormXObjectFromPDFPage(
    index: number,
    pageBox?: PDFPageBoxType | PDFRectangle,
    transformation?: PDFMatrix,
  ): number;
  mergePDFPageToFormXObject(
    form: FormXObject | ModifierFormXObject,
    index: number,
  ): this;
  end(): this;
}
/** Stateful methods require an active writer and throw Error("PDF writer has ended") after cleanup. Async methods reject instead. */
export interface PDFWriter {
  appendPDFPagesFromPDF(
    source: ByteSource,
    options?: PageRangeOptions,
  ): number[];
  appendPDFPagesFromPDFAsync(
    source: AsyncByteSource,
    options?: PageRangeOptions,
  ): Promise<number[]>;
  /** Calls the optional callback with no arguments and globalThis as its receiver. */
  mergePDFPagesToPage(
    page: PDFPage,
    source: ByteSource,
    options?: PageRangeOptions,
  ): this;
  mergePDFPagesToPage(
    page: PDFPage,
    source: ByteSource,
    callback: (this: typeof globalThis) => void,
  ): this;
  mergePDFPagesToPage(
    page: PDFPage,
    source: ByteSource,
    options: PageRangeOptions,
    callback: (this: typeof globalThis) => void,
  ): this;
  mergePDFPagesToPageAsync(
    page: PDFPage,
    source: AsyncByteSource,
    options?: PageRangeOptions,
  ): Promise<this>;
  mergePDFPagesToPageAsync(
    page: PDFPage,
    source: AsyncByteSource,
    callback: (this: typeof globalThis) => void,
  ): Promise<this>;
  mergePDFPagesToPageAsync(
    page: PDFPage,
    source: AsyncByteSource,
    options: PageRangeOptions,
    callback: (this: typeof globalThis) => void,
  ): Promise<this>;
  getDocumentContext(): DocumentContext;
  createPDFTextString(value?: string | ByteSource | number[]): PDFTextString;
  createPDFDate(value?: string | Date): PDFDate;
  getObjectsContext(): ObjectsContext;
  attachURLLinktoCurrentPage(
    url: string,
    left: number,
    bottom: number,
    right: number,
    top: number,
  ): this;
  createAnnotation(
    subtype: string,
    left: number,
    bottom: number,
    right: number,
    top: number,
    options?: AnnotationOptions,
  ): number;
  registerAnnotationReferenceForNextPageWrite(id: number): this;
  getFontForBytes(name: string, index?: number): PDFUsedFont;
  getFontForBytes(
    name: string,
    metricsName: string,
    index?: number,
  ): PDFUsedFont;
  requireCatalogUpdate(): void;
  getImageDimensions(
    image: string | ByteSource,
    imageIndex?: number,
  ): ImageDimensions;
  getImageDimensionsAsync(
    image: AsyncByteSource,
    imageIndex?: number,
  ): Promise<ImageDimensions>;
  getImageType(image: string | ByteSource): PDFImageType | undefined;
  getImageTypeAsync(image: AsyncByteSource): Promise<PDFImageType | undefined>;
  getImagePagesCount(image: string | ByteSource): number;
  getImagePagesCountAsync(image: AsyncByteSource): Promise<number>;
  retrieveJPGImageInformation(image: string | ByteSource): JPGImageInformation;
  retrieveJPGImageInformationAsync(
    image: AsyncByteSource,
  ): Promise<JPGImageInformation>;
  createImageXObjectFromJPGBytes(name: string, objectId?: number): ImageXObject;
  createFormXObjectFromJPGBytes(
    name: string,
    objectId?: number,
  ): CompletedFormXObject;
  createFormXObjectFromPNGBytes(
    name: string,
    objectId?: number,
  ): CompletedFormXObject;
  createFormXObjectFromTIFF(
    image: string | ByteSource,
    options?: TIFFOptions,
  ): CompletedFormXObject;
  createFormXObjectFromTIFFBytes(
    image: string | ByteSource,
    options?: TIFFOptions,
  ): CompletedFormXObject;
  createFormXObjectFromTIFFAsync(
    image: AsyncByteSource,
    options?: TIFFOptions,
  ): Promise<CompletedFormXObject>;
  createFormXObjectFromTIFFBytesAsync(
    image: AsyncByteSource,
    options?: TIFFOptions,
  ): Promise<CompletedFormXObject>;
  createFormXObject(
    left: number,
    bottom: number,
    right: number,
    top: number,
    objectId?: number,
  ): FormXObject;
  endFormXObject(form: FormXObject): this;
  createFormXObjectsFromPDF(
    source: string | ByteSource,
    pageBox?: PDFPageBoxType | PDFRectangle,
    options?: PDFFormOptions,
  ): number[];
  createFormXObjectsFromPDFAsync(
    source: AsyncByteSource,
    pageBox?: PDFPageBoxType | PDFRectangle,
    options?: PDFFormOptions,
  ): Promise<number[]>;
  createPDFCopyingContext(source: ByteSource): DocumentCopyingContext;
  createPDFCopyingContextAsync(
    source: AsyncByteSource,
  ): Promise<DocumentCopyingContext>;
  createPage(
    left?: number,
    bottom?: number,
    right?: number,
    top?: number,
  ): PDFPage;
  startPageContentContext(page: PDFPage): ContentContext;
  pausePageContentContext(context: ContentContext): this;
  writePage(page: PDFPage): this;
  writePageAndReturnID(page: PDFPage): number;
  end(): Uint8Array;
  dispose(): void;
}
export interface PageModifier {
  startContext(): this;
  getContext(): ContentContext;
  getResourcesDictionary(): ResourcesDictionary;
  attachURLLinktoCurrentPage(
    url: string,
    left: number,
    bottom: number,
    right: number,
    top: number,
  ): this;
  createAnnotation(
    subtype: string,
    left: number,
    bottom: number,
    right: number,
    top: number,
    options?: AnnotationOptions,
  ): number;
  endContext(): this;
  writePage(): this;
}
/** An open modifier-owned form may be ended directly or through the modifier. */
export interface ModifierFormXObject extends FormXObject {
  end(): this;
}
export interface ModifierImageXObject {
  readonly id: number;
}
export interface ModifierCompletedFormXObject {
  readonly id: number;
}
/** Where `replaceObject()` replaces references: `global` means every page. */
export type ObjectReplacementScope = "global";
export declare const ObjectReplacementScope: {
  readonly GLOBAL: "global";
};
export interface ObjectReplacementOptions {
  scope?: ObjectReplacementScope;
}
export interface PDFModifier {
  createFormXObject(
    left: number,
    bottom: number,
    right: number,
    top: number,
    objectId?: number,
  ): ModifierFormXObject;
  endFormXObject(form: ModifierFormXObject): this;
  createFormXObjectFromTIFF(
    image: string | ByteSource,
    options?: TIFFOptions,
  ): ModifierCompletedFormXObject;
  createFormXObjectFromTIFFBytes(
    image: string | ByteSource,
    options?: TIFFOptions,
  ): ModifierCompletedFormXObject;
  createFormXObjectFromTIFFAsync(
    image: AsyncByteSource,
    options?: TIFFOptions,
  ): Promise<ModifierCompletedFormXObject>;
  createFormXObjectFromTIFFBytesAsync(
    image: AsyncByteSource,
    options?: TIFFOptions,
  ): Promise<ModifierCompletedFormXObject>;
  createPage(
    left?: number,
    bottom?: number,
    right?: number,
    top?: number,
  ): PDFPage;
  getFontForBytes(name: string, index?: number): PDFUsedFont;
  getFontForBytes(
    name: string,
    metricsName: string,
    index?: number,
  ): PDFUsedFont;
  requireCatalogUpdate(): void;
  /**
   * Replaces matching direct references in one original page dictionary.
   * Set `scope` to `global` to replace matching references on every page.
   * All IDs must be positive unsigned 32-bit IDs from this modified PDF.
   */
  replaceObject(
    pageIndex: number,
    sourceObjectId: number,
    replacementObjectId: number,
    options?: ObjectReplacementOptions,
  ): this;
  getObjectsContext(): ObjectsContext;
  getModifiedFileParser(): PDFReader;
  getDocumentContext(): DocumentContext;
  createPDFTextString(value?: string | ByteSource | number[]): PDFTextString;
  createPDFDate(value?: string | Date): PDFDate;
  startPageContentContext(page: PDFPage): ContentContext;
  pausePageContentContext(context: ContentContext): this;
  createPageModifier(
    index?: number,
    ensureContentEncapsulation?: boolean,
  ): PageModifier;
  writePage(page: PDFPage): this;
  writePageAndReturnID(page: PDFPage): number;
  attachURLLinktoCurrentPage(
    url: string,
    left: number,
    bottom: number,
    right: number,
    top: number,
  ): this;
  createAnnotation(
    subtype: string,
    left: number,
    bottom: number,
    right: number,
    top: number,
    options?: AnnotationOptions,
  ): number;
  registerAnnotationReferenceForNextPageWrite(id: number): this;
  appendPDFPagesFromPDF(
    source: ByteSource,
    options?: PageRangeOptions,
  ): number[];
  appendPDFPagesFromPDFAsync(
    source: AsyncByteSource,
    options?: PageRangeOptions,
  ): Promise<number[]>;
  mergePDFPagesToPage(
    page: PDFPage,
    source: ByteSource,
    options?: PageRangeOptions,
  ): this;
  mergePDFPagesToPage(
    page: PDFPage,
    source: ByteSource,
    callback: (this: typeof globalThis) => void,
  ): this;
  mergePDFPagesToPage(
    page: PDFPage,
    source: ByteSource,
    options: PageRangeOptions,
    callback: (this: typeof globalThis) => void,
  ): this;
  mergePDFPagesToPageAsync(
    page: PDFPage,
    source: AsyncByteSource,
    options?: PageRangeOptions,
  ): Promise<this>;
  mergePDFPagesToPageAsync(
    page: PDFPage,
    source: AsyncByteSource,
    callback: (this: typeof globalThis) => void,
  ): Promise<this>;
  mergePDFPagesToPageAsync(
    page: PDFPage,
    source: AsyncByteSource,
    options: PageRangeOptions,
    callback: (this: typeof globalThis) => void,
  ): Promise<this>;
  getImageDimensions(
    image: string | ByteSource,
    imageIndex?: number,
  ): ImageDimensions;
  getImageDimensionsAsync(
    image: AsyncByteSource,
    imageIndex?: number,
  ): Promise<ImageDimensions>;
  getImageType(image: string | ByteSource): PDFImageType | undefined;
  getImageTypeAsync(image: AsyncByteSource): Promise<PDFImageType | undefined>;
  getImagePagesCount(image: string | ByteSource): number;
  getImagePagesCountAsync(image: AsyncByteSource): Promise<number>;
  retrieveJPGImageInformation(image: string | ByteSource): JPGImageInformation;
  retrieveJPGImageInformationAsync(
    image: AsyncByteSource,
  ): Promise<JPGImageInformation>;
  createImageXObjectFromJPGBytes(
    name: string,
    objectId?: number,
  ): ModifierImageXObject;
  createFormXObjectFromJPGBytes(
    name: string,
    objectId?: number,
  ): ModifierCompletedFormXObject;
  createFormXObjectFromPNGBytes(
    name: string,
    objectId?: number,
  ): ModifierCompletedFormXObject;
  createFormXObjectsFromPDF(
    source: string | ByteSource,
    pageBox?: PDFPageBoxType | PDFRectangle,
    options?: PDFFormOptions,
  ): number[];
  createFormXObjectsFromPDFAsync(
    source: AsyncByteSource,
    pageBox?: PDFPageBoxType | PDFRectangle,
    options?: PDFFormOptions,
  ): Promise<number[]>;
  createPDFCopyingContext(source: ByteSource): DocumentCopyingContext;
  createPDFCopyingContextAsync(
    source: AsyncByteSource,
  ): Promise<DocumentCopyingContext>;
  createPDFCopyingContextForModifiedFile(): DocumentCopyingContext;
  end(): Uint8Array;
  dispose(): void;
}
/** Low-level color: a 24-bit RGB number, `#rrggbb`, a basic color name, or three 0-255 components. */
export type ColorValue = number | string | [number, number, number];
/** Colors for CompactModifier rectangles and circles; `fill` wins over `stroke` and `color`. */
export interface CompactModifierShapeOptions {
  color?: ColorValue;
  fill?: ColorValue;
  stroke?: ColorValue;
}
/** Line color and width for CompactModifier.line(); `stroke` wins over `color`. */
export interface CompactModifierLineOptions {
  color?: ColorValue;
  stroke?: ColorValue;
  lineWidth?: number;
}
/** Font and color for CompactModifier.text(); `font` names a registered font. */
export interface CompactModifierTextOptions {
  font: string;
  fontSize?: number;
  color?: ColorValue;
}
export interface CompactModifier {
  startPage(index: number): this;
  rectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    options?: CompactModifierShapeOptions,
  ): this;
  circle(
    x: number,
    y: number,
    radius: number,
    options?: CompactModifierShapeOptions,
  ): this;
  line(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options?: CompactModifierLineOptions,
  ): this;
  text(
    value: string,
    x: number,
    y: number,
    options: CompactModifierTextOptions,
  ): this;
  image(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): this;
  endPage(): this;
  end(): Uint8Array;
  dispose(): void;
}
export interface MuhammaraWasm {
  PDFPage: typeof PDFPage;
  PDFDate: typeof PDFDate;
  PDFTextString: typeof PDFTextString;
  PDFRStreamForBuffer: typeof PDFRStreamForBuffer;
  PDFWStreamForBuffer: typeof PDFWStreamForBuffer;
  ByteReader: typeof ByteReader;
  ByteReaderWithPosition: typeof ByteReaderWithPosition;
  ByteWriter: typeof ByteWriter;
  ByteWriterWithPosition: typeof ByteWriterWithPosition;
  createWriter(options?: WriterOptions): PDFWriter;
  recrypt(source: ByteSource, options?: PDFRecryptOptions): Uint8Array;
  createWriterToModify(
    source: ByteSource,
    options?: WriterOptions,
  ): PDFModifier;
  createWriterToModifyAsync(
    source: AsyncByteSource,
    options?: WriterOptions,
  ): Promise<PDFModifier>;
  createReader(source: ByteSource): PDFReader;
  createReaderAsync(source: AsyncByteSource): Promise<PDFReader>;
  createModifier(source: ByteSource): CompactModifier;
  createModifierAsync(source: AsyncByteSource): Promise<CompactModifier>;
  registerFont(name: string, bytes: ByteSource): string;
  registerFontAsync(name: string, bytes: AsyncByteSource): Promise<string>;
  registerImage(name: string, bytes: ByteSource, extension: string): void;
  registerImageAsync(
    name: string,
    bytes: AsyncByteSource,
    extension: string,
  ): Promise<void>;
  registerPdf(name: string, bytes: ByteSource): void;
  registerPdfAsync(name: string, bytes: AsyncByteSource): Promise<void>;
  unregisterFont(name: string): boolean;
  unregisterImage(name: string): boolean;
  unregisterPdf(name: string): boolean;
  disposeAssets(): void;
  createBlankPdf(width: number, height: number): Uint8Array;
  readonly ePDFVersionUndefined: 0;
  readonly ePDFVersion10: 10;
  readonly ePDFVersion11: 11;
  readonly ePDFVersion12: 12;
  readonly ePDFVersion13: 13;
  readonly ePDFVersion14: 14;
  readonly ePDFVersion15: 15;
  readonly ePDFVersion16: 16;
  readonly ePDFVersion17: 17;
  readonly ePDFVersion20: 20;
  readonly KProcsetImageB: "ImageB";
  readonly KProcsetImageC: "ImageC";
  readonly KProcsetImageI: "ImageI";
  readonly kProcsetPDF: "PDF";
  readonly kProcsetText: "Text";
  readonly eRangeTypeAll: 0;
  readonly eRangeTypeSpecific: 1;
  readonly ePDFPageBoxMediaBox: 0;
  readonly ePDFPageBoxCropBox: 1;
  readonly ePDFPageBoxBleedBox: 2;
  readonly ePDFPageBoxTrimBox: 3;
  readonly ePDFPageBoxArtBox: 4;
  readonly ePDFObjectBoolean: 0;
  readonly ePDFObjectLiteralString: 1;
  readonly ePDFObjectHexString: 2;
  readonly ePDFObjectNull: 3;
  readonly ePDFObjectName: 4;
  readonly ePDFObjectInteger: 5;
  readonly ePDFObjectReal: 6;
  readonly ePDFObjectArray: 7;
  readonly ePDFObjectDictionary: 8;
  readonly ePDFObjectIndirectObjectReference: 9;
  readonly ePDFObjectStream: 10;
  readonly ePDFObjectSymbol: 11;
  readonly ePDFPageContentItemText: 0;
  readonly ePDFPageContentItemPath: 1;
  readonly ePDFPageContentItemXObject: 2;
  readonly ePDFPageContentItemShading: 3;
  readonly eTokenSeparatorSpace: 0;
  readonly eTokenSeparatorEndLine: 1;
  readonly eTokenSeparatorNone: 2;
  readonly eXrefEntryExisting: 0;
  readonly eXrefEntryDelete: 1;
  readonly eXrefEntryStreamObject: 2;
  readonly eXrefEntryUndefined: 3;
  readonly EInfoTrappedTrue: 0;
  readonly EInfoTrappedFalse: 1;
  readonly EInfoTrappedUnknown: 2;
  getTypeLabel(type: PDFObjectType): string;
}
export interface MuhammaraWasmOptions {
  /**
   * Maps the requested file name (`muhammara-wasm.wasm`) to the URL, or under
   * Node the path or `file:` URL, to load it from. When `wasmBinary` is
   * supplied, the returned location is not loaded.
   */
  locateFile?: (path: string, prefix: string) => string;
  /**
   * Bytes of `muhammara-wasm.wasm` obtained by the caller, for example with
   * `fetch()` or `File.arrayBuffer()`. When supplied, the binary is not
   * fetched or read and `limits` does not apply to it. Other typed arrays,
   * `DataView`, and `Blob` are rejected with a `TypeError`.
   */
  wasmBinary?: Uint8Array | ArrayBuffer;
  limits?: {
    maxInputBytes?: number;
    maxOutputBytes?: number;
  };
  [key: string]: unknown;
}
export function createMuhammaraWasm(
  options?: MuhammaraWasmOptions,
): Promise<MuhammaraWasm>;

export interface CreateRecipeOptions extends MuhammaraWasmOptions {
  /**
   * Omit to load bundled Roboto Regular. Supply font bytes/Blob/File to use a
   * custom default (family "default"), or false to require named registered fonts.
   * Custom bytes and false both skip importing the bundled font module.
   */
  defaultFont?: AsyncByteSource | false;
}

/** Loads the byte-first Recipe constructor and its optional default font. */
export function createRecipe(
  options?: CreateRecipeOptions,
): Promise<RecipeConstructor>;
