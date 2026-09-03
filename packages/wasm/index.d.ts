/** Browser-only, byte-first WebAssembly API. It intentionally excludes Node paths and streams. */
export type ByteSource = Uint8Array | ArrayBuffer;
export interface BlobLike {
  arrayBuffer(): Promise<ArrayBuffer>;
}
export type AsyncByteSource = ByteSource | BlobLike;
export type PDFRectangle = [number, number, number, number];
export type PDFMatrix = [number, number, number, number, number, number];
export type Glyph = [number, number];
export type TextEncoding = "text" | "code" | "hex";
export type PageBox = "media" | "crop" | "bleed" | "trim" | "art";
export type PDFVersion = 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 20;

export interface WriterOptions {
  version?: PDFVersion;
  /** Enables Flate compression for streams. Defaults to true. */
  compress?: boolean;
}
export type RecipeFontStyle =
  "regular" | "bold" | "italic" | "bold-italic" | "r" | "b" | "i" | "bi";
export type RecipeCoordinate = number | "center";
export interface RecipeMargins {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}
export interface RecipeOptions {
  /** PDF version; canonical decimal levels 1.0 through 1.7 are accepted. Integer enums 10 through 17 are a byte-first extension. Invalid values, including 2.0, use 1.7. */
  version?: number;
  /** Enables stream compression. Defaults to true. */
  compress?: boolean;
  author?: string;
  title?: string;
  subject?: string;
  keywords?: string | string[];
  colorspace?: "rgb" | "gray" | "cmyk";
}
export type RecipeColor = string | number[];
export type RecipeKnownColors = Record<
  "rgb" | "gray" | "cmyk" | "separation",
  Record<string, string>
>;
export type RecipeExtension = (this: Recipe, ...args: any[]) => unknown;
export interface RecipePathOptions {
  color?: RecipeColor;
  colour?: RecipeColor;
  stroke?: RecipeColor;
  fill?: RecipeColor;
  colorspace?: "rgb" | "gray" | "cmyk" | "separation";
  colorName?: string;
  width?: number;
  lineWidth?: number;
  opacity?: number;
  dash?: number[];
  dashPhase?: number;
  lineCap?: "butt" | "round" | "square";
  lineJoin?: "miter" | "round" | "bevel";
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
  align?: string;
  index?: number;
}
export interface RecipeAnnotationOptions {
  text?: string;
  contents?: string;
  title?: string;
  subject?: string;
  date?: string | Date;
  icon?: string;
  name?: string;
  color?: RecipeColor;
  border?: number | { width?: number; dash?: number[] };
  borderWidth?: number;
  borderDash?: number[];
  quadPoints?: number[];
  flag?: string | number;
  flags?: number;
  open?: boolean;
  opacity?: number;
  richText?: boolean;
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
export interface RecipeTextBox {
  width?: number;
  height?: number;
  minHeight?: number;
  padding?: number | [number, number?, number?, number?];
  lineHeight?: number;
  /** `clip` retains and clips the source, `trim` omits its non-fitting suffix, and `ellipsis` replaces it with `...`. */
  wrap?: boolean | "auto" | "clip" | "trim" | "ellipsis";
  textAlign?:
    | "left"
    | "center"
    | "right"
    | "justify"
    | `${string} ${"top" | "center" | "bottom"}`;
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
export interface RecipeTextOptions extends RecipePathOptions {
  font?: string;
  fontSize?: number;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  charSpace?: number;
  html?: boolean;
  flow?: boolean;
  align?:
    | "left"
    | "center"
    | "right"
    | `${"left" | "center" | "right"} ${"top" | "center" | "bottom"}`;
  layout?: string | number;
  highlight?: boolean | RecipePathOptions;
  /** Visual text background, distinct from the Highlight annotation option. */
  hilite?: boolean | RecipePathOptions;
  underline?: boolean;
  strikeOut?: boolean;
  textBox?: RecipeTextBox;
  cell?: RecipeTextBox;
  overflow?: (
    recipe: Recipe,
  ) =>
    | boolean
    | { column?: number | [number, number]; layout?: string | number }
    | void;
}
export interface RecipeHtmlTextObject {
  value: string;
  styles: Partial<RecipeTextOptions>;
}
export interface RecipeTableColumn extends Omit<RecipeTextOptions, "font"> {
  name: string;
  font?: string;
  text?: string;
  width?: number;
  cell?: RecipeTextBox;
  header?: RecipeTextOptions;
  hcell?: RecipeTextBox;
  renderer?: (
    text: unknown,
    record: Record<string, unknown>,
    field: string,
    row: number,
  ) => RecipeTextOptions | void;
}
export interface RecipeTableOptions extends Omit<
  RecipeTextOptions,
  "overflow"
> {
  /** Per-continuation table height. Wrapped headers and cells are measured before rows are placed. */
  height?: number;
  order?: string | string[];
  columns?: RecipeTableColumn[];
  header?:
    | boolean
    | (RecipeTextOptions & { alignToData?: boolean; cell?: RecipeTextBox });
  border?: boolean | RecipePathOptions;
  row?: RecipeTextOptions & { nth?: "even" | "odd" };
  overflow?: (
    recipe: Recipe,
    row: number,
  ) => boolean | { position?: [number, number] } | void;
}
export interface RecipePageInfo {
  pageNumber: number;
  mediaBox: PDFRectangle;
  rotate: number;
  /** Recipe-coordinate width, with MediaBox axes swapped for 90/270-degree rotation. */
  width: number;
  /** Recipe-coordinate height, with MediaBox axes swapped for 90/270-degree rotation. */
  height: number;
  layout: "portrait" | "landscape";
  size: [number, number];
  offsetX: number;
  offsetY: number;
}
export interface Recipe {
  readonly options: RecipeOptions;
  readonly default: {
    pageSize: [number, number];
    pageMargin: Required<RecipeMargins>;
    mediumSizes: Record<string, [number, number]>;
  };
  /** The last high-level moveTo, lineTo, or text position in Recipe coordinates. */
  readonly position: { x: number; y: number };
  /** A per-Recipe copy of the built-in named device colors. */
  readonly knownColors: RecipeKnownColors;
  register(key: string, callback: RecipeExtension): this;
  register(callback: RecipeExtension & { name: string }): this;
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
  createPage(size: string, rotation?: number, margins?: RecipeMargins): this;
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
  read(source: ByteSource): { pages: number; [page: number]: RecipePageInfo };
  readAsync(
    source: AsyncByteSource,
  ): Promise<{ pages: number; [page: number]: RecipePageInfo }>;
  /** Starts a prepend-safe editing context for an existing one-based page number. */
  editPage(pageNumber: number): this;
  pauseContext(): this;
  resumeContext(): this;
  setPageBox(
    box: PageBox,
    left: number,
    bottom: number,
    right: number,
    top: number,
  ): this;
  rotate(rotation: number): this;
  save(): this;
  restore(): this;
  transform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): this;
  rotateContent(degrees: number, x?: number, y?: number): this;
  chroma(
    name: string,
    value: RecipeColor,
    colorspace?: "rgb" | "gray" | "cmyk" | "separation",
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
    options?: RecipePathOptions & {
      borderRadius?:
        | number
        | [number]
        | [number, number]
        | [number, number, number]
        | [number, number, number, number];
    },
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
    options?: RecipePathOptions & { sector?: boolean },
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
    options?: RecipePathOptions & { rotationVertice?: number },
  ): this;
  n_gon(
    cx: number,
    cy: number,
    radius: number,
    sides?: number,
    options?: RecipePathOptions & { rotationVertice?: number },
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
  arrow(
    x: number,
    y: number,
    options?: RecipePathOptions & {
      head?: number | number[];
      shaft?: number | number[];
      double?: boolean;
      type?: number | "triangle" | "dart" | "kite";
      at?: "head" | "tail";
    },
  ): this;
  triangle(
    x: number,
    y: number,
    traits: number[] | [number, number][],
    options?: RecipePathOptions & {
      traitID?: "sss" | "sas" | "asa" | "vtx";
      traitsID?: "sss" | "sas" | "asa" | "vtx";
      position?:
        | "a"
        | "b"
        | "c"
        | "A"
        | "B"
        | "C"
        | "centroid"
        | "circumcenter"
        | "incenter";
      flipX?: boolean;
      flipY?: boolean;
    },
  ): this;
  lineStyle(options?: {
    width?: number;
    lineWidth?: number;
    cap?: number;
    join?: number;
    miterLimit?: number;
    dash?: number[];
    dashPhase?: number;
  }): this;
  lineWidth(width: number): this;
  opacity(value: number): this;
  fillOpacity(value: number): this;
  fill(): this;
  stroke(): this;
  fillAndStroke(): this;
  text(value?: string, options?: RecipeTextOptions): this;
  text(value: string, x: number, y: number, options?: RecipeTextOptions): this;
  textDimensions(value: string, options?: RecipeTextOptions): TextDimensions;
  movedown(lines?: number, returnCoords?: false): this;
  movedown(lines: number, returnCoords: true): [number, number];
  layout(
    id: string | number,
    x?: number,
    y?: number,
    width?: number,
    height?: number,
    options?: {
      columns?: number | RecipeTableColumn[];
      gap?: number;
      reset?: boolean;
    },
  ): this;
  table(
    x: number,
    y: number,
    contents: Record<string, unknown>[],
    options?: RecipeTableOptions,
  ): this;
  image(name: string, x: number, y: number, options?: RecipeImageOptions): this;
  appendPage(
    name: string,
    pages?: number | [number, number] | (number | [number, number])[],
  ): this;
  overlay(name: string, options?: RecipeOverlayOptions): this;
  overlay(
    name: string,
    x?: number,
    y?: number,
    options?: RecipeOverlayOptions,
  ): this;
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
    subtype: string,
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
  split(prefix?: string): { name: string; bytes: Uint8Array }[];
  structure(
    format?: "string" | "json" | { json?: boolean },
  ): string | { pages: number; encrypted: boolean; objects: number };
  permission(flags?: string): number;
  encrypt(options?: Record<string, unknown>): never;
  endPDF(callback?: (bytes: Uint8Array) => void): Uint8Array;
  dispose(): void;
}
export interface RecipeConstructor {
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
  splitPdf(
    name: string,
    prefix?: string,
  ): { name: string; bytes: Uint8Array }[];
  inspectPdf(name: string): {
    pages: number;
    level: number;
    encrypted: boolean;
    [page: number]: RecipePageInfo;
  };
  permission(flags?: string): number;
}
export interface TextOptions {
  encoding?: TextEncoding;
}
export interface PageRangeOptions {
  type?: number;
  specificRanges?: [number, number][];
}
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
  color?: number[];
  borderWidth?: number;
  borderDash?: number[];
  border?: { width?: number; dash?: number[] };
  quadPoints?: number[];
  flags?: number;
  open?: boolean;
  opacity?: number;
}
export interface DrawPathOptions {
  color?: number | string;
  colorspace?: "rgb" | "gray" | "cmyk";
  type?: "fill" | string;
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
        fit?: "always" | "overflow";
      };
}
export interface TIFFOptions {
  pageIndex?: number;
  objectId?: number;
  bwTreatment?: { asImageMask?: boolean; oneColor?: number[] };
  grayscaleTreatment?: {
    asColorMap?: boolean;
    oneColor?: number[];
    zeroColor?: number[];
  };
}
export interface PDFFormOptions extends PageRangeOptions {
  transformation?: PDFMatrix;
  additionalObjectIds?: number[];
}
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
  read(amount: number): number[];
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
  calculateTextDimensions(text: string, size?: number): TextDimensions;
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
  addProcsetResource(name: string): void;
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
  writeLiteralStringValue(value: string | ByteSource): this;
  writeHexStringValue(value: string | ByteSource): this;
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
  endArray(separator?: number): this;
  writeNumber(value: number): this;
  writeIndirectObjectReference(id: number, generation?: number): this;
  writeBoolean(value: boolean): this;
  writeName(value: string): this;
  writeLiteralString(value: string | ByteSource): this;
  writeHexString(value: string | ByteSource): this;
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
  v(x1: number, y1: number, x2: number, y2: number): this;
  y(x1: number, y1: number, x2: number, y2: number): this;
  h(): this;
  re(x: number, y: number, width: number, height: number): this;
  q(): this;
  Q(): this;
  cm(...matrix: PDFMatrix): this;
  w(value: number): this;
  J(value: number): this;
  j(value: number): this;
  M(value: number): this;
  d(dash: number[], phase?: number): this;
  g(value: number): this;
  G(value: number): this;
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
  Tr(value: number): this;
  Ts(value: number): this;
  Tf(font: PDFUsedFont | string, size: number): this;
  Tj(text: string | Glyph[], options?: TextOptions): this;
  Quote(text: string | Glyph[], options?: TextOptions): this;
  DoubleQuote(
    wordSpace: number,
    characterSpace: number,
    text: string | Glyph[],
    options?: TextOptions,
  ): this;
  TJ(...items: (string | number | Glyph[] | TextOptions)[]): this;
  ri(name: string): this;
  i(value: number): this;
  gs(name: string): this;
  CS(name: string): this;
  cs(name: string): this;
  SC(...components: number[]): this;
  SCN(...componentsAndPattern: (number | string | number[])[]): this;
  sc(...components: number[]): this;
  scn(...componentsAndPattern: (number | string | number[])[]): this;
  doXObject(xObject: string | number | FormXObject | ImageXObject): this;
  drawPath(points: [number, number][], options?: DrawPathOptions): this;
  drawPath(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    ...coordinatesAndOptions: [...number[], DrawPathOptions]
  ): this;
  drawCircle(
    x: number,
    y: number,
    radius: number,
    options?: DrawPathOptions,
  ): this;
  drawSquare(
    x: number,
    y: number,
    edge: number,
    options?: DrawPathOptions,
  ): this;
  drawRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    options?: DrawPathOptions,
  ): this;
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
  trapped: number;
  addAdditionalInfoEntry(key: string, value: string): void;
  removeAdditionalInfoEntry(key: string): void;
  clearAdditionalInfoEntries(): void;
  getAdditionalInfoEntry(key: string): string;
  getAdditionalInfoEntries(): Record<string, string>;
  setCreationDate(value: string | Date | PDFDate): void;
  setModDate(value: string | Date | PDFDate): void;
}

export interface PDFByteReader {
  read(amount: number): number[];
  notEnded(): boolean;
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
  getType(): number;
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
  textMatrix: [number, number, number, number, number, number];
}
export interface PDFTextExtractionLimits {
  maxElements?: number;
  maxOperands?: number;
  maxTextBytes?: number;
  maxParsedObjects?: number;
}
export interface PDFReader {
  getPagesCount(): number;
  getPageObjectID(index: number): number;
  getPDFLevel(): number;
  getObjectsCount(): number;
  isEncrypted(): boolean;
  getXrefSize(): number;
  getXrefPosition(): number;
  getXrefEntry(
    id: number,
  ): { objectPosition: number; revision: number; type: number } | null;
  getTrailerEntryType(key: string): number | null;
  getTrailer(): PDFDictionary;
  queryDictionaryObject(
    dictionary: PDFDictionary,
    key: string,
  ): PDFObject | undefined;
  queryArrayObject(array: PDFArray, index: number): PDFObject | undefined;
  parseNewObject(id: number): PDFObject;
  parsePageDictionary(index: number): PDFDictionary;
  parsePage(index: number): PDFPageInput;
  extractPageText(
    index: number,
    limits?: PDFTextExtractionLimits,
  ): PDFTextElement[];
  startReadingObjectsFromStream(stream: PDFStreamInput): PDFObjectParser;
  startReadingObjectsFromStreams(streams: PDFArray): PDFObjectParser;
  startReadingFromStream(stream: PDFStreamInput): PDFByteReader;
  startReadingFromStreamForPlainCopying(stream: PDFStreamInput): PDFByteReader;
  getParserStream(): PositionedPDFByteReader;
  getPageInfo(index: number): {
    mediaBox: PDFRectangle;
    rotate: number;
    width: number;
    height: number;
  };
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
    pageBox?: number | PDFRectangle,
    transformation?: PDFMatrix,
  ): number;
  mergePDFPageToFormXObject(
    form: FormXObject | ModifierFormXObject,
    index: number,
  ): this;
  end(): this;
}
export interface PDFWriter {
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
    callback: () => void,
  ): this;
  mergePDFPagesToPage(
    page: PDFPage,
    source: ByteSource,
    options: PageRangeOptions,
    callback: () => void,
  ): this;
  mergePDFPagesToPageAsync(
    page: PDFPage,
    source: AsyncByteSource,
    options?: PageRangeOptions,
  ): Promise<this>;
  mergePDFPagesToPageAsync(
    page: PDFPage,
    source: AsyncByteSource,
    callback: () => void,
  ): Promise<this>;
  mergePDFPagesToPageAsync(
    page: PDFPage,
    source: AsyncByteSource,
    options: PageRangeOptions,
    callback: () => void,
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
  getImageType(
    image: string | ByteSource,
  ): "PDF" | "JPG" | "TIFF" | "PNG" | undefined;
  getImageTypeAsync(
    image: AsyncByteSource,
  ): Promise<"PDF" | "JPG" | "TIFF" | "PNG" | undefined>;
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
    pageBox?: number | PDFRectangle,
    options?: PDFFormOptions,
  ): number[];
  createFormXObjectsFromPDFAsync(
    source: AsyncByteSource,
    pageBox?: number | PDFRectangle,
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
   * All IDs must be positive unsigned 32-bit IDs from this modified PDF.
   */
  replaceObject(
    pageIndex: number,
    sourceObjectId: number,
    replacementObjectId: number,
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
    callback: () => void,
  ): this;
  mergePDFPagesToPage(
    page: PDFPage,
    source: ByteSource,
    options: PageRangeOptions,
    callback: () => void,
  ): this;
  mergePDFPagesToPageAsync(
    page: PDFPage,
    source: AsyncByteSource,
    options?: PageRangeOptions,
  ): Promise<this>;
  mergePDFPagesToPageAsync(
    page: PDFPage,
    source: AsyncByteSource,
    callback: () => void,
  ): Promise<this>;
  mergePDFPagesToPageAsync(
    page: PDFPage,
    source: AsyncByteSource,
    options: PageRangeOptions,
    callback: () => void,
  ): Promise<this>;
  getImageDimensions(
    image: string | ByteSource,
    imageIndex?: number,
  ): ImageDimensions;
  getImageDimensionsAsync(
    image: AsyncByteSource,
    imageIndex?: number,
  ): Promise<ImageDimensions>;
  getImageType(
    image: string | ByteSource,
  ): "PDF" | "JPG" | "TIFF" | "PNG" | undefined;
  getImageTypeAsync(
    image: AsyncByteSource,
  ): Promise<"PDF" | "JPG" | "TIFF" | "PNG" | undefined>;
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
    pageBox?: number | PDFRectangle,
    options?: PDFFormOptions,
  ): number[];
  createFormXObjectsFromPDFAsync(
    source: AsyncByteSource,
    pageBox?: number | PDFRectangle,
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
export interface CompactModifier {
  startPage(index: number): this;
  rectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    options?: { color?: RecipeColor; fill?: RecipeColor; stroke?: RecipeColor },
  ): this;
  circle(
    x: number,
    y: number,
    radius: number,
    options?: { color?: RecipeColor; fill?: RecipeColor; stroke?: RecipeColor },
  ): this;
  line(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options?: { color?: RecipeColor; stroke?: RecipeColor; lineWidth?: number },
  ): this;
  text(
    value: string,
    x: number,
    y: number,
    options: { font: string; fontSize?: number; color?: RecipeColor },
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
  readonly KProcsetImageB: string;
  readonly KProcsetImageC: string;
  readonly KProcsetImageI: string;
  readonly kProcsetPDF: string;
  readonly kProcsetText: string;
  readonly eRangeTypeAll: number;
  readonly eRangeTypeSpecific: number;
  readonly ePDFPageBoxMediaBox: number;
  readonly ePDFPageBoxCropBox: number;
  readonly ePDFPageBoxBleedBox: number;
  readonly ePDFPageBoxTrimBox: number;
  readonly ePDFPageBoxArtBox: number;
  readonly ePDFObjectBoolean: number;
  readonly ePDFObjectLiteralString: number;
  readonly ePDFObjectHexString: number;
  readonly ePDFObjectNull: number;
  readonly ePDFObjectName: number;
  readonly ePDFObjectInteger: number;
  readonly ePDFObjectReal: number;
  readonly ePDFObjectArray: number;
  readonly ePDFObjectDictionary: number;
  readonly ePDFObjectIndirectObjectReference: number;
  readonly ePDFObjectStream: number;
  readonly ePDFObjectSymbol: number;
  readonly eTokenSeparatorSpace: number;
  readonly eTokenSeparatorEndLine: number;
  readonly eTokenSeparatorNone: number;
  readonly eXrefEntryExisting: number;
  readonly eXrefEntryDelete: number;
  readonly eXrefEntryStreamObject: number;
  readonly eXrefEntryUndefined: number;
  readonly EInfoTrappedTrue: number;
  readonly EInfoTrappedFalse: number;
  readonly EInfoTrappedUnknown: number;
  getTypeLabel(type: number): string;
}
export interface MuhammaraWasmOptions {
  locateFile?: (path: string, prefix: string) => string;
  limits?: {
    maxInputBytes?: number;
    maxOutputBytes?: number;
  };
  [key: string]: unknown;
}
export function createMuhammaraWasm(
  options?: MuhammaraWasmOptions,
): Promise<MuhammaraWasm>;

/** Loads the separate browser Recipe constructor. Recipe accepts byte assets only. */
export function createRecipe(
  options?: MuhammaraWasmOptions,
): Promise<RecipeConstructor>;
