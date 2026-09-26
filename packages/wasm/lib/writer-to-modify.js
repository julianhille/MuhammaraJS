import {
  ObjectReplacementScope,
  PDFImageType,
  RegisteredImageFormat,
} from "./value-sets.js";
import { createChildLifecycle } from "./lifecycle.js";
import { isPageBoxType } from "./constants.js";
import { selectedPageRanges } from "./page-ranges.js";
import {
  readTextOptions,
  validateDrawingGeometry,
  applyDrawingColor,
  installDrawingHelpers,
  checkOperatorRange,
  measureFontText,
  readFontUnderline,
  prepareUnderline,
  strokeUnderline,
} from "./drawing-options.js";

/**
 * Creates the byte-first PDF modifier factory.
 * @param {object} dependencies - Module, constants, value types, and shared helpers.
 * @returns {Function} `createWriterToModify(bytes, options)`.
 */
export function createWriterToModifyFactory({
  module,
  constants,
  colorValue,
  normalizeBytes,
  normalizeBytesAsync,
  PDFTextString,
  PDFDate,
  PDFPage,
  normalizePDFDate,
  rawObjectsContext,
  copyingObjectOperations,
  createReader,
  fonts,
  images,
  imageTypes,
  pdfs,
  state,
  withString,
  withBytes,
  writeNativeBytes,
  writeFreeCode,
  addStructuredContentOperators,
  withDoubles,
  copiedPageFormArguments,
  textEncoding,
  withGlyphs,
  addTextShowingOperators,
  resourcesDictionary,
  createAnnotation,
  drawImageCall,
  removeAssets,
  removeFile,
  assertOutputSize,
}) {
  /**
   * Opens PDF bytes for incremental modification.
   * @param {ByteSource} bytes - PDF to modify.
   * @param {WriterOptions} [options={}] - PDF version and stream compression.
   * @returns {PDFModifier} The modifier; call `end()` for the bytes or `dispose()` to discard it.
   * @throws {TypeError} If the bytes are unsupported, `options` is not an object, or `compress` is not a boolean.
   * @throws {RangeError} If `version` is not a supported `ePDFVersion*` constant.
   * @throws {Error} If the PDF cannot be opened.
   */
  function createWriterToModify(bytes, options = {}) {
    bytes = normalizeBytes(bytes, "PDF input");
    if (!options || typeof options !== "object" || Array.isArray(options))
      throw new TypeError("createWriterToModify options must be an object");
    var version = options.version ?? constants.ePDFVersion14;
    var compress = options.compress ?? true;
    if (
      !Number.isInteger(version) ||
      ![
        constants.ePDFVersion10,
        constants.ePDFVersion11,
        constants.ePDFVersion12,
        constants.ePDFVersion13,
        constants.ePDFVersion14,
        constants.ePDFVersion15,
        constants.ePDFVersion16,
        constants.ePDFVersion17,
        constants.ePDFVersion20,
      ].includes(version)
    )
      throw new RangeError(
        "createWriterToModify version must be a supported PDF version",
      );
    if (typeof compress !== "boolean")
      throw new TypeError("createWriterToModify compress must be a boolean");
    var path = `/pdfs/${state.nextPdf++}.pdf`;
    module.FS.mkdirTree("/pdfs");
    module.FS.writeFile(path, bytes);
    var modifier;
    try {
      modifier = withString(path, (pointer) =>
        module._muhammara_wasm_modifier_create(
          pointer,
          version,
          compress ? 1 : 0,
        ),
      );
    } catch (error) {
      removeFile(path);
      throw error;
    }
    if (!modifier) {
      removeFile(path);
      throw new Error("Unable to modify PDF");
    }
    var ended = false;
    var owner = {};
    var context = null;
    var page = null;
    var objectsContext = null;
    var directImagePaths = [];
    var lifecycle = createChildLifecycle();
    var modifiedReaders = [];

    /**
     * Releases the native modifier, its children, readers, and stored assets. Idempotent.
     * @returns {void}
     */
    function dispose() {
      if (ended) return;
      lifecycle.disposeChildren();
      modifiedReaders.forEach((reader) => reader.end());
      modifiedReaders.length = 0;
      if (modifier) module._muhammara_wasm_modifier_destroy(modifier);
      removeAssets(directImagePaths);
      removeFile(path);
      modifier = 0;
      ended = true;
    }

    /**
     * Validates an optional reserved object ID.
     * @param {number} [value] - Object ID to write the XObject under.
     * @returns {number} The ID, or 0 to allocate a new one.
     * @throws {RangeError} If `value` is not a positive 32-bit integer.
     */
    function optionalObjectId(value) {
      if (value === undefined) return 0;
      if (!Number.isSafeInteger(value) || value <= 0 || value > 0xffffffff)
        throw new RangeError("objectId must be a positive object ID");
      return value;
    }
    /**
     * Resolves a registered image name to its virtual path.
     * @param {string} name - Registered image name.
     * @param {string} [expectedType] - Required RegisteredImageFormat.
     * @returns {string} Virtual file system path.
     * @throws {TypeError} If the name is not registered or the format differs.
     */
    function imagePath(name, expectedType) {
      if (typeof name !== "string" || !images.has(name))
        throw new TypeError("A registered image name is required");
      var type = imageTypes.get(name);
      if (expectedType !== undefined && type !== expectedType)
        throw new TypeError(`Registered image is not a ${expectedType}`);
      return images.get(name);
    }
    /**
     * Runs a callback with the path of a registered image or of stored bytes;
     * stored bytes are removed when the modifier ends.
     * @param {string|ByteSource} value - Registered image name or image bytes.
     * @param {string} label - Name used in byte errors.
     * @param {string} [expectedType] - Required RegisteredImageFormat for a name.
     * @param {function(string): *} callback - Receives the virtual path.
     * @returns {*} The callback result.
     * @throws {TypeError} If the name is not registered or the bytes are unsupported.
     */
    function withImagePathOrBytes(value, label, expectedType, callback) {
      if (typeof value === "string")
        return callback(imagePath(value, expectedType));
      var imageBytes = normalizeBytes(value, label);
      var path = `/images/${state.nextAsset++}.bin`;
      module.FS.mkdirTree("/images");
      module.FS.writeFile(path, imageBytes);
      directImagePaths.push(path);
      return callback(path);
    }

    /**
     * Wraps the object ID of a finished image or form so `doXObject()` accepts it.
     * @param {number} id - Object ID of the XObject.
     * @returns {{id: number}} The XObject, owned by this modifier.
     */
    function completedXObject(id) {
      var xobject = { id };
      Object.defineProperties(xobject, {
        _owner: { value: owner },
        _ended: { value: true },
      });
      return xobject;
    }

    /**
     * Rejects use of a finished modifier.
     * @returns {void}
     * @throws {Error} If the modifier has ended.
     */
    function requireOpen() {
      if (ended || !modifier) throw new Error("PDF writer has ended");
    }

    /**
     * Rejects use of an inactive page content context.
     * @param {object} value - Content context being used.
     * @returns {void}
     * @throws {Error} If the modifier ended or `value` is not the active context.
     */
    function requireContext(value) {
      requireOpen();
      if (context !== value)
        throw new Error("Page content context is not active");
    }

    /**
     * Creates the content context of the active new or modified page.
     * @returns {ContentContext} The content context.
     */
    function modifierContext() {
      /**
       * Applies one numeric content operator to the active page.
       * @param {string} name - Operator name for error messages.
       * @param {number} code - Native operator code.
       * @param {number[]} [args=[]] - Operands; a missing operand is `undefined` and rejected.
       * @param {boolean} [integers=false] - Whether operands must be integers.
       * @returns {ContentContext} The content context.
       * @throws {TypeError} If an operand is not finite, or not an integer when required.
       * @throws {Error} If the context is inactive or the operator fails.
       */
      function operator(name, code, args = [], integers = false) {
        requireContext(result);
        if (!args.every(Number.isFinite)) {
          throw new TypeError(`${name} requires finite numeric arguments`);
        }
        if (integers && !args.every(Number.isInteger)) {
          throw new TypeError(`${name} requires integer numeric arguments`);
        }
        if (
          !module._muhammara_wasm_modifier_operator(modifier, code, ...args)
        ) {
          throw new Error(`Unable to apply ${name}`);
        }
        return result;
      }
      var result = {
        /**
         * Returns the new page this context writes to.
         * @returns {PDFPage|null} The page, or null for a page modifier.
         * @throws {Error} If the content context is no longer active.
         */
        getAssociatedPage: function () {
          requireContext(result);
          if (!page) throw new Error("Form XObject has no associated page");
          return page;
        },
        /**
         * Returns the page content stream being written.
         * @returns {PDFStream} The stream; `getWriteStream()` exposes a byte writer.
         * @throws {Error} If the content context is no longer active.
         */
        getCurrentPageContentStream: function () {
          requireContext(result);
          if (!page) throw new Error("Form XObject has no page content stream");
          return {
            /**
             * Returns a writer that appends raw bytes to the page content stream.
             * @returns {ByteWriteStream} The byte writer.
             * @throws {Error} If the content context is no longer active.
             */
            getWriteStream: function () {
              return {
                /**
                 * Appends raw bytes to the page content stream.
                 * @param {ByteSource} bytes - Bytes to append.
                 * @returns {number} The number of bytes written.
                 * @throws {TypeError} If `bytes` is not a supported byte source.
                 * @throws {Error} If the content context is no longer active or the write fails.
                 */
                write: function (bytes) {
                  requireContext(result);
                  return writeNativeBytes(
                    module,
                    (pointer, length) =>
                      module._muhammara_wasm_modifier_write_current_page_stream(
                        modifier,
                        pointer,
                        length,
                      ),
                    bytes,
                  );
                },
              };
            },
          };
        },
        /**
         * Appends raw content-stream code.
         * @param {string} freeCode - Operators to write verbatim.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `freeCode` is not a string.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        writeFreeCode: function (freeCode) {
          return writeFreeCode(
            result,
            () => requireContext(result),
            (pointer, length) =>
              module._muhammara_wasm_modifier_write_free_code(
                modifier,
                pointer,
                length,
              ),
            freeCode,
          );
        },
        /**
         * Sets fill and stroke opacity through an ExtGState resource.
         * @param {number} opacity - Opacity from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `opacity` is not a finite number from 0 to 1.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        setOpacity: function (opacity) {
          requireContext(result);
          if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
            throw new TypeError(
              "Wrong Argument, please provide 1 opacity value between 0 and 1",
            );
          }
          if (!module._muhammara_wasm_modifier_set_opacity(modifier, opacity)) {
            throw new Error("Unable to set opacity");
          }
          return result;
        },
        /**
         * Closes, fills (nonzero winding), and strokes the current path (`b`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        b: function () {
          return operator("b", 0);
        },
        /**
         * Fills (nonzero winding) and strokes the current path (`B`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        B: function () {
          return operator("B", 1);
        },
        /**
         * Closes, fills (even-odd), and strokes the current path (`b*`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        bStar: function () {
          return operator("bStar", 2);
        },
        /**
         * Fills (even-odd) and strokes the current path (`B*`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        BStar: function () {
          return operator("BStar", 3);
        },
        /**
         * Closes and strokes the current path (`s`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        s: function () {
          return operator("s", 4);
        },
        /**
         * Strokes the current path (`S`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        S: function () {
          return operator("S", 5);
        },
        /**
         * Fills the current path using the nonzero winding rule (`f`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        f: function () {
          return operator("f", 6);
        },
        /**
         * Fills the current path using the nonzero winding rule (`F`, the obsolete `f` spelling).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        F: function () {
          return operator("F", 7);
        },
        /**
         * Fills the current path using the even-odd rule (`f*`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        fStar: function () {
          return operator("fStar", 8);
        },
        /**
         * Ends the current path without filling or stroking it (`n`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        n: function () {
          return operator("n", 9);
        },
        /**
         * Begins a new subpath at a point (`m`).
         * @param {number} x - Point x.
         * @param {number} y - Point y.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        m: function (x, y) {
          return operator("m", 10, [x, y]);
        },
        /**
         * Appends a straight line to a point (`l`).
         * @param {number} x - Point x.
         * @param {number} y - Point y.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        l: function (x, y) {
          return operator("l", 11, [x, y]);
        },
        /**
         * Appends a cubic Bezier curve (`c`).
         * @param {number} x1 - First control point x.
         * @param {number} y1 - First control point y.
         * @param {number} x2 - Second control point x.
         * @param {number} y2 - Second control point y.
         * @param {number} x3 - End point x.
         * @param {number} y3 - End point y.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        c: function (x1, y1, x2, y2, x3, y3) {
          return operator("c", 12, [x1, y1, x2, y2, x3, y3]);
        },
        /**
         * Appends a cubic Bezier curve whose first control point is the current point (`v`).
         * @param {number} x2 - Second control point x.
         * @param {number} y2 - Second control point y.
         * @param {number} x3 - End point x.
         * @param {number} y3 - End point y.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        v: function (x2, y2, x3, y3) {
          return operator("v", 13, [x2, y2, x3, y3]);
        },
        /**
         * Appends a cubic Bezier curve whose second control point is the end point (`y`).
         * @param {number} x1 - First control point x.
         * @param {number} y1 - First control point y.
         * @param {number} x3 - End point x.
         * @param {number} y3 - End point y.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        y: function (x1, y1, x3, y3) {
          return operator("y", 14, [x1, y1, x3, y3]);
        },
        /**
         * Closes the current subpath (`h`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        h: function () {
          return operator("h", 15);
        },
        /**
         * Appends a rectangle subpath (`re`).
         * @param {number} x - Lower-left x.
         * @param {number} y - Lower-left y.
         * @param {number} width - Rectangle width.
         * @param {number} height - Rectangle height.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        re: function (x, y, width, height) {
          return operator("re", 16, [x, y, width, height]);
        },
        /**
         * Saves the graphics state (`q`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        q: function () {
          return operator("q", 17);
        },
        /**
         * Restores the graphics state (`Q`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Q: function () {
          return operator("Q", 18);
        },
        /**
         * Concatenates a matrix to the current transformation matrix (`cm`).
         * @param {number} a - Matrix component `a`.
         * @param {number} b - Matrix component `b`.
         * @param {number} c - Matrix component `c`.
         * @param {number} d - Matrix component `d`.
         * @param {number} e - Matrix component `e`.
         * @param {number} f - Matrix component `f`.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        cm: function (a, b, c, d, e, f) {
          return operator("cm", 19, [a, b, c, d, e, f]);
        },
        /**
         * Sets the line width (`w`).
         * @param {number} width - Line width in user space units.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        w: function (width) {
          return operator("w", 20, [width]);
        },
        /**
         * Sets the line cap style (`J`).
         * @param {LineCapStyle} value - 0 butt, 1 round, or 2 projecting square.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `value` is missing or not an integer.
         * @throws {RangeError} If `value` is not 0, 1, or 2.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        J: function (value) {
          checkOperatorRange("J", value, 2, "line cap");
          return operator("J", 21, [value]);
        },
        /**
         * Sets the line join style (`j`).
         * @param {LineJoinStyle} value - 0 miter, 1 round, or 2 bevel.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `value` is missing or not an integer.
         * @throws {RangeError} If `value` is not 0, 1, or 2.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        j: function (value) {
          checkOperatorRange("j", value, 2, "line join");
          return operator("j", 22, [value]);
        },
        /**
         * Sets the miter limit (`M`).
         * @param {number} value - Miter limit.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        M: function (value) {
          return operator("M", 23, [value]);
        },
        /**
         * Sets the nonstroking gray color (`g`).
         * @param {number} value - Gray level from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        g: function (value) {
          return operator("g", 24, [value]);
        },
        /**
         * Sets the stroking gray color (`G`).
         * @param {number} gray - Gray level from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        G: function (gray) {
          return operator("G", 25, [gray]);
        },
        /**
         * Sets the nonstroking RGB color (`rg`).
         * @param {number} red - Red from 0 to 1.
         * @param {number} green - Green from 0 to 1.
         * @param {number} blue - Blue from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        rg: function (red, green, blue) {
          return operator("rg", 26, [red, green, blue]);
        },
        /**
         * Sets the stroking RGB color (`RG`).
         * @param {number} red - Red from 0 to 1.
         * @param {number} green - Green from 0 to 1.
         * @param {number} blue - Blue from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        RG: function (red, green, blue) {
          return operator("RG", 27, [red, green, blue]);
        },
        /**
         * Sets the nonstroking CMYK color (`k`).
         * @param {number} cyan - Cyan from 0 to 1.
         * @param {number} magenta - Magenta from 0 to 1.
         * @param {number} yellow - Yellow from 0 to 1.
         * @param {number} black - Black from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        k: function (cyan, magenta, yellow, black) {
          return operator("k", 28, [cyan, magenta, yellow, black]);
        },
        /**
         * Sets the stroking CMYK color (`K`).
         * @param {number} cyan - Cyan from 0 to 1.
         * @param {number} magenta - Magenta from 0 to 1.
         * @param {number} yellow - Yellow from 0 to 1.
         * @param {number} black - Black from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        K: function (cyan, magenta, yellow, black) {
          return operator("K", 29, [cyan, magenta, yellow, black]);
        },
        /**
         * Intersects the clipping path with the current path, nonzero winding (`W`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        W: function () {
          return operator("W", 30);
        },
        /**
         * Intersects the clipping path with the current path, even-odd (`W*`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        WStar: function () {
          return operator("WStar", 31);
        },
        /**
         * Begins a text object (`BT`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        BT: function () {
          return operator("BT", 32);
        },
        /**
         * Ends a text object (`ET`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        ET: function () {
          return operator("ET", 33);
        },
        /**
         * Sets the text matrix and text line matrix (`Tm`).
         * @param {number} a - Matrix component `a`.
         * @param {number} b - Matrix component `b`.
         * @param {number} c - Matrix component `c`.
         * @param {number} d - Matrix component `d`.
         * @param {number} e - Matrix component `e`.
         * @param {number} f - Matrix component `f`.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Tm: function (a, b, c, d, e, f) {
          return operator("Tm", 34, [a, b, c, d, e, f]);
        },
        /**
         * Sets the character spacing (`Tc`).
         * @param {number} characterSpace - Extra space per glyph in unscaled text space units.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Tc: function (characterSpace) {
          return operator("Tc", 35, [characterSpace]);
        },
        /**
         * Sets the word spacing (`Tw`).
         * @param {number} wordSpace - Extra space per ASCII space in unscaled text space units.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Tw: function (wordSpace) {
          return operator("Tw", 36, [wordSpace]);
        },
        /**
         * Sets the horizontal text scaling (`Tz`).
         * @param {number} horizontalScaling - Integer percentage; 100 is normal width.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {TypeError} If `horizontalScaling` is not an integer.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Tz: function (horizontalScaling) {
          return operator("Tz", 37, [horizontalScaling], true);
        },
        /**
         * Sets the text leading (`TL`).
         * @param {number} textLeading - Line spacing in unscaled text space units.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        TL: function (textLeading) {
          return operator("TL", 38, [textLeading]);
        },
        /**
         * Sets the text rendering mode (`Tr`).
         * @param {TextRenderingMode} renderingMode - Mode from 0 (fill) to 7 (add to clip).
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `renderingMode` is missing or not an integer.
         * @throws {RangeError} If `renderingMode` is outside 0 to 7.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Tr: function (renderingMode) {
          checkOperatorRange("Tr", renderingMode, 7, "text rendering mode");
          return operator("Tr", 39, [renderingMode], true);
        },
        /**
         * Sets the text rise (`Ts`).
         * @param {number} fontRise - Baseline shift in unscaled text space units.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Ts: function (fontRise) {
          return operator("Ts", 40, [fontRise]);
        },
        /**
         * Sets the dash pattern (`d`).
         * @param {number[]} dash - Alternating dash and gap lengths; empty for a solid line.
         * @param {number} [phase=0] - Offset into the pattern.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `dash` is not an array of finite numbers or `phase` is not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        d: function (dash, phase = 0) {
          requireContext(result);
          if (
            !Array.isArray(dash) ||
            !dash.every(Number.isFinite) ||
            !Number.isFinite(phase)
          ) {
            throw new TypeError("d requires a finite dash array and phase");
          }
          var pointer = dash.length ? module._malloc(dash.length * 8) : 0;
          try {
            if (pointer) module.HEAPF64.set(dash, pointer >>> 3);
            if (
              !module._muhammara_wasm_modifier_dash(
                modifier,
                pointer,
                dash.length,
                phase,
              )
            ) {
              throw new Error("Unable to set dash pattern");
            }
            return result;
          } finally {
            if (pointer) module._free(pointer);
          }
        },
        /**
         * Selects the font and size for text (`Tf`).
         * @param {PDFUsedFont|string} font - Font from this writer, or a font resource name.
         * @param {number} size - Positive font size.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `font` is neither a font from this writer nor a string.
         * @throws {RangeError} If `size` is not a positive finite number.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Tf: function (font, size) {
          requireContext(result);
          if (!((font && font._owner === owner) || typeof font === "string")) {
            throw new TypeError("Tf requires a font from this writer");
          }
          if (!Number.isFinite(size) || size <= 0) {
            throw new RangeError("Tf requires a positive font size");
          }
          if (typeof font === "string")
            return withString(font, (pointer) => {
              if (
                !module._muhammara_wasm_modifier_set_font_name(
                  modifier,
                  pointer,
                  size,
                )
              )
                throw new Error("Unable to set font");
              return result;
            });
          if (
            !module._muhammara_wasm_modifier_set_font(
              modifier,
              font._font,
              size,
            )
          )
            throw new Error("Unable to set font");
          return result;
        },
        /**
         * Writes one line of text with a writer font.
         * @param {string} text - Text to write.
         * @param {number} x - Baseline start x.
         * @param {number} y - Baseline y.
         * @param {WriteTextOptions} [options={}] - Font, size, color, opacity, and underline.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `text`, a coordinate, or the font is invalid, or a color option is invalid.
         * @throws {RangeError} If `size` is not positive.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        writeText: function (text, x, y, options = {}) {
          options = readTextOptions(options, colorValue);
          if (
            typeof text !== "string" ||
            ![x, y].every(Number.isFinite) ||
            !options ||
            typeof options !== "object" ||
            !options.font ||
            options.font._owner !== owner
          )
            throw new TypeError(
              "writeText requires text, coordinates, and a writer font",
            );
          var size = options.size ?? 1;
          if (!Number.isFinite(size) || size <= 0)
            throw new RangeError("writeText requires a positive font size");
          var underline = prepareUnderline(options, text, x, y, size);
          result.BT();
          applyDrawingColor(result, options, false);
          result.Tf(options.font, size).Tm(1, 0, 0, 1, x, y).Tj(text).ET();
          strokeUnderline(result, options, underline, x);
          return result;
        },
        /**
         * Draws an image or PDF page at a position.
         * @param {number} x - Left position.
         * @param {number} y - Bottom position.
         * @param {string|ByteSource} image - Registered image or PDF name, or JPEG, PNG, TIFF, or PDF bytes.
         * @param {DrawImageOptions} [options] - Page index and a matrix or fit transformation.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If a coordinate or option is invalid or the bytes are not a supported image.
         * @throws {RangeError} If `index` or the fit box is out of range.
         * @throws {Error} If the asset is unknown, the context is inactive, or drawing fails.
         */
        drawImage: function (x, y, image, options) {
          requireContext(result);
          drawImageCall(
            (path, drawOptions, matrixPointer) =>
              module._muhammara_wasm_modifier_draw_image(
                modifier,
                x,
                y,
                path,
                drawOptions.index,
                drawOptions.method,
                matrixPointer,
                drawOptions.width,
                drawOptions.height,
                drawOptions.proportional ? 1 : 0,
                drawOptions.fit,
              ),
            x,
            y,
            image,
            options,
            directImagePaths,
          );
          return result;
        },
        /**
         * Draws an image after reading an asynchronous byte source.
         * @async
         * @param {number} x - Left position.
         * @param {number} y - Bottom position.
         * @param {string|AsyncByteSource} image - Registered name, bytes, Blob, or File.
         * @param {DrawImageOptions} [options] - Page index and transformation.
         * @returns {Promise<this>} Resolves to the content context.
         * @throws {TypeError} If a coordinate, option, or byte source is invalid.
         * @throws {Error} If the asset is unknown, the context is inactive, or drawing fails.
         */
        drawImageAsync: async function (x, y, image, options) {
          return result.drawImage(
            x,
            y,
            await normalizeBytesAsync(image, "Image bytes"),
            options,
          );
        },
        /**
         * Paints an XObject (`Do`).
         * @param {string|number|FormXObject|ImageXObject} xobject - Resource name, form object ID,
         * or a completed XObject from this writer.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `xobject` is an unfinished form or belongs to another writer.
         * @throws {Error} If the content context is no longer active or the XObject cannot be placed.
         */
        doXObject: function (xobject) {
          requireContext(result);
          if (Number.isInteger(xobject) && xobject > 0) {
            if (
              !module._muhammara_wasm_modifier_do_form_object_id(
                modifier,
                xobject,
              )
            )
              throw new Error("Unable to place XObject");
            return result;
          }
          if (typeof xobject === "string") {
            return withString(xobject, (pointer) => {
              if (
                !module._muhammara_wasm_modifier_do_xobject_name(
                  modifier,
                  pointer,
                )
              )
                throw new Error("Unable to place XObject");
              return result;
            });
          }
          if (
            !xobject ||
            xobject._owner !== owner ||
            !xobject._ended ||
            !xobject.id
          ) {
            throw new TypeError(
              "doXObject requires a completed XObject from this writer",
            );
          }
          if (
            !module._muhammara_wasm_modifier_do_form_object_id(
              modifier,
              xobject.id,
            )
          )
            throw new Error("Unable to place XObject");
          return result;
        },
      };
      /**
       * Moves to the start of the next text line, offset from the current one (`Td`).
       * @param {number} x - Horizontal offset.
       * @param {number} y - Vertical offset.
       * @returns {this} The content context, for chaining.
       * @throws {TypeError} If an operand is missing or not finite.
       * @throws {Error} If the content context is no longer active or the operator fails.
       */
      result.Td = function (x, y) {
        return operator("Td", 41, [x, y]);
      };
      /**
       * Moves to the next text line and sets the leading to `-y` (`TD`).
       * @param {number} x - Horizontal offset.
       * @param {number} y - Vertical offset.
       * @returns {this} The content context, for chaining.
       * @throws {TypeError} If an operand is missing or not finite.
       * @throws {Error} If the content context is no longer active or the operator fails.
       */
      result.TD = function (x, y) {
        return operator("TD", 42, [x, y]);
      };
      /**
       * Moves to the start of the next text line (`T*`).
       * @returns {this} The content context, for chaining.
       * @throws {Error} If the content context is no longer active or the operator fails.
       */
      result.TStar = function () {
        return operator("TStar", 43);
      };
      /**
       * Shows text (`Tj`).
       * @param {string|Glyph[]} text - Text, or glyph entries to show without encoding.
       * @param {TextOptions} [options] - Text encoding; only for string text.
       * @returns {this} The content context, for chaining.
       * @throws {TypeError} If `options` is not an options object, has an unknown encoding, or is given with glyphs.
       * @throws {Error} If the content context is no longer active or the operator fails.
       */
      result.Tj = function (text, options) {
        requireContext(result);
        if (typeof text === "string")
          return withString(text, (pointer, length) => {
            if (
              !module._muhammara_wasm_modifier_show_text_operator(
                modifier,
                0,
                textEncoding(options),
                0,
                0,
                pointer,
                length,
              )
            )
              throw new Error("Unable to show text");
            return result;
          });
        if (options !== undefined)
          throw new TypeError("glyph text has no encoding options");
        return withGlyphs(text, (pointer) => {
          if (
            !module._muhammara_wasm_modifier_show_glyphs_operator(
              modifier,
              0,
              0,
              0,
              pointer,
              text.length,
            )
          )
            throw new Error("Unable to show glyph text");
          return result;
        });
      };
      addTextShowingOperators(result, () => requireContext(result), {
        /**
         * Runs a native string text-showing operator.
         * @param {...number} args - Operator kind, encoding, spacing, and text pointer and length.
         * @returns {boolean} Whether the operator was written.
         */
        text: (...args) =>
          module._muhammara_wasm_modifier_show_text_operator(modifier, ...args),
        /**
         * Runs a native glyph text-showing operator.
         * @param {...number} args - Operator kind, spacing, and glyph pointer and count.
         * @returns {boolean} Whether the operator was written.
         */
        glyphs: (...args) =>
          module._muhammara_wasm_modifier_show_glyphs_operator(
            modifier,
            ...args,
          ),
        /**
         * Runs the native `TJ` operator.
         * @param {...number} args - Encoding and the encoded item pointers.
         * @returns {boolean} Whether the operator was written.
         */
        tj: (...args) =>
          module._muhammara_wasm_modifier_show_tj(modifier, ...args),
      });
      addStructuredContentOperators(
        result,
        () => requireContext(result),
        (...args) =>
          module._muhammara_wasm_modifier_structured_operator(
            modifier,
            ...args,
          ),
      );
      installDrawingHelpers(result, colorValue);
      return result;
    }

    /**
     * Starts the native page context and creates its content context.
     * @returns {ContentContext} The content context.
     * @throws {Error} If the context cannot be started.
     */
    function startContext() {
      if (!module._muhammara_wasm_modifier_start_page_context(modifier)) {
        throw new Error("Unable to start page content context");
      }
      context = modifierContext();
      return context;
    }

    var additionalInfo = new Map();
    /**
     * Writes a text Info dictionary entry.
     * @param {string} key - Entry name.
     * @param {string} value - Text value.
     * @returns {void}
     * @throws {TypeError} If `key` or `value` is not a string.
     * @throws {Error} If the modifier has ended or the entry cannot be set.
     */
    function setInfo(key, value) {
      requireOpen();
      if (typeof key !== "string" || typeof value !== "string")
        throw new TypeError("addAdditionalInfoEntry requires two strings");
      withString(key, (keyPointer) =>
        withString(value, (valuePointer) => {
          if (
            !module._muhammara_wasm_modifier_set_info(
              modifier,
              keyPointer,
              valuePointer,
            )
          )
            throw new Error("Unable to set additional info entry");
        }),
      );
    }
    var infoDictionary = {
      /**
       * Sets a custom Info dictionary entry.
       * @param {string} key - Entry name without the leading slash.
       * @param {string} value - Text value.
       * @returns {void}
       * @throws {TypeError} If `key` or `value` is not a string.
       * @throws {Error} If the modifier has ended or the entry cannot be set.
       */
      addAdditionalInfoEntry: function (key, value) {
        setInfo(key, value);
        additionalInfo.set(key, value);
      },
      /**
       * Removes a custom Info dictionary entry.
       * @param {string} key - Entry name.
       * @returns {void}
       * @throws {TypeError} If `key` is not a string.
       * @throws {Error} If the modifier has ended or the entry cannot be removed.
       */
      removeAdditionalInfoEntry: function (key) {
        requireOpen();
        if (typeof key !== "string")
          throw new TypeError("removeAdditionalInfoEntry requires a string");
        withString(key, (pointer) => {
          if (!module._muhammara_wasm_modifier_remove_info(modifier, pointer))
            throw new Error("Unable to remove additional info entry");
        });
        additionalInfo.delete(key);
      },
      /**
       * Removes every custom Info dictionary entry.
       * @returns {void}
       * @throws {Error} If the modifier has ended or the entries cannot be cleared.
       */
      clearAdditionalInfoEntries: function () {
        requireOpen();
        if (!module._muhammara_wasm_modifier_clear_info(modifier))
          throw new Error("Unable to clear additional info entries");
        additionalInfo.clear();
      },
      /**
       * Reads a custom Info dictionary entry.
       * @param {string} key - Entry name.
       * @returns {string} The value, or an empty string when unset.
       * @throws {TypeError} If `key` is not a string.
       * @throws {Error} If the modifier has ended.
       */
      getAdditionalInfoEntry: function (key) {
        requireOpen();
        if (typeof key !== "string")
          throw new TypeError("getAdditionalInfoEntry requires a string");
        return additionalInfo.get(key) || "";
      },
      /**
       * Reads every custom Info dictionary entry.
       * @returns {Record<string, string>} Entries keyed by name.
       * @throws {Error} If the modifier has ended.
       */
      getAdditionalInfoEntries: function () {
        requireOpen();
        return Object.fromEntries(additionalInfo);
      },
      /**
       * Sets `/CreationDate`.
       * @param {string|Date|PDFDate} value - PDF date string, Date, or PDFDate.
       * @returns {void}
       * @throws {TypeError} If `value` is not a valid date.
       * @throws {Error} If the modifier has ended or the date cannot be parsed or set.
       */
      setCreationDate: function (value) {
        requireOpen();
        var date = normalizePDFDate(value);
        withString(date, (pointer) => {
          if (
            !module._muhammara_wasm_modifier_set_info_date(modifier, 0, pointer)
          )
            throw new Error("Unable to set creation date");
        });
      },
      /**
       * Sets `/ModDate`.
       * @param {string|Date|PDFDate} value - PDF date string, Date, or PDFDate.
       * @returns {void}
       * @throws {TypeError} If `value` is not a valid date.
       * @throws {Error} If the modifier has ended or the date cannot be parsed or set.
       */
      setModDate: function (value) {
        requireOpen();
        var date = normalizePDFDate(value);
        withString(date, (pointer) => {
          if (
            !module._muhammara_wasm_modifier_set_info_date(modifier, 1, pointer)
          )
            throw new Error("Unable to set modification date");
        });
      },
    };
    ["title", "author", "subject", "keywords", "creator", "producer"].forEach(
      (key) => {
        var value = "";
        Object.defineProperty(infoDictionary, key, {
          /**
           * Reads the text entry.
           * @returns {string} The value, or an empty string when unset.
           */
          get: function () {
            return value;
          },
          /**
           * Writes the text entry.
           * @param {string} nextValue - New value; other values are converted with `String()`.
           * @returns {void}
           * @throws {Error} If the modifier has ended or the entry cannot be set.
           */
          set: function (nextValue) {
            nextValue = String(nextValue);
            setInfo(key, nextValue);
            value = nextValue;
          },
        });
      },
    );
    var TRAPPED_VALUES = [
      constants.EInfoTrappedTrue,
      constants.EInfoTrappedFalse,
      constants.EInfoTrappedUnknown,
    ];
    var trapped = constants.EInfoTrappedUnknown;
    Object.defineProperty(infoDictionary, "trapped", {
      /**
       * Reads `/Trapped`.
       * @returns {EInfoTrapped} The trapped state; `EInfoTrappedUnknown` by default.
       */
      get: function () {
        return trapped;
      },
      /**
       * Writes `/Trapped`.
       * @param {EInfoTrapped} value - An `EInfoTrapped*` constant.
       * @returns {void}
       * @throws {RangeError} If `value` is not an EInfoTrapped constant.
       * @throws {Error} If the modifier has ended or the entry cannot be set.
       */
      set: function (value) {
        requireOpen();
        if (!TRAPPED_VALUES.includes(value))
          throw new RangeError("trapped must be an EInfoTrapped value");
        if (!module._muhammara_wasm_modifier_set_info_trapped(modifier, value))
          throw new Error("Unable to set trapped");
        trapped = value;
      },
    });

    return {
      /**
       * Appends pages of a source PDF as new pages.
       * @param {ByteSource} source - Source PDF bytes.
       * @param {PageRangeOptions} [options] - Pages to append; all by default.
       * @returns {number[]} Object IDs of the appended pages.
       * @throws {TypeError} If `options` is not an object or holds a password.
       * @throws {RangeError} If `type` is not an ERangeType constant, or
       * `specificRanges` is empty for a specific range or holds an invalid range.
       * @throws {Error} If a page is active, the modifier ended, or the source is encrypted
       * or unreadable; a failed append disposes the modifier.
       */
      appendPDFPagesFromPDF: function (source, options = {}) {
        requireOpen();
        if (page || context)
          throw new Error("Finish the active page before appending PDF pages");
        if (
          !options ||
          typeof options !== "object" ||
          Array.isArray(options) ||
          "password" in options
        )
          throw new TypeError("Append options must be a browser-safe object");
        var ranges = selectedPageRanges(options, constants);
        var sourceBytes = normalizeBytes(source, "PDF input");
        return withBytes(sourceBytes, (bytesPointer) => {
          var errorPointer = module._malloc(4);
          var countPointer = module._malloc(4);
          var rangesPointer = ranges.length
            ? module._malloc(ranges.length * 8)
            : 0;
          try {
            if (rangesPointer)
              module.HEAPU32.set(ranges.flat(), rangesPointer >>> 2);
            var ids = module._muhammara_wasm_modifier_append_pages_from_pdf(
              modifier,
              bytesPointer,
              sourceBytes.length,
              rangesPointer,
              ranges.length,
              errorPointer,
              countPointer,
            );
            var errorCode = module.HEAP32[errorPointer >>> 2];
            if (errorCode === 2) {
              dispose();
              throw new Error("Encrypted PDF input is not supported in Wasm");
            }
            if (errorCode !== 0) {
              dispose();
              throw new Error("Unable to append PDF pages from input bytes");
            }
            try {
              return ids
                ? Array.from(
                    module.HEAPU32.subarray(
                      ids >>> 2,
                      (ids >>> 2) + module.HEAPU32[countPointer >>> 2],
                    ),
                  )
                : [];
            } finally {
              if (ids) module._muhammara_wasm_free(ids);
            }
          } finally {
            module._free(errorPointer);
            module._free(countPointer);
            if (rangesPointer) module._free(rangesPointer);
          }
        });
      },
      /**
       * Appends pages of a source PDF after reading an asynchronous byte source.
       * @async
       * @param {AsyncByteSource} source - Source PDF bytes, Blob, or File.
       * @param {PageRangeOptions} [options] - Pages to append.
       * @returns {Promise<number[]>} Object IDs of the appended pages.
       * @throws {TypeError} If the source or options are invalid.
       * @throws {RangeError} If the page range is invalid.
       * @throws {Error} If a page is active, the modifier ended, or the source is unreadable.
       */
      appendPDFPagesFromPDFAsync: async function (source, options) {
        return this.appendPDFPagesFromPDF(
          await normalizeBytesAsync(source, "PDF input"),
          options,
        );
      },
      /**
       * Merges pages of a source PDF into a target page.
       * @param {PDFPage} targetPage - Page being written.
       * @param {ByteSource} source - Source PDF bytes.
       * @param {PageRangeOptions|Function} [options] - Pages to merge, or the callback.
       * @param {Function} [callback] - Called after the merge completes.
       * @returns {this} The modifier.
       * @throws {TypeError} If the page, options, or callback is invalid.
       * @throws {RangeError} If the page range is invalid.
       * @throws {Error} If another page is active, the modifier ended, or the source is unreadable.
       */
      mergePDFPagesToPage: function (target, source, options = {}, callback) {
        requireOpen();
        if (typeof options === "function") {
          callback = options;
          options = {};
        }
        if (
          target !== page ||
          !page ||
          !options ||
          typeof options !== "object" ||
          Array.isArray(options) ||
          "password" in options
        )
          throw new TypeError(
            "An active target PDFPage and browser-safe merge options are required",
          );
        if (callback !== undefined && typeof callback !== "function")
          throw new TypeError("Merge callback must be a function");
        var ranges = selectedPageRanges(options, constants);
        var sourceBytes = normalizeBytes(source, "PDF input");
        return withBytes(sourceBytes, (bytesPointer) => {
          var errorPointer = module._malloc(4);
          var rangesPointer = ranges.length
            ? module._malloc(ranges.length * 8)
            : 0;
          try {
            if (rangesPointer)
              module.HEAPU32.set(ranges.flat(), rangesPointer >>> 2);
            if (
              !module._muhammara_wasm_modifier_merge_pages_to_page_from_pdf(
                modifier,
                bytesPointer,
                sourceBytes.length,
                rangesPointer,
                ranges.length,
                errorPointer,
              )
            ) {
              if (module.HEAP32[errorPointer >>> 2] === 2)
                throw new Error("Encrypted PDF input is not supported in Wasm");
              throw new Error("Unable to merge PDF pages from input bytes");
            }
            if (callback) Reflect.apply(callback, globalThis, []);
            return this;
          } finally {
            module._free(errorPointer);
            if (rangesPointer) module._free(rangesPointer);
          }
        });
      },
      /**
       * Merges pages of a source PDF after reading an asynchronous byte source.
       * @async
       * @param {PDFPage} targetPage - Page being written.
       * @param {AsyncByteSource} source - Source PDF bytes, Blob, or File.
       * @param {PageRangeOptions|Function} [options] - Pages to merge, or the callback.
       * @param {Function} [callback] - Called after the merge completes.
       * @returns {Promise<this>} The writer.
       * @throws {TypeError} If the page, source, options, or callback is invalid.
       * @throws {RangeError} If the page range is invalid.
       * @throws {Error} If another page is active, the modifier ended, or the source is unreadable.
       */
      mergePDFPagesToPageAsync: async function (
        target,
        source,
        options,
        callback,
      ) {
        return this.mergePDFPagesToPage(
          target,
          await normalizeBytesAsync(source, "PDF input"),
          options,
          callback,
        );
      },
      /**
       * Reads the dimensions of an image or PDF page.
       * @param {string|ByteSource} image - Registered image or PDF name, or bytes.
       * @param {number} [imageIndex=0] - Page or TIFF frame index.
       * @returns {{width: number, height: number}} Size in points.
       * @throws {RangeError} If `imageIndex` is not a 32-bit unsigned integer.
       * @throws {TypeError} If the name is not registered or the bytes are unsupported.
       * @throws {Error} If the modifier ended or the dimensions cannot be read.
       */
      getImageDimensions: function (image, imageIndex = 0) {
        requireOpen();
        if (
          !Number.isSafeInteger(imageIndex) ||
          imageIndex < 0 ||
          imageIndex > 0xffffffff
        )
          throw new RangeError(
            "imageIndex must be a non-negative 32-bit integer",
          );
        var imageBytes;
        if (typeof image === "string") {
          var registeredPath = images.get(image) || pdfs.get(image);
          if (!registeredPath)
            throw new TypeError("A registered image or PDF name is required");
          imageBytes = module.FS.readFile(registeredPath);
        } else {
          imageBytes = normalizeBytes(image, "Image bytes");
        }
        var valuesPointer = module._malloc(16);
        try {
          return withBytes(imageBytes, (pointer) => {
            if (
              !module._muhammara_wasm_modifier_image_dimensions(
                modifier,
                pointer,
                imageBytes.length,
                imageIndex,
                valuesPointer,
              )
            )
              throw new Error("Unable to read image dimensions");
            return {
              width: module.HEAPF64[valuesPointer >>> 3],
              height: module.HEAPF64[(valuesPointer >>> 3) + 1],
            };
          });
        } finally {
          module._free(valuesPointer);
        }
      },
      /**
       * Reads image dimensions after reading an asynchronous byte source.
       * @async
       * @param {AsyncByteSource} image - Image or PDF bytes, Blob, or File.
       * @param {number} [imageIndex=0] - Page or TIFF frame index.
       * @returns {Promise<{width: number, height: number}>} Size in points.
       * @throws {RangeError} If `imageIndex` is invalid.
       * @throws {TypeError} If the bytes are unsupported.
       * @throws {Error} If the modifier ended or the dimensions cannot be read.
       */
      getImageDimensionsAsync: async function (image, imageIndex) {
        return this.getImageDimensions(
          await normalizeBytesAsync(image, "Image bytes"),
          imageIndex,
        );
      },
      getImageType: function (image) {
        requireOpen();
        return withImagePathOrBytes(image, "Image bytes", undefined, (path) =>
          withString(path, (pointer) => {
            var type = module._muhammara_wasm_modifier_get_image_type(
              modifier,
              pointer,
            );
            return [
              undefined,
              PDFImageType.PDF,
              PDFImageType.JPG,
              PDFImageType.TIFF,
              PDFImageType.PNG,
            ][type];
          }),
        );
      },
      getImageTypeAsync: async function (image) {
        return this.getImageType(
          await normalizeBytesAsync(image, "Image bytes"),
        );
      },
      getImagePagesCount: function (image) {
        requireOpen();
        return withImagePathOrBytes(image, "Image bytes", undefined, (path) =>
          withString(path, (pointer) =>
            module._muhammara_wasm_modifier_get_image_pages_count(
              modifier,
              pointer,
            ),
          ),
        );
      },
      getImagePagesCountAsync: async function (image) {
        return this.getImagePagesCount(
          await normalizeBytesAsync(image, "Image bytes"),
        );
      },
      retrieveJPGImageInformation: function (image) {
        requireOpen();
        var imageBytes =
          typeof image === "string"
            ? module.FS.readFile(imagePath(image, RegisteredImageFormat.JPEG))
            : normalizeBytes(image, "JPEG bytes");
        var valuesPointer = module._malloc(14 * 8);
        try {
          return withBytes(imageBytes, (pointer) => {
            if (
              !module._muhammara_wasm_modifier_retrieve_jpg_image_information(
                modifier,
                pointer,
                imageBytes.length,
                valuesPointer,
              )
            )
              throw new Error("Unable to retrieve JPEG image information");
            var values = module.HEAPF64.subarray(
              valuesPointer >>> 3,
              (valuesPointer >>> 3) + 14,
            );
            var result = {
              samplesWidth: values[0],
              samplesHeight: values[1],
              colorComponentsCount: values[2],
              JFIFInformationExists: Boolean(values[3]),
              ExifInformationExists: Boolean(values[7]),
              PhotoshopInformationExists: Boolean(values[11]),
            };
            if (result.JFIFInformationExists)
              Object.assign(result, {
                JFIFUnit: values[4],
                JFIFXDensity: values[5],
                JFIFYDensity: values[6],
              });
            if (result.ExifInformationExists)
              Object.assign(result, {
                ExifUnit: values[8],
                ExifXDensity: values[9],
                ExifYDensity: values[10],
              });
            if (result.PhotoshopInformationExists)
              Object.assign(result, {
                PhotoshopXDensity: values[12],
                PhotoshopYDensity: values[13],
              });
            return result;
          });
        } finally {
          module._free(valuesPointer);
        }
      },
      retrieveJPGImageInformationAsync: async function (image) {
        return this.retrieveJPGImageInformation(
          await normalizeBytesAsync(image, "JPEG bytes"),
        );
      },
      createImageXObjectFromJPGBytes: function (name, objectId) {
        requireOpen();
        var handle = withString(
          imagePath(name, RegisteredImageFormat.JPEG),
          (pointer) =>
            module._muhammara_wasm_modifier_create_jpg_image(
              modifier,
              pointer,
              optionalObjectId(objectId),
            ),
        );
        if (!handle) throw new Error("Unable to create JPEG image XObject");
        return completedXObject(
          module._muhammara_wasm_image_get_object_id(handle),
        );
      },
      createFormXObjectFromJPGBytes: function (name, objectId) {
        requireOpen();
        var handle = withString(
          imagePath(name, RegisteredImageFormat.JPEG),
          (pointer) =>
            module._muhammara_wasm_modifier_create_image_form(
              modifier,
              pointer,
              0,
              optionalObjectId(objectId),
            ),
        );
        if (!handle) throw new Error("Unable to create image form XObject");
        return completedXObject(
          module._muhammara_wasm_modifier_form_get_object_id(handle),
        );
      },
      createFormXObjectFromPNGBytes: function (name, objectId) {
        requireOpen();
        var handle = withString(
          imagePath(name, RegisteredImageFormat.PNG),
          (pointer) =>
            module._muhammara_wasm_modifier_create_image_form(
              modifier,
              pointer,
              1,
              optionalObjectId(objectId),
            ),
        );
        if (!handle) throw new Error("Unable to create image form XObject");
        return completedXObject(
          module._muhammara_wasm_modifier_form_get_object_id(handle),
        );
      },
      createFormXObjectsFromPDF: function (
        source,
        pageBox = constants.ePDFPageBoxMediaBox,
        options = {},
      ) {
        requireOpen();
        var cropBox = Array.isArray(pageBox) ? pageBox : undefined;
        if (cropBox) pageBox = constants.ePDFPageBoxMediaBox;
        if (!isPageBoxType(pageBox))
          throw new RangeError("A valid page box is required");
        if (
          !options ||
          typeof options !== "object" ||
          Array.isArray(options) ||
          "password" in options
        )
          throw new TypeError("PDF form options must be a browser-safe object");
        var ranges = selectedPageRanges(options, constants);
        var matrix = options.transformation;
        var additionalIds = options.additionalObjectIds ?? [];
        if (
          (cropBox &&
            (!Array.isArray(cropBox) ||
              cropBox.length !== 4 ||
              !cropBox.every(Number.isFinite))) ||
          (matrix !== undefined &&
            (!Array.isArray(matrix) ||
              matrix.length !== 6 ||
              !matrix.every(Number.isFinite))) ||
          !Array.isArray(additionalIds) ||
          !additionalIds.every(
            (id) => Number.isInteger(id) && id >= 0 && id <= 0xffffffff,
          )
        )
          throw new TypeError("Invalid byte PDF form options");
        var sourceBytes =
          typeof source === "string"
            ? (() => {
                var path = pdfs.get(source);
                if (!path) throw new Error(`Unknown PDF: ${source}`);
                return module.FS.readFile(path);
              })()
            : normalizeBytes(source, "PDF input");
        return withBytes(sourceBytes, (bytesPointer) =>
          withDoubles(cropBox || [], (cropPointer) =>
            withDoubles(matrix || [], (matrixPointer) => {
              var countPointer = module._malloc(4);
              var rangesPointer = ranges.length
                ? module._malloc(ranges.length * 8)
                : 0;
              var idsPointer = additionalIds.length
                ? module._malloc(additionalIds.length * 4)
                : 0;
              try {
                if (rangesPointer)
                  module.HEAPU32.set(ranges.flat(), rangesPointer >>> 2);
                if (idsPointer)
                  module.HEAPU32.set(additionalIds, idsPointer >>> 2);
                var result =
                  module._muhammara_wasm_modifier_create_forms_from_pdf(
                    modifier,
                    bytesPointer,
                    sourceBytes.length,
                    pageBox,
                    rangesPointer,
                    ranges.length,
                    cropPointer || 0,
                    matrixPointer || 0,
                    idsPointer,
                    additionalIds.length,
                    countPointer,
                  );
                if (!result) throw new Error("Unable to create forms from PDF");
                try {
                  return Array.from(
                    module.HEAPU32.subarray(
                      result >>> 2,
                      (result >>> 2) + module.HEAPU32[countPointer >>> 2],
                    ),
                  );
                } finally {
                  module._muhammara_wasm_free(result);
                }
              } finally {
                module._free(countPointer);
                if (rangesPointer) module._free(rangesPointer);
                if (idsPointer) module._free(idsPointer);
              }
            }),
          ),
        );
      },
      createFormXObjectsFromPDFAsync: async function (
        source,
        pageBox,
        options,
      ) {
        return this.createFormXObjectsFromPDF(
          await normalizeBytesAsync(source, "PDF input"),
          pageBox,
          options,
        );
      },
      createFormXObjectFromTIFF: function (image, options = {}) {
        requireOpen();
        if (!options || typeof options !== "object" || Array.isArray(options))
          throw new TypeError("TIFF options must be an object");
        function treatment(name) {
          var value = options[name];
          if (value === undefined) return undefined;
          if (!value || typeof value !== "object" || Array.isArray(value))
            throw new TypeError(`TIFF ${name} must be an object`);
          return value;
        }
        function color(name, value) {
          if (value === undefined)
            return { components: 0, values: [0, 0, 0, 0] };
          if (
            !Array.isArray(value) ||
            (value.length !== 3 && value.length !== 4) ||
            !value.every(
              (component) =>
                Number.isInteger(component) &&
                component >= 0 &&
                component <= 255,
            )
          )
            throw new TypeError(
              `TIFF ${name} must be an RGB (3) or CMYK (4) array of integers from 0 to 255`,
            );
          return {
            components: value.length,
            values: [...value, 0].slice(0, 4),
          };
        }
        var bwTreatment = treatment("bwTreatment");
        var grayscaleTreatment = treatment("grayscaleTreatment");
        var bwColor = color("bwTreatment.oneColor", bwTreatment?.oneColor);
        var grayscaleOneColor = color(
          "grayscaleTreatment.oneColor",
          grayscaleTreatment?.oneColor,
        );
        var grayscaleZeroColor = color(
          "grayscaleTreatment.zeroColor",
          grayscaleTreatment?.zeroColor,
        );
        var pageIndex = options.pageIndex ?? 0;
        if (!Number.isInteger(pageIndex) || pageIndex < 0)
          throw new RangeError("TIFF pageIndex must be a non-negative integer");
        var objectId = optionalObjectId(options.objectId);
        var handle = withImagePathOrBytes(
          image,
          "TIFF bytes",
          RegisteredImageFormat.TIFF,
          (path) =>
            withString(path, (pointer) =>
              module._muhammara_wasm_modifier_create_tiff_form(
                modifier,
                pointer,
                pageIndex,
                objectId,
                bwTreatment ? 1 : 0,
                bwTreatment?.asImageMask === true ? 1 : 0,
                bwColor.components,
                ...bwColor.values,
                grayscaleTreatment ? 1 : 0,
                grayscaleTreatment?.asColorMap === true ? 1 : 0,
                grayscaleOneColor.components,
                ...grayscaleOneColor.values,
                grayscaleZeroColor.components,
                ...grayscaleZeroColor.values,
              ),
            ),
        );
        if (!handle) throw new Error("Unable to create TIFF form XObject");
        return completedXObject(
          objectId ||
            module._muhammara_wasm_modifier_form_get_object_id(handle),
        );
      },
      createFormXObjectFromTIFFBytes: function (image, options) {
        return this.createFormXObjectFromTIFF(image, options);
      },
      createFormXObjectFromTIFFAsync: async function (image, options) {
        return this.createFormXObjectFromTIFF(
          await normalizeBytesAsync(image, "TIFF bytes"),
          options,
        );
      },
      createFormXObjectFromTIFFBytesAsync: async function (image, options) {
        return this.createFormXObjectFromTIFFAsync(image, options);
      },
      createFormXObject: function (left, bottom, right, top, objectId) {
        requireOpen();
        if (
          ![left, bottom, right, top].every(Number.isFinite) ||
          right <= left ||
          top <= bottom
        ) {
          throw new RangeError("A valid form rectangle is required");
        }
        objectId = optionalObjectId(objectId);
        var handle = module._muhammara_wasm_modifier_create_form(
          modifier,
          left,
          bottom,
          right,
          top,
          objectId,
        );
        if (!handle) throw new Error("Unable to create form XObject");
        var form = {
          _handle: handle,
          _modifier: modifier,
          _owner: owner,
          _ended: false,
          id:
            objectId ||
            module._muhammara_wasm_modifier_form_get_object_id(handle),
          getResourcesDictionary: function () {
            requireOpen();
            if (form._ended)
              throw new Error("Form XObject resources are no longer active");
            var resources = module._muhammara_wasm_modifier_get_form_resources(
              modifier,
              handle,
            );
            if (!resources)
              throw new Error("Form XObject resources are no longer active");
            return resourcesDictionary(resources, () => {
              requireOpen();
              if (form._ended)
                throw new Error("Form XObject resources are no longer active");
            });
          },
          getResourcesDictinary: function () {
            return form.getResourcesDictionary();
          },
          getContentStream: function () {
            requireOpen();
            if (form._ended)
              throw new Error(
                "Form XObject content stream is no longer active",
              );
            return {
              getWriteStream: function () {
                return {
                  write: function (bytes) {
                    requireOpen();
                    if (form._ended)
                      throw new Error(
                        "Form XObject content stream is no longer active",
                      );
                    return writeNativeBytes(
                      module,
                      (pointer, length) =>
                        module._muhammara_wasm_modifier_form_write_stream(
                          modifier,
                          handle,
                          pointer,
                          length,
                        ),
                      bytes,
                    );
                  },
                };
              },
            };
          },
          getContentContext: function () {
            requireOpen();
            if (form._ended)
              throw new Error("Form XObject content is not writable");
            function requireFormContent() {
              requireOpen();
              if (form._ended)
                throw new Error("Form XObject content has ended");
            }
            function operator(code, ...args) {
              requireFormContent();
              if (!args.every(Number.isFinite))
                throw new TypeError("Form operator requires finite arguments");
              if (
                !module._muhammara_wasm_modifier_form_operator(
                  modifier,
                  handle,
                  code,
                  ...args,
                )
              )
                throw new Error("Unable to apply form operator");
              return context;
            }
            var context = {
              /**
               * Appends raw content-stream code.
               * @param {string} freeCode - Operators to write verbatim.
               * @returns {this} The content context, for chaining.
               * @throws {TypeError} If `freeCode` is not a string.
               * @throws {Error} If the content context is no longer active or the operator fails.
               */
              writeFreeCode: function (freeCode) {
                requireFormContent();
                if (typeof freeCode !== "string")
                  throw new TypeError("writeFreeCode requires a string");
                return withString(freeCode, (pointer, length) => {
                  if (
                    !module._muhammara_wasm_modifier_form_write_free_code(
                      modifier,
                      handle,
                      pointer,
                      length,
                    )
                  )
                    throw new Error("Unable to write free code");
                  return context;
                });
              },
              Tf: function (font, size) {
                requireFormContent();
                if (!(
                  (font && font._owner === owner) ||
                  typeof font === "string"
                ))
                  throw new TypeError("Tf requires a font from this writer");
                if (!Number.isFinite(size) || size <= 0)
                  throw new RangeError("Tf requires a positive font size");
                var applied =
                  typeof font === "string"
                    ? withString(font, (pointer) =>
                        module._muhammara_wasm_modifier_form_set_font_name(
                          modifier,
                          handle,
                          pointer,
                          size,
                        ),
                      )
                    : font && font._owner === owner
                      ? module._muhammara_wasm_modifier_form_set_font(
                          modifier,
                          handle,
                          font._font,
                          size,
                        )
                      : false;
                if (!applied) throw new Error("Unable to set form font");
                return context;
              },
              writeText: function (text, x, y, options = {}) {
                requireFormContent();
                options = readTextOptions(options, colorValue);
                if (
                  typeof text !== "string" ||
                  ![x, y].every(Number.isFinite) ||
                  !options.font ||
                  options.font._owner !== owner
                )
                  throw new TypeError(
                    "writeText requires text, coordinates, and a writer font",
                  );
                var size = options.size ?? 1;
                if (!Number.isFinite(size) || size <= 0)
                  throw new RangeError(
                    "writeText requires a positive font size",
                  );
                var underline = prepareUnderline(options, text, x, y, size);
                context.BT();
                applyDrawingColor(context, options, false);
                context
                  .Tf(options.font, size)
                  .Tm(1, 0, 0, 1, x, y)
                  .Tj(text)
                  .ET();
                strokeUnderline(context, options, underline, x);
                return context;
              },
            };
            [
              ["q", 17],
              ["Q", 18],
              ["b", 0],
              ["B", 1],
              ["bStar", 2],
              ["BStar", 3],
              ["s", 4],
              ["F", 7],
              ["fStar", 8],
              ["n", 9],
              ["c", 12, 6],
              ["v", 13, 4],
              ["y", 14, 4],
              ["h", 15],
              ["BT", 32],
              ["ET", 33],
              ["Td", 41, 2],
              ["TD", 42, 2],
              ["TStar", 43],
              ["S", 5],
              ["f", 6],
              ["m", 10, 2],
              ["l", 11, 2],
              ["re", 16, 4],
              ["rg", 26, 3],
              ["RG", 27, 3],
              ["g", 24, 1],
              ["G", 25, 1],
              ["k", 28, 4],
              ["K", 29, 4],
              ["w", 20, 1],
              ["M", 23, 1],
              ["W", 30],
              ["WStar", 31],
              ["cm", 19, 6],
              ["Tm", 34, 6],
              ["Tc", 35, 1],
              ["Tw", 36, 1],
              ["TL", 38, 1],
              ["Ts", 40, 1],
            ].forEach(([name, code, arity = 0]) => {
              context[name] = function (...args) {
                // Missing operands become undefined and fail the finite check.
                args.length = Math.max(args.length, arity);
                return operator(code, ...args);
              };
            });
            /**
             * Sets the line cap style (`J`).
             * @param {LineCapStyle} value - 0 butt, 1 round, or 2 projecting square.
             * @returns {this} The content context, for chaining.
             * @throws {TypeError} If `value` is missing or not an integer.
             * @throws {RangeError} If `value` is not 0, 1, or 2.
             * @throws {Error} If the content context is no longer active or the operator fails.
             */
            context.J = function (value) {
              checkOperatorRange("J", value, 2, "line cap");
              return operator(21, value);
            };
            /**
             * Sets the line join style (`j`).
             * @param {LineJoinStyle} value - 0 miter, 1 round, or 2 bevel.
             * @returns {this} The content context, for chaining.
             * @throws {TypeError} If `value` is missing or not an integer.
             * @throws {RangeError} If `value` is not 0, 1, or 2.
             * @throws {Error} If the content context is no longer active or the operator fails.
             */
            context.j = function (value) {
              checkOperatorRange("j", value, 2, "line join");
              return operator(22, value);
            };
            /**
             * Sets the horizontal text scaling (`Tz`).
             * @param {number} horizontalScaling - Integer percentage; 100 is normal width.
             * @returns {this} The content context, for chaining.
             * @throws {TypeError} If an operand is missing or not finite.
             * @throws {TypeError} If `horizontalScaling` is not an integer.
             * @throws {Error} If the content context is no longer active or the operator fails.
             */
            context.Tz = function (horizontalScaling) {
              if (!Number.isInteger(horizontalScaling))
                throw new TypeError("Tz requires integer numeric arguments");
              return operator(37, horizontalScaling);
            };
            /**
             * Sets the text rendering mode (`Tr`).
             * @param {TextRenderingMode} renderingMode - Mode from 0 (fill) to 7 (add to clip).
             * @returns {this} The content context, for chaining.
             * @throws {TypeError} If `renderingMode` is missing or not an integer.
             * @throws {RangeError} If `renderingMode` is outside 0 to 7.
             * @throws {Error} If the content context is no longer active or the operator fails.
             */
            context.Tr = function (renderingMode) {
              checkOperatorRange("Tr", renderingMode, 7, "text rendering mode");
              return operator(39, renderingMode);
            };
            /**
             * Sets the dash pattern (`d`).
             * @param {number[]} dash - Alternating dash and gap lengths; empty for a solid line.
             * @param {number} [phase=0] - Offset into the pattern.
             * @returns {this} The content context, for chaining.
             * @throws {TypeError} If `dash` is not an array of finite numbers or `phase` is not finite.
             * @throws {Error} If the content context is no longer active or the operator fails.
             */
            context.d = function (dash, phase = 0) {
              requireFormContent();
              if (
                !Array.isArray(dash) ||
                !dash.every(Number.isFinite) ||
                !Number.isFinite(phase)
              )
                throw new TypeError("d requires a finite dash array and phase");
              return withDoubles(dash, (pointer) => {
                if (
                  !module._muhammara_wasm_modifier_form_dash(
                    modifier,
                    handle,
                    pointer,
                    dash.length,
                    phase,
                  )
                )
                  throw new Error("Unable to set dash pattern");
                return context;
              });
            };
            /**
             * Sets fill and stroke opacity through an ExtGState resource.
             * @param {number} opacity - Opacity from 0 to 1.
             * @returns {this} The content context, for chaining.
             * @throws {TypeError} If `opacity` is not a finite number from 0 to 1.
             * @throws {Error} If the content context is no longer active or the operator fails.
             */
            context.setOpacity = function (opacity) {
              requireFormContent();
              if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1)
                throw new TypeError(
                  "Wrong Argument, please provide 1 opacity value between 0 and 1",
                );
              if (
                !module._muhammara_wasm_modifier_form_set_opacity(
                  modifier,
                  handle,
                  opacity,
                )
              )
                throw new Error("Unable to set opacity");
              return context;
            };
            context.Tj = function (text, options) {
              requireOpen();
              if (form._ended)
                throw new Error("Form XObject content has ended");
              if (typeof text === "string")
                return withString(text, (pointer, length) => {
                  if (
                    !module._muhammara_wasm_modifier_form_show_text_operator(
                      modifier,
                      handle,
                      0,
                      textEncoding(options),
                      0,
                      0,
                      pointer,
                      length,
                    )
                  )
                    throw new Error("Unable to show text");
                  return context;
                });
              if (options !== undefined)
                throw new TypeError("glyph text has no encoding options");
              return withGlyphs(text, (pointer) => {
                if (
                  !module._muhammara_wasm_modifier_form_show_glyphs_operator(
                    modifier,
                    handle,
                    0,
                    0,
                    0,
                    pointer,
                    text.length,
                  )
                )
                  throw new Error("Unable to show glyph text");
                return context;
              });
            };
            addTextShowingOperators(
              context,
              () => {
                requireOpen();
                if (form._ended)
                  throw new Error("Form XObject content has ended");
              },
              {
                text: (...args) =>
                  module._muhammara_wasm_modifier_form_show_text_operator(
                    modifier,
                    handle,
                    ...args,
                  ),
                glyphs: (...args) =>
                  module._muhammara_wasm_modifier_form_show_glyphs_operator(
                    modifier,
                    handle,
                    ...args,
                  ),
                tj: (...args) =>
                  module._muhammara_wasm_modifier_form_show_tj(
                    modifier,
                    handle,
                    ...args,
                  ),
              },
            );
            addStructuredContentOperators(
              context,
              () => {
                requireOpen();
                if (form._ended)
                  throw new Error("Form XObject content has ended");
              },
              (...args) =>
                module._muhammara_wasm_modifier_form_structured_operator(
                  modifier,
                  handle,
                  ...args,
                ),
            );
            context.doXObject = function (xobject) {
              requireOpen();
              if (form._ended)
                throw new Error("Form XObject content has ended");
              if (Number.isInteger(xobject) && xobject > 0) {
                if (
                  !module._muhammara_wasm_modifier_form_do_form_object_id(
                    modifier,
                    handle,
                    xobject,
                  )
                )
                  throw new Error("Unable to place XObject");
                return context;
              }
              if (typeof xobject === "string")
                return withString(xobject, (pointer) => {
                  if (
                    !module._muhammara_wasm_modifier_form_do_xobject_name(
                      modifier,
                      handle,
                      pointer,
                    )
                  )
                    throw new Error("Unable to place XObject");
                  return context;
                });
              if (
                !xobject ||
                xobject._owner !== owner ||
                !xobject._ended ||
                !xobject.id
              )
                throw new TypeError(
                  "doXObject requires a completed XObject from this writer",
                );
              if (
                !module._muhammara_wasm_modifier_form_do_form_object_id(
                  modifier,
                  handle,
                  xobject.id,
                )
              )
                throw new Error("Unable to place XObject");
              return context;
            };
            context.drawImage = function (x, y, image, options) {
              requireOpen();
              if (form._ended)
                throw new Error("Form XObject content has ended");
              drawImageCall(
                (path, drawOptions, matrixPointer) =>
                  module._muhammara_wasm_modifier_form_draw_image(
                    modifier,
                    handle,
                    x,
                    y,
                    path,
                    drawOptions.index,
                    drawOptions.method,
                    matrixPointer,
                    drawOptions.width,
                    drawOptions.height,
                    drawOptions.proportional ? 1 : 0,
                    drawOptions.fit,
                  ),
                x,
                y,
                image,
                options,
                directImagePaths,
              );
              return context;
            };
            context.drawImageAsync = async function (x, y, image, options) {
              return context.drawImage(
                x,
                y,
                await normalizeBytesAsync(image, "Image bytes"),
                options,
              );
            };
            installDrawingHelpers(context, colorValue);
            return context;
          },
          end: function () {
            requireOpen();
            if (
              form._ended ||
              !module._muhammara_wasm_modifier_end_form(modifier, handle)
            ) {
              throw new Error("Unable to end form XObject");
            }
            form._ended = true;
            return form;
          },
        };
        return form;
      },
      endFormXObject: function (form) {
        requireOpen();
        if (
          !form ||
          form._owner !== owner ||
          form._ended ||
          typeof form.end !== "function"
        )
          throw new TypeError(
            "endFormXObject requires an open form from this writer",
          );
        form.end();
        return this;
      },
      createPage: function (left, bottom, right, top) {
        requireOpen();
        if (page || context) throw new Error("Finish the active page first");
        var nextPage = new PDFPage(left, bottom, right, top);
        if (
          !module._muhammara_wasm_modifier_create_page(
            modifier,
            ...nextPage.mediaBox,
          )
        ) {
          throw new Error("Unable to create page");
        }
        page = nextPage;
        page._getNativeResources = function () {
          requireOpen();
          if (page !== nextPage) {
            throw new Error("PDFPage resources are not active");
          }
          var handle =
            module._muhammara_wasm_modifier_get_page_resources(modifier);
          if (!handle) throw new Error("Unable to get page resources");
          return resourcesDictionary(handle, function () {
            requireOpen();
            if (page !== nextPage) {
              throw new Error("PDFPage resources are not active");
            }
          });
        };
        return page;
      },
      getFontForBytes: function (name, metricsNameOrIndex, fontIndex) {
        requireOpen();
        if (typeof name !== "string") {
          throw new TypeError(
            "getFontForBytes requires a registered font name",
          );
        }
        var metricsName;
        if (metricsNameOrIndex === undefined) {
          if (fontIndex !== undefined) {
            throw new TypeError(
              "getFontForBytes requires a metrics name before a font index",
            );
          }
          fontIndex = 0;
        } else if (typeof metricsNameOrIndex === "number") {
          if (fontIndex !== undefined) {
            throw new TypeError(
              "getFontForBytes requires a metrics name before a font index",
            );
          }
          fontIndex = metricsNameOrIndex;
        } else if (typeof metricsNameOrIndex === "string") {
          metricsName = metricsNameOrIndex;
          fontIndex = fontIndex ?? 0;
        } else {
          throw new TypeError(
            "getFontForBytes requires a metrics name or font index",
          );
        }
        if (
          !Number.isInteger(fontIndex) ||
          fontIndex < 0 ||
          fontIndex > 0xffffffff
        ) {
          throw new RangeError(
            "Font index must be a non-negative 32-bit integer",
          );
        }
        var fontPath = fonts.get(name);
        var metricsPath =
          metricsName === undefined ? null : fonts.get(metricsName);
        if (!fontPath || (metricsName !== undefined && !metricsPath)) {
          throw new Error(`Unknown font: ${metricsName || name}`);
        }
        var font = withString(fontPath, (fontPointer) =>
          metricsPath === null
            ? module._muhammara_wasm_modifier_get_font_for_bytes(
                modifier,
                fontPointer,
                0,
                fontIndex,
              )
            : withString(metricsPath, (metricsPointer) =>
                module._muhammara_wasm_modifier_get_font_for_bytes(
                  modifier,
                  fontPointer,
                  metricsPointer,
                  fontIndex,
                ),
              ),
        );
        if (!font) throw new Error("Unable to load registered font bytes");
        return {
          _modifier: modifier,
          _owner: owner,
          _font: font,
          calculateTextDimensions: function (text, size = 1) {
            requireOpen();
            return measureFontText(
              module,
              withString,
              text,
              size,
              (textPointer, resultPointer) =>
                module._muhammara_wasm_modifier_font_text_dimensions(
                  modifier,
                  font,
                  textPointer,
                  size,
                  resultPointer,
                ),
              (glyphPointer, count, resultPointer) =>
                module._muhammara_wasm_modifier_font_glyph_dimensions(
                  modifier,
                  font,
                  glyphPointer,
                  count,
                  size,
                  resultPointer,
                ),
            );
          },
          /** Read underline thickness, position, and text advance for writeText. */
          _underline: function (text, size) {
            requireOpen();
            return readFontUnderline(
              module,
              withString,
              text,
              size,
              (textPointer, resultPointer) =>
                module._muhammara_wasm_modifier_font_underline(
                  modifier,
                  font,
                  textPointer,
                  size,
                  resultPointer,
                ),
            );
          },
          getFontMetrics: function (size = 1) {
            requireOpen();
            if (!Number.isFinite(size) || size <= 0)
              throw new TypeError("A positive font size is required");
            var values = module._malloc(64);
            try {
              if (
                !module._muhammara_wasm_modifier_font_metrics(
                  modifier,
                  font,
                  size,
                  values,
                )
              )
                throw new Error("Unable to read font metrics");
              var offset = values >>> 3;
              return {
                pixelsPerEm: {
                  x: module.HEAPF64[offset],
                  y: module.HEAPF64[offset + 1],
                  xScale: module.HEAPF64[offset + 2],
                  yScale: module.HEAPF64[offset + 3],
                },
                ascender: module.HEAPF64[offset + 4],
                descender: module.HEAPF64[offset + 5],
                height: module.HEAPF64[offset + 6],
                max_advance: module.HEAPF64[offset + 7],
              };
            } finally {
              module._free(values);
            }
          },
        };
      },
      requireCatalogUpdate: function () {
        requireOpen();
        if (!module._muhammara_wasm_modifier_require_catalog_update(modifier)) {
          throw new Error("Unable to require catalog update");
        }
      },
      /** Attaches a newly written PageLabels object to the catalog. @private */
      _setPageLabelsObject: function (objectId) {
        requireOpen();
        if (
          !Number.isInteger(objectId) ||
          objectId <= 0 ||
          !module._muhammara_wasm_modifier_set_page_labels(modifier, objectId)
        ) {
          throw new RangeError("PageLabels object ID must be positive");
        }
      },
      replaceObject: function (
        pageIndex,
        sourceObjectId,
        replacementObjectId,
        options,
      ) {
        requireOpen();
        if (
          ![pageIndex, sourceObjectId, replacementObjectId].every(
            (value) =>
              Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff,
          ) ||
          sourceObjectId === 0 ||
          replacementObjectId === 0
        ) {
          throw new RangeError(
            "Page index and object IDs must be unsigned 32-bit integers; object IDs must be positive",
          );
        }
        if (options && options.scope === ObjectReplacementScope.GLOBAL) {
          var parser = this.getModifiedFileParser();
          var pageCount = parser.getPagesCount();

          parser.end();
          for (var index = 0; index < pageCount; ++index) {
            this.replaceObject(index, sourceObjectId, replacementObjectId);
          }
          return this;
        }
        if (
          !module._muhammara_wasm_modifier_replace_object(
            modifier,
            pageIndex,
            sourceObjectId,
            replacementObjectId,
          )
        ) {
          throw new RangeError(
            "Page and object IDs must belong to the modified PDF",
          );
        }
        return this;
      },
      getObjectsContext: function () {
        requireOpen();
        if (!objectsContext) {
          var handle =
            module._muhammara_wasm_modifier_get_objects_context(modifier);
          if (!handle) throw new Error("Unable to get objects context");
          objectsContext = rawObjectsContext(handle, requireOpen);
        }
        return objectsContext;
      },
      getModifiedFileParser: function () {
        requireOpen();
        var parser =
          module._muhammara_wasm_modifier_get_modified_file_parser(modifier);
        if (!parser) throw new Error("Unable to get modified file parser");
        var reader = createReader(null, parser, requireOpen);
        modifiedReaders.push(reader);
        return reader;
      },
      getDocumentContext: function () {
        requireOpen();
        return {
          getInfoDictionary: function () {
            requireOpen();
            return infoDictionary;
          },
        };
      },
      createPDFTextString: function (value) {
        return new PDFTextString(value);
      },
      createPDFDate: function (value) {
        return new PDFDate(value);
      },
      attachURLLinktoCurrentPage: function (url, left, bottom, right, top) {
        requireOpen();
        if (
          typeof url !== "string" ||
          ![left, bottom, right, top].every(Number.isFinite) ||
          right < left ||
          top < bottom
        )
          throw new TypeError(
            "URL link requires a URL and valid PDF rectangle",
          );
        withString(url, (pointer) => {
          if (
            !module._muhammara_wasm_modifier_attach_url_link_to_current_page(
              modifier,
              pointer,
              left,
              bottom,
              right,
              top,
            )
          )
            throw new Error("Unable to attach URL link to current page");
        });
        return this;
      },
      createAnnotation: function (subtype, left, bottom, right, top, options) {
        requireOpen();
        return createAnnotation(
          (...args) =>
            module._muhammara_wasm_modifier_create_annotation_for_current_page(
              modifier,
              ...args,
            ),
          subtype,
          left,
          bottom,
          right,
          top,
          options,
        );
      },
      registerAnnotationReferenceForNextPageWrite: function (objectId) {
        requireOpen();
        if (!Number.isInteger(objectId) || objectId <= 0)
          throw new RangeError("Annotation object ID must be positive");
        if (
          !module._muhammara_wasm_modifier_register_annotation(
            modifier,
            objectId,
          )
        )
          throw new Error("Unable to register annotation for the current page");
        return this;
      },
      startPageContentContext: function (nextPage) {
        requireOpen();
        if (nextPage !== page || context) {
          throw new Error("A writable PDFPage is required");
        }
        return startContext();
      },
      pausePageContentContext: function (value) {
        requireContext(value);
        if (!page || !module._muhammara_wasm_modifier_pause_page(modifier))
          throw new Error("Unable to pause page content context");
        return this;
      },
      createPageModifier: function (
        index = 0,
        ensureContentEncapsulation = false,
      ) {
        requireOpen();
        if (!Number.isInteger(index) || index < 0 || index > 0xffffffff) {
          throw new RangeError(
            "Page index must be a non-negative 32-bit integer",
          );
        }
        if (typeof ensureContentEncapsulation !== "boolean") {
          throw new TypeError("ensureContentEncapsulation must be a boolean");
        }
        var modifierPage = null;
        return {
          startContext: function () {
            requireOpen();
            if (
              page ||
              context ||
              !(modifierPage
                ? module._muhammara_wasm_modifier_start_page_context(modifier)
                : module._muhammara_wasm_modifier_start_page(
                    modifier,
                    index,
                    ensureContentEncapsulation ? 1 : 0,
                  ))
            ) {
              throw new RangeError(`Unable to modify page ${index}`);
            }
            modifierPage = true;
            context = modifierContext();
            return this;
          },
          getContext: function () {
            requireOpen();
            if (!modifierPage || !context)
              throw new Error("No context created");
            return context;
          },
          getResourcesDictionary: function () {
            requireOpen();
            if (!modifierPage || !context) {
              throw new Error("No context created");
            }
            var handle =
              module._muhammara_wasm_modifier_get_page_resources(modifier);
            if (!handle) throw new Error("Unable to get page resources");
            var resourceContext = context;
            return resourcesDictionary(handle, () =>
              requireContext(resourceContext),
            );
          },
          attachURLLinktoCurrentPage: function (url, left, bottom, right, top) {
            requireOpen();
            if (
              !modifierPage ||
              typeof url !== "string" ||
              ![left, bottom, right, top].every(Number.isFinite) ||
              right < left ||
              top < bottom
            ) {
              throw new TypeError(
                "URL link requires a URL and valid PDF rectangle",
              );
            }
            withString(url, (pointer) => {
              if (
                !module._muhammara_wasm_modifier_attach_url_link(
                  modifier,
                  pointer,
                  left,
                  bottom,
                  right,
                  top,
                )
              ) {
                throw new Error("Unable to attach URL link to current page");
              }
            });
            return this;
          },
          createAnnotation: function (
            subtype,
            left,
            bottom,
            right,
            top,
            options,
          ) {
            requireOpen();
            if (!modifierPage) throw new Error("No context created");
            return createAnnotation(
              (...args) =>
                module._muhammara_wasm_modifier_create_annotation(
                  modifier,
                  ...args,
                ),
              subtype,
              left,
              bottom,
              right,
              top,
              options,
            );
          },
          endContext: function () {
            requireOpen();
            requireContext(context);
            if (!module._muhammara_wasm_modifier_end_context(modifier)) {
              throw new Error("Unable to finish page content context");
            }
            context = null;
            return this;
          },
          writePage: function () {
            requireOpen();
            if (
              !modifierPage ||
              context ||
              !module._muhammara_wasm_modifier_write_page(modifier)
            ) {
              throw new Error("Unable to write modified page");
            }
            modifierPage = null;
            return this;
          },
        };
      },
      writePage: function (nextPage) {
        requireOpen();
        if (nextPage !== page)
          throw new Error("The active PDFPage is required");
        if (context && !module._muhammara_wasm_modifier_end_context(modifier)) {
          throw new Error("Unable to finish page content context");
        }
        context = null;
        if (!module._muhammara_wasm_modifier_write_page(modifier))
          throw new Error("Unable to write page");
        page = null;
        nextPage._getNativeResources = null;
        return this;
      },
      writePageAndReturnID: function (nextPage) {
        requireOpen();
        if (nextPage !== page)
          throw new Error("The active PDFPage is required");
        var objectIdPointer = module._malloc(4);
        try {
          if (
            !module._muhammara_wasm_modifier_write_page_and_return_id(
              modifier,
              objectIdPointer,
            )
          )
            throw new Error("Unable to write page");
          var objectId = module.HEAPU32[objectIdPointer >>> 2];
          page = null;
          context = null;
          nextPage._getNativeResources = null;
          return objectId;
        } finally {
          module._free(objectIdPointer);
        }
      },
      createPDFCopyingContext: function (sourceBytes) {
        requireOpen();
        sourceBytes = normalizeBytes(sourceBytes, "PDF input");
        var sourcePath = `/pdfs/${state.nextPdf++}.pdf`;
        module.FS.writeFile(sourcePath, sourceBytes);
        var copying;
        try {
          copying = withString(sourcePath, (pointer) =>
            module._muhammara_wasm_modifier_create_copying_context(
              modifier,
              pointer,
            ),
          );
        } catch (error) {
          removeFile(sourcePath);
          throw error;
        }
        if (!copying) {
          removeFile(sourcePath);
          throw new Error("Unable to create PDF copying context");
        }
        var copyingEnded = false;
        var sourceParsers = [];
        function cleanupCopying() {
          if (!copying) return;
          sourceParsers.forEach((parser) => parser._end());
          if (!copyingEnded)
            module._muhammara_wasm_copying_context_end(copying);
          module._muhammara_wasm_modifier_destroy_copying_context(copying);
          removeFile(sourcePath);
          copying = 0;
          copyingEnded = true;
          lifecycle.untrack(cleanupCopying);
        }
        lifecycle.track(cleanupCopying);
        function requireCopying() {
          requireOpen();
          if (copyingEnded) throw new Error("PDF copying context has ended");
        }
        return {
          getSourceDocumentParser: function () {
            requireCopying();
            var parser = createReader(
              undefined,
              module._muhammara_wasm_copying_context_get_source_document_parser(
                copying,
              ),
              requireCopying,
              copying,
              false,
            );
            sourceParsers.push(parser);
            return parser;
          },
          getSourceDocumentStream: function () {
            requireCopying();
            var parser = this.getSourceDocumentParser();
            return parser.getSourceDocumentStream();
          },
          copyDirectObjectAsIs: function (object) {
            requireCopying();
            if (!object || object._copyingContext !== copying) {
              throw new TypeError(
                "PDF object must originate from this source document parser",
              );
            }
            if (
              !module._muhammara_wasm_copying_context_copy_direct_object_as_is(
                copying,
                object._handle,
              )
            ) {
              throw new Error("Unable to copy PDF object");
            }
            return this;
          },
          ...copyingObjectOperations(copying, requireCopying),
          appendPDFPageFromPDF: function (index) {
            requireCopying();
            if (!Number.isInteger(index) || index < 0) {
              throw new RangeError("Page index must be a non-negative integer");
            }
            var objectId = module._muhammara_wasm_copying_context_append_page(
              copying,
              index,
            );
            if (!objectId) {
              throw new RangeError(`Unable to append page ${index}`);
            }
            return objectId;
          },
          appendPDFPagesFromPDF: function (start, end) {
            requireCopying();
            if (
              !Number.isInteger(start) ||
              !Number.isInteger(end) ||
              start < 0 ||
              end < start
            ) {
              throw new RangeError("A valid zero-based page range is required");
            }
            for (var index = start; index <= end; ++index)
              this.appendPDFPageFromPDF(index);
            return this;
          },
          mergePDFPageToPage: function (targetPage, index) {
            requireCopying();
            if (targetPage !== page || !Number.isInteger(index) || index < 0)
              throw new Error(
                "The active target page and a non-negative source index are required",
              );
            if (
              !module._muhammara_wasm_copying_context_merge_page(copying, index)
            ) {
              throw new RangeError(`Unable to merge page ${index}`);
            }
            return this;
          },
          createFormXObjectFromPDFPage: function (
            index,
            pageBox = constants.ePDFPageBoxMediaBox,
            transformation,
          ) {
            requireCopying();
            [index, pageBox, transformation] = copiedPageFormArguments(
              index,
              pageBox,
              transformation,
            );
            var objectId = withDoubles(
              Array.isArray(pageBox) ? pageBox : [],
              (cropBox) =>
                withDoubles(transformation || [], (matrix) =>
                  module._muhammara_wasm_copying_context_create_form_from_page(
                    copying,
                    index,
                    Array.isArray(pageBox) ? -1 : pageBox,
                    cropBox || 0,
                    matrix || 0,
                  ),
                ),
            );
            if (!objectId)
              throw new RangeError(`Unable to create form from page ${index}`);
            return objectId;
          },
          mergePDFPageToFormXObject: function (form, index) {
            requireCopying();
            if (
              !form ||
              form._owner !== owner ||
              form._ended ||
              !Number.isInteger(index) ||
              index < 0
            ) {
              throw new TypeError(
                "An open form from this modifier and a non-negative page index are required",
              );
            }
            if (
              !module._muhammara_wasm_copying_context_merge_page_to_form(
                copying,
                form._handle,
                index,
              )
            ) {
              throw new RangeError(`Unable to merge page ${index} to form`);
            }
            return this;
          },
          end: function () {
            requireCopying();
            sourceParsers.forEach((parser) => parser._end());
            sourceParsers.length = 0;
            var result = module._muhammara_wasm_copying_context_end(copying);
            copyingEnded = true;
            cleanupCopying();
            if (!result) throw new Error("Unable to end PDF copying context");
            return this;
          },
        };
      },
      createPDFCopyingContextAsync: async function (sourceBytes) {
        return this.createPDFCopyingContext(
          await normalizeBytesAsync(sourceBytes, "PDF input"),
        );
      },
      createPDFCopyingContextForModifiedFile: function () {
        requireOpen();
        var copying =
          module._muhammara_wasm_modifier_create_copying_context_for_modified_file(
            modifier,
          );
        if (!copying) {
          throw new Error(
            "Unable to create PDF copying context for modified file",
          );
        }
        var copyingEnded = false;
        var sourceParsers = [];
        function cleanupCopying() {
          if (!copying) return;
          sourceParsers.forEach((parser) => parser._end());
          if (!copyingEnded)
            module._muhammara_wasm_copying_context_end(copying);
          module._muhammara_wasm_modifier_destroy_copying_context(copying);
          copying = 0;
          copyingEnded = true;
          lifecycle.untrack(cleanupCopying);
        }
        lifecycle.track(cleanupCopying);
        function requireCopying() {
          requireOpen();
          if (copyingEnded) throw new Error("PDF copying context has ended");
        }
        return {
          getSourceDocumentParser: function () {
            requireCopying();
            var parser = createReader(
              undefined,
              module._muhammara_wasm_copying_context_get_source_document_parser(
                copying,
              ),
              requireCopying,
              copying,
              false,
            );
            sourceParsers.push(parser);
            return parser;
          },
          getSourceDocumentStream: function () {
            requireCopying();
            var parser = this.getSourceDocumentParser();
            return parser.getSourceDocumentStream();
          },
          copyDirectObjectAsIs: function (object) {
            requireCopying();
            if (!object || object._copyingContext !== copying) {
              throw new TypeError(
                "PDF object must originate from this source document parser",
              );
            }
            if (
              !module._muhammara_wasm_copying_context_copy_direct_object_as_is(
                copying,
                object._handle,
              )
            ) {
              throw new Error("Unable to copy PDF object");
            }
            return this;
          },
          ...copyingObjectOperations(copying, requireCopying),
          appendPDFPageFromPDF: function (index) {
            requireCopying();
            if (!Number.isInteger(index) || index < 0) {
              throw new RangeError("Page index must be a non-negative integer");
            }
            var objectId = module._muhammara_wasm_copying_context_append_page(
              copying,
              index,
            );
            if (!objectId) {
              throw new RangeError(`Unable to append page ${index}`);
            }
            return objectId;
          },
          appendPDFPagesFromPDF: function (start, end) {
            requireCopying();
            if (
              !Number.isInteger(start) ||
              !Number.isInteger(end) ||
              start < 0 ||
              end < start
            ) {
              throw new RangeError("A valid zero-based page range is required");
            }
            for (var index = start; index <= end; ++index) {
              this.appendPDFPageFromPDF(index);
            }
            return this;
          },
          mergePDFPageToPage: function (targetPage, index) {
            requireCopying();
            if (
              targetPage !== page ||
              context ||
              !Number.isInteger(index) ||
              index < 0
            ) {
              throw new Error(
                "Merge before starting the target page context with a non-negative source index",
              );
            }
            if (
              !module._muhammara_wasm_copying_context_merge_page(copying, index)
            ) {
              throw new RangeError(`Unable to merge page ${index}`);
            }
            return this;
          },
          createFormXObjectFromPDFPage: function (
            index,
            pageBox = constants.ePDFPageBoxMediaBox,
            transformation,
          ) {
            requireCopying();
            [index, pageBox, transformation] = copiedPageFormArguments(
              index,
              pageBox,
              transformation,
            );
            var objectId = withDoubles(
              Array.isArray(pageBox) ? pageBox : [],
              (cropBox) =>
                withDoubles(transformation || [], (matrix) =>
                  module._muhammara_wasm_copying_context_create_form_from_page(
                    copying,
                    index,
                    Array.isArray(pageBox) ? -1 : pageBox,
                    cropBox || 0,
                    matrix || 0,
                  ),
                ),
            );
            if (!objectId) {
              throw new RangeError(`Unable to create form from page ${index}`);
            }
            return objectId;
          },
          mergePDFPageToFormXObject: function (form, index) {
            requireCopying();
            if (
              !form ||
              form._owner !== owner ||
              form._ended ||
              !Number.isInteger(index) ||
              index < 0
            ) {
              throw new TypeError(
                "An open form from this modifier and a non-negative page index are required",
              );
            }
            if (
              !module._muhammara_wasm_copying_context_merge_page_to_form(
                copying,
                form._handle,
                index,
              )
            ) {
              throw new RangeError(`Unable to merge page ${index} to form`);
            }
            return this;
          },
          end: function () {
            requireCopying();
            sourceParsers.forEach((parser) => parser._end());
            sourceParsers.length = 0;
            var result = module._muhammara_wasm_copying_context_end(copying);
            copyingEnded = true;
            cleanupCopying();
            if (!result) {
              throw new Error("Unable to end PDF copying context");
            }
            return this;
          },
        };
      },
      end: function () {
        requireOpen();
        if (page || context)
          throw new Error("Write the active page before ending the PDF");
        if (objectsContext && objectsContext._hasActive())
          throw new Error(
            "End the active objects context operation before ending the PDF",
          );
        // Like native, release copying contexts the caller left open.
        lifecycle.disposeChildren();
        var lengthPointer = module._malloc(4);
        try {
          var pdfPointer = module._muhammara_wasm_modifier_end_pdf(
            modifier,
            lengthPointer,
          );
          var length = module.HEAPU32[lengthPointer >>> 2];
          if (!pdfPointer || !length)
            throw new Error("Unable to finish modified PDF");
          try {
            assertOutputSize(length);
            return module.HEAPU8.slice(pdfPointer, pdfPointer + length);
          } finally {
            module._muhammara_wasm_free(pdfPointer);
          }
        } finally {
          module._free(lengthPointer);
          dispose();
        }
      },
      dispose: function () {
        dispose();
      },
    };
  }

  return createWriterToModify;
}
