const fs = require("fs");
const muhammara = require("../muhammara");
const { HorizontalAlign, VerticalAlign } = require("../recipe-constants");

/**
 * Place images to pdf
 * @name image
 * @function
 * @memberof Recipe#
 * @param {string} imgSrc - The path for the image. [JPEG, PNG, TIFF, PDF]
 * @param {number|"center"} x - The coordinate x of the top-left corner
 * @param {number|"center"} y - The coordinate y of the top-left corner
 * @param {Object} [options] - The options
 * @returns {Recipe} The recipe instance.
 * @param {number} [options.page=1] - The one-based page of a PDF source, or the
 *   image of a multi-image TIFF, as in `overlay()`.
 * @param {number} [options.width] - The new width. The frame's line width is
 *   `options.lineWidth`.
 * @param {number} [options.height] - The new height
 * @param {number} [options.scale] - Scale the image from the original width and height.
 * @param {boolean} [options.keepAspectRatio=true] - Keep the aspect ratio.
 * @param {number} [options.opacity] - The opacity of the image and its frame.
 * @param {string} [options.align] - A `Recipe.HorizontalAlign` value, optionally
 *   followed by a space and a `Recipe.VerticalAlign` value, for example
 *   "center center". Horizontal center moves the image left by half its width
 *   and right moves it right by half; vertical center moves it up by half its
 *   height and bottom moves it down by half from its top-left placement.
 * @param {number} [options.rotation] - Rotate the image, in degrees.
 * @param {number[]} [options.rotationOrigin] - [x, y] of the rotation origin;
 *   the bottom-left corner of the drawn image when omitted.
 * @param {number} [options.skewX] - Skew angle off the x axis, in degrees.
 * @param {number} [options.skewY] - Skew angle off the y axis, in degrees.
 * @param {string|number[]} [options.fill] - Paint the image box beneath the
 *   image in this color.
 * @param {string|number[]} [options.stroke] - Outline the image box above the
 *   image in this color.
 * @param {string|number[]} [options.color] - Outline color when `stroke` is
 *   not given.
 * @param {Recipe.Colorspace} [options.colorspace] - The frame colorspace.
 * @param {string} [options.colorName] - The Separation ink name of a
 *   `"separation"` frame color.
 * @param {number} [options.lineWidth] - The outline width. The outline lies
 *   inside the image box, as a `rectangle()` stroke does.
 * @param {number[]} [options.dash] - The outline dash pattern.
 * @param {number} [options.dashPhase] - The outline dash phase.
 * @param {Recipe.LineCap} [options.lineCap] - The outline dash cap.
 * @param {Recipe.LineJoin} [options.lineJoin] - The outline corner join.
 * @param {number} [options.miterLimit] - The outline miter limit.
 * @param {boolean|number} [options.debug] - Outline the image box in green and
 *   mark the placement point in red.
 * @param {string} [options.link] - Make the image open this URL.
 * @throws {TypeError} If no page is active.
 * @throws {RangeError} If `page` is not an integer from 1 to 4294967296,
 *   a size is not a finite number, or `miterLimit` is not a number of at
 *   least 1.
 * @throws {TypeError} If `rotation` is not a finite number.
 * @throws {Error} If the image, or the PDF page `page` selects, cannot be read.
 */
exports.image = function image(imgSrc, x, y, options = {}) {
  // null options act like omitted options.
  if (options === null) options = {};
  const index = imageIndex(options);
  const { width, height, offsetX, offsetY, page } = this._getImgOffset(
    imgSrc,
    options,
  );
  const imgOptions = {
    index,
    transformation: {
      fit: muhammara.ImageFit.ALWAYS,
      // proportional: true,
      width,
      height,
    },
  };
  const { nx, ny } = this._calibrateCoordinate(x, y, offsetX, offsetY);

  const _options = this._getPathOptions(options, nx, ny);
  const gsId = _options.fillGsId;
  const xObjectKeyName = `${imgSrc}__${index}__${gsId}`;

  // `width` is the image width; only `lineWidth` sizes the frame outline.
  const frame = { ...options, width: undefined };
  if (options.fill) {
    drawFrame(this, nx, ny, width, height, { ...frame, stroke: undefined });
  }

  // See if this image has been seen already, so as to not duplicate it.
  let xObject = this.xObjects.find((element) => {
    return element.get("name") == xObjectKeyName;
  });

  if (xObject) {
    _options.xObject = xObject;
    _options.ratio = [
      width / xObject.get("width"),
      height / xObject.get("height"),
    ];
  }

  this._drawObject(this, nx, ny, width, height, _options, (ctx, xObject) => {
    // Only new images visit here
    xObject.set("type", "image");
    xObject.set("name", xObjectKeyName);
    xObject.set("width", width);
    xObject.set("height", height);

    this.xObjects.push(xObject);
    ctx.gs(xObject.getGsName(gsId));
    if (page) {
      const placed = placedPage(page, width, height);
      ctx.cm(...placed.matrix).drawImage(placed.x, placed.y, imgSrc, {
        index,
        transformation: { ...imgOptions.transformation, ...placed.size },
      });
    } else {
      ctx.drawImage(0, 0, imgSrc, imgOptions);
    }
  });

  if (options.stroke || options.color) {
    drawFrame(this, nx, ny, width, height, { ...frame, fill: undefined });
  }

  if (options.debug) {
    drawFrame(this, nx, ny, width, height, {
      stroke: DEBUG_OUTLINE,
      lineWidth: 1,
      rotation: options.rotation,
      rotationOrigin: options.rotationOrigin,
      skewX: options.skewX,
      skewY: options.skewY,
    });
    this.circle(x, y, 2, { fill: DEBUG_ANCHOR });
  }

  if (options.link) {
    const [linkX, linkY] = this._centrify(x, y);
    this.link(
      options.link,
      linkX + offsetX,
      linkY - offsetY - height,
      width,
      height,
    );
  }

  return this;
};

/**
 * Read the one-based `page` option as the zero-based index of the PDF page or
 * TIFF image that PDFWriter takes.
 * @private
 * @param {Object} options - The image() options.
 * @returns {number} The zero-based index; 0 when `page` is omitted.
 * @throws {RangeError} If `page` is not an integer from 1 to 4294967296.
 */
function imageIndex(options) {
  const page = options.page ?? 1;
  if (!Number.isInteger(page) || page < 1 || page > 0x100000000) {
    throw new RangeError("image page must be an integer from 1 to 4294967296");
  }
  return page - 1;
}

/**
 * Read a size option of `image()` as a number. A numeric string counts as its
 * number, as in Wasm; a missing or other falsy value means not given.
 * A negative size mirrors the image.
 * @private
 * @param {Object} options - The image() options.
 * @param {string} key - `width`, `height`, or `scale`.
 * @returns {number|undefined} The size, or undefined when not given.
 * @throws {RangeError} If the value is not a finite number.
 */
function imageSize(options, key) {
  if (!options[key]) return undefined;
  const size = Number(options[key]);
  if (!Number.isFinite(size)) {
    throw new RangeError(`image ${key} must be a finite number`);
  }
  return size;
}

/**
 * Read the media box and rotation of a page of a PDF image source, caching
 * them per file version on the Recipe. Returns null for a source that is not
 * a readable PDF file, which is measured and drawn as an image.
 * @private
 * @param {Recipe} recipe - The recipe instance.
 * @param {string} imgSrc - The image path.
 * @param {number} index - The zero-based page.
 * @returns {?{mediaBox: number[], rotate: number}} The page geometry.
 * @throws {Error} If the PDF has no page at `index`: PDFWriter would read a
 *   page that does not exist.
 */
function pdfPage(recipe, imgSrc, index) {
  let key;
  try {
    const stat = fs.statSync(imgSrc);
    key = `${imgSrc}\0${stat.mtimeMs}\0${stat.size}`;
  } catch {
    // A missing file measures 0 by 0 and is rejected as an unknown image.
    return null;
  }
  recipe._pdfSources = recipe._pdfSources || new Map();
  let source = recipe._pdfSources.get(key);
  if (!source) {
    source = {
      pdf: recipe.writer.getImageType(imgSrc) === muhammara.PDFImageType.PDF,
      pages: new Map(),
    };
    recipe._pdfSources.set(key, source);
  }
  if (!source.pdf) return null;
  if (!source.pages.has(index)) {
    source.pages.set(index, readPdfPage(imgSrc, index));
  }
  const page = source.pages.get(index);
  if (!page) throw new Error(`Unknown image: ${imgSrc}`);
  return page;
}

/**
 * Read the media box and rotation of one page of a PDF file.
 * @private
 * @param {string} imgSrc - The PDF path.
 * @param {number} index - The zero-based page.
 * @returns {?{mediaBox: number[], rotate: number}} The page geometry, or null
 *   when the PDF cannot be read or has no such page.
 */
function readPdfPage(imgSrc, index) {
  let reader;
  try {
    reader = muhammara.createReader(imgSrc);
  } catch {
    return null;
  }
  try {
    if (index >= reader.getPagesCount()) return null;
    const page = reader.parsePage(index);
    return { mediaBox: page.getMediaBox(), rotate: page.getRotate() };
  } finally {
    reader.end();
  }
}

/**
 * The size of a PDF page as it is displayed: its media box, turned by its
 * `/Rotate`.
 * @private
 * @param {{mediaBox: number[], rotate: number}} page - The page geometry.
 * @returns {{width: number, height: number}} The displayed size.
 */
function displayedPageSize(page) {
  const [left, bottom, right, top] = page.mediaBox;
  return quarterTurns(page.rotate) % 2
    ? { width: top - bottom, height: right - left }
    : { width: right - left, height: top - bottom };
}

/**
 * How to draw a PDF page into a displayed box: PDFWriter fits the unturned
 * media box and ignores its origin, so the page is turned by its `/Rotate`
 * and drawn at its origin scaled away.
 * @private
 * @param {{mediaBox: number[], rotate: number}} page - The page geometry.
 * @param {number} width - The displayed width.
 * @param {number} height - The displayed height.
 * @returns {{matrix: number[], x: number, y: number, size: {width: number, height: number}}}
 *   The turning matrix, the drawing position, and the fitted unturned size.
 */
function placedPage(page, width, height) {
  const [left, bottom, right, top] = page.mediaBox;
  const turns = quarterTurns(page.rotate);
  const w = turns % 2 ? height : width;
  const h = turns % 2 ? width : height;
  const matrix = [
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
 * @private
 * @param {number} rotate - The `/Rotate` value, a multiple of 90.
 * @returns {number} 0 to 3; 0 for a value that is not a multiple of 90.
 */
function quarterTurns(rotate) {
  const turns = (((Number(rotate) || 0) % 360) + 360) % 360;
  return turns % 90 ? 0 : turns / 90;
}

// The diagnostic colors the shape `debug` options draw with.
const DEBUG_OUTLINE = "#00ff00";
const DEBUG_ANCHOR = "#ff0000";

/**
 * Paint the box of a placed image, with the image's rotation and skew: a fill
 * when `options.fill` is given, otherwise an outline inset by half its line
 * width, as `rectangle()` strokes are.
 * @private
 * @param {Recipe} recipe - The recipe instance.
 * @param {number} nx - The PDF x of the image's bottom-left corner.
 * @param {number} ny - The PDF y of the image's bottom-left corner.
 * @param {number} width - The drawn image width.
 * @param {number} height - The drawn image height.
 * @param {Object} options - The image() frame options, `width` excluded.
 * @returns {void}
 */
function drawFrame(recipe, nx, ny, width, height, options) {
  const pathOptions = recipe._getPathOptions(options, nx, ny);
  // A negative size mirrors the image into the other side of its corner.
  const left = Math.min(0, width);
  const bottom = Math.min(0, height);
  const boxWidth = Math.abs(width);
  const boxHeight = Math.abs(height);
  if (options.fill) {
    const colorModel = pathOptions.fillModel;
    pathOptions.type = muhammara.DrawingPathType.FILL;
    pathOptions.color = colorModel.color;
    pathOptions.colorspace = colorModel.colorspace;
    recipe._drawObject(
      recipe,
      nx,
      ny,
      width,
      height,
      pathOptions,
      (ctx, xObject) => {
        ctx.gs(xObject.getGsName(pathOptions.fillGsId));
        xObject.fill(colorModel);
        ctx.drawRectangle(
          left,
          bottom,
          boxWidth,
          boxHeight,
          recipe._devicePathOptions(pathOptions),
        );
      },
    );
    return;
  }
  const colorModel =
    pathOptions.stroke !== undefined
      ? pathOptions.strokeModel
      : pathOptions.colorModel;
  pathOptions.type = muhammara.DrawingPathType.STROKE;
  pathOptions.color = colorModel.color;
  pathOptions.colorspace = colorModel.colorspace;
  recipe._drawObject(
    recipe,
    nx,
    ny,
    width,
    height,
    pathOptions,
    (ctx, xObject) => {
      // The form clips at the image box, so the outline lies inside it.
      const margin = pathOptions.width;
      ctx.gs(xObject.getGsName(pathOptions.strokeGsId));
      xObject.stroke(colorModel);
      ctx
        .J(pathOptions.lineCap)
        .j(pathOptions.lineJoin)
        .M(pathOptions.miterLimit)
        .d(pathOptions.dash, pathOptions.dashPhase)
        .drawRectangle(
          left + Math.min(margin / 2, boxWidth / 2),
          bottom + Math.min(margin / 2, boxHeight / 2),
          Math.max(0, boxWidth - margin),
          Math.max(0, boxHeight - margin),
          recipe._devicePathOptions(pathOptions),
        );
    },
  );
}

/**
 * Compute the drawn size of an image and the offset its alignment applies.
 * A missing `options.keepAspectRatio` keeps the aspect ratio.
 * @private
 * @param {string} [imgSrc=''] - The image path.
 * @param {Object} [options] - The image() options; `page` selects the page or
 *   image that is measured.
 * @returns {{width: number, height: number, offsetX: number, offsetY: number, page: ?Object}}
 *   The drawn size, the PDF offset from the placement point, and the page
 *   geometry of a PDF source.
 * @throws {Error} If the image, or the PDF page `page` selects, cannot be read.
 */
exports._getImgOffset = function _getImgOffset(imgSrc = "", options = {}) {
  // A missing keepAspectRatio keeps it; the caller's options stay untouched.
  const keepAspectRatio = options.keepAspectRatio ?? true;
  const index = imageIndex(options);
  const page = pdfPage(this, imgSrc, index);
  const dimensions = page
    ? displayedPageSize(page)
    : this.writer.getImageDimensions(imgSrc, index);
  // An unreadable image measures 0 by 0. Drawing it would leave an image
  // object that is never written, so endPDF() could not finish the PDF.
  if (!(dimensions.width > 0 && dimensions.height > 0)) {
    throw new Error(`Unknown image: ${imgSrc}`);
  }
  const ratio = dimensions.width / dimensions.height;
  const scale = imageSize(options, "scale");
  const wantedWidth = imageSize(options, "width");
  const wantedHeight = imageSize(options, "height");

  let width = dimensions.width;
  let height = dimensions.height;
  if (scale) {
    width = width * scale;
    height = height * scale;
  } else if (wantedWidth && !wantedHeight) {
    width = wantedWidth;
    height = wantedWidth / ratio;
  } else if (!wantedWidth && wantedHeight) {
    width = wantedHeight * ratio;
    height = wantedHeight;
  } else if (wantedWidth && wantedHeight) {
    if (!keepAspectRatio) {
      width = wantedWidth;
      height = wantedHeight;
    } else {
      // fit to the smaller
      if (wantedWidth / ratio <= wantedHeight) {
        width = wantedWidth;
        height = wantedWidth / ratio;
      } else {
        width = wantedHeight * ratio;
        height = wantedHeight;
      }
    }
  }
  let offsetX = 0;
  let offsetY = -height;

  if (options.align) {
    const alignments = options.align.split(" ");
    if (alignments[0]) {
      switch (alignments[0]) {
        case HorizontalAlign.CENTER:
          offsetX = (-1 * width) / 2;
          break;
        case HorizontalAlign.RIGHT:
          offsetX = width / 2;
          break;
        default:
      }
    }
    if (alignments[1]) {
      switch (alignments[1]) {
        case VerticalAlign.CENTER:
          offsetY = (-1 * height) / 2;
          break;
        case VerticalAlign.BOTTOM:
          // Down by half the height from the top-left placement, as
          // documented; 6.x moved the image up by 1.5 times its height.
          offsetY = -1.5 * height;
          break;
        default:
      }
    }
  }
  return { width, height, offsetX, offsetY, page };
};
