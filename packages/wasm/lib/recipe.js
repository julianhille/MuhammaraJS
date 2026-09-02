import { coordinateMethods } from "./recipe/coordinate.js";
import { knownColors, createColorMethods } from "./recipe/colors.js";
import { endPDF } from "./recipe/end.js";
import { getFont, registerFont } from "./recipe/font.js";
import { createImageMethods } from "./recipe/image.js";
import { initializeRecipe, recipeVersion } from "./recipe/parameters.js";
import { createPageMethods, updateMediaBox } from "./recipe/page.js";
import { createShapeMethods } from "./recipe/shapes.js";
import { createVectorHelpers } from "./recipe/vector.helper.js";
import { createLineMethods } from "./recipe/vector-line.js";
import { createPolygonMethods } from "./recipe/vector-polygon.js";
import { createVectorMethods } from "./recipe/vector.js";
import { createTextMethods } from "./recipe/text.js";
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

export function createRecipeFactory({
  module,
  encoder,
  colorValue,
  normalizeBytes,
  normalizeBytesAsync,
  createReader,
  createWriterToModify,
  registerWriterFont,
  unregisterWriterFont,
  removeFile,
  withString,
  withDoubles,
  assertOutputSize,
}) {
  var fonts = new Map();
  var images = new Map();
  var pdfs = new Map();
  var state = { nextFont: 0, nextImage: 0, nextPdf: 0 };

  function call(name, ...args) {
    if (!module[name](...args)) {
      throw new Error(`Muhammara WebAssembly operation failed: ${name}`);
    }
  }

  class Recipe {
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
      ["author", "title", "subject", "keywords"].forEach((key) => {
        if (options[key] !== undefined) info[key] = options[key];
      });
      if (hasSource) this._openSource(sourceOrOptions);
      if (Object.keys(info).length) this.info(info);
    }

    get position() {
      return { ...this._cursor };
    }

    async readAsync(bytes) {
      return this.read(await normalizeBytesAsync(bytes, "PDF input"));
    }

    dispose() {
      if (this.writer?.dispose) this.writer.dispose();
      if (this._recipe) module._muhammara_wasm_recipe_destroy(this._recipe);
      this._recipe = 0;
    }

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

    htmlToTextObjects(html, options = {}) {
      return htmlToTextObjects(html, options);
    }

    setPageBox(box, left, bottom, right, top) {
      var boxes = { media: 0, crop: 1, bleed: 2, trim: 3, art: 4 };
      if (!(box in boxes)) {
        throw new RangeError(`Unknown page box: ${box}`);
      }
      call(
        "_muhammara_wasm_recipe_set_page_box",
        this._recipe,
        boxes[box],
        left,
        bottom,
        right,
        top,
      );
      if (box === "media") updateMediaBox(this, [left, bottom, right, top]);
      return this;
    }

    rotate(rotation) {
      call("_muhammara_wasm_recipe_set_page_rotation", this._recipe, rotation);
      var page = this._pages[this._pages.length - 1];
      if (page) {
        page.rotate = rotation;
      }
      return this;
    }

    save() {
      if (this._pageContext) return this._pageContext.q() && this;
      call("_muhammara_wasm_recipe_save", this._recipe);
      return this;
    }

    restore() {
      if (this._pageContext) return this._pageContext.Q() && this;
      call("_muhammara_wasm_recipe_restore", this._recipe);
      return this;
    }

    transform(a, b, c, d, e, f) {
      if (this._pageContext)
        return this._pageContext.cm(a, b, c, d, e, f) && this;
      call("_muhammara_wasm_recipe_transform", this._recipe, a, b, c, d, e, f);
      return this;
    }

    rotateContent(degrees, x = 0, y = 0) {
      var radians = (degrees * Math.PI) / 180;
      var cosine = Math.cos(radians);
      var sine = Math.sin(radians);
      var point = this._calibrateCoordinate(x, y);
      return this.transform(1, 0, 0, 1, point.nx, point.ny)
        .transform(cosine, sine, -sine, cosine, 0, 0)
        .transform(1, 0, 0, 1, -point.nx, -point.ny);
    }

    lineStyle(options = {}) {
      if (this._pageContext) {
        this._pageContext
          .w(options.width || options.lineWidth || 1)
          .J(options.cap || 0)
          .j(options.join || 0)
          .M(options.miterLimit || 10)
          .d(options.dash || [], options.dashPhase || 0);
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
          options.width || options.lineWidth || 1,
          options.cap || 0,
          options.join || 0,
          options.miterLimit || 10,
          dashPointer,
          dash.length,
          options.dashPhase || 0,
        );
        return this;
      } finally {
        if (dashPointer) {
          module._free(dashPointer);
        }
      }
    }

    opacity(value) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError("Opacity must be a finite number between 0 and 1");
      }
      if (this._pageContext) this._pageContext.setOpacity(value);
      else call("_muhammara_wasm_recipe_set_opacity", this._recipe, value);
      return this;
    }

    _movePdf(x, y) {
      if (this._pageContext) return this._pageContext.m(x, y) && this;
      call("_muhammara_wasm_recipe_move_to", this._recipe, x, y);
      return this;
    }

    _linePdf(x, y) {
      if (this._pageContext) return this._pageContext.l(x, y) && this;
      call("_muhammara_wasm_recipe_line_to", this._recipe, x, y);
      return this;
    }

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

    _drawText(value, x, y, options = {}) {
      var point = this._calibrateCoordinate(x, y);
      if (this._pageContext) {
        var editFont = this.writer.getFontForBytes(getFont(fonts, options));
        var editSize = options.fontSize || options.size || 12;
        this._pageContext
          .BT()
          .Tf(editFont, editSize)
          .Tm(1, 0, 0, 1, point.nx, point.ny)
          .Tj(String(value))
          .ET();
        this._lastLineHeight = editSize;
        this._cursor = { x, y: y + editSize };
        return this;
      }
      var fontPath = getFont(fonts, options);
      var fontSize = options.fontSize || options.size || 12;
      var dimensions = this.textDimensions(value, { ...options, fontSize });
      var transformed =
        options.rotation ||
        options.skewX ||
        options.skewY ||
        options.opacity !== undefined;
      if (transformed) {
        this.save();
        if (options.opacity !== undefined) this.opacity(options.opacity);
        var origin = options.rotationOrigin || [x, y];
        if (options.rotation)
          this.rotateContent(options.rotation, origin[0], origin[1]);
        if (options.skewX || options.skewY) {
          this.transform(
            1,
            Math.tan(((options.skewY || 0) * Math.PI) / 180),
            Math.tan(((options.skewX || 0) * Math.PI) / 180),
            1,
            0,
            0,
          );
        }
      }
      if (options.highlight) {
        var highlight =
          typeof options.highlight === "object" ? options.highlight : {};
        this.annot(x + dimensions.xMin, y - dimensions.yMax, "Highlight", {
          ...highlight,
          color: highlight.color || "#ffff00",
          width: dimensions.xMax - dimensions.xMin,
          height: dimensions.yMax - dimensions.yMin,
        });
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
            colorValue(options.color),
          );
        }),
      );
      if (options.underline) {
        this.line(x, y + 2, x + dimensions.width, y + 2, {
          stroke: options.color || "#000000",
        });
      }
      if (options.strikeOut) {
        this.line(x, y - fontSize / 3, x + dimensions.width, y - fontSize / 3, {
          stroke: options.color || "#000000",
        });
      }
      if (transformed) this.restore();
      this._lastLineHeight = fontSize;
      this._cursor = { x, y: y + this._lastLineHeight };
      return this;
    }
  }

  Object.assign(
    Recipe.prototype,
    createTextMethods({
      module,
      drawText: function (value, x, y, options) {
        return this._drawText(value, x, y, options);
      },
      measure: function (value, options) {
        var fontPath = getFont(fonts, options);
        if (this._sourceMode) {
          return this.writer
            .getFontForBytes(fontPath)
            .calculateTextDimensions(
              String(value),
              options.fontSize || options.size || 12,
            );
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
                options.fontSize || options.size || 12,
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
    createVectorHelpers(runtime),
    createLineMethods(runtime),
    createPolygonMethods(runtime),
    createVectorMethods(runtime),
    createShapeMethods(),
    createImageMethods(runtime),
    createAnnotationMethods({ module, withString, withDoubles, colorValue }),
    createInfoMethods({ call, withString }),
    createSecurityMethods(),
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
      createRecipe: (options) => new Recipe(options),
    }),
  });
  Object.assign(Recipe.prototype, {
    registerFont: function (name, bytes, type) {
      Recipe.registerFont(name, bytes, type);
      return this;
    },
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
        endPDF: (recipe) => {
          if (recipe._sourceMode) {
            if (recipe._editingPage || recipe._pageHeight) {
              throw new Error("Finish the current page before endPDF");
            }
            if (!recipe._endedBytes) {
              recipe._writeCanonicalInfo();
              recipe._endedBytes = recipe.writer.end();
            }
            return recipe._endedBytes;
          }
          return endPDF(recipe, module, assertOutputSize);
        },
        state,
        registerPdf: Recipe.registerPdf,
        unregisterPdf: Recipe.unregisterPdf,
        inspectPdf,
        createRecipe: (options) => new Recipe(options),
      }),
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

  return Recipe;
}
