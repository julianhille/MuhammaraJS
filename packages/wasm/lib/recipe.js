import { recipeConstants } from "./recipe/constants.js";
import { Colorspace, DeviceColorSpace } from "./value-sets.js";
import { coordinateMethods } from "./recipe/coordinate.js";
import {
  colorModel,
  knownColors,
  createColorMethods,
  createSeparationMethods,
} from "./recipe/colors.js";
import { endPDF } from "./recipe/end.js";
import { getFont, registerFont } from "./recipe/font.js";
import { createImageMethods } from "./recipe/image.js";
import { initializeRecipe, recipeVersion } from "./recipe/parameters.js";
import {
  createPageMethods,
  endActivePage,
  hasActivePage,
  updateMediaBox,
} from "./recipe/page.js";
import { createShapeMethods } from "./recipe/shapes.js";
import { createVectorHelpers } from "./recipe/vector.helper.js";
import { createLineMethods } from "./recipe/vector-line.js";
import { createPolygonMethods } from "./recipe/vector-polygon.js";
import { createVectorMethods } from "./recipe/vector.js";
import { createTextMethods } from "./recipe/text.js";
import { resolveFontSize } from "./recipe/text.helper.js";
import { htmlToTextObjects } from "./recipe/htmlToTextObjects.js";
import { createTableMethods } from "./recipe/table.js";
import { createAnnotationMethods } from "./recipe/annotation.js";
import {
  createCompositionMethods,
  createEndPDF,
  createSplitPdf,
  createStructure,
} from "./recipe/composition.js";
import { createInfoMethods } from "./recipe/info.js";
import { createInspectPdf } from "./recipe/inspection.js";
import { createRegistrationMethods } from "./recipe/registration.js";
import { createSecurityMethods, permission } from "./recipe/security.js";
import { createReplaceTextMethods } from "./recipe/replace-text.js";
import { standardInfoKeys } from "./recipe-info.js";

/**
 * Packs a Recipe color model for the text export: a color-space index (0 gray,
 * 1 RGB, 2 CMYK) and one byte per component, as PDFWriter expects.
 * @param {{colorspace: DeviceColorSpace, values: number[]}} model - Resolved color.
 * @returns {{space: number, value: number}} The packed color.
 */
function textColor(model) {
  // Code 3 keeps the color already selected, such as a Separation color.
  if (model.colorspace === Colorspace.SEPARATION) return { space: 3, value: 0 };
  return {
    space: [
      DeviceColorSpace.GRAY,
      DeviceColorSpace.RGB,
      DeviceColorSpace.CMYK,
    ].indexOf(model.colorspace),
    value: model.values.reduce(
      (packed, component) => packed * 256 + Math.round(component * 255),
      0,
    ),
  };
}

/**
 * Creates the high-level Recipe PDF composition factory.
 * @param {object} dependencies - Module, default font, byte helpers, and low-level factories.
 * @returns {Function} The Recipe class.
 */
export function createRecipeFactory({
  defaultFont,
  module,
  encoder,
  colorValue,
  normalizeBytes,
  normalizeBytesAsync,
  createReader,
  createWriterToModify,
  recrypt,
  pageBoxes,
  registerWriterFont,
  unregisterWriterFont,
  removeFile,
  withString,
  withDoubles,
  rawObjectsContext,
  assertOutputSize,
}) {
  var fonts = new Map();
  var images = new Map();
  var pdfs = new Map();
  var state = { nextFont: 0, nextImage: 0, nextPdf: 0 };

  /**
   * Resolves the registered font path for text options, registering the default font on first use.
   * @param {object} [options={}] - Text options with `font`, `bold`, and `italic`.
   * @returns {string} Virtual path of the font.
   * @throws {Error} If the font is not registered.
   */
  function resolveFont(options = {}) {
    var name = options.font || defaultFont?.name;
    if (
      defaultFont &&
      String(name).toLowerCase() === defaultFont.name.toLowerCase() &&
      !fonts.has(defaultFont.name.toLowerCase())
    ) {
      Recipe.registerFont(defaultFont.name, defaultFont.loadBytes());
    }
    return getFont(fonts, { ...options, font: name });
  }

  /**
   * Calls a Recipe export and throws when it reports failure.
   * @param {string} name - Export name.
   * @param {...*} args - Export arguments.
   * @returns {void}
   * @throws {Error} If the export returns a falsy value.
   */
  function call(name, ...args) {
    if (!module[name](...args)) {
      throw new Error(`Muhammara WebAssembly operation failed: ${name}`);
    }
  }

  class Recipe {
    /**
     * Creates a byte-first high-level PDF Recipe.
     * Pass PDF bytes as the first argument to modify an existing document, or
     * pass only options to create a new document. For Blob or File input, await
     * `arrayBuffer()` and pass the resulting bytes to the constructor.
     *
     * @param {ByteSource|RecipeOptions} [sourceOrOptions={}] Source PDF bytes or creation options.
     * @param {RecipeOptions} [options={}] Options used when modifying source bytes.
     * @throws {TypeError} If Recipe options are not an object.
     * @throws {Error} If password-protected input is requested or the PDF cannot be created.
     */
    constructor(sourceOrOptions = {}, options = {}) {
      var hasSource =
        sourceOrOptions instanceof Uint8Array ||
        sourceOrOptions instanceof ArrayBuffer ||
        (typeof Blob !== "undefined" && sourceOrOptions instanceof Blob);
      if (hasSource) options = options || {};
      else options = sourceOrOptions;
      if (!options || typeof options !== "object" || Array.isArray(options)) {
        throw new TypeError("Recipe options must be an object");
      }
      if (
        hasSource &&
        ["password", "userPassword", "ownerPassword"].some(
          (key) => options[key] !== undefined,
        )
      ) {
        throw new Error(
          "Password-protected PDF input is unavailable in WebAssembly Recipe",
        );
      }
      var version = recipeVersion(options.version);
      initializeRecipe(this, options);
      this.encryption_ = hasSource ? {} : this._getEncryptOptions(options);
      this._version = version;
      this._recipe = 0;
      if (!hasSource) {
        this._recipe = module._muhammara_wasm_recipe_create_with_options(
          version,
          options.compress !== false,
        );
        if (!this._recipe) throw new Error("Unable to create PDF");
      }
      this.knownColors = Object.fromEntries(
        Object.entries(knownColors).map(([space, colors]) => [
          space,
          { ...colors },
        ]),
      );
      var info = {};
      standardInfoKeys.forEach((key) => {
        if (options[key] !== undefined) info[key] = options[key];
      });
      if (hasSource) this._openSource(sourceOrOptions);
      if (Object.keys(info).length) this.info(info);
    }

    /**
     * The last moveTo or lineTo path position in Recipe coordinates.
     * @returns {{x: number, y: number}} A copy of the position.
     */
    get position() {
      return { ...this._cursor };
    }

    /**
     * Asynchronously inspects PDF bytes without changing this Recipe's output.
     * Blob and File inputs are accepted in addition to synchronous byte sources.
     *
     * @name readAsync
     * @function
     * @memberof Recipe#
     * @param {AsyncByteSource} bytes - PDF bytes or a blob-like source.
     * @returns {Promise<RecipeMetadata>} One-based page geometry and the page count.
     * @throws {TypeError} If the source cannot be normalized to bytes.
     * @throws {Error} If the bytes cannot be opened as a PDF.
     */
    async readAsync(bytes) {
      return this.read(await normalizeBytesAsync(bytes, "PDF input"));
    }

    /**
     * Releases this Recipe's writer and native WebAssembly state.
     * The instance must not be used after disposal. Registered static assets
     * remain available until {@link Recipe.disposeAssets} is called.
     *
     * @name dispose
     * @function
     * @memberof Recipe#
     * @returns {void}
     */
    dispose() {
      if (this.writer?.dispose) this.writer.dispose();
      if (this._recipe) module._muhammara_wasm_recipe_destroy(this._recipe);
      this._recipe = 0;
      this._disposed = true;
    }

    /**
     * Adds a named extension method to all Recipe instances.
     * The callback executes with the Recipe as `this`. Existing Recipe methods
     * cannot be replaced through this API.
     *
     * @name register
     * @function
     * @memberof Recipe#
     * @param {string|RecipeExtension} key - Method name, or a named callback.
     * @param {RecipeExtension} [callback] - Extension implementation when a name is supplied.
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If no method name or callback is available.
     * @throws {Error} If the method name already exists.
     */
    register(key, callback) {
      if (typeof key !== "string") {
        callback = key;
        key = callback?.name;
      }
      if (!key || typeof callback !== "function") {
        throw new TypeError("Register requires a named callback function");
      }
      if (key in Recipe.prototype) {
        throw new Error(`Recipe method already exists: ${key}`);
      }
      Recipe.prototype[key] = callback;
      return this;
    }

    /**
     * Converts supported DOM-free HTML into styled Recipe text fragments.
     * Ordered and unordered list fragments include their visual prefix and
     * native-style indentation. Unlike native's nested XML-derived layout tree,
     * Wasm returns flat visual fragments. This helper does not draw content or
     * alter Recipe state.
     *
     * @name htmlToTextObjects
     * @function
     * @memberof Recipe#
     * @param {string} html - HTML source to convert.
     * @param {Partial<RecipeTextOptions>} [options] - Initial text options.
     * @returns {RecipeHtmlTextObject[]} Styled fragments in source order.
     */
    htmlToTextObjects(html, options = {}) {
      return htmlToTextObjects(html, options);
    }

    /**
     * Sets a page boundary using native PDF bottom-left coordinates.
     * Changing the media box also updates active Recipe page dimensions.
     *
     * @name setPageBox
     * @function
     * @memberof Recipe#
     * @param {PDFPageBoxType} box - Page-box constant.
     * @param {number} left - Left PDF coordinate.
     * @param {number} bottom - Bottom PDF coordinate.
     * @param {number} right - Right PDF coordinate.
     * @param {number} top - Top PDF coordinate.
     * @returns {Recipe} The Recipe instance.
     * @throws {RangeError} If `box` is not a supported page-box constant.
     * @throws {Error} If the underlying PDF operation fails.
     */
    setPageBox(box, left, bottom, right, top) {
      if (!Object.values(pageBoxes).includes(box)) {
        throw new RangeError(`Unknown page box: ${box}`);
      }
      call(
        "_muhammara_wasm_recipe_set_page_box",
        this._recipe,
        box,
        left,
        bottom,
        right,
        top,
      );
      if (box === pageBoxes.media) {
        updateMediaBox(this, [left, bottom, right, top]);
      }
      return this;
    }

    /**
     * Sets the active page's rotation in degrees.
     * The page metadata is updated so later Recipe-coordinate operations account
     * for the rotation.
     *
     * @name rotate
     * @function
     * @memberof Recipe#
     * @param {number} rotation - Page rotation in degrees.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If the underlying PDF operation fails.
     */
    rotate(rotation) {
      call("_muhammara_wasm_recipe_set_page_rotation", this._recipe, rotation);
      var page = this._pages[this._pages.length - 1];
      if (page) {
        page.rotate = rotation;
      }
      return this;
    }

    /**
     * Saves the active PDF graphics state.
     * @private
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If the state cannot be saved.
     */
    _save() {
      if (this._pageContext) return this._pageContext.q() && this;
      call("_muhammara_wasm_recipe_save", this._recipe);
      return this;
    }

    /**
     * Restores the active PDF graphics state.
     * @private
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If the state cannot be restored.
     */
    _restore() {
      if (this._pageContext) return this._pageContext.Q() && this;
      call("_muhammara_wasm_recipe_restore", this._recipe);
      return this;
    }

    /**
     * Applies a PDF transformation matrix to the active context.
     * @private
     * @param {number} a - Matrix component `a`.
     * @param {number} b - Matrix component `b`.
     * @param {number} c - Matrix component `c`.
     * @param {number} d - Matrix component `d`.
     * @param {number} e - Matrix component `e`.
     * @param {number} f - Matrix component `f`.
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If a component is not finite.
     * @throws {Error} If the matrix cannot be applied.
     */
    _transform(a, b, c, d, e, f) {
      if (this._pageContext)
        return this._pageContext.cm(a, b, c, d, e, f) && this;
      call("_muhammara_wasm_recipe_transform", this._recipe, a, b, c, d, e, f);
      return this;
    }

    /**
     * Rotates subsequent content around a point in Recipe coordinates.
     * Positive angles rotate clockwise because Recipe's y axis points downward.
     * The transformation remains active until the current graphics state is
     * restored or the page ends.
     *
     * @name rotateContent
     * @function
     * @memberof Recipe#
     * @param {number} degrees - Rotation angle in degrees.
     * @param {number|string} [x=0] - Horizontal rotation origin, or `center`.
     * @param {number|string} [y=0] - Vertical rotation origin, or `center`.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If there is no active page or the PDF operation fails.
     */
    rotateContent(degrees, x = 0, y = 0) {
      var radians = (degrees * Math.PI) / 180;
      var cosine = Math.cos(radians);
      var sine = Math.sin(radians);
      var point = this._calibrateCoordinate(x, y);
      return this._transform(1, 0, 0, 1, point.nx, point.ny)
        ._transform(cosine, sine, -sine, cosine, 0, 0)
        ._transform(1, 0, 0, 1, -point.nx, -point.ny);
    }

    /**
     * Sets defaults for subsequent line and shape drawing.
     * When a page context is active, supplied values are applied immediately;
     * omitted values preserve the stored style.
     *
     * @name lineStyle
     * @function
     * @memberof Recipe#
     * @param {RecipeLineStyleOptions} [options] - Width, cap, join, miter, and dash settings.
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If a dash pattern containing non-finite values is applied to an active page context.
     * @throws {Error} If the underlying PDF operation fails.
     */
    lineStyle(options = {}) {
      this._lineStyle = this._lineStyle || {};
      if (options.width !== undefined || options.lineWidth !== undefined)
        this._lineStyle.width = options.width ?? options.lineWidth;
      if (options.cap !== undefined) this._lineStyle.cap = options.cap;
      if (options.join !== undefined) this._lineStyle.join = options.join;
      if (options.miterLimit !== undefined)
        this._lineStyle.miterLimit = options.miterLimit;
      if (options.dash !== undefined || options.dashPhase !== undefined) {
        this._lineStyle.dash = options.dash ?? this._lineStyle.dash ?? [];
        this._lineStyle.dashPhase =
          options.dashPhase ?? this._lineStyle.dashPhase ?? 0;
      }

      if (!this._pageContext) return this;
      return this._setLineStyle(options);
    }

    /**
     * Applies line style values to the active PDF context.
     * @private
     * @param {object} [options={}] - `width` or `lineWidth`, `cap`, `join`, `miterLimit`, `dash`, and `dashPhase`,
     * with numeric cap and join styles.
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If the dash pattern or a value is invalid.
     * @throws {RangeError} If a cap or join style is out of range.
     * @throws {Error} If the style cannot be applied.
     */
    _setLineStyle(options = {}) {
      if (this._pageContext) {
        if (options.width !== undefined || options.lineWidth !== undefined)
          this._pageContext.w(options.width ?? options.lineWidth);
        if (options.cap !== undefined) this._pageContext.J(options.cap);
        if (options.join !== undefined) this._pageContext.j(options.join);
        if (options.miterLimit !== undefined)
          this._pageContext.M(options.miterLimit);
        if (options.dash !== undefined || options.dashPhase !== undefined)
          this._pageContext.d(options.dash || [], options.dashPhase ?? 0);
        return this;
      }
      var dash = options.dash || [];
      if (!Array.isArray(dash) || !dash.every(Number.isFinite)) {
        throw new TypeError("Dash patterns must be arrays of finite numbers");
      }
      var dashPointer = dash.length ? module._malloc(dash.length * 8) : 0;
      try {
        if (dash.length) {
          module.HEAPF64.set(dash, dashPointer >>> 3);
        }
        call(
          "_muhammara_wasm_recipe_set_line_style",
          this._recipe,
          options.width ?? options.lineWidth ?? 1,
          options.cap ?? 0,
          options.join ?? 0,
          options.miterLimit ?? 10,
          dashPointer,
          dash.length,
          options.dashPhase ?? 0,
        );
        return this;
      } finally {
        if (dashPointer) {
          module._free(dashPointer);
        }
      }
    }

    /**
     * Sets fill and stroke opacity for subsequent drawing.
     *
     * @name opacity
     * @function
     * @memberof Recipe#
     * @param {number} value - Opacity from 0 (transparent) through 1 (opaque).
     * @returns {Recipe} The Recipe instance.
     * @throws {RangeError} If the value is not finite or outside 0 through 1.
     * @throws {Error} If the underlying PDF operation fails.
     */
    opacity(value) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError("Opacity must be a finite number between 0 and 1");
      }
      this._opacity = value;
      return this._setOpacity(value);
    }

    /**
     * Applies opacity to the active PDF context.
     * @private
     * @param {number} value - Opacity from 0 to 1.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If the opacity cannot be applied.
     */
    _setOpacity(value) {
      if (this._pageContext) this._pageContext.setOpacity(value);
      else call("_muhammara_wasm_recipe_set_opacity", this._recipe, value);
      return this;
    }

    /**
     * Moves the active native PDF path.
     * @private
     * @param {number} x - PDF x.
     * @param {number} y - PDF y.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If the operator fails.
     */
    _movePdf(x, y) {
      if (this._pageContext) return this._pageContext.m(x, y) && this;
      call("_muhammara_wasm_recipe_move_to", this._recipe, x, y);
      return this;
    }

    /**
     * Adds a line to the active native PDF path.
     * @private
     * @param {number} x - PDF x.
     * @param {number} y - PDF y.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If the operator fails.
     */
    _linePdf(x, y) {
      if (this._pageContext) return this._pageContext.l(x, y) && this;
      call("_muhammara_wasm_recipe_line_to", this._recipe, x, y);
      return this;
    }

    /**
     * Adds a cubic curve to the active native PDF path.
     * @private
     * @param {number} x1 - First control point x.
     * @param {number} y1 - First control point y.
     * @param {number} x2 - Second control point x.
     * @param {number} y2 - Second control point y.
     * @param {number} x3 - End point x.
     * @param {number} y3 - End point y.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If the operator fails.
     */
    _curvePdf(x1, y1, x2, y2, x3, y3) {
      if (this._pageContext)
        return this._pageContext.c(x1, y1, x2, y2, x3, y3) && this;
      call(
        "_muhammara_wasm_recipe_curve_to",
        this._recipe,
        x1,
        y1,
        x2,
        y2,
        x3,
        y3,
      );
      return this;
    }

    /**
     * Draws one text run after coordinate and style normalization.
     * @private
     * @param {string} value - Text.
     * @param {number} x - Recipe x.
     * @param {number} y - Recipe y of the baseline.
     * @param {object} [options={}] - Font, size, color, spacing, rotation, skew, opacity, and HTML decorations.
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If `charSpace` is not finite or a color is invalid.
     * @throws {Error} If the font is not registered or the text cannot be drawn.
     */
    _drawText(value, x, y, options = {}) {
      var point = this._calibrateCoordinate(x, y);
      var characterSpacing = options.charSpace ?? 0;
      if (!Number.isFinite(characterSpacing)) {
        throw new TypeError("charSpace must be a finite number");
      }
      // Resolve like native: registered names, gray/RGB/CMYK codes, and the
      // #1777d1 default for a missing or unknown color.
      var fill = colorModel(this, options.color || options.colour, options);
      var separation = fill.colorspace === Colorspace.SEPARATION;
      if (separation) this._separationColorspace(fill);
      var transformed =
        options.rotation ||
        options.skewX ||
        options.skewY ||
        (!this._pageContext && options.opacity !== undefined);
      if (transformed) {
        this._save();
        if (!this._pageContext && options.opacity !== undefined)
          this.opacity(options.opacity);
        var origin = options.rotationOrigin || [x, y];
        if (options.rotation)
          this.rotateContent(options.rotation, origin[0], origin[1]);
        if (options.skewX || options.skewY) {
          this._transform(
            1,
            Math.tan(((options.skewY || 0) * Math.PI) / 180),
            Math.tan(((options.skewX || 0) * Math.PI) / 180),
            1,
            0,
            0,
          );
        }
      }
      var fontPath = resolveFont(options);
      var fontSize = resolveFontSize(options);
      if (this._pageContext) {
        var editContext = this._pageContext
          .BT()
          .Tf(this.writer.getFontForBytes(fontPath), fontSize)
          .Tc(characterSpacing);
        if (separation) this._setSeparationColor(fill, false);
        else if (fill.colorspace === DeviceColorSpace.GRAY)
          editContext.g(...fill.values);
        else if (fill.colorspace === DeviceColorSpace.CMYK)
          editContext.k(...fill.values);
        else editContext.rg(...fill.values);
        editContext.Tm(1, 0, 0, 1, point.nx, point.ny).Tj(String(value)).ET();
      } else {
        var packedFill = textColor(fill);
        if (separation) {
          this._save();
          this._setSeparationColor(fill, false);
        }
        withString(value, (textPointer) =>
          withString(fontPath, (fontPointer) => {
            call(
              "_muhammara_wasm_recipe_text",
              this._recipe,
              point.nx,
              point.ny,
              textPointer,
              fontPointer,
              fontSize,
              packedFill.space,
              packedFill.value,
              characterSpacing,
            );
          }),
        );
        if (separation) this._restore();
      }
      // Text-markup annotations are added per line by text(); only HTML
      // underline and strike-out styles draw a visible decoration line.
      if (options.htmlUnderline || options.htmlStrikeOut) {
        var runWidth = this.textDimensions(value, {
          ...options,
          fontSize,
        }).xMax;
        // Native measures markup against one sample so every run on a line
        // gets the same height, including descenders and tall glyphs.
        var textHeight = this.textDimensions(
          "ABCDEFGHIJKLMNOPQRSTUVWXYZgjpqy|}",
          { ...options, fontSize },
        ).height;
        var decoration = {
          stroke: options.color || options.colour || "#1777d1",
          colorspace: options.colorspace,
          colorName: options.colorName,
          width: 2,
        };
        if (options.htmlUnderline) {
          var underlineY = y + textHeight * 0.1;
          this.line(x, underlineY, x + runWidth, underlineY, decoration);
        }
        if (options.htmlStrikeOut) {
          var strikeOutY = y - textHeight * 0.2;
          this.line(x, strikeOutY, x + runWidth, strikeOutY, decoration);
        }
      }
      if (transformed) this._restore();
      this._lastLineHeight = fontSize;
      this._textCursor = { x, y: y + this._lastLineHeight };
      return this;
    }
  }

  Object.assign(
    Recipe.prototype,
    createTextMethods({
      module,
      /**
       * Draws one text run for the shared text methods.
       * @param {string} value - Text.
       * @param {number} x - Recipe x.
       * @param {number} y - Recipe y.
       * @param {object} options - Normalized text options.
       * @returns {Recipe} The Recipe instance.
       * @throws {Error} If the text cannot be drawn.
       */
      drawText: function (value, x, y, options) {
        return this._drawText(value, x, y, options);
      },
      /**
       * Measures one text run with the resolved font and size.
       * @param {string} value - Text.
       * @param {object} options - Font and size options.
       * @returns {TextDimensions} Bounds and advance in points.
       * @throws {Error} If the font is not registered or the text cannot be measured.
       */
      measure: function (value, options) {
        var fontPath = resolveFont(options);
        if (this._sourceMode) {
          return this.writer
            .getFontForBytes(fontPath)
            .calculateTextDimensions(String(value), resolveFontSize(options));
        }
        var resultPointer = module._malloc(48);
        try {
          return withString(value, (textPointer) =>
            withString(fontPath, (fontPointer) => {
              call(
                "_muhammara_wasm_recipe_text_dimensions",
                this._recipe,
                textPointer,
                fontPointer,
                resolveFontSize(options),
                resultPointer,
              );
              var offset = resultPointer >>> 3;
              return {
                xMin: module.HEAPF64[offset],
                yMin: module.HEAPF64[offset + 1],
                xMax: module.HEAPF64[offset + 2],
                yMax: module.HEAPF64[offset + 3],
                width: module.HEAPF64[offset + 4],
                height: module.HEAPF64[offset + 5],
              };
            }),
          );
        } finally {
          module._free(resultPointer);
        }
      },
    }),
    createTableMethods(),
  );

  var runtime = { module, call, withString, images };
  Object.assign(
    Recipe.prototype,
    coordinateMethods,
    createPageMethods(call, { createReader, createWriterToModify, module }),
    createColorMethods(),
    createSeparationMethods({
      module,
      rawObjectsContext,
      withString,
      withDoubles,
    }),
    createVectorHelpers(runtime),
    createLineMethods(runtime),
    createPolygonMethods(runtime),
    createVectorMethods(runtime),
    createShapeMethods(),
    createImageMethods(runtime),
    createAnnotationMethods({ module, withString, withDoubles, colorValue }),
    createInfoMethods({ call, withString }),
    createSecurityMethods(),
    createReplaceTextMethods(),
  );

  // Composition modules receive closures rather than reaching into Recipe state.
  var inspectPdf = createInspectPdf({ module, withString, pdfs });
  var registration = createRegistrationMethods({
    module,
    normalizeBytes,
    normalizeBytesAsync,
    fonts,
    images,
    pdfs,
    state,
    registerFont,
    registerWriterFont,
    unregisterWriterFont,
    removeFile,
  });
  Object.assign(Recipe, registration, {
    inspectPdf,
    permission,
    splitPdf: createSplitPdf({
      module,
      pdfs,
      withString,
      call,
      /**
       * Creates a Recipe for each split page.
       * @param {RecipeOptions} options - Recipe options.
       * @returns {Recipe} A new Recipe.
       */
      createRecipe: (options) => new Recipe(options),
    }),
  });
  Object.assign(Recipe.prototype, {
    /**
     * Registers font bytes globally and makes them available to this Recipe.
     *
     * @name registerFont
     * @function
     * @memberof Recipe#
     * @param {string} name - Non-empty font family name.
     * @param {ByteSource} bytes - Font bytes.
     * @param {RecipeFontStyle} [type="regular"] - Font family style.
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If the name or bytes are invalid.
     */
    registerFont: function (name, bytes, type) {
      Recipe.registerFont(name, bytes, type);
      return this;
    },
    /**
     * Asynchronously registers font bytes and makes them available to this Recipe.
     *
     * @name registerFontAsync
     * @function
     * @memberof Recipe#
     * @async
     * @param {string} name - Non-empty font family name.
     * @param {AsyncByteSource} bytes - Font bytes or a blob-like source.
     * @param {RecipeFontStyle} [type="regular"] - Font family style.
     * @returns {Promise<Recipe>} The Recipe instance after registration.
     * @throws {TypeError} If the name or bytes are invalid.
     */
    registerFontAsync: async function (name, bytes, type) {
      await Recipe.registerFontAsync(name, bytes, type);
      return this;
    },
  });
  Object.assign(
    Recipe.prototype,
    createCompositionMethods({ module, pdfs, withString, call, inspectPdf }),
    {
      endPDF: createEndPDF({
        /**
         * Finishes the open page and writes the Recipe, rolling back page deletions
         * when modifying a source PDF fails.
         * @param {Recipe} recipe - Recipe to finish.
         * @returns {Uint8Array} The PDF bytes.
         * @throws {Error} If a page is open while pages are deleted, or writing fails.
         */
        endPDF: (recipe) => {
          if (recipe._endError) throw recipe._endError;
          // deletePage() rewrites the page tree it read when the page was
          // marked, so an open page cannot be folded into that rewrite.
          // Native reports the same conflict the same way.
          if (recipe._deletedPages?.size && hasActivePage(recipe)) {
            throw new Error("Finish the current page before endPDF");
          }
          // Otherwise finish the open page for the caller, before finalization
          // retires the Recipe: a forgotten page ending must not cost the page
          // or leave an unrecoverable document behind.
          endActivePage(recipe);
          if (recipe._sourceMode) {
            if (!recipe._endedBytes) {
              var deletingPages = Boolean(recipe._deletedPages?.size);
              var deletionState = deletingPages
                ? {
                    pages: recipe._pages,
                    metadata: recipe.metadata,
                    metadataValues: { ...recipe.metadata },
                    activePageNumber: recipe._activePageNumber,
                    deletedPages: recipe._deletedPages,
                  }
                : null;
              try {
                recipe._deletePages();
                recipe._writeCanonicalInfo();
                recipe._endedBytes = recipe.writer.end();
              } catch (error) {
                if (!deletingPages) throw error;
                recipe._pages = deletionState.pages;
                Object.keys(deletionState.metadata).forEach(
                  (key) => delete deletionState.metadata[key],
                );
                Object.assign(
                  deletionState.metadata,
                  deletionState.metadataValues,
                );
                recipe.metadata = deletionState.metadata;
                recipe._activePageNumber = deletionState.activePageNumber;
                recipe._deletedPages = deletionState.deletedPages;
                recipe._endError = error;
                try {
                  recipe.writer.dispose();
                } catch (_) {
                  // Preserve the deletion error if modifier cleanup fails.
                }
                throw error;
              }
            }
            return recipe._endedBytes;
          }
          return endPDF(recipe, module, assertOutputSize);
        },
        state,
        registerPdf: Recipe.registerPdf,
        unregisterPdf: Recipe.unregisterPdf,
        inspectPdf,
        /**
         * Creates the Recipe that endPDF() uses for post-processing.
         * @param {RecipeOptions} options - Recipe options.
         * @returns {Recipe} A new Recipe.
         */
        createRecipe: (options) => new Recipe(options),
        recrypt,
      }),
      /**
       * Finishes this Recipe and splits it into one-page PDF byte arrays.
       * Calling this method ends the Recipe; result names use one-based page numbers.
       *
       * @name split
       * @function
       * @memberof Recipe#
       * @param {string} [prefix="page"] - Prefix for each output filename.
       * @returns {RecipeSplitResult[]} One result per page in source order.
       * @throws {Error} If the Recipe cannot be finished or split.
       */
      split: function (prefix = "page") {
        var name = `split-${state.nextPdf++}`;
        Recipe.registerPdf(name, this.endPDF());
        try {
          return Recipe.splitPdf(name, prefix);
        } finally {
          Recipe.unregisterPdf(name);
        }
      },
      structure: createStructure(),
    },
  );

  Object.assign(Recipe, recipeConstants);
  return Recipe;
}
