declare namespace muhammara {
  type EventEmitter = import("events").EventEmitter;
  export type PosX = number;
  export type PosY = number;
  export type Width = number;
  export type Height = number;

  export type FilePath = string;

  export let PDFPageModifier: PDFPageModifier;
  export let PDFWStreamForFile: PDFWStreamForFile;
  export let PDFRStreamForFile: PDFRStreamForFile;
  export let PDFRStreamForBuffer: PDFRStreamForBuffer;
  export let PDFWStreamForBuffer: PDFWStreamForBuffer;
  export let PDFStreamForResponse: PDFStreamForResponse;
  export let PDFDate: {
    new (value?: string | Date): PDFDate;
  };
  export let PDFTextString: {
    new (value?: string | number[]): PDFTextString;
  };

  export function createWriter(
    input: FilePath | WriteStream,
    options?: PDFWriterOptions,
  ): PDFWriter;
  export function createWriterToModify(
    inFile: FilePath,
    options?: PDFWriterToModifyOptions,
  ): PDFWriter;
  export function createWriterToModify(
    inStream: ReadStream,
    outStream: WriteStream,
    options?: PDFWriterToModifyOptions,
  ): PDFWriter;

  export function createWriterToContinue(
    restartFile: string,
    restartStateFile: string,
    options?: PDFWriterToContinueOptions,
  ): PDFWriter;
  export function createReader(
    input: FilePath | ReadStream,
    options?: PDFReaderOptions,
  ): PDFReader;
  export function recrypt(
    originalPdfPath: FilePath,
    newPdfPath: FilePath,
    options?: PDFRecryptOptions,
  ): void;
  export function recrypt(
    originalPdfStream: PDFRStreamForFile | PDFRStreamForBuffer,
    newPdfStream: PDFWStreamForFile | PDFWStreamForBuffer,
    options?: PDFRecryptOptions,
  ): void;

  /**
   * A JavaScript output stream. `write` receives each chunk as a `Buffer` the
   * stream owns and may keep, and returns the number of bytes it accepted.
   */
  export interface WriteStream {
    write(inBytes: Buffer): number;
    getCurrentPosition(): number;
  }

  /**
   * A JavaScript log sink. `write` receives each chunk as a `Buffer` the sink
   * owns and may keep, and returns the number of bytes it accepted.
   */
  export interface LogStream {
    write(inBytes: Buffer): number;
  }

  /**
   * A JavaScript input stream. `read` returns at most `inAmount` bytes as a
   * `Uint8Array` (a `Buffer` qualifies) or an array of byte values.
   */
  export interface ReadStream {
    read(inAmount: number): Uint8Array | number[];
    notEnded(): boolean;
    setPosition(inPosition: number): void;
    setPositionFromEnd(inPosition: number): void;
    skip(inAmount: number): void;
    getCurrentPosition(): number;
    moveStartPosition(inPosition: number): void;
  }

  export interface PDFPageInput {
    getDictionary(): PDFDictionary;
    getMediaBox(): PDFBox;
    getCropBox(): PDFBox;
    getTrimBox(): PDFBox;
    getBleedBox(): PDFBox;
    getArtBox(): PDFBox;
    getRotate(): number;
  }

  export interface PDFPageModifier {
    new (
      writer: PDFWriter,
      pageIndex?: number,
      ensureContentEncapsulation?: boolean,
    ): PDFPageModifier;
    startContext(): this;
    getContext(): XObjectContentContext;
    endContext(): this;
    attachURLLinktoCurrentPage(
      inUrl: string,
      left: number,
      bottom: number,
      right: number,
      top: number,
    ): this;
    writePage(): this;
  }

  export type PDFImageType = "JPG" | "PDF" | "PNG" | "TIFF";

  export interface PDFRStreamForFile extends ReadStream {
    new (inPath: FilePath): PDFRStreamForFile;
    read(inAmount: number): Buffer;
    close(inCallback?: () => void): void;
  }

  export interface PDFRStreamForBuffer extends ReadStream {
    new (buffer: Buffer): PDFRStreamForBuffer;
    read(inAmount: number): Buffer;
  }

  export interface ColorOptions {
    colorspace?: string;
    color?: string | number;
  }

  /**
   * Paint operation a drawing helper finishes its path with. `"stroke"` is the
   * default when `type` is omitted, `"fill"` fills the path, and `"clip"`
   * intersects the clipping region without painting; scope it with q()/Q().
   * `null` selects no paint operation and ends the path unpainted.
   */
  /** Paint operations for the `type` option of the drawing helpers. */
  export const DrawingPathType: {
    readonly STROKE: "stroke";
    readonly FILL: "fill";
    readonly CLIP: "clip";
  };
  export type DrawingPathType =
    (typeof DrawingPathType)[keyof typeof DrawingPathType] | null;

  export interface GraphicOptions extends ColorOptions {
    type?: DrawingPathType;
    width?: number;
    close?: boolean;
  }
  export type TransformationMatrix = [
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ];

  export type LineJoinStyle = 0 | 1 | 2;

  export type EEncoding = "text" | "code" | "hex";

  export const LineCapStyle: {
    readonly LINECAP_BUTT: 0;
    readonly LINECAP_ROUND: 1;
    readonly LINECAP_SQUARE: 2;
  };
  export type LineCapStyle = (typeof LineCapStyle)[keyof typeof LineCapStyle];

  export interface TextRenderOptions {
    encoding?: EEncoding;
  }

  export type Glyph = Array<[number, number]>;

  export interface AbstractContentContext {
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
    m(x: PosX, y: PosY): this;
    l(x: PosX, y: PosY): this;
    c(x1: PosX, y1: PosY, x2: PosX, y2: PosY, x3: PosX, y3: PosY): this;
    v(x2: PosX, y2: PosY, x3: PosX, y3: PosY): this;
    y(x1: PosX, y1: PosY, x3: PosX, y3: PosY): this;
    h(): this;
    re(left: number, bottom: number, width: Width, height: Height): this;
    q(): this;
    Q(): this;
    /**
     * a b 0
     * c d 0
     * e f 1
     */
    cm(...args: TransformationMatrix): this;
    w(lineWidth: Width): this;
    J(lineCapStyle: LineCapStyle): this;
    j(lineJoinStyle: LineJoinStyle): this;
    M(miterLimit: number): this;
    /** The dash phase defaults to 0. */
    d(dashArray: number[], dashPhase?: number): this;
    ri(renderingIntentName: string): this;
    i(flatness: number): this;
    gs(graphicStateName: string): this;
    setOpacity(opacity: number): this;
    CS(colorSpaceName: string): this;
    cs(colorSpaceName: string): this;
    SC(...colorComponents: number[]): this;
    SCN(...parameters: any[]): this; // This can't be materialized in TypeScript
    ////SCN(...colorComponents: number[], patternName?: string): this;
    SCN(colorComponents: number[], patternName?: string): this;
    sc(...colorComponents: number[]): this;
    scn(...parameters: any[]): this; // This can't be materialized in TypeScript
    ////scn(...colorComponents: number[], patternName?: string): this;
    scn(colorComponents: number[], patternName?: string): this;
    G(gray: number): this;
    g(gray: number): this;
    RG(r: number, g: number, b: number): this;
    rg(r: number, g: number, b: number): this;
    K(c: number, m: number, y: number, k: number): this;
    k(c: number, m: number, y: number, k: number): this;
    W(): this;
    WStar(): this;
    /** A resource name, an XObject, or a form XObject object ID. */
    doXObject(
      xObject: string | FormXObjectId | FormXObject | ImageXObject,
    ): this;
    Tc(characterSpace: number): this;
    Tw(wordSpace: number): this;
    Tz(horizontalScaling: number): this;
    TL(textLeading: number): this;
    Tr(renderingMode: number): this;
    Ts(fontRise: number): this;
    BT(): this;
    ET(): this;
    Td(tX: number, tY: number): this;
    TD(tX: number, tY: number): this;
    Tm(a: number, b: number, c: number, d: number, e: number, f: number): this;
    TStar(): this;
    Tf(fontReferenced: UsedFont | string, fontSize: number): this;
    Tj(text: string, options?: TextRenderOptions): this;
    Tj(glyphs: Glyph): this;
    Tj(text: string | Glyph): this;
    Quote(text: string, options?: TextRenderOptions): this;
    Quote(glyphs: Glyph): this;
    Quote(text: string | Glyph): this;
    DoubleQuote(
      wordSpacing: number,
      characterSpacing: number,
      text: string,
      options?: TextRenderOptions,
    ): this;
    DoubleQuote(
      wordSpacing: number,
      characterSpacing: number,
      glyphs: Glyph,
    ): this;
    DoubleQuote(
      wordSpacing: number,
      characterSpacing: number,
      text: string | Glyph,
    ): this;
    /** Pass the TJ array items as separate arguments: strings with numeric kerning adjustments, optionally followed by options. */
    TJ(...items: (string | number)[]): this;
    TJ(
      ...items: [string | number, ...(string | number)[], TextRenderOptions]
    ): this;
    /** Glyph variant: glyph lists with numeric kerning adjustments. */
    TJ(...items: (Glyph | number)[]): this;
    writeFreeCode(freeCode: string): this;
    /** Require at least two complete finite coordinate pairs; invalid input emits no operators. */
    drawPath(...parameters: any[]): this; // This can't be materialized in TypeScript
    ////drawPath(...xyPairs: number[], options: GraphicOptions): this;
    drawPath(xyPairs: Array<[number, number]>, options: GraphicOptions): this;
    /** Coordinates, radius, and calculated circle geometry must remain finite. */
    drawCircle(x: PosX, y: PosY, r: number, options?: GraphicOptions): this;
    /** Coordinates and edge length must be finite. */
    drawSquare(x: PosX, y: PosY, l: number, options?: GraphicOptions): this;
    /** Coordinates and dimensions must be finite. */
    drawRectangle(
      x: PosX,
      y: PosY,
      w: number,
      h: number,
      options?: GraphicOptions,
    ): this;
    /** Coordinates, font size, and calculated underline geometry must remain finite. */
    writeText(text: string, x: PosX, y: PosY, options?: WriteTextOptions): this;
    drawImage(
      x: PosX,
      y: PosY,
      imagePath: string,
      options?: ImageOptions,
    ): this;
  }

  export interface TransformationObject {
    width: number;
    height: number;
    proportional?: boolean;
    fit?: "always" | "overflow";
  }

  export interface ImageOptions {
    index?: number;
    transformation?: number[] | TransformationObject;
    password?: string;
  }

  export interface FontOptions {
    size?: number;
    font?: UsedFont;
  }

  export interface WriteTextOptions extends FontOptions, ColorOptions {
    underline?: boolean;
    strikeOut?: boolean;
    lineWidth?: number;
  }

  export interface XObjectContentContext extends AbstractContentContext {}

  export interface PDFWStreamForFile extends WriteStream {
    new (inPath: string): PDFWStreamForFile;
    /** Also accepts an array of byte values when called directly. */
    write(inBytes: Buffer | number[]): number;
    close(inCallback?: () => void): void;
  }

  export interface PDFStreamForResponse extends WriteStream {
    new (res: NodeJS.WritableStream): PDFStreamForResponse;
    /** Also accepts an array of byte values when called directly. */
    write(inBytes: Buffer | number[]): number;
  }

  export interface PDFWStreamForBuffer extends WriteStream {
    new (): PDFWStreamForBuffer;
    /** Also accepts an array of byte values when called directly. */
    write(inBytes: Buffer | number[]): number;
    buffer: Buffer | null;
  }

  export interface PDFReaderOptions {
    password?: string;
  }

  export interface PDFWriterToModifyOptions extends PDFWriterOptions {
    modifiedFilePath?: string;
  }

  export interface PDFWriterToContinueOptions {
    modifiedFilePath?: string;
    modifiedStream?: PDFRStreamForFile; // TODO
    /** Log file path or synchronous byte writer returning the number of bytes written. */
    log?: string | LogStream;
  }

  export interface PDFRecryptOptions extends PDFWriterOptions {
    password?: string;
  }

  export const ePDFVersion10 = 10;
  export const ePDFVersion11 = 11;
  export const ePDFVersion12 = 12;
  export const ePDFVersion13 = 13;
  export const ePDFVersion14 = 14;
  export const ePDFVersion15 = 15;
  export const ePDFVersion16 = 16;
  export const ePDFVersion17 = 17;
  export const ePDFVersion20 = 20;
  export const ePDFVersionUndefined = 0;
  export type EPDFVersion = 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 20;

  export const KProcsetImageB = "ImageB";
  export const KProcsetImageC = "ImageC";
  export const KProcsetImageI = "ImageI";
  export const kProcsetPDF = "PDF";
  export const kProcsetText = "Text";

  export const ePDFObjectBoolean = 0;
  export const ePDFObjectLiteralString = 1;
  export const ePDFObjectHexString = 2;
  export const ePDFObjectNull = 3;
  export const ePDFObjectName = 4;
  export const ePDFObjectInteger = 5;
  export const ePDFObjectReal = 6;
  export const ePDFObjectArray = 7;
  export const ePDFObjectDictionary = 8;
  export const ePDFObjectIndirectObjectReference = 9;
  export const ePDFObjectStream = 10;
  export const ePDFObjectSymbol = 11;
  export type PDFObjectType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
  export function getTypeLabel(type: PDFObjectType): string;

  export const ePDFPageContentItemText = 0;
  export const ePDFPageContentItemPath = 1;
  export const ePDFPageContentItemXObject = 2;
  export const ePDFPageContentItemShading = 3;
  export type PDFPageContentItemType =
    | typeof ePDFPageContentItemText
    | typeof ePDFPageContentItemPath
    | typeof ePDFPageContentItemXObject
    | typeof ePDFPageContentItemShading;

  export const ePDFPageBoxMediaBox = 0;
  export const ePDFPageBoxCropBox = 1;
  export const ePDFPageBoxBleedBox = 2;
  export const ePDFPageBoxTrimBox = 3;
  export const ePDFPageBoxArtBox = 4;
  export type PDFPageBoxType = 0 | 1 | 2 | 3 | 4;
  export type PageBox = "media" | "crop" | "bleed" | "trim" | "art";

  export const eRangeTypeAll = 0;
  export const eRangeTypeSpecific = 1;
  export type eRangeType = 0 | 1;

  export interface PDFWriterOptions {
    version?: EPDFVersion;
    log?: string;
    compress?: boolean;

    userPassword?: string;
    ownerPassword?: string;
    userProtectionFlag?: number;
  }

  type FormXObjectId = number;

  export interface FormXObject {
    id: FormXObjectId;
    getContentContext(): XObjectContentContext;
    getContentStream(): PDFStream;
    getResourcesDictionary(): ResourcesDictionary;
  }

  export interface ResourcesDictionary {
    /**
     * Adds a form XObject to the resources and returns its resource name.
     * @param formXObjectId - The object ID.
     * @returns The resource name to use in content-stream operators.
     * @throws {TypeError} If formXObjectId is not a single number.
     */
    addFormXObjectMapping(formXObjectId: FormXObjectId): string;
    /**
     * Adds an image XObject to the resources and returns its resource name.
     * @param imageXObject - The image, or its object ID.
     * @returns The resource name to use in content-stream operators.
     * @throws {TypeError} If imageXObject is neither an image nor a number.
     */
    addImageXObjectMapping(imageXObject: ImageXObject | number): string;
    /**
     * Adds a procedure set name to the ProcSet array.
     * @param procSetName - The procedure set, for example PDF or Text.
     * @throws {TypeError} If procSetName is not a single string.
     */
    addProcsetResource(procSetName: string): void;
    /**
     * Adds a graphics state dictionary to the resources and returns its resource name.
     * @param stateObjectId - The object ID.
     * @returns The resource name to use in content-stream operators.
     * @throws {TypeError} If stateObjectId is not a single number.
     */
    addExtGStateMapping(stateObjectId: number): string;
    /**
     * Adds a font to the resources and returns its resource name.
     * @param fontObjectId - The object ID.
     * @returns The resource name to use in content-stream operators.
     * @throws {TypeError} If fontObjectId is not a single number.
     */
    addFontMapping(fontObjectId: number): string;
    /**
     * Adds a color space to the resources and returns its resource name.
     * @param colorSpaceId - The object ID.
     * @returns The resource name to use in content-stream operators.
     * @throws {TypeError} If colorSpaceId is not a single number.
     */
    addColorSpaceMapping(colorSpaceId: number): string;
    /**
     * Adds a pattern to the resources and returns its resource name.
     * @param patternObjectId - The object ID.
     * @returns The resource name to use in content-stream operators.
     * @throws {TypeError} If patternObjectId is not a single number.
     */
    addPatternMapping(patternObjectId: number): string;
    /**
     * Adds a marked-content property list to the resources and returns its resource name.
     * @param propertyObjectId - The object ID.
     * @returns The resource name to use in content-stream operators.
     * @throws {TypeError} If propertyObjectId is not a single number.
     */
    addPropertyMapping(propertyObjectId: number): string;
    addXObjectMapping(xObjectId: number): string;
    addShadingMapping(xObjectId: number): string;
  }

  export type PDFBox = [PosX, PosY, Width, Height];

  export interface PDFPage {
    mediaBox?: PDFBox;
    cropBox?: PDFBox;
    bleedBox?: PDFBox;
    trimBox?: PDFBox;
    artBox?: PDFBox;
    rotate?: number;
    getResourcesDictionary(): ResourcesDictionary;
  }

  export interface TextDimension {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
    width: number;
    height: number;
  }

  /** A text-showing operation in a page content stream. */
  export interface PDFTextElement {
    /** Raw character codes from the content stream. Unicode decoding requires a font ToUnicode CMap. */
    content: string;
    /** The page resource name selected by the most recent Tf operation. */
    fontResource: string;
    fontSize: number;
    /** The text-to-page matrix after applying the active graphics CTM: [a, b, c, d, e, f]. */
    textMatrix: [number, number, number, number, number, number];
  }

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

  export interface RectangleDimension {
    width: Width;
    height: Height;
  }

  export interface UsedFont {
    /** Measure a string, or a list of glyph ids. The font size defaults to 1. */
    calculateTextDimensions(
      text: string | number[],
      fontSize?: number,
    ): TextDimension;
    getFontMetrics(fontSize?: number): FontMetrics;
  }

  export interface FontMetrics {
    pixelsPerEm: { x: number; y: number; xScale: number; yScale: number };
    ascender: number;
    descender: number;
    height: number;
    max_advance: number;
  }

  export interface ByteWriter {
    write(buffer: Uint8Array | number[]): number;
  }

  export interface ByteReader {
    read(length: number): Buffer;
    notEnded(): boolean;
  }

  export interface ByteReaderWithPosition {
    read(length: number): Buffer;
    notEnded(): boolean;
    getCurrentPosition(): number;
    skip(length: number): this;
    setPosition(position: number): this;
    setPositionFromEnd(position: number): this;
  }

  export interface PDFReader {
    /**
     * Ends the reader and closes its file; later calls throw. Safe to repeat.
     * @returns This reader.
     */
    end(): PDFReader;
    /**
     * Returns the PDF version from the file header, for example 1.7.
     * @returns The PDF version.
     * @throws {TypeError} If the reader has ended.
     */
    getPDFLevel(): number;
    /**
     * Returns the number of pages.
     * @returns The page count.
     * @throws {TypeError} If the reader has ended.
     */
    getPagesCount(): number;
    /**
     * Returns the trailer dictionary.
     * @returns The trailer; undefined when the file has none.
     * @throws {TypeError} If the reader has ended.
     */
    getTrailer(): PDFDictionary;
    /**
     * Returns a dictionary value, resolving an indirect reference.
     * @param dictionary - The dictionary to read.
     * @param name - The key, without a leading slash.
     * @returns The value; undefined when the key is missing.
     * @throws {TypeError} If the reader has ended or the arguments are not a
     *   dictionary and a string.
     */
    queryDictionaryObject(dictionary: PDFDictionary, name: string): PDFObject;
    /**
     * Returns an array item, resolving an indirect reference.
     * @param objectList - The array to read.
     * @param index - The zero-based item index.
     * @returns The item; undefined when the index is out of range.
     * @throws {TypeError} If the reader has ended or the arguments are not an
     *   array and a number.
     */
    queryArrayObject(
      objectList: PDFArray,
      index: number,
    ): undefined | PDFObject;
    /**
     * Parses an indirect object by its ID.
     * @param objectId - The object ID.
     * @returns The parsed object.
     * @throws {TypeError} If the reader has ended, objectId is not a non-negative
     *   integer, or the object cannot be read.
     */
    parseNewObject(objectId: number): PDFObject;
    /**
     * Returns the object ID of a page.
     * @param pageIndex - The zero-based page index.
     * @returns The page object ID; 0 when the page does not exist.
     * @throws {TypeError} If the reader has ended or pageIndex is not a
     *   non-negative integer.
     */
    getPageObjectID(pageIndex: number): number;
    /**
     * Parses a page dictionary.
     * @param pageIndex - The zero-based page index.
     * @returns The page dictionary.
     * @throws {TypeError} If the reader has ended.
     * @throws {TypeError} If pageIndex is not a non-negative integer or the page
     *   cannot be read.
     */
    parsePageDictionary(pageIndex: number): PDFDictionary;
    /**
     * Parses a page with helpers for its boxes and rotation.
     * @param pageIndex - The zero-based page index.
     * @returns The page.
     * @throws {TypeError} If the reader has ended.
     * @throws {TypeError} If pageIndex is not a non-negative integer or the page
     *   cannot be read.
     */
    parsePage(pageIndex: number): PDFPageInput;
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
    /**
     * Returns the number of objects in the cross-reference table.
     * @returns The object count.
     * @throws {TypeError} If the reader has ended.
     */
    getObjectsCount(): number;
    /**
     * Tells whether the PDF is encrypted.
     * @returns True when the PDF is encrypted.
     * @throws {TypeError} If the reader has ended.
     */
    isEncrypted(): boolean;
    /**
     * Returns the size of the cross-reference table.
     * @returns The number of cross-reference entries.
     * @throws {TypeError} If the reader has ended.
     */
    getXrefSize(): number;
    /**
     * Returns the cross-reference entry of an object.
     * @param objectId - The object ID.
     * @returns The entry: byte position, revision and entry type.
     * @throws {TypeError} If the reader has ended, objectId is not a non-negative
     *   integer, or it is out of range.
     */
    getXrefEntry(objectId: number): {
      objectPosition: number;
      revision: number;
      type: number;
    };
    /**
     * Returns the byte position of the last cross-reference section.
     * @returns The byte position.
     * @throws {TypeError} If the reader has ended.
     */
    getXrefPosition(): number;
    /**
     * Opens a stream's contents with its filters decoded.
     * @param inputStream - The stream to read.
     * @returns A reader over the decoded bytes.
     * @throws {TypeError} If the reader has ended or inputStream is not a stream.
     * @throws {Error} If the stream cannot be read.
     */
    startReadingFromStream(inputStream: PDFStreamInput): ByteReader;
    /**
     * Opens a stream's contents as stored, decrypted but not decoded.
     * @param inputStream - The stream to read.
     * @returns A reader over the stored bytes.
     * @throws {TypeError} If the reader has ended or inputStream is not a stream.
     * @throws {Error} If the stream cannot be read.
     */
    startReadingFromStreamForPlainCopying(
      inputStream: PDFStreamInput,
    ): ByteReader;
    /**
     * Parses a content stream as a sequence of objects.
     * @param stream - The stream to parse.
     * @returns A parser returning one object per call.
     * @throws {TypeError} If the reader has ended or stream is not a stream.
     * @throws {Error} If the stream cannot be read.
     */
    startReadingObjectsFromStream(stream: PDFStreamInput): PDFObjectParser;
    /**
     * Parses several content streams as one sequence of objects, as for a
     * page whose Contents is an array.
     * @param streams - The array of stream references.
     * @returns A parser returning one object per call.
     * @throws {TypeError} If the reader has ended or streams is not an array.
     */
    startReadingObjectsFromStreams(streams: PDFArray): PDFObjectParser;
    /**
     * Returns the underlying stream the reader parses.
     * @returns The positioned byte reader.
     * @throws {TypeError} If the reader has ended.
     */
    getParserStream(): ByteReaderWithPosition;
  }

  export interface PDFObjectParser {
    /**
     * Parses the next object.
     * @returns The object; undefined at the end.
     */
    parseNewObject(): PDFObject | undefined;
  }

  export interface PDFStream {
    /**
     * Returns the writer for the stream contents.
     * @returns The byte writer.
     */
    getWriteStream(): ByteWriter;
  }

  export interface PDFNull extends PDFObject {
    value: void;
  }

  export interface PDFName extends PDFObject {
    value: string;
  }

  export interface PDFLiteralString extends PDFObject {
    /**
     * Decodes the string as a PDF text string, PDFDocEncoding or UTF-16BE.
     * @returns The text.
     */
    toText(): string;
    /**
     * Returns the raw bytes of the string.
     * @returns The byte values.
     */
    toBytesArray(): number[];
    value: string;
  }

  export interface PDFInteger extends PDFObject {
    value: number;
  }

  export interface PDFIndirectObjectReference extends PDFObject {
    /**
     * Returns the referenced object ID.
     * @returns The object ID.
     */
    getObjectID(): number;
    /**
     * Returns the referenced generation number.
     * @returns The generation number.
     */
    getVersion(): number;
  }

  export interface PDFHexString extends PDFObject {
    value: string;
  }

  export interface PDFDictionary extends PDFObject {
    /**
     * Returns the entries, without resolving indirect references.
     * @returns The values by key.
     */
    toJSObject(): { [key: string]: PDFObject };
    /**
     * Tells whether a key exists.
     * @param inName - The key, without a leading slash.
     * @returns True when the key exists.
     * @throws {TypeError} If inName is not a single string.
     */
    exists(inName: string): boolean;
    /**
     * Returns a value, without resolving an indirect reference.
     * @param inName - The key, without a leading slash.
     * @returns The value.
     * @throws {TypeError} If inName is not a single string or the key is
     *   missing.
     */
    queryObject(inName: string): PDFObject;
  }

  export interface PDFDate {
    /**
     * Returns the date in PDF date format, for example
     * D:20260926120000+02'00'.
     * @returns The PDF date string.
     */
    toString(): string;
    /**
     * Sets the date to now.
     * @returns This date.
     */
    setToCurrentTime(): this;
  }

  export interface PDFBoolean extends PDFObject {
    value: boolean;
  }

  export interface PDFArray extends PDFObject {
    /**
     * Returns the items, without resolving indirect references.
     * @returns The items as PDF objects.
     */
    toJSArray(): Array<any>;
    /**
     * Returns an item, without resolving an indirect reference.
     * @param index - The zero-based item index.
     * @returns The item as a PDF object.
     * @throws {TypeError} If index is not a number or is out of range.
     */
    queryObject(index: number): any;
    /**
     * Returns the number of items.
     * @returns The length.
     */
    getLength(): number;
  }

  export interface OutputFile {
    openFile(filePath: FilePath, append?: boolean): void;
    closeFile(): void;
    getFilePath(): string | undefined;
    getOutputStream(): ByteWriterWithPosition | undefined;
  }

  export interface InputFile {
    openFile(filePath: FilePath): void;
    closeFile(): void;
    getFilePath(): string | undefined;
    getFileSize(): number | undefined;
    getInputStream(): ByteReaderWithPosition | undefined;
  }

  export type EInfoTrapped = 0 | 1 | 2;
  export const EInfoTrappedTrue = 0;
  export const EInfoTrappedFalse = 1;
  export const EInfoTrappedUnknown = 2;

  export interface InfoDictionary {
    addAdditionalInfoEntry(key: string, value: string): void;
    removeAdditionalInfoEntry(key: string): void;
    clearAdditionalInfoEntries(): void;
    getAdditionalInfoEntry(key: string): string;
    /** @param key Ignored; kept so 6.x calls that passed a key still compile. */
    getAdditionalInfoEntries(key?: string): { [key: string]: string };
    setCreationDate(date: string | Date | PDFDate): void;
    setModDate(date: string | Date | PDFDate): void;

    title: string;
    author: string;
    subject: string;
    keywords: string;
    creator: string;
    producer: string;
    trapped: EInfoTrapped;
  }

  export interface ImageXObject {
    id: number;
  }

  export interface FormObject {
    id: number;
    getContentContext(): XObjectContentContext;
    getResourcesDictinary(): ResourcesDictionary;
    getResourcesDictionary(): ResourcesDictionary;
    getContentStream(): PDFStream;
  }

  export interface DocumentCopyingContext {
    /**
     * Ends the copying context and releases its source; later calls throw.
     * @returns This context.
     */
    end(): DocumentCopyingContext;
    /**
     * Creates a form XObject from a source page.
     * @param sourcePageIndex - The zero-based source page index.
     * @param ePDFPageBox - The page box to use, or an explicit [left, bottom,
     *   right, top].
     * @param transformation - The form matrix.
     * @returns The form object ID.
     * @throws {TypeError} If the arguments are wrong or the page does not exist.
     * @throws {TypeError} If the copying context has ended.
     */
    createFormXObjectFromPDFPage(
      sourcePageIndex: number,
      /** Defaults to the media box. */
      ePDFPageBox?: PDFPageBoxType | PDFBox,
      transformation?: TransformationMatrix,
    ): number;
    /**
     * Draws a source page onto a page of this document.
     * @param target - The target page.
     * @param sourcePageIndex - The zero-based source page index.
     * @throws {TypeError} If the arguments are not a page and a number, or the
     *   source page does not exist.
     * @throws {TypeError} If the copying context has ended.
     */
    mergePDFPageToPage(target: PDFPage, sourcePageIndex: number): void;
    /**
     * Appends a source page as a new page.
     * @param sourcePageNumber - The zero-based source page index.
     * @returns The object ID of the new page.
     * @throws {TypeError} If the argument is not a number or the page does not
     *   exist.
     * @throws {TypeError} If the copying context has ended.
     */
    appendPDFPageFromPDF(sourcePageNumber: number): number;
    /**
     * Draws a source page into a form XObject of this document.
     * @param targetForm - The target form.
     * @param sourcePageIndex - The zero-based source page index.
     * @throws {TypeError} If the arguments are not a form and a number, or the
     *   source page does not exist.
     * @throws {TypeError} If the copying context has ended.
     */
    mergePDFPageToFormXObject(
      targetForm: FormXObject,
      sourcePageIndex: number,
    ): void;
    getSourceDocumentParser(): PDFReader;
    /**
     * Writes a source object at the current output position, copying the
     * objects it references later.
     * @param objectToCopy - The source object.
     * @throws {TypeError} If objectToCopy is not a PDF object or cannot be copied.
     * @throws {TypeError} If the copying context has ended.
     */
    copyDirectObjectAsIs(objectToCopy: PDFObject): void;
    /**
     * Copies a source indirect object and the objects it references.
     * @param objectId - The source object ID.
     * @returns The object ID in this document.
     * @throws {TypeError} If objectId is not a number or the object cannot be
     *   copied.
     * @throws {TypeError} If the copying context has ended.
     */
    copyObject(objectId: number): number;
    /**
     * Writes a source object at the current output position. The objects it
     * references are not copied yet; pass the returned IDs to
     * copyNewObjectsForDirectObject() once the current object ends.
     * @param objectToCopy - The source object.
     * @returns The source IDs of the referenced objects still to copy.
     * @throws {TypeError} If objectToCopy is not a PDF object or cannot be copied.
     * @throws {TypeError} If the copying context has ended.
     */
    copyDirectObjectWithDeepCopy(objectToCopy: PDFObject): Array<number>;
    /**
     * Copies the objects returned by copyDirectObjectWithDeepCopy().
     * @param objectIds - The source object IDs.
     * @throws {TypeError} If objectIds is not an array or the objects cannot be
     *   copied.
     * @throws {TypeError} If the copying context has ended.
     */
    copyNewObjectsForDirectObject(objectIds: Array<number>): void;
    /**
     * Returns the ID in this document of an already copied source object.
     * @param objectId - The source object ID.
     * @returns The object ID in this document.
     * @throws {TypeError} If objectId is not a number or has not been copied.
     * @throws {TypeError} If the copying context has ended.
     */
    getCopiedObjectID(objectId: number): number;
    /**
     * Returns every copied source object ID with its ID in this document.
     * @returns The map from source object ID to object ID in this document.
     * @throws {TypeError} If the copying context has ended.
     */
    getCopiedObjects(): { [key: string]: number };
    /**
     * Makes later copies reference existing objects instead of copying the
     * given source objects.
     * @param replaceMap - The map from source object ID to object ID in this
     *   document.
     * @throws {TypeError} If replaceMap is not an object or a key is not an
     *   unsigned integer.
     * @throws {TypeError} If the copying context has ended.
     */
    replaceSourceObjects(replaceMap: { [key: string]: number }): void;
    /**
     * Returns the stream the source PDF is read from.
     * @returns The positioned byte reader.
     * @throws {TypeError} If the copying context has ended.
     */
    getSourceDocumentStream(): ByteReaderWithPosition;
  }

  export interface DocumentContext {
    /**
     * Returns the document information dictionary written with the PDF.
     * @returns The info dictionary.
     * @throws {TypeError} If the context was not created by a writer.
     */
    getInfoDictionary(): InfoDictionary;
  }

  export interface DictionaryContext {
    /**
     * Writes a dictionary key.
     * @param key - The key, without a leading slash.
     * @returns This dictionary context.
     * @throws {TypeError} If key is not a single string.
     */
    writeKey(key: string): DictionaryContext;
    /**
     * Writes a name as the value of the last key.
     * @param nameValue - The name, without a leading slash.
     * @returns This dictionary context.
     * @throws {TypeError} If nameValue is not a single string.
     */
    writeNameValue(nameValue: string): this;
    /**
     * Writes a rectangle array as the value of the last key.
     * @param values - The rectangle [left, bottom, right, top].
     * @returns This dictionary context.
     * @throws {TypeError} If the arguments are not an array of 4 numbers or 4 numbers.
     */
    writeRectangleValue(values: Array<number>): this;
    writeRectangleValue(a: number, b: number, c: number, d: number): this;
    /**
     * Writes a literal string as the value of the last key.
     * @param literal - The text, or its byte values.
     * @returns This dictionary context.
     * @throws {TypeError} If literal is not a single string or array.
     */
    writeLiteralStringValue(literal: Array<number> | string): this;
    /**
     * Writes a boolean as the value of the last key.
     * @param boolValue - The value.
     * @returns This dictionary context.
     * @throws {TypeError} If boolValue is not a single boolean.
     */
    writeBooleanValue(boolValue: boolean): this;
    /**
     * Writes a number as the value of the last key.
     * @param value - The number.
     * @returns This dictionary context.
     * @throws {TypeError} If value is not a single number.
     */
    writeNumberValue(value: number): this;
    /**
     * Writes an indirect object reference as the value of the last key.
     * @param objectId - The object ID.
     * @returns This dictionary context.
     * @throws {TypeError} If objectId is not a single number.
     */
    writeObjectReferenceValue(objectId: number): this;
  }

  export interface ByteWriterWithPosition {
    write(bytes: Uint8Array | number[]): number;
    getCurrentPosition(): number;
  }

  export const eTokenSeparatorSpace = 0;
  export const eTokenSeparatorEndLine = 1;
  export const eTokenSeparatorNone = 2;
  export const ETokenSeparator: {
    readonly eTokenSeparatorSpace: 0;
    readonly eTokenSeparatorEndLine: 1;
    readonly eTokenSeparatorNone: 2;
  };
  export type ETokenSeparator =
    (typeof ETokenSeparator)[keyof typeof ETokenSeparator];

  export const eXrefEntryExisting = 0;
  export const eXrefEntryDelete = 1;
  export const eXrefEntryStreamObject = 2;
  export const eXrefEntryUndefined = 3;

  export interface ObjectsContext {
    /**
     * Reserves a new object ID, for a forward reference or a later object.
     * @returns The object ID.
     */
    allocateNewObjectID(): FormXObjectId;
    /**
     * Writes the start of a dictionary. End it with endDictionary().
     * @returns The dictionary context for writing keys and values.
     */
    startDictionary(): DictionaryContext;
    /**
     * Writes the start of an array. End it with endArray().
     * @returns This context.
     */
    startArray(): this;
    /**
     * Writes a number, as an integer when it has no fraction.
     * @param value - The number.
     * @returns This context.
     * @throws {TypeError} If value is not a single number.
     */
    writeNumber(value: number): this;
    /**
     * Writes the end of an array.
     * @param endType - The separator after the array; a space when omitted.
     * @returns This context.
     * @throws {TypeError} If endType is given and is not a number.
     */
    endArray(endType?: ETokenSeparator): this;
    /**
     * Writes a line break.
     * @returns This context.
     */
    endLine(): this;
    /**
     * Writes the end of a dictionary.
     * @param dictionary - The dictionary started last.
     * @returns This context.
     * @throws {TypeError} If dictionary is not a dictionary context or not the one started last.
     */
    endDictionary(dictionary: DictionaryContext): this;
    /**
     * Writes the end of the current indirect object.
     * @returns This context.
     */
    endIndirectObject(): this;
    /**
     * Writes a reference to an indirect object.
     * @param objectId - The object ID.
     * @param generationNumber - The generation number; 0 when omitted.
     * @returns This context.
     * @throws {TypeError} If the arguments are not one or two numbers.
     */
    writeIndirectObjectReference(
      objectId: FormXObjectId,
      generationNumber?: number,
    ): this;
    /**
     * Starts an indirect object. Without an ID, allocates one and returns it;
     * with an ID reserved by allocateNewObjectID(), returns this context.
     * @param objectId - A reserved object ID.
     * @returns The new object ID, or this context when objectId is given.
     * @throws {TypeError} If objectId is given and is not a number.
     */
    startNewIndirectObject(objectId: FormXObjectId): this;
    startNewIndirectObject(): FormXObjectId;
    /**
     * Starts a new version of an existing object of the PDF being modified.
     * @param objectId - The object ID to replace.
     * @returns This context.
     * @throws {TypeError} If objectId is not a single number.
     */
    startModifiedIndirectObject(objectId: FormXObjectId): this;
    /**
     * Marks an object as free in the cross-reference table.
     * @param objectId - The object ID.
     * @returns This context.
     * @throws {TypeError} If objectId is not a single number.
     */
    deleteObject(objectId: FormXObjectId): this;
    /**
     * Writes a name object, escaping it as needed.
     * @param name - The name, without a leading slash.
     * @returns This context.
     * @throws {TypeError} If name is not a single string.
     */
    writeName(name: string): this;
    /**
     * Writes a literal string, escaping it as needed.
     * @param literal - The text, or its byte values.
     * @returns This context.
     * @throws {TypeError} If literal is not a single string or array.
     */
    writeLiteralString(literal: string | number[]): this;
    /**
     * Writes a hexadecimal string.
     * @param hex - The bytes as a string of hex digits, or their byte values.
     * @returns This context.
     * @throws {TypeError} If hex is not a single string or array.
     */
    writeHexString(hex: string | number[]): this;
    /**
     * Writes a boolean.
     * @param bool - The value.
     * @returns This context.
     * @throws {TypeError} If bool is not a single boolean.
     */
    writeBoolean(bool: boolean): this;
    /**
     * Writes a keyword, such as a content-stream operator, unescaped.
     * @param keyword - The keyword.
     * @returns This context.
     * @throws {TypeError} If keyword is not a single string.
     */
    writeKeyword(keyword: string): this;
    /**
     * Writes a comment line.
     * @param comment - The comment, without the percent sign.
     * @returns This context.
     * @throws {TypeError} If comment is not a single string.
     */
    writeComment(comment: string): this;
    /**
     * Sets whether later streams are Flate compressed.
     * @param compress - True to compress.
     * @returns This context.
     * @throws {TypeError} If compress is not a single boolean.
     */
    setCompressStreams(compress: boolean): this;
    /**
     * Starts a stream that is compressed when compression is on.
     * @param dictionaryContext - A started stream dictionary to add Length and
     *   Filter to; a new one when omitted.
     * @returns The stream; write to its write stream, then call endPDFStream().
     * @throws {TypeError} If dictionaryContext is given and is not a dictionary context.
     */
    startPDFStream(dictionaryContext?: DictionaryContext): PDFStream;
    /**
     * Starts a stream written as given, never compressed.
     * @param dictionaryContext - A started stream dictionary to add Length to;
     *   a new one when omitted.
     * @returns The stream; write to its write stream, then call endPDFStream().
     * @throws {TypeError} If dictionaryContext is given and is not a dictionary context.
     */
    startUnfilteredPDFStream(dictionaryContext?: DictionaryContext): PDFStream;
    /**
     * Ends a stream and writes its length.
     * @param stream - The stream started last.
     * @returns This context.
     * @throws {TypeError} If stream is not a stream.
     */
    endPDFStream(stream: PDFStream): this;
    /**
     * Gives direct access to the output, for bytes the other methods cannot
     * write. End it with endFreeContext().
     * @returns A writer at the current output position.
     */
    startFreeContext(): ByteWriterWithPosition;
    /**
     * Ends direct output access.
     * @returns This context.
     */
    endFreeContext(): this;
  }

  export interface PDFObject {
    /**
     * Returns the object type.
     * @returns The type, one of the ePDFObject* constants.
     */
    getType(): PDFObjectType;
    /**
     * Returns this object typed as an indirect object reference.
     * @returns This object; undefined when it is not an indirect object reference.
     */
    toPDFIndirectObjectReference(): PDFIndirectObjectReference | undefined;
    /**
     * Returns this object typed as an array.
     * @returns This object; undefined when it is not an array.
     */
    toPDFArray(): PDFArray | undefined;
    /**
     * Returns this object typed as a dictionary.
     * @returns This object; undefined when it is not a dictionary.
     */
    toPDFDictionary(): PDFDictionary | undefined;
    /**
     * Returns this object typed as a stream.
     * @returns This object; undefined when it is not a stream.
     */
    toPDFStream(): PDFStream | undefined;
    /**
     * Returns this object typed as a boolean.
     * @returns This object; undefined when it is not a boolean.
     */
    toPDFBoolean(): PDFBoolean | undefined;
    /**
     * Returns this object typed as a literal string.
     * @returns This object; undefined when it is not a literal string.
     */
    toPDFLiteralString(): PDFLiteralString | undefined;
    /**
     * Returns this object typed as a hex string.
     * @returns This object; undefined when it is not a hex string.
     */
    toPDFHexString(): PDFHexString | undefined;
    /**
     * Returns this object typed as the null object.
     * @returns This object; undefined when it is not the null object.
     */
    toPDFNull(): PDFNull | undefined;
    /**
     * Returns this object typed as a name.
     * @returns This object; undefined when it is not a name.
     */
    toPDFName(): PDFName | undefined;
    /**
     * Returns this object typed as an integer.
     * @returns This object; undefined when it is not an integer.
     */
    toPDFInteger(): PDFInteger | undefined;
    /**
     * Returns this object typed as a real number.
     * @returns This object; undefined when it is not a real number.
     */
    toPDFReal(): PDFReal | undefined;
    /**
     * Returns this object typed as a symbol.
     * @returns This object; undefined when it is not a symbol.
     */
    toPDFSymbol(): PDFSymbol | undefined;
    /**
     * Returns the value of an integer or real number.
     * @returns The number; undefined for other types.
     */
    toNumber(): number | undefined;
    /**
     * Returns the value as text: the name, string, number, symbol or
     * boolean; the type label for other types.
     * @returns The text.
     */
    toString(): string;
  }

  export interface PDFReal extends PDFObject {
    value: number;
  }

  export interface PDFSymbol extends PDFObject {
    value: string;
  }

  export interface PDFStreamInput extends PDFObject {
    /**
     * Returns the stream dictionary.
     * @returns The dictionary.
     */
    getDictionary(): PDFDictionary;
    /**
     * Returns the byte position where the stream contents start.
     * @returns The byte position in the source file.
     */
    getStreamContentStart(): number;
  }

  export interface PDFTextString {
    /**
     * Returns the encoded bytes, PDFDocEncoding or UTF-16BE with a byte
     * order mark.
     * @returns The byte values.
     */
    toBytesArray(): Array<number>;
    /**
     * Returns the text.
     * @returns The decoded text.
     */
    toString(): string;
    /**
     * Sets the text; a value that is not a string is ignored.
     * @param value - The text.
     * @returns This text string.
     */
    fromString(value: string): this;
  }

  export interface PageContentContext extends AbstractContentContext {
    getCurrentPageContentStream(): PDFStream;
    getAssociatedPage(): PDFPage;
  }

  export interface JPEGInformation {
    samplesWidth: number;
    samplesHeight: number;
    colorComponentsCount: number;
    JFIFInformationExists: boolean;
    JFIFUnit?: number;
    JFIFXDensity?: number;
    JFIFYDensity?: number;
    ExifInformationExists: boolean;
    ExifUnit?: number;
    ExifXDensity?: number;
    ExifYDensity?: number;
    PhotoshopInformationExists: boolean;
    PhotoshopXDensity?: number;
    PhotoshopYDensity?: number;
  }

  export type PDFRectangle = [
    lowerLeftX: number,
    lowerLeftY: number,
    upperRightX: number,
    upperRightY: number,
  ];

  /** RGB (3 numbers) or CMYK (4 numbers) color components, 0 to 255. */
  export type TIFFColor =
    | [r: number, g: number, b: number]
    | [c: number, m: number, y: number, k: number];

  /** Options for `createFormXObjectFromTIFF()`. */
  export interface TIFFUsageOptions {
    /** The zero-based page of a multi-page TIFF. */
    pageIndex?: number;
    /** How black-and-white images are drawn. */
    bwTreatment?: {
      /** Draw the image as a stencil mask in oneColor. */
      asImageMask?: boolean;
      oneColor?: TIFFColor;
    };
    /** How grayscale images are drawn. */
    grayscaleTreatment?: {
      /** Map gray values between zeroColor and oneColor. */
      asColorMap?: boolean;
      oneColor?: TIFFColor;
      zeroColor?: TIFFColor;
    };
  }

  export interface MergeOptions {
    password?: string;
    type?: eRangeType;
    specificRanges?: [number, number][];
  }

  export interface AppendOptions extends MergeOptions {}

  export type inInterPagesCallback = (this: typeof globalThis) => void;

  /** Stateful methods require an active writer and throw Error("PDF writer has ended") after cleanup. */
  export interface PDFWriter {
    /**
     * Replace direct references to an object in a page dictionary.
     * Available only when modifying an existing PDF.
     * @param pageIndex - The zero-based page index; ignored for the global scope.
     * @param sourceObjectId - The object ID to stop referencing.
     * @param replacementObjectId - The object ID to reference instead.
     * @param options - `scope: ObjectReplacementScope.GLOBAL` replaces on every page.
     * @returns This writer.
     * @throws {Error} If the writer does not modify a PDF or the page does not exist.
     */
    replaceObject(
      pageIndex: number,
      sourceObjectId: number,
      replacementObjectId: number,
      options?: ObjectReplacementOptions,
    ): this;
    /**
     * Finalizes the PDF once; repeated calls return this writer. A failed
     * finalization also ends the writer.
     * @returns This writer.
     * @throws {TypeError} If the PDF cannot be finalized.
     */
    end(): PDFWriter;
    /**
     * Creates a page, optionally with its media box. Write it with writePage().
     * @param x - The media box left edge.
     * @param y - The media box bottom edge.
     * @param width - The media box width.
     * @param height - The media box height.
     * @returns The new page.
     * @throws {Error} If the writer has ended.
     */
    createPage(x: PosX, y: PosY, width: Width, height: Height): PDFPage;
    createPage(): PDFPage;
    /**
     * Writes a page and ends its content context.
     * @param page - The page to write.
     * @returns This writer.
     * @throws {TypeError} If page is not a page or the page cannot be written.
     * @throws {Error} If the writer has ended.
     */
    writePage(page: PDFPage): this;
    /**
     * Writes a page and ends its content context.
     * @param page - The page to write.
     * @returns The page object ID.
     * @throws {TypeError} If page is not a page or the page cannot be written.
     * @throws {Error} If the writer has ended.
     */
    writePageAndReturnID(page: PDFPage): number;
    /**
     * Starts, or returns the already started, content context of a page.
     * @param page - The page to draw on.
     * @returns The page content context.
     * @throws {TypeError} If page is not a page.
     * @throws {Error} If the writer has ended.
     */
    startPageContentContext(page: PDFPage): PageContentContext;
    /**
     * Ends the current content stream of a page so other objects can be
     * written; later drawing starts a new stream on the same page.
     * @param pageContextContext - The content context to pause.
     * @returns This writer.
     * @throws {TypeError} If the argument is not a started page content context.
     * @throws {Error} If the writer has ended.
     */
    pausePageContentContext(pageContextContext: PageContentContext): this;
    /**
     * Starts a form XObject. Draw on its content context, then call
     * endFormXObject().
     * @param left - The bounding box left edge.
     * @param bottom - The bounding box bottom edge.
     * @param right - The bounding box right edge.
     * @param top - The bounding box top edge.
     * @param objectId - A forward-reference object ID reserved earlier.
     * @returns The form.
     * @throws {TypeError} If the arguments are not four or five numbers.
     * @throws {Error} If the writer has ended.
     */
    createFormXObject(
      left: number,
      bottom: number,
      right: number,
      top: number,
      objectId?: FormXObjectId,
    ): FormXObject;
    /**
     * Ends and writes a form XObject.
     * @param formXObject - The form to end.
     * @returns This writer.
     * @throws {TypeError} If formXObject is not a form or cannot be written.
     * @throws {Error} If the writer has ended.
     */
    endFormXObject(formXObject: FormXObject): this;
    /**
     * Creates a form XObject showing a JPEG image.
     * @param file - The image path or a read stream.
     * @param objectId - A forward-reference object ID reserved earlier.
     * @returns The form.
     * @throws {TypeError} If the arguments are wrong or the image cannot be read.
     * @throws {Error} If the writer has ended.
     */
    createFormXObjectFromJPG(
      file: FilePath | ReadStream,
      objectId?: FormXObjectId,
    ): FormXObject;
    /**
     * Loads a font file for text drawing.
     * @param inFontFilePath - The font file path.
     * @param inOptionalMetricsFile - The metrics file of a Type 1 font.
     * @param index - The font index in a collection such as TTC or DFont.
     * @returns The font.
     * @throws {TypeError} If the arguments are wrong or the font cannot be loaded.
     * @throws {Error} If the writer has ended.
     */
    getFontForFile(inFontFilePath: FilePath, index?: number): UsedFont;
    getFontForFile(
      inFontFilePath: FilePath,
      inOptionalMetricsFile?: string,
      index?: number,
    ): UsedFont;
    /**
     * Adds a link annotation to the page written next.
     * @param url - The ASCII link target.
     * @param left - The clickable area left edge.
     * @param bottom - The clickable area bottom edge.
     * @param right - The clickable area right edge.
     * @param top - The clickable area top edge.
     * @returns This writer.
     * @throws {TypeError} If the arguments are not a string and four numbers, or
     *   the URL cannot be encoded as ASCII.
     * @throws {Error} If the writer has ended.
     */
    attachURLLinktoCurrentPage(
      url: string,
      left: PosX,
      bottom: PosY,
      right: PosX,
      top: PosY,
    ): this;
    /**
     * Saves the continuation state for createWriterToContinue() and retires
     * this writer, including when saving fails.
     * @param outputFilePath - The state file path.
     * @returns This writer.
     * @throws {TypeError} If the path is missing or the state cannot be saved.
     * @throws {Error} If the writer has ended.
     */
    shutdown(outputFilePath: FilePath): this;
    /**
     * Creates a form XObject showing a TIFF image.
     * @param filePath - The image path or a read stream.
     * @param objectId - A forward-reference object ID, or TIFF options.
     * @returns The form.
     * @throws {TypeError} If the arguments are wrong, a color is not 3 or 4
     *   numbers, or the image cannot be read.
     * @throws {Error} If the writer has ended.
     */
    createFormXObjectFromTIFF(
      filePath: FilePath | ReadStream,
      objectId?: FormXObjectId | TIFFUsageOptions,
    ): FormXObject;
    /**
     * Creates an image XObject from a JPEG image.
     * @param filePath - The image path or a read stream.
     * @param objectId - A forward-reference object ID reserved earlier.
     * @returns The image.
     * @throws {TypeError} If the arguments are wrong or the image cannot be read.
     * @throws {Error} If the writer has ended.
     */
    createImageXObjectFromJPG(
      filePath: FilePath | ReadStream,
      objectId?: FormXObjectId,
    ): ImageXObject;
    /**
     * Creates a form XObject showing a PNG image.
     * @param filePath - The image path or a read stream.
     * @param objectId - A forward-reference object ID reserved earlier.
     * @returns The form.
     * @throws {TypeError} If the arguments are wrong or the image cannot be read.
     * @throws {Error} If the writer has ended.
     */
    createFormXObjectFromPNG(
      filePath: FilePath | ReadStream,
      objectId?: FormXObjectId,
    ): FormXObject;
    /**
     * Reads the header information of a JPEG file.
     * @param filePath - The image path.
     * @returns The image information.
     * @throws {TypeError} If the argument is wrong or the file cannot be read.
     * @throws {Error} If the writer has ended.
     */
    retrieveJPGImageInformation(filePath: FilePath): JPEGInformation;
    /**
     * Returns the context for writing PDF objects directly.
     * @returns The objects context.
     * @throws {Error} If the writer has ended.
     */
    getObjectsContext(): ObjectsContext;
    /**
     * Returns the document context, for extensions and the info dictionary.
     * @returns The document context.
     * @throws {Error} If the writer has ended.
     */
    getDocumentContext(): DocumentContext;
    /**
     * Appends pages of another PDF as new pages.
     * @param source - The PDF path or a read stream.
     * @param options - The page range and the source password.
     * @returns The object IDs of the appended pages.
     * @throws {TypeError} If the arguments are wrong or the pages cannot be
     *   appended; the writer is aborted then.
     * @throws {RangeError} If the page range is invalid.
     * @throws {Error} If the writer has ended.
     */
    appendPDFPagesFromPDF(
      source: FilePath | ReadStream,
      options?: AppendOptions,
    ): number[];
    /**
     * Draws pages of another PDF onto a page. The optional callback runs
     * between pages, with no arguments and globalThis as its receiver.
     * @param page - The target page.
     * @param file - The PDF path or a read stream.
     * @param options - The page range and the source password.
     * @param callback - Called between merged pages.
     * @returns This writer.
     * @throws {TypeError} If page is not a page, file is neither a path nor a
     *   stream, or the pages cannot be merged.
     * @throws {RangeError} If the page range is invalid.
     * @throws {Error} If the writer has ended.
     */
    mergePDFPagesToPage(
      page: PDFPage,
      file: FilePath | ReadStream,
      options?: MergeOptions,
      callback?: inInterPagesCallback,
    ): this;
    mergePDFPagesToPage(
      page: PDFPage,
      file: FilePath | ReadStream,
      callback?: inInterPagesCallback,
    ): this;
    /**
     * Opens a PDF for copying objects and pages into this document.
     * @param source - The PDF path, a read stream, or an open reader.
     * @param options - The source password.
     * @returns The copying context; call end() on it when done.
     * @throws {TypeError} If the arguments are wrong, the reader has ended, or the
     *   PDF cannot be read.
     * @throws {Error} If the writer has ended.
     */
    createPDFCopyingContext(
      source: FilePath | ReadStream | PDFReader,
      options?: PDFReaderOptions,
    ): DocumentCopyingContext;
    /**
     * Creates one form XObject per page of another PDF.
     * @param file - The PDF path.
     * @param box - The page box to use, or an explicit [left, bottom, right, top].
     * @param options - The page range and the source password.
     * @param transformation - The form matrix.
     * @param objectIds - Further source object IDs to copy.
     * @returns The form object IDs, one per page.
     * @throws {TypeError} If the arguments are wrong or the forms cannot be
     *   created.
     * @throws {RangeError} If the page range is invalid.
     * @throws {Error} If the writer has ended.
     */
    createFormXObjectsFromPDF(
      file: FilePath,
      box?: PDFBox | PDFPageBoxType,
      options?: MergeOptions,
      transformation?: TransformationMatrix,
      objectIds?: FormXObjectId[],
    ): FormXObjectId[];
    /**
     * Opens the PDF being modified for copying its objects.
     * @returns The copying context; call end() on it when done.
     * @throws {TypeError} If the writer does not modify a PDF.
     * @throws {Error} If the writer has ended.
     */
    createPDFCopyingContextForModifiedFile(): DocumentCopyingContext;
    /**
     * Creates a PDF text string, encoded as PDFDocEncoding or UTF-16 as needed.
     * Works after the writer has ended.
     * @param value - The text, or its UTF-16 code units.
     * @returns The text string.
     */
    createPDFTextString(value?: string | number[]): PDFTextString;
    /**
     * Creates a PDF date. Works after the writer has ended.
     * @param value - The date, or a PDF date string; now when omitted.
     * @returns The date.
     */
    createPDFDate(value?: string | Date): PDFDate;
    /**
     * Returns the size of an image in points.
     * @param imagePath - The image path or a read stream.
     * @param imageIndex - The image or page index of a multi-image file.
     * @param options - The password of a PDF source.
     * @returns The width and height.
     * @throws {TypeError} If the arguments are wrong.
     * @throws {Error} If the writer has ended.
     */
    getImageDimensions(
      imagePath: FilePath | ReadStream,
      imageIndex?: number,
      options?: PDFReaderOptions,
    ): RectangleDimension;
    /**
     * Returns the number of pages or images in an image file.
     * @param imagePath - The image path.
     * @param options - The password of a PDF source.
     * @returns The page count.
     * @throws {TypeError} If the arguments are wrong.
     * @throws {Error} If the writer has ended.
     */
    getImagePagesCount(
      imagePath: FilePath,
      options?: { password?: string },
    ): number;
    /**
     * Detects the type of an image file.
     * @param imagePath - The image path.
     * @returns The type; undefined when it is not a supported image.
     * @throws {TypeError} If imagePath is not a single argument.
     * @throws {Error} If the writer has ended.
     */
    getImageType(imagePath: FilePath): PDFImageType | undefined;
    /**
     * Returns a reader of the PDF being modified.
     * @returns The reader.
     * @throws {TypeError} If the writer does not modify a PDF.
     * @throws {Error} If the writer has ended.
     */
    getModifiedFileParser(): PDFReader;
    /**
     * Returns the input file of the PDF being modified.
     * @returns The input file.
     * @throws {TypeError} If the writer does not modify a PDF.
     * @throws {Error} If the writer has ended.
     */
    getModifiedInputFile(): InputFile;
    /**
     * Returns the output file.
     * @returns The output file.
     * @throws {TypeError} If the output is not a file.
     * @throws {Error} If the writer has ended.
     */
    getOutputFile(): OutputFile;
    /**
     * Adds an annotation to the Annots array of the page written next.
     * @param annotationId - The annotation object ID.
     * @returns This writer.
     * @throws {TypeError} If annotationId is not a number.
     * @throws {Error} If the writer has ended.
     */
    registerAnnotationReferenceForNextPageWrite(annotationId: number): this;
    /**
     * Makes a modified PDF write a new catalog when it ends, so catalog
     * changes from extensions are kept.
     * @throws {Error} If the writer has ended.
     */
    requireCatalogUpdate(): void;

    /* Js Extensions (in muhammara.js) */
    /**
     * Returns the writer's event emitter, created on first use.
     * @returns The emitter for writer events.
     */
    getEvents(): EventEmitter;
    /**
     * Emits an event on the writer's emitter after setting `eventParams.writer`
     * to this writer.
     * @param eventName - The event name.
     * @param eventParams - The event parameters; gains a `writer` key.
     * @throws {TypeError} If eventParams is not an object.
     */
    triggerDocumentExtensionEvent(
      eventName: string | symbol,
      eventParams: any,
    ): void;
  }

  /** Scopes for the `replaceObject()` scope option. */
  export const ObjectReplacementScope: {
    /** Replace the reference on every page. */
    readonly GLOBAL: "global";
  };
  export type ObjectReplacementScope =
    (typeof ObjectReplacementScope)[keyof typeof ObjectReplacementScope];

  export interface ObjectReplacementOptions {
    scope?: ObjectReplacementScope;
  }

  export interface RemoveTextOptions {
    /** Also remove text from the Form XObjects the page paints, including nested forms. Defaults to `false`. */
    forms?: boolean;
  }

  export interface RecipePageInfo {
    width: number;
    height: number;
    rotate: number;
    pageNumber: number;
  }

  namespace Recipe {
    type Color = string | readonly number[];
    type BorderRadius =
      | number
      | readonly [number]
      | readonly [number, number]
      | readonly [number, number, number]
      | readonly [number, number, number, number];
    type DeviceColorspace = "rgb" | "gray" | "cmyk";
    type Colorspace = DeviceColorspace | "separation";
    /**
     * Matches known runtime values case-insensitively without enumerating
     * every per-character capitalization combination — that recursive
     * approach costs 2^N literal types for an N-character word (4096 for
     * "circumcenter" alone). The runtime lowercases the whole value before
     * comparing, so any casing works at runtime; the type instead accepts
     * the three forms callers actually write (lower case, UPPER CASE, and
     * Capitalized).
     */
    type CaseInsensitive<Value extends string> =
      Lowercase<Value> | Uppercase<Value> | Capitalize<Lowercase<Value>>;
    type TriangleTrait = CaseInsensitive<"sss" | "sas" | "asa" | "vtx">;
    type TriangleMeasurementTrait = CaseInsensitive<"sss" | "sas" | "asa">;
    type TriangleVertexTrait = CaseInsensitive<"vtx">;
    type TrianglePosition = CaseInsensitive<
      "a" | "b" | "c" | "centroid" | "circumcenter" | "incenter"
    >;
    type PermissionName =
      | "print"
      | "modify"
      | "copy"
      | "edit"
      | "fillform"
      | "extract"
      | "assemble"
      | "printbest";
    /** Known permission names with string compatibility for composed lists. */
    type PermissionList = PermissionName | (string & {});
    /**
     * Passes a colorspace argument through when it is valid, and otherwise
     * resolves to the accepted set so the compiler names the valid values
     * instead of reporting the bare `never` the optional parameter would
     * collapse to. A plain `string` stays accepted for runtime-computed values.
     */
    type ValidColorspace<Value extends string | undefined> = [Value] extends [
      undefined,
    ]
      ? Value
      : string extends Exclude<Value, undefined>
        ? Value
        : Exclude<Value, undefined> extends Colorspace | ""
          ? Value
          : Colorspace | "";
    type ExtensionCallback<
      Arguments extends unknown[] = never[],
      Result = unknown,
    > = (this: Recipe, ...args: Arguments) => Result;

    type CommentOptionsFlag =
      | "invisible"
      | "hidden"
      | "print"
      | "nozoom"
      | "norotate"
      | "noview"
      | "readonly"
      | "locked"
      | "togglenoview";

    type AnnotSubtype =
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

    type AnnotOptionsFlag =
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

    type AnnotOptionsIcon =
      | "Comment"
      | "Key"
      | "Note"
      | "Help"
      | "NewParagraph"
      | "Paragraph"
      | "Insert";

    type RecipeCoordinate = number | "center";

    /** Named page sizes, with string compatibility for other names. */
    type PageSize =
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

    type HorizontalAlign = "left" | "center" | "right";
    type VerticalAlign = "top" | "center" | "bottom";
    type TextAlign = "left" | "center" | "right" | "justify";
    /** Known text-box alignments, with string compatibility for computed values. */
    type TextBoxAlign =
      TextAlign | `${TextAlign} ${VerticalAlign}` | (string & {});
    /** Known alignments, with string compatibility for computed values. */
    type ImageAlign =
      HorizontalAlign | `${HorizontalAlign} ${VerticalAlign}` | (string & {});

    type RecipeFontStyle =
      "regular" | "bold" | "italic" | "bold-italic" | "r" | "b" | "i" | "bi";

    interface RecipeOptions {
      /** PDF version of a new PDF: 1.0 through 1.7 or 2.0; other values use 1.7. */
      version?: number;
      author?: string;
      title?: string;
      subject?: string;
      keywords?: string[];
      /** Default colorspace; see `Recipe.Colorspace`. */
      colorspace?: Colorspace;
      /** Owner password; also opens a protected source PDF. */
      password?: string;
      /** The 'view' password; also enables encryption. */
      userPassword?: string;
      /** The 'edit' password. */
      ownerPassword?: string;
      /** Encryption permission flags, see `Recipe#permission()`. */
      userProtectionFlag?: number;
      /** Directory location(s) of additional fonts. */
      fontSrcPath?: string | string[];
    }

    interface RecipeMargins {
      left?: number;
      right?: number;
      top?: number;
      bottom?: number;
    }

    interface CommentOptions {
      title?: string;
      date?: string;
      open?: boolean;
      richText?: boolean;
      flag?: CommentOptionsFlag;
      /** Replies linked to this comment annotation. */
      replies?: readonly AnnotReply[];
    }

    interface AnnotOptions {
      /** The annotation content. */
      text?: string;
      title?: string;
      open?: boolean;
      richText?: boolean;
      flag?: AnnotOptionsFlag;
      icon?: AnnotOptionsIcon;
      width?: number;
      height?: number;
      /** Annotation opacity from 0 (transparent) to 1 (opaque). Defaults to 1. */
      opacity?: number;
      date?: string;
      subject?: string;
      replies?: readonly AnnotReply[];
      /** The border width. */
      border?: number;
      /** The annotation color. */
      color?: Color;
      /** Keep the annotation unrotated on a rotated source page. */
      followOriginalPageRotation?: boolean;
    }

    interface AnnotReply {
      /** Ignored: a reply uses the subtype of the annotation it answers. */
      subtype?: AnnotSubtype;
      text: string;
      title?: string;
      richText?: boolean;
      flag?: AnnotOptionsFlag;
      opacity?: number;
      date?: string;
      subject?: string;
    }

    interface TextMarkupOptions extends Pick<
      AnnotOptions,
      "opacity" | "replies"
    > {
      text?: string;
      color?: Color;
    }

    interface EncryptOptions {
      password?: string;
      ownerPassword?: string;
      userPassword?: string;
      userProtectionFlag?: number;
    }

    interface ImageOptions {
      /** Make the rendered image open this URL. */
      link?: string;
      width?: number;
      height?: number;
      scale?: number;
      keepAspectRatio?: boolean;
      opacity?: number;
      /** `Recipe.HorizontalAlign`, optionally followed by a space and `Recipe.VerticalAlign`. */
      align?: ImageAlign;
      rotation?: number;
      rotationOrigin?: [number, number];
      skewX?: number;
      skewY?: number;
    }

    interface InfoOptions {
      /** Additional Info dictionary entries; arrays are joined with a comma and space. */
      [key: string]: string | string[] | undefined;
      version?: string;
      author?: string;
      title?: string;
      subject?: string;
      keywords?: string[];
    }

    interface OverlayOptions {
      page?: number;
      scale?: number;
      keepAspectRatio?: boolean;
      fitWidth?: boolean;
      fitHeight?: boolean;
    }

    interface MetadataPage {
      pageNumber: number;
      mediaBox: number[];
      layout: "portrait" | "landscape";
      rotate: number;
      width: number;
      height: number;
      size?: number[];
      offsetX?: number;
      offsetY?: number;
    }

    interface ReadMetadataPage extends MetadataPage {
      size: number[];
      offsetX: number;
      offsetY: number;
    }

    interface Metadata {
      /** Number of pages in a parsed source PDF. */
      pages?: number;
      /** Number of pages created in a new PDF. */
      pageCount?: number;
      [page: number]: MetadataPage | undefined;
    }

    interface ReadMetadata extends Metadata {
      pages: number;
      pageCount?: never;
      [page: number]: ReadMetadataPage | undefined;
    }

    interface TextBoxStyle {
      lineWidth?: number;
      stroke?: Color;
      dash?: readonly number[];
      fill?: Color;
      colorspace?: Colorspace;
      opacity?: number;
      borderRadius?: boolean | BorderRadius;
    }

    interface TextBoxClipResult {
      remainder: string;
      linesWritten: number;
      clipped: true;
      bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }

    interface TextBox {
      width?: number;
      height?: number;
      minHeight?: number;
      padding?: number | readonly number[];
      lineHeight?: number;
      wrap?: boolean | "auto" | "clip" | "trim" | "ellipsis";
      /** `Recipe.TextAlign`, optionally followed by a space and `Recipe.VerticalAlign`. */
      textAlign?: TextBoxAlign;
      clipIfExceedsBox?: boolean;
      onClip?: (recipe: Recipe, result: TextBoxClipResult) => void;
      style?: TextBoxStyle;
    }

    interface TextOverflowInstructions {
      layout?: number | string;
      column?: number | readonly [number, number];
    }

    type TextOverflowCallback = (
      this: Recipe,
      recipe: Recipe,
    ) => boolean | TextOverflowInstructions;

    interface TextOptions {
      /** Make the rendered text open this URL. */
      link?: string;
      charSpace?: number;
      /** Text fill color: `#gg`, `#rrggbb`, `#ccmmyykk`, `%r,g,b` percentages, a 0-255 component array, or a name registered with `chroma()`. Missing or unknown colors use `#1777d1`. */
      color?: Color;
      colorspace?: Colorspace;
      flow?: boolean;
      overflow?: TextOverflowCallback;
      layout?: number | string;
      opacity?: number;
      rotation?: number;
      rotationOrigin?: readonly [number, number];
      font?: string;
      /** Font size in points for text() and textDimensions(); defaults to 14 when both fontSize and size are omitted. A size that is not greater than zero throws RangeError. */
      fontSize?: number;
      /** Font size in points for text() and textDimensions(); defaults to 14. A size that is not greater than zero throws RangeError. */
      size?: number;
      bold?: boolean;
      italic?: boolean;
      align?: string;
      highlight?: boolean | TextMarkupOptions;
      underline?: boolean | TextMarkupOptions;
      strikeOut?: boolean | TextMarkupOptions;
      squiggly?: boolean | TextMarkupOptions;
      html?: boolean;
      hilite?:
        | boolean
        | {
            color?: Color;
            opacity?: number;
          };
      textBox?: TextBox;
      title?: string;
      open?: boolean;
      richText?: boolean;
      flag?: AnnotOptionsFlag;
      icon?: AnnotOptionsIcon;
      date?: string;
      subject?: string;
    }

    interface LayoutOptions {
      columns?: number;
      gap?: number;
      reset?: boolean;
    }

    type TableField<RecordType extends object> = RecordType extends unknown
      ? RecordType extends readonly unknown[]
        ? number extends RecordType["length"]
          ? `${number}`
          : Extract<keyof RecordType, `${number}`>
        : | Extract<keyof RecordType, string>
          | `${Extract<keyof RecordType, number>}`
      : never;
    type TableColumnField<RecordType extends object> = Exclude<
      TableField<RecordType>,
      ""
    >;
    type TableFieldValue<
      RecordType extends object,
      Field extends TableField<RecordType>,
    > = RecordType extends unknown
      ? Field extends keyof RecordType
        ? RecordType[Field]
        : Field extends `${infer NumericField extends number}`
          ? NumericField extends keyof RecordType
            ? RecordType[NumericField]
            : undefined
          : undefined
      : never;

    interface TableColumnDefinition<
      RecordType extends object = Record<string, unknown>,
      Field extends TableColumnField<RecordType> = TableColumnField<RecordType>,
    > extends Omit<TextOptions, "textBox"> {
      name: Field;
      text?: string;
      width?: number;
      /** Cell text-box options, including onClip callbacks preserved during table layout. */
      cell?: TextBox;
      /** Header text styles, independent of body styles; booleans use the default header style. Table-level header options take precedence. */
      header?: boolean | TextOptions;
      /** Final header text-box overrides, applied after header styles and alignToData. */
      hcell?: TextBox;
      renderer?: (
        this: void,
        /** The own cell value; missing, inherited, and nullish values arrive as `""`. */
        text: undefined extends TableFieldValue<RecordType, Field>
          ? Exclude<TableFieldValue<RecordType, Field>, null | undefined> | ""
          : null extends TableFieldValue<RecordType, Field>
            ? Exclude<TableFieldValue<RecordType, Field>, null | undefined> | ""
            : TableFieldValue<RecordType, Field>,
        record: RecordType,
        field: Field,
        row: number,
      ) => TextOptions | false | null | "" | 0 | void;
    }

    /**
     * A distributive map over every field of `RecordType`, so a column's
     * `renderer` receives the exact value type for its own `name` rather than
     * the union of all columns' value types. This costs one
     * `TableColumnDefinition` instantiation per field of `RecordType`; a
     * plain `TableColumnDefinition<RecordType>` would be cheaper but would
     * widen every renderer's `text` parameter to the union of all fields.
     */
    type TableColumnOptions<
      RecordType extends object = Record<string, unknown>,
    > = {
      [Field in TableColumnField<RecordType>]: TableColumnDefinition<
        RecordType,
        Field
      >;
    }[TableColumnField<RecordType>];

    interface TableOptions<
      RecordType extends object = Record<string, unknown>,
    > extends Omit<TextOptions, "overflow"> {
      /** Per-segment height, also bounded by the current page's bottom margin. */
      height?: number;
      /** Comma-separated names are trimmed; array entries preserve exact keys. */
      order?:
        | string
        | TableField<RecordType>[]
        | readonly [TableField<RecordType>, ...TableField<RecordType>[]];
      columns?: readonly TableColumnOptions<RecordType>[];
      /** Enables headers and overrides column header styles; body text styles are not inherited. */
      header?:
        boolean | (TextOptions & { alignToData?: boolean; cell?: TextBox });
      border?: boolean | PolygonOptions;
      row?: TextOptions & { nth?: "even" | "odd"; cell?: TextBox };
      /** Called once per overflow. A continuing destination must fit the row and repeated header or table() throws RangeError; ending the page without starting another throws Error. */
      overflow?: (
        this: Recipe,
        recipe: Recipe,
        row: number,
      ) => boolean | { position?: readonly [number, number] };
    }

    interface HtmlTextObject {
      value: string | null;
      tag: string | undefined;
      font: string | undefined;
      isBold: boolean;
      isItalic: boolean;
      underline: boolean;
      strikeOut: boolean;
      attributes: Array<{ name: string; value: string | null }>;
      styles: Record<string, string | number | number[]>;
      needsLineBreaker: boolean;
      /** True for a `<br>` element, which ends the current line. */
      lineBreak: boolean;
      size: number | undefined;
      sizeRatio: number;
      sizeRatios: number[];
      link: string | null;
      childs: HtmlTextObject[];
    }

    interface DrawingOptions {
      color?: Color;
      stroke?: Color;
      colorspace?: Colorspace;
      lineWidth?: number;
      width?: number;
      opacity?: number;
      dash?: readonly number[];
      dashPhase?: number;
    }

    interface PathOptions extends DrawingOptions {
      lineCap?: "butt" | "round" | "square";
      lineJoin?: "miter" | "round" | "bevel";
      miterLimit?: number;
    }

    interface SkewOptions {
      skewX?: number;
      skewY?: number;
    }

    interface TransformOptions extends SkewOptions {
      rotation?: number;
      rotationOrigin?: readonly [number, number];
    }

    interface TransformedPathOptions extends PathOptions, TransformOptions {}

    type LineToOptions = PathOptions;

    type LineOptions = PathOptions;

    interface LinkFillOptions {
      link?: string;
      fill?: Color;
    }

    interface PolygonOptions extends TransformedPathOptions, LinkFillOptions {}

    interface ShapeOptions extends PolygonOptions {
      debug?: boolean | number;
    }

    interface NGonOptions extends ShapeOptions {
      rotationVertice?: number;
    }

    interface ArrowOptions extends ShapeOptions {
      head?:
        | number
        | readonly [number]
        | readonly [number, number]
        | readonly [number, number, number];
      shaft?: number | readonly [number] | readonly [number, number];
      double?: boolean;
      type?: 0 | 1 | 2 | "triangle" | "dart" | "kite";
      at?: "head" | "tail";
    }

    interface TriangleBaseOptions extends ShapeOptions {
      position?: TrianglePosition;
      flipX?: boolean;
      flipY?: boolean;
    }

    type TriangleMeasurementOptions = TriangleBaseOptions &
      (
        | { traitID: TriangleMeasurementTrait; traitsID?: TriangleTrait }
        | {
            traitID?: undefined;
            traitsID?: TriangleMeasurementTrait;
          }
      );
    type TriangleVertexIdentifier =
      | { traitID: TriangleVertexTrait; traitsID?: TriangleTrait }
      | { traitID?: undefined; traitsID: TriangleVertexTrait };
    type TriangleVertexOptions = TriangleBaseOptions & TriangleVertexIdentifier;
    type TriangleUnpositionedVertexOptions = Omit<
      TriangleBaseOptions,
      "position" | "flipX" | "flipY"
    > & {
      position?: undefined;
      flipX?: false;
      flipY?: false;
    } & TriangleVertexIdentifier;
    type TriangleOptions = TriangleMeasurementOptions | TriangleVertexOptions;
    type TriangleMeasurements = readonly [number, number, number];
    type TriangleVertices = readonly [
      readonly [number, number],
      readonly [number, number],
      readonly [number, number],
    ];
    type MutableTriangleVertices = [
      [number, number],
      [number, number],
      [number, number],
    ];

    interface CircleOptions
      extends DrawingOptions, SkewOptions, LinkFillOptions {}

    interface EllipseOptions extends CircleOptions, TransformOptions {}

    interface RectangleOptions
      extends DrawingOptions, TransformOptions, LinkFillOptions {
      borderRadius?: BorderRadius;
    }

    interface LineStyleOptions {
      width?: number;
      lineWidth?: number;
      cap?: number;
      join?: number;
      miterLimit?: number;
      dash?: number[];
      dashPhase?: number;
    }

    type EndPDFCallback1 = () => any;
    type EndPDFCallback2 = (buffer: Buffer) => any;
    type EndPDFCallback = EndPDFCallback1 | EndPDFCallback2;
  }

  export class Recipe {
    constructor(
      src: string,
      output?: string | null,
      options?: Recipe.RecipeOptions,
    );

    /** Special Recipe sources, such as `Recipe.Source.NEW` for a new PDF. */
    static readonly Source: {
      readonly NEW: "new";
    };
    /** How text that does not fit a text-box line is handled. */
    static readonly TextWrap: {
      readonly AUTO: "auto";
      readonly CLIP: "clip";
      readonly TRIM: "trim";
      readonly ELLIPSIS: "ellipsis";
    };
    /** Horizontal alignments of text inside a text box. */
    static readonly TextAlign: {
      readonly LEFT: "left";
      readonly CENTER: "center";
      readonly RIGHT: "right";
      readonly JUSTIFY: "justify";
    };
    /** Which table rows the `row` options apply to. */
    static readonly TableRowNth: {
      readonly EVEN: "even";
      readonly ODD: "odd";
    };
    /** Line cap styles for the `lineCap` options. */
    static readonly LineCap: {
      readonly BUTT: "butt";
      readonly ROUND: "round";
      readonly SQUARE: "square";
    };
    /** Line join styles for the `lineJoin` options. */
    static readonly LineJoin: {
      readonly MITER: "miter";
      readonly ROUND: "round";
      readonly BEVEL: "bevel";
    };
    /** The arrow point placed at the `arrow()` coordinates. */
    static readonly ArrowAt: {
      readonly HEAD: "head";
      readonly TAIL: "tail";
    };
    /** Arrow head shapes for the `arrow()` type option. */
    static readonly ArrowType: {
      readonly TRIANGLE: "triangle";
      readonly DART: "dart";
      readonly KITE: "kite";
    };
    /** How `triangle()` traits define the triangle. */
    static readonly TriangleTrait: {
      readonly SSS: "sss";
      readonly SAS: "sas";
      readonly ASA: "asa";
      readonly VTX: "vtx";
    };
    /** The triangle point placed at the `triangle()` coordinates. */
    static readonly TrianglePosition: {
      readonly A: "a";
      readonly B: "b";
      readonly C: "c";
      readonly CENTROID: "centroid";
      readonly CIRCUMCENTER: "circumcenter";
      readonly INCENTER: "incenter";
    };
    /** Page orientations reported in page metadata. */
    static readonly PageLayout: {
      readonly PORTRAIT: "portrait";
      readonly LANDSCAPE: "landscape";
    };
    /** Named page sizes for `createPage()`. */
    static readonly PageSize: {
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
    static readonly HorizontalAlign: {
      readonly LEFT: "left";
      readonly CENTER: "center";
      readonly RIGHT: "right";
    };
    /** Vertical alignments. */
    static readonly VerticalAlign: {
      readonly TOP: "top";
      readonly CENTER: "center";
      readonly BOTTOM: "bottom";
    };
    /** Font styles for `registerFont()`. */
    static readonly FontStyle: {
      readonly REGULAR: "regular";
      readonly BOLD: "bold";
      readonly ITALIC: "italic";
      readonly BOLD_ITALIC: "bold-italic";
    };
    /** User access permission names for `permission()`. */
    static readonly Permission: {
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
    static readonly Coordinate: {
      readonly CENTER: "center";
    };
    /** Colorspaces accepted by the `colorspace` options. */
    static readonly Colorspace: {
      readonly RGB: "rgb";
      readonly CMYK: "cmyk";
      readonly GRAY: "gray";
      readonly SEPARATION: "separation";
    };
    /** Annotation subtypes for `annot()`. */
    static readonly AnnotSubtype: {
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
    static readonly AnnotFlag: {
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
    static readonly ChromaCommand: {
      readonly LOAD: "!load";
    };
    /** Text annotation icons for the `icon` option. */
    static readonly AnnotIcon: {
      readonly COMMENT: "Comment";
      readonly KEY: "Key";
      readonly NOTE: "Note";
      readonly HELP: "Help";
      readonly NEW_PARAGRAPH: "NewParagraph";
      readonly PARAGRAPH: "Paragraph";
      readonly INSERT: "Insert";
    };

    readonly position: { x: number; y: number };
    /** Current document metadata, keyed by one-based page number. */
    readonly metadata: Recipe.Metadata;
    read(inSrc?: string | Buffer): Recipe.ReadMetadata;
    register<Arguments extends unknown[], Result>(
      key: string,
      callback: Recipe.ExtensionCallback<Arguments, Result>,
    ): Recipe;
    register<Arguments extends unknown[], Result>(
      callback: Recipe.ExtensionCallback<Arguments, Result>,
    ): Recipe;

    constructor(
      buffer: Buffer,
      output?: string | null,
      options?: Recipe.RecipeOptions,
    );

    comment(
      text: string,
      x: Recipe.RecipeCoordinate,
      y: Recipe.RecipeCoordinate,
      options?: Recipe.CommentOptions,
    ): Recipe;

    link(
      url: string,
      x: Recipe.RecipeCoordinate,
      y: Recipe.RecipeCoordinate,
      width: number,
      height: number,
    ): Recipe;

    annot(
      x: Recipe.RecipeCoordinate,
      y: Recipe.RecipeCoordinate,
      subtype: Recipe.AnnotSubtype,
      options?: Recipe.AnnotOptions,
    ): Recipe;

    appendPage(
      pdfSrc: string,
      pages?: number | (number | [number, number])[],
    ): Recipe;

    encrypt(options?: Recipe.EncryptOptions): Recipe;

    registerFont(
      fontName: string,
      fontSrcPath: string,
      type?: Recipe.RecipeFontStyle,
    ): Recipe;

    image(
      imgSrc: string,
      x: Recipe.RecipeCoordinate,
      y: Recipe.RecipeCoordinate,
      options?: Recipe.ImageOptions,
    ): Recipe;

    info(options?: Recipe.InfoOptions): Recipe;

    custom(key: string, value: string): Recipe;

    insertPage(
      afterPageNumber: number,
      pdfSrc: string,
      srcPageNumber: number,
    ): Recipe;

    overlay(pdfSrc: string, options?: Recipe.OverlayOptions): Recipe;
    overlay(
      pdfSrc: string,
      x: number,
      y: number,
      options?: Recipe.OverlayOptions,
    ): Recipe;

    createPage(
      pageWidth?: number,
      pageHeight?: number,
      margins?: Recipe.RecipeMargins,
    ): Recipe;
    createPage(
      pageType: Recipe.PageSize,
      rotation?: number,
      margins?: Recipe.RecipeMargins,
    ): Recipe;
    rotate(rotation: number): Recipe;
    endPage(): Recipe;
    setPageBox(
      box: PDFPageBoxType,
      left: number,
      bottom: number,
      right: number,
      top: number,
    ): Recipe;

    editPage(pageNumber: number): Recipe;
    deletePage(pageNumbers: number | number[]): Recipe;

    replaceText(text: string, replacement: string, pageNumber: number): Recipe;
    /** Removes shown text from an existing page's content streams, and optionally its Form XObjects. */
    removeText(pageNumber: number, options?: RemoveTextOptions): Recipe;

    pageInfo(pageNumber: number): RecipePageInfo;
    getCurrentPageInfo(): RecipePageInfo | null;

    margins(): Required<Recipe.RecipeMargins>;
    margins(margins: Recipe.RecipeMargins): Recipe;
    margins(
      left?: number,
      right?: number,
      top?: number,
      bottom?: number,
    ): Recipe;
    getPageInfo(): InfoDictionary;
    pauseContext(): Recipe;
    resumeContext(): Recipe;
    rotateContent(
      degrees: number,
      x?: Recipe.RecipeCoordinate,
      y?: Recipe.RecipeCoordinate,
    ): Recipe;
    split(outputDir?: string, prefix?: string): Recipe;

    text(text: string, options?: Recipe.TextOptions): Recipe;
    text(
      text: string,
      x: Recipe.RecipeCoordinate,
      y: Recipe.RecipeCoordinate,
      options?: Recipe.TextOptions,
    ): Recipe;
    textDimensions(text: string, options?: Recipe.TextOptions): TextDimension;
    movedown(lines?: number, returnCoords?: false): Recipe;
    movedown(lines: number, returnCoords: true): number[];
    movedown(lines?: number, returnCoords?: boolean): Recipe | number[];
    layout(
      id: string | number,
      x?: number,
      y?: number,
      width?: number,
      height?: number,
      options?: Recipe.LayoutOptions,
    ): Recipe;
    table<RecordType extends object>(
      x: number,
      y: number,
      contents: readonly RecordType[],
      options?: Recipe.TableOptions<RecordType>,
    ): Recipe;

    moveTo(x: number, y: number): Recipe;

    lineTo(x: number, y: number, options?: Recipe.LineToOptions): Recipe;

    line(coordinates: number[][], options?: Recipe.LineOptions): Recipe;
    line(
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      options?: Recipe.LineOptions,
    ): Recipe;

    polygon(coordinates: number[][], options?: Recipe.PolygonOptions): Recipe;

    circle(
      x: Recipe.RecipeCoordinate,
      y: Recipe.RecipeCoordinate,
      radius: number,
      options?: Recipe.CircleOptions,
    ): Recipe;

    rectangle(
      x: Recipe.RecipeCoordinate,
      y: Recipe.RecipeCoordinate,
      width: number,
      height: number,
      options?: Recipe.RectangleOptions,
    ): Recipe;

    ellipse(
      cx: Recipe.RecipeCoordinate,
      cy: Recipe.RecipeCoordinate,
      rx: number,
      ry: number,
      options?: Recipe.EllipseOptions,
    ): Recipe;
    arc(
      x: Recipe.RecipeCoordinate,
      y: Recipe.RecipeCoordinate,
      radius: number,
      startAngle?: number,
      endAngle?: number,
      options?: Recipe.EllipseOptions,
    ): Recipe;
    pie(
      x: Recipe.RecipeCoordinate,
      y: Recipe.RecipeCoordinate,
      radius: number,
      startAngle?: number,
      endAngle?: number,
      options?: Recipe.EllipseOptions,
    ): Recipe;
    lineStyle(options?: Recipe.LineStyleOptions): Recipe;
    lineWidth(width: number): Recipe;
    /** Set fill and stroke opacity from 0 (transparent) to 1 (opaque). */
    opacity(opacity: number): Recipe;
    fill(): Recipe;
    stroke(): Recipe;
    fillAndStroke(): Recipe;
    n_gon(
      cx: number,
      cy: number,
      radius: number,
      sides?: number | Recipe.NGonOptions,
      options?: Recipe.NGonOptions,
    ): Recipe;
    star(
      cx: number,
      cy: number,
      radius: number,
      points?: number | Recipe.ShapeOptions,
      options?: Recipe.ShapeOptions,
    ): Recipe;
    triangle(
      x: number,
      y: number,
      traits: Recipe.TriangleMeasurements,
      options?: Recipe.TriangleMeasurementOptions,
    ): Recipe;
    triangle(
      x: number,
      y: number,
      traits: Recipe.TriangleVertices,
      options: Recipe.TriangleUnpositionedVertexOptions,
    ): Recipe;
    triangle(
      x: number,
      y: number,
      traits: Recipe.MutableTriangleVertices,
      options: Recipe.TriangleVertexOptions,
    ): Recipe;
    arrow(x: number, y: number, options?: Recipe.ArrowOptions): Recipe;
    chroma<ColorspaceValue extends string | undefined = undefined>(
      name: string,
      value: Recipe.Color,
      colorspace?: Recipe.ValidColorspace<ColorspaceValue>,
    ): Recipe;
    permission(flags?: Recipe.PermissionList): number;
    structure(output: string): Recipe;
    htmlToTextObjects(
      htmlCodes: string,
      options?: Recipe.TextOptions,
    ): Recipe.HtmlTextObject[];

    endPDF(): void;
    endPDF<T>(callback: (output?: Buffer | string) => T): T;
  }
}

export = muhammara;
