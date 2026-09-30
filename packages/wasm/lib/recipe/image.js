import { ImageFit, HorizontalAlign, VerticalAlign } from "../value-sets.js";
import { isColorspace } from "./colors.js";
import { DRAW_IMAGE_PATH } from "../writer.js";
import { miterLimitOption, rotationOption } from "./vector.helper.js";

// The error a modifier throws for an image it cannot measure.
var UNREADABLE_IMAGE = "Unable to read image dimensions";

// The diagnostic colors the shape `debug` options draw with.
var DEBUG_OUTLINE = "#00ff00";
var DEBUG_ANCHOR = "#ff0000";

/**
 * Creates Recipe image placement methods.
 * @param {object} runtime - Module and export helpers.
 * @returns {object} Methods mixed into Recipe.prototype.
 */
export function createImageMethods(runtime) {
  var nextCopy = 0;

  /**
   * Computes the drawn size of an image and the offset its alignment applies,
   * as native Recipe does: `scale` wins over `width` and `height`.
   * @param {Recipe} recipe - Recipe instance.
   * @param {string} name - Registered image or PDF name.
   * @param {string} path - Virtual image path.
   * @param {RecipeImageOptions} options - Size, scale, keepAspectRatio, alignment, and page.
   * @returns {{width: number, height: number, offsetX: number, offsetY: number, page: ?object}}
   *   The drawn size, the PDF offset from the placement point, and the page
   *   geometry of a PDF source.
   * @throws {Error} If the image or the selected page cannot be measured.
   * @throws {RangeError} If a size option is not a finite number.
   */
  function placement(recipe, name, path, options) {
    var index = imageIndex(options);
    var page =
      runtime.pdfs.get(name) === path
        ? pdfPage(recipe, name, path, index)
        : null;
    var dimensions = page
      ? displayedPageSize(page)
      : recipe._imageDimensions(path, index);
    // An unmeasurable image would leave an unwritten image object behind.
    if (!(dimensions.width > 0 && dimensions.height > 0))
      throw new Error(`Unknown image: ${name}`);
    var ratio = dimensions.width / dimensions.height;
    var scale = imageSize(options, "scale");
    var wantedWidth = imageSize(options, "width");
    var wantedHeight = imageSize(options, "height");
    var width = dimensions.width;
    var height = dimensions.height;
    if (scale) {
      width *= scale;
      height *= scale;
    } else if (wantedWidth && !wantedHeight) {
      width = wantedWidth;
      height = wantedWidth / ratio;
    } else if (!wantedWidth && wantedHeight) {
      width = wantedHeight * ratio;
      height = wantedHeight;
    } else if (wantedWidth && wantedHeight) {
      // As in native, a missing keepAspectRatio keeps it; any falsy one stretches.
      if (!(options.keepAspectRatio ?? true)) {
        width = wantedWidth;
        height = wantedHeight;
      } else if (wantedWidth / ratio <= wantedHeight) {
        width = wantedWidth;
        height = wantedWidth / ratio;
      } else {
        width = wantedHeight * ratio;
        height = wantedHeight;
      }
    }
    var offsetX = 0;
    var offsetY = -height;
    var align = String(options.align || "").split(" ");
    if (align[0] === HorizontalAlign.CENTER) offsetX = -width / 2;
    else if (align[0] === HorizontalAlign.RIGHT) offsetX = width / 2;
    if (align[1] === VerticalAlign.CENTER) offsetY = -height / 2;
    // Down by half the height from the top-left placement, as documented.
    else if (align[1] === VerticalAlign.BOTTOM) offsetY = -1.5 * height;
    return { width, height, offsetX, offsetY, page };
  }

  /**
   * Reads the media box and rotation of a page of a registered PDF, caching
   * them on the Recipe. Each registration has its own path.
   * @param {Recipe} recipe - Recipe instance.
   * @param {string} name - Registered PDF name, for errors.
   * @param {string} path - Virtual PDF path.
   * @param {number} index - Zero-based page.
   * @returns {{mediaBox: number[], rotate: number}} The page geometry.
   * @throws {Error} If the PDF has no page at `index`: PDFWriter would read a
   *   page that does not exist.
   */
  function pdfPage(recipe, name, path, index) {
    recipe._pdfPages = recipe._pdfPages || new Map();
    var key = `${path}\0${index}`;
    if (!recipe._pdfPages.has(key))
      recipe._pdfPages.set(key, readPdfPage(path, index));
    var page = recipe._pdfPages.get(key);
    if (!page) throw new Error(`Unknown image: ${name}`);
    return page;
  }

  /**
   * Reads the media box and rotation of one page of a PDF file.
   * @param {string} path - Virtual PDF path.
   * @param {number} index - Zero-based page.
   * @returns {?{mediaBox: number[], rotate: number}} The page geometry, or null
   *   when the PDF cannot be read or has no such page.
   */
  function readPdfPage(path, index) {
    var reader;
    try {
      reader = runtime.createReader(runtime.module.FS.readFile(path));
    } catch {
      return null;
    }
    try {
      if (index >= reader.getPagesCount()) return null;
      var page = reader.parsePage(index);
      return { mediaBox: page.getMediaBox(), rotate: page.getRotate() };
    } finally {
      reader.end();
    }
  }

  /**
   * Draws an image or PDF page into the placed box at the origin: a PDF page is
   * turned by its `/Rotate` and drawn with its media box origin scaled away,
   * because PDFWriter fits the unturned media box and ignores its origin.
   * @param {Recipe} recipe - Recipe instance.
   * @param {string} path - Virtual image path.
   * @param {number} index - Zero-based PDF page or TIFF image.
   * @param {object} box - The placement from `placement()`.
   * @returns {void}
   * @throws {Error} If the image cannot be drawn.
   */
  function drawPlaced(recipe, path, index, box) {
    var placed = box.page
      ? placedPage(box.page, box.width, box.height)
      : { x: 0, y: 0, size: { width: box.width, height: box.height } };
    if (box.page) recipe._transform(...placed.matrix);
    // A negative size mirrors the image, as a negative fit box does in native.
    // Drawing validates a positive box, so mirror first.
    var mirrorX = Math.sign(placed.size.width) || 1;
    var mirrorY = Math.sign(placed.size.height) || 1;
    if (mirrorX < 0 || mirrorY < 0) {
      recipe._transform(mirrorX, 0, 0, mirrorY, 0, 0);
      placed = {
        x: placed.x * mirrorX,
        y: placed.y * mirrorY,
        size: {
          width: Math.abs(placed.size.width),
          height: Math.abs(placed.size.height),
        },
      };
    }
    // The box already has the fitted size, so fit without keeping the source
    // proportions, as native does.
    if (recipe._sourceMode) {
      // Drawing the registered file by its path lets PDFWriter reuse one form
      // per image or PDF page, as on new pages.
      recipe._pageContext[DRAW_IMAGE_PATH](placed.x, placed.y, path, {
        index,
        transformation: {
          ...placed.size,
          proportional: false,
          fit: ImageFit.ALWAYS,
        },
      });
      return;
    }
    runtime.withString(recipe._imageCopy(path), (pointer) => {
      var matrix = runtime.module._malloc(48);
      try {
        runtime.module.HEAPF64.set([1, 0, 0, 1, 0, 0], matrix >>> 3);
        runtime.call(
          "_muhammara_wasm_writer_draw_image",
          recipe._recipe,
          placed.x,
          placed.y,
          pointer,
          index,
          // Fit (2) the image into the box, always (fit policy 0).
          2,
          matrix,
          placed.size.width,
          placed.size.height,
          0,
          0,
        );
      } finally {
        runtime.module._free(matrix);
      }
    });
  }

  /**
   * Moves the origin to the image's bottom-left corner and applies its
   * rotation and skew, with native Recipe's matrices: the rotation turns
   * around `rotationOrigin`, or that corner when it is omitted.
   * @param {Recipe} recipe - Recipe instance.
   * @param {number} nx - PDF x of the bottom-left corner.
   * @param {number} ny - PDF y of the bottom-left corner.
   * @param {RecipeImageOptions} options - Rotation and skew options.
   * @returns {void}
   * @throws {Error} If a matrix cannot be applied.
   */
  function placeOrigin(recipe, nx, ny, options) {
    var rotation = rotationOption(options.rotation);
    if (!rotation) {
      recipe._transform(1, 0, 0, 1, nx, ny);
    } else {
      var origin =
        Array.isArray(options.rotationOrigin) &&
        options.rotationOrigin.length === 2
          ? recipe._calibrateCoordinate(...options.rotationOrigin)
          : { nx, ny };
      var theta = toRadians(rotation);
      var cosine = Math.cos(theta);
      var sine = Math.sin(theta);
      var offsetX = nx - origin.nx;
      var offsetY = ny - origin.ny;
      recipe._transform(
        cosine,
        -sine,
        sine,
        cosine,
        origin.nx + cosine * offsetX + sine * offsetY,
        origin.ny + cosine * offsetY - sine * offsetX,
      );
    }
    if (options.skewX || options.skewY) {
      recipe._transform(
        1,
        Math.tan(toRadians(options.skewX || 0)),
        Math.tan(toRadians(options.skewY || 0)),
        1,
        0,
        0,
      );
    }
  }

  /**
   * Paints the image box in the placed coordinate system: a fill beneath the
   * image or an outline inset by half its line width, as `rectangle()` does.
   * @param {Recipe} recipe - Recipe instance.
   * @param {number} width - Drawn image width.
   * @param {number} height - Drawn image height.
   * @param {object} options - Frame colors and line style, `width` excluded.
   * @returns {void}
   * @throws {Error} If the frame cannot be drawn.
   */
  function drawFrame(recipe, width, height, options) {
    // A negative size mirrors the image into the other side of its corner.
    recipe.rectangle(
      Math.min(0, width),
      Math.min(0, height),
      Math.abs(width),
      Math.abs(height),
      {
        ...options,
        width: undefined,
        rotation: undefined,
        rotationOrigin: undefined,
        skewX: undefined,
        skewY: undefined,
        link: undefined,
        borderRadius: undefined,
        useGivenCoords: true,
      },
    );
  }

  return {
    /**
     * Places a previously registered image or PDF page on the active page.
     *
     * `(x, y)` uses Recipe's top-left coordinate system. Width and height default
     * to the source dimensions; `scale` wins over both, specifying one
     * dimension preserves aspect ratio, and specifying both fits within that box
     * unless disabled. A name registered with `registerPdf()` places the page
     * that the one-based `page` selects, sized by its media box. `fill`, `stroke`, or
     * `color` frame the final image box, beneath and above the image. A link
     * option covers the final image bounds.
     *
     * @name image
     * @function
     * @memberof Recipe#
     * @param {string} name - The name used when the image or PDF bytes were registered.
     * @param {number|string} x - The horizontal placement coordinate in points, or `center`.
     * @param {number|string} y - The vertical placement coordinate in points, or `center`.
     * @param {RecipeImageOptions} [options] - Image sizing, alignment, page-index, frame, and transformation options.
     * @returns {Recipe} The recipe instance.
     * @throws {Error} If the image name is unknown or no target page is available.
     * @throws {RangeError} If `page` is not an integer from 1 to 4294967296,
     *   a size is not a finite number, or `miterLimit` is not a number of at
     *   least 1.
     * @throws {TypeError} If the colorspace is unknown or `rotation` is not a
     *   finite number.
     */
    image: function (name, x, y, options = {}) {
      // null options act like omitted options.
      if (options === null) options = {};
      var path = runtime.images.get(name) || runtime.pdfs.get(name);
      if (!path) throw new Error(`Unknown image: ${name}`);
      var index = imageIndex(options);
      rotationOption(options.rotation);
      miterLimitOption(options.miterLimit);
      // Native rejects an unknown colorspace before drawing anything.
      var colorspace = options.colorspace || this.options.colorspace;
      if (colorspace && !isColorspace(colorspace))
        throw new TypeError(`Unknown colorspace: ${colorspace}`);
      // As in native, a missing or non-numeric opacity keeps the current one.
      var opacity =
        options.opacity == null || isNaN(options.opacity)
          ? undefined
          : Math.max(0, Math.min(1, Number(options.opacity)));
      var box = placement(this, name, path, options);
      [x, y] = this._centrify(x, y);
      var { nx, ny } = this._calibrateCoordinate(
        x,
        y,
        box.offsetX,
        box.offsetY,
      );
      this._save();
      try {
        placeOrigin(this, nx, ny, options);
        if (options.fill)
          drawFrame(this, box.width, box.height, {
            ...options,
            opacity,
            stroke: undefined,
            color: undefined,
          });
        if (opacity !== undefined) this._setOpacity(opacity);
        // The page turn applies to the image only, not to the frames.
        this._save();
        try {
          drawPlaced(this, path, index, box);
        } finally {
          this._restore();
        }
        var stroke = options.stroke || options.color;
        if (stroke)
          drawFrame(this, box.width, box.height, {
            ...options,
            opacity,
            fill: undefined,
            stroke,
            color: undefined,
          });
        if (options.debug)
          drawFrame(this, box.width, box.height, {
            stroke: DEBUG_OUTLINE,
            lineWidth: 1,
          });
      } finally {
        this._restore();
      }
      if (options.debug) this.circle(x, y, 2, { fill: DEBUG_ANCHOR });
      if (options.link)
        this.link(
          options.link,
          x + box.offsetX,
          y - box.offsetY - box.height,
          box.width,
          box.height,
        );
      return this;
    },
    /**
     * Returns this Recipe's copy of a registered file, made on first use. The
     * native writer reads a drawn image again when the page ends, so a copy
     * keeps it valid when the asset is replaced or removed before then.
     * @private
     * @param {string} path - Virtual path of the registered file.
     * @returns {string} Virtual path of the copy.
     */
    _imageCopy: function (path) {
      this._imageCopies = this._imageCopies || new Map();
      var copy = this._imageCopies.get(path);
      if (!copy) {
        copy = `/recipe-draw/${nextCopy++}${path.slice(path.lastIndexOf("."))}`;
        runtime.module.FS.mkdirTree("/recipe-draw");
        runtime.module.FS.writeFile(copy, runtime.module.FS.readFile(path));
        this._imageCopies.set(path, copy);
      }
      return copy;
    },
    /**
     * Removes this Recipe's copies of drawn files once its native writer is
     * released.
     * @private
     * @returns {void}
     */
    _releaseImageCopies: function () {
      (this._imageCopies || new Map()).forEach(runtime.removeFile);
      this._imageCopies = new Map();
    },
    /**
     * Reads the dimensions of an image or PDF page in the virtual filesystem.
     * @private
     * @param {string} path - Virtual image path.
     * @param {number} [index=0] - Zero-based PDF page or TIFF image.
     * @returns {{width: number, height: number}} Size in points; 0 by 0 when
     *   the image or page cannot be read.
     */
    _imageDimensions: function (path, index = 0) {
      if (this._sourceMode) {
        try {
          return this.writer.getImageDimensions(
            runtime.module.FS.readFile(path),
            index,
          );
        } catch (error) {
          // The modifier throws where the new-page export reports failure.
          if (error.message !== UNREADABLE_IMAGE) throw error;
          return { width: 0, height: 0 };
        }
      }
      var result = runtime.module._malloc(16);
      try {
        return runtime.withString(path, (pointer) => {
          if (
            !runtime.module._muhammara_wasm_recipe_image_dimensions(
              this._recipe,
              pointer,
              index,
              result,
              result + 8,
            )
          )
            return { width: 0, height: 0 };
          return {
            width: runtime.module.HEAPF64[result >>> 3],
            height: runtime.module.HEAPF64[(result + 8) >>> 3],
          };
        });
      } finally {
        runtime.module._free(result);
      }
    },
  };
}

/**
 * Reads the one-based `page` option as the zero-based index of the PDF page or
 * TIFF image that PDFWriter takes.
 * @param {RecipeImageOptions} options - Image options.
 * @returns {number} The zero-based index; 0 when `page` is omitted.
 * @throws {RangeError} If `page` is not an integer from 1 to 4294967296.
 */
function imageIndex(options) {
  var page = options.page ?? 1;
  if (!Number.isInteger(page) || page < 1 || page > 0x100000000)
    throw new RangeError("image page must be an integer from 1 to 4294967296");
  return page - 1;
}

/**
 * Reads a size option of `image()` as a number. A numeric string counts as its
 * number, as in native; a missing or other falsy value means not given.
 * A negative size mirrors the image.
 * @param {RecipeImageOptions} options - Image options.
 * @param {string} key - `width`, `height`, or `scale`.
 * @returns {number|undefined} The size, or undefined when not given.
 * @throws {RangeError} If the value is not a finite number.
 */
function imageSize(options, key) {
  if (!options[key]) return undefined;
  var size = Number(options[key]);
  if (!Number.isFinite(size))
    throw new RangeError(`image ${key} must be a finite number`);
  return size;
}

/**
 * The size of a PDF page as it is displayed: its media box, turned by its
 * `/Rotate`.
 * @param {{mediaBox: number[], rotate: number}} page - The page geometry.
 * @returns {{width: number, height: number}} The displayed size.
 */
function displayedPageSize(page) {
  var [left, bottom, right, top] = page.mediaBox;
  return quarterTurns(page.rotate) % 2
    ? { width: top - bottom, height: right - left }
    : { width: right - left, height: top - bottom };
}

/**
 * How to draw a PDF page into a displayed box, as native Recipe does: turned
 * by its `/Rotate` and drawn at its media box origin scaled away.
 * @param {{mediaBox: number[], rotate: number}} page - The page geometry.
 * @param {number} width - The displayed width.
 * @param {number} height - The displayed height.
 * @returns {{matrix: number[], x: number, y: number, size: {width: number, height: number}}}
 *   The turning matrix, the drawing position, and the fitted unturned size.
 */
function placedPage(page, width, height) {
  var [left, bottom, right, top] = page.mediaBox;
  var turns = quarterTurns(page.rotate);
  var w = turns % 2 ? height : width;
  var h = turns % 2 ? width : height;
  var matrix = [
    [1, 0, 0, 1, 0, 0],
    [0, -1, 1, 0, 0, w],
    [-1, 0, 0, -1, w, h],
    [0, 1, -1, 0, h, 0],
  ][turns];
  return {
    matrix,
    x: (-left * w) / (right - left),
    y: (-bottom * h) / (top - bottom),
    size: { width: w, height: h },
  };
}

/**
 * The clockwise quarter turns of a page `/Rotate` value.
 * @param {number} rotate - The `/Rotate` value, a multiple of 90.
 * @returns {number} 0 to 3; 0 for a value that is not a multiple of 90.
 */
function quarterTurns(rotate) {
  var turns = (((Number(rotate) || 0) % 360) + 360) % 360;
  return turns % 90 ? 0 : turns / 90;
}

/**
 * Converts degrees to radians, wrapping at 360 as native Recipe does.
 * @param {number} angle - Angle in degrees.
 * @returns {number} Angle in radians.
 */
function toRadians(angle) {
  return 2 * Math.PI * ((angle % 360) / 360);
}
