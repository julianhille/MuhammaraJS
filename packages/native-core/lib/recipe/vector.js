//  Table indicating how to specify coloration of elements
//  -------------------------------------------------------------------
// |Color | HexColor   | DecimalColor                   | PercentColor |
// |Space | (string)   | (array)                        | (string)     |
// |------+------------+--------------------------------+--------------|
// | Gray | #GG        | [gray]                         | %G           |
// |  RGB | #rrggbb    | [red, green, blue]             | %r,g,b       |
// | CMYK | #ccmmyykk  | [cyan, magenta, yellow, black] | %c,m,y,k     |
//  -------------------------------------------------------------------
//
//   HexColor component values (two hex digits) range from 00 to FF.
//   DecimalColor component values range from 0 to 255.
//   PercentColor component values range from 1 to 100.

const { linkPdf } = require("./annotation");
const muhammara = require("../muhammara");

/**
 * Draw a circle
 * @name circle
 * @function
 * @memberof Recipe#
 * @param {number|"center"} x - The coordinate x of the center
 * @param {number|"center"} y - The coordinate y of the center
 * @param {number} radius - The radius
 * @param {Object} [options] - The options
 * @param {string|number[]} [options.color] - HexColor, PercentColor or DecimalColor
 * @param {string|number[]} [options.stroke] - HexColor, PercentColor or DecimalColor
 * @param {string|number[]} [options.fill] - HexColor, PercentColor or DecimalColor
 * @param {number} [options.lineWidth] - The line width
 * @param {number} [options.opacity] - The opacity
 * @param {number[]} [options.dash] - The dash style [number, number]
 * @param {string} [options.link] - Make the circle's bounding square open this URL.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If no page is active.
 */
exports.circle = function circle(x, y, radius, options = {}) {
  [x, y] = this._centrify(x, y);
  const { nx, ny } = this._calibrateCoordinate(x, y);
  const diameter = radius * 2;

  if (options.fill) {
    const pathOptions = this._getPathOptions(options, nx, ny);
    pathOptions.type = muhammara.DrawingPathType.FILL;

    if (pathOptions.fill !== undefined) {
      pathOptions.color = pathOptions.fill;
      pathOptions.colorspace = pathOptions.fillModel.colorspace;
    }

    this._drawObject(
      this,
      nx - radius,
      ny - radius,
      diameter,
      diameter,
      pathOptions,
      (ctx, xObject) => {
        ctx
          .gs(xObject.getGsName(pathOptions.fillGsId))
          .drawCircle(radius, radius, radius, pathOptions);
      },
    );
  }
  if (options.stroke || options.color || !options.fill) {
    const pathOptions = this._getPathOptions(options);
    pathOptions.type = muhammara.DrawingPathType.STROKE;

    if (pathOptions.stroke !== undefined) {
      pathOptions.color = pathOptions.stroke;
      pathOptions.colorspace = pathOptions.strokeModel.colorspace;
    }

    // To honor the given width and height of the enclosing square ...

    this._drawObject(
      this,
      nx - radius,
      ny - radius,
      diameter,
      diameter,
      pathOptions,
      (ctx, xObject) => {
        ctx.gs(xObject.getGsName(pathOptions.strokeGsId));
        ctx
          .d(pathOptions.dash, pathOptions.dashPhase)
          .drawCircle(
            radius,
            radius,
            Math.max(0, radius - pathOptions.width / 2),
            pathOptions,
          );

        // ... requires adjusting the internal drawing to accomodate line thickness.
      },
    );
  }
  if (options.link)
    this.link(options.link, x - radius, y - radius, diameter, diameter);
  return this;
};

/**
 * Draw a rectangle
 * @name rectangle
 * @function
 * @memberof Recipe#
 * @param {number|"center"} x - The coordinate x of the top-left corner
 * @param {number|"center"} y - The coordinate y of the top-left corner
 * @param {number} width - The width
 * @param {number} height - The height
 * @param {Object} [options] - The options
 * @param {string|number[]} [options.color] - HexColor, PercentColor or DecimalColor
 * @param {string|number[]} [options.stroke] - HexColor, PercentColor or DecimalColor
 * @param {string|number[]} [options.fill] - HexColor, PercentColor or DecimalColor
 * @param {number} [options.lineWidth] - The line width
 * @param {number} [options.opacity] - The opacity
 * @param {number[]} [options.dash] - The dash style [number, number]
 * @param {number} [options.rotation] - Accept: +/- 0 through 360. Default: 0
 * @param {number[]} [options.rotationOrigin] - [originX, originY] Default: x, y
 * @param {number|number[]} [options.borderRadius] - Radius size for rounded corners.
 * When a one to four number array can be used to give specific sizees to each corner.
 * The numbering starts from the top, left corner, and goes clockwise around the text box.
 * Missing values in the array are filled in by opposite corner values.
 * @param {string} [options.link] - Make the rectangle open this URL.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If no page is active.
 */
exports.rectangle = function rectangle(x, y, width, height, options = {}) {
  const { nx, ny } = options.useGivenCoords
    ? { nx: x, ny: y }
    : this._calibrateCoordinate(x, y, 0, -height);

  const pathOptions = this._getPathOptions(options, nx, ny);
  let colorModel = pathOptions.colorModel;
  pathOptions.useGivenCoords = options.useGivenCoords;

  if (options.fill) {
    pathOptions.type = muhammara.DrawingPathType.FILL;

    if (pathOptions.fill !== undefined) {
      pathOptions.color = pathOptions.fill;
      pathOptions.colorspace = pathOptions.fillModel.colorspace;
      colorModel = pathOptions.fillModel;
    }

    this._drawObject(
      this,
      nx,
      ny,
      width,
      height,
      pathOptions,
      (ctx, xObject) => {
        ctx.gs(xObject.getGsName(pathOptions.fillGsId));
        xObject.fill(colorModel);

        if (options.borderRadius) {
          drawRoundedRectangle(ctx, 0, 0, width, height, options.borderRadius);
          ctx.f();
        } else {
          ctx.drawRectangle(0, 0, width, height, pathOptions);
        }
      },
    );
  }

  if (options.stroke || options.color || !options.fill) {
    pathOptions.type = muhammara.DrawingPathType.STROKE;

    if (pathOptions.stroke !== undefined) {
      pathOptions.color = pathOptions.stroke;
      pathOptions.colorspace = pathOptions.strokeModel.colorspace;
      colorModel = pathOptions.strokeModel;
    }

    // To honor the given width and height of the rectangle ...

    this._drawObject(
      this,
      nx,
      ny,
      width,
      height,
      pathOptions,
      (ctx, xObject) => {
        ctx.gs(xObject.getGsName(pathOptions.strokeGsId));
        // ... requires adjusting the internal drawing to accomodate line thickness.
        const margin = pathOptions.width;
        xObject.stroke(colorModel);

        if (options.borderRadius) {
          ctx.w(pathOptions.width).d(pathOptions.dash, pathOptions.dashPhase);

          const inset = Math.min(margin / 2, width / 2, height / 2);
          drawRoundedRectangle(
            ctx,
            inset,
            inset,
            width - inset * 2,
            height - inset * 2,
            options.borderRadius,
            inset,
          );
          ctx.S();
        } else {
          ctx
            .d(pathOptions.dash, pathOptions.dashPhase)
            .drawRectangle(
              Math.min(margin / 2, width / 2),
              Math.min(margin / 2, height / 2),
              Math.max(0, width - margin),
              Math.max(0, height - margin),
              pathOptions,
            );
        }
      },
    );
  }
  if (options.link) {
    if (options.useGivenCoords)
      linkPdf(this, options.link, x, y, width, height);
    else this.link(options.link, x, y, width, height);
  }

  return this;
};

/**
 * Append a rectangle path with rounded corners.
 * @private
 * @param {Object} ctx - The content context.
 * @param {number} left - The left edge.
 * @param {number} bottom - The bottom edge.
 * @param {number} width - The width.
 * @param {number} height - The height.
 * @param {number|number[]} radii - One radius, or up to four clockwise from
 *   the top-left corner; missing ones come from the opposite corner.
 * @param {number} [inset=0] - How far to move the path inside the rectangle.
 * @returns {void}
 */
function drawRoundedRectangle(
  ctx,
  left,
  bottom,
  width,
  height,
  radii,
  inset = 0,
) {
  let radius = [];

  // populate radius array accordingly.
  // Missing element value comes from opposite corner.
  if (typeof radii === "number") {
    radius = new Array(4).fill(radii);
  } else if (Array.isArray(radii)) {
    switch (radii.length) {
      case 1:
        radius = new Array(4).fill(radii[0]);
        break;
      case 2:
        radius = radii.slice(0);
        radius[2] = radii[0];
        radius[3] = radii[1];
        break;
      case 3:
        radius = radii.slice(0);
        radius[3] = radii[1];
        break;
      case 4:
        radius = radii;
        break;
    }
  }
  // Keep inset corners concentric with the nominal corners.
  radius = radius.map((value) => Math.max(0, value - inset));
  const K = 0.551784;
  const right = left + width;
  const top = bottom + height;
  ctx
    .m(left, top - radius[0]) // top-left
    .c(
      left,
      top - radius[0] * (1 - K),
      left + radius[0] * (1 - K),
      top,
      left + radius[0],
      top,
    )

    .l(right - radius[1], top) // top-right
    .c(
      right - radius[1] * (1 - K),
      top,
      right,
      top - radius[1] * (1 - K),
      right,
      top - radius[1],
    )

    .l(right, bottom + radius[2]) // bottom-right
    .c(
      right,
      bottom + radius[2] * (1 - K),
      right - radius[2] * (1 - K),
      bottom,
      right - radius[2],
      bottom,
    )

    .l(left + radius[3], bottom) // bottom-left
    .c(
      left + radius[3] * (1 - K),
      bottom,
      left,
      bottom + radius[3] * (1 - K),
      left,
      bottom + radius[3],
    )

    .l(left, top - radius[0]); // back to top-left
}

/**
 * Draw an ellipse
 * @name ellipse
 * @function
 * @memberof Recipe#
 * @param {number|"center"} cx x-coordinate of center point of ellipse
 * @param {number|"center"} cy y-coordinate of center point of ellipse
 * @param {number} rx radius length from the center point along x-axis
 * @param {number} ry radius length from the center point along y-axis
 * @param {Object} [options]
 * @param {string|number[]} [options.color] - HexColor, PercentColor or DecimalColor
 * @param {string|number[]} [options.stroke] - HexColor, PercentColor or DecimalColor
 * @param {string|number[]}[ options.fill] - HexColor, PercentColor or DecimalColor
 * @param {number} [options.lineWidth] - The line width
 * @param {number} [options.opacity] - The opacity
 * @param {number[]} [options.dash] - The dash style [number, number]
 * @param {number} [options.rotation] - Accept: +/- 0 through 360. Default: 0
 * @param {number[]} [options.rotationOrigin] - [originX, originY] Default: x, y
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If no page is active.
 */
exports.ellipse = function ellipse(cx, cy, rx, ry, options = {}) {
  [cx, cy] = this._centrify(cx, cy);
  const { nx, ny } = this._calibrateCoordinate(cx, cy);

  const pathOptions = this._getPathOptions(options, nx, ny);
  let colorModel = pathOptions.colorModel;

  const width = rx * 2;
  const height = ry * 2;

  const drawEllipse = (ctx, x, y, w, h) => {
    const magic = 0.551784; // from https://www.tinaja.com/glib/ellipse4.pdf
    const ox = (w / 2) * magic; // control point offset horizontal
    const oy = (h / 2) * magic; // control point offset vertical
    const xe = x + w; // x-end, opposite corner from origin
    const ye = y + h; // y-end, opposite corner from origin
    const xm = rx; // x-middle of enclosing rectangle
    const ym = ry; // y-middle of enclosing rectangle

    ctx
      .m(x, ym)
      .c(x, ym - oy, xm - ox, y, xm, y)
      .c(xm + ox, y, xe, ym - oy, xe, ym)
      .c(xe, ym + oy, xm + ox, ye, xm, ye)
      .c(xm - ox, ye, x, ym + oy, x, ym);
  };

  if (options.fill) {
    if (pathOptions.fill !== undefined) {
      colorModel = pathOptions.fillModel;
    }

    this._drawObject(
      this,
      nx - rx,
      ny - ry,
      width,
      height,
      pathOptions,
      (ctx, xObject) => {
        ctx.gs(xObject.getGsName(pathOptions.fillGsId));
        xObject.fill(colorModel);
        drawEllipse(ctx, 0, 0, width, height);
        ctx.f();
      },
    );
  }

  if (options.stroke || options.color || !options.fill) {
    if (pathOptions.stroke !== undefined) {
      colorModel = pathOptions.strokeModel;
    }

    // To honor the given width and height of the enclosing rectangle ...

    this._drawObject(
      this,
      nx - rx,
      ny - ry,
      width,
      height,
      pathOptions,
      (ctx, xObject) => {
        ctx.gs(xObject.getGsName(pathOptions.strokeGsId));
        const margin = pathOptions.width / 2;
        xObject.stroke(colorModel);
        ctx.w(pathOptions.width).d(pathOptions.dash, pathOptions.dashPhase);

        // ... requires adjusting the internal drawing to accomodate line thickness.
        drawEllipse(
          ctx,
          Math.min(margin, rx),
          Math.min(margin, ry),
          Math.max(0, width - pathOptions.width),
          Math.max(0, height - pathOptions.width),
        );
        ctx.S();
      },
    );
  }
  if (options.link) this.link(options.link, cx - rx, cy - ry, width, height);
  return this;
};

/**
 * Append a circular arc path built from Bézier segments.
 * @private
 * @param {Object} ctx - The content context.
 * @param {number} x - The center x.
 * @param {number} y - The center y.
 * @param {number} radius - The radius.
 * @param {number} startAngle - The start angle in degrees.
 * @param {number} endAngle - The end angle in degrees.
 * @param {boolean} [fromCenter=false] - Start the path at the center, for a sector.
 * @returns {void}
 */
function drawArc(ctx, x, y, radius, startAngle, endAngle, fromCenter = false) {
  const TWO_PI = 2.0 * Math.PI;
  const HALF_PI = 0.5 * Math.PI;
  const magic = 0.551784; // from https://www.tinaja.com/glib/ellipse4.pdf
  let deltaAng;

  deltaAng = endAngle - startAngle;

  // Limit the drawing to no more than one complete circle
  if (Math.abs(deltaAng) > TWO_PI) {
    deltaAng = TWO_PI;
  }

  const numSegs = Math.ceil(Math.abs(deltaAng) / HALF_PI);
  const segAng = deltaAng / numSegs;
  const handleLen = (segAng / HALF_PI) * magic * radius;
  let curAng = startAngle;

  // distances between anchor point and control point
  let deltaCx = -Math.sin(curAng) * handleLen;
  let deltaCy = Math.cos(curAng) * handleLen;

  // anchor point
  let ax = x + Math.cos(curAng) * radius;
  let ay = y + Math.sin(curAng) * radius;

  // draw sector lines?
  if (!fromCenter) {
    ctx.m(ax, ay);
  } else {
    ctx.m(x, y).l(ax, ay);
  }

  // generate segments of overall arc

  for (let segIdx = 0; segIdx < numSegs; segIdx++) {
    // starting control point
    const cp1x = ax + deltaCx;
    const cp1y = ay + deltaCy;

    // next angle
    curAng += segAng;

    // next control point difference
    deltaCx = -Math.sin(curAng) * handleLen;
    deltaCy = Math.cos(curAng) * handleLen;

    // next anchor point
    ax = x + Math.cos(curAng) * radius;
    ay = y + Math.sin(curAng) * radius;

    // ending control point
    const cp2x = ax - deltaCx;
    const cp2y = ay - deltaCy;

    // produce segment
    ctx.c(cp1x, cp1y, cp2x, cp2y, ax, ay);
  }
}

/**
 * Draw an arc of a circle.
 * @name arc
 * @function
 * @memberof Recipe#
 * @param {number|"center"} x - the x coordinate of the arc center point
 * @param {number|"center"} y - the y coordinate of the arc center point
 * @param {number} radius - the distance from the given x,y coordinates from which to produce the arc
 * @param {number} [startAngle=0] - the start of the arc in degree units +/- 0 through 360. Positive values go clockwise, Negative values, counterclockwise.
 * @param {number} [endAngle=360] - the end of the arc in degree units +/- 0 through 360. Positive values go clockwise, Negative values, counterclockwise.
 * @param {Object} [options]
 * @param {string|number[]} [options.color] - HexColor, PercentColor or DecimalColor
 * @param {string|number[]} [options.stroke] - HexColor, PercentColor or DecimalColor
 * @param {string|number[]}[ options.fill] - HexColor, PercentColor or DecimalColor
 * @param {number} [options.lineWidth] - The line width
 * @param {number} [options.opacity] - The opacity
 * @param {number[]} [options.dash] - The dash style [number, number]
 * @param {number} [options.rotation=0] - Accept: +/- 0 through 360.
 * @param {number[]} [options.rotationOrigin] - [originX, originY] Default: x, y
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If no page is active.
 */
exports.arc = function arc(
  x,
  y,
  radius,
  startAngle = 0,
  endAngle = 360,
  options = {},
) {
  [x, y] = this._centrify(x, y);
  const { nx, ny } = this._calibrateCoordinate(x, y);
  const diameter = radius * 2;
  const pathOptions = this._getPathOptions(options, nx, ny);
  let colorModel = pathOptions.colorModel;
  const toRadians = (angle) => {
    return angle * (Math.PI / 180);
  };
  const sAng = -toRadians(startAngle);
  const eAng = -toRadians(endAngle);
  const sector = options.sector;

  if (options.fill) {
    if (pathOptions.fill !== undefined) {
      colorModel = pathOptions.fillModel;
    }

    this._drawObject(
      this,
      nx - radius,
      ny - radius,
      diameter,
      diameter,
      pathOptions,
      (ctx, xObject) => {
        ctx.gs(xObject.getGsName(pathOptions.fillGsId));
        xObject.fill(colorModel);

        drawArc(ctx, radius, radius, radius, sAng, eAng, sector);
        ctx.f();
      },
    );
  }

  if (options.stroke || options.color || !options.fill) {
    if (pathOptions.stroke !== undefined) {
      colorModel = pathOptions.strokeModel;
    }

    // To honor the given width and height of the enclosing rectangle ...

    this._drawObject(
      this,
      nx - radius,
      ny - radius,
      diameter,
      diameter,
      pathOptions,
      (ctx, xObject) => {
        ctx.gs(xObject.getGsName(pathOptions.strokeGsId));
        const margin = pathOptions.width / 2;
        xObject.stroke(colorModel);
        ctx.w(pathOptions.width).d(pathOptions.dash, pathOptions.dashPhase);

        // ... requires adjusting the internal drawing to accomodate line thickness.
        drawArc(
          ctx,
          radius,
          radius,
          Math.max(0, radius - margin),
          sAng,
          eAng,
          sector,
        );
        if (sector) {
          ctx.h();
        } // close off path to create a circle sector.
        ctx.S();
      },
    );
  }

  if (options.link)
    this.link(options.link, x - radius, y - radius, diameter, diameter);
  return this;
};

/**
 * Draw a closed sector of a circle.
 * @name pie
 * @function
 * @memberof Recipe#
 * @param {number|"center"} x - the x coordinate of the pie center point
 * @param {number|"center"} y - the y coordinate of the pie center point
 * @param {number} radius - the distance from the center point to the arc
 * @param {number} [startAngle=0] - the start of the arc in degree units
 * @param {number} [endAngle=360] - the end of the arc in degree units
 * @param {Object} [options] - The path options.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If no page is active.
 */
exports.pie = function pie(x, y, radius, startAngle, endAngle, options = {}) {
  return this.arc(x, y, radius, startAngle, endAngle, {
    ...options,
    sector: true,
  });
};

/**
 * Set the line style for the current page content context.
 * @name lineStyle
 * @function
 * @memberof Recipe#
 * @param {Recipe.LineStyleOptions} [options] - The line style options.
 * @param {number} [options.width] - The line width.
 * @param {number} [options.lineWidth] - Alias for width.
 * @param {number} [options.cap] - The PDF line cap style, a `LineCapStyle` value.
 * @param {number} [options.join] - The PDF line join style: 0 miter, 1 round, 2 bevel.
 * @param {number} [options.miterLimit] - The miter limit.
 * @param {number[]} [options.dash] - The dash pattern.
 * @param {number} [options.dashPhase] - The dash pattern phase.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If no page is active.
 */
exports.lineStyle = function lineStyle(options = {}) {
  this.current = this.current || {};
  this.current.lineStyle = this.current.lineStyle || {};

  if (options.width !== undefined || options.lineWidth !== undefined) {
    const width = options.width ?? options.lineWidth;
    this.current.lineStyle.width = width;
    this.pageContext.w(width);
  }
  if (options.cap !== undefined) {
    this.current.lineStyle.cap = options.cap;
    this.pageContext.J(options.cap);
  }
  if (options.join !== undefined) {
    this.current.lineStyle.join = options.join;
    this.pageContext.j(options.join);
  }
  if (options.miterLimit !== undefined) {
    this.current.lineStyle.miterLimit = options.miterLimit;
    this.pageContext.M(options.miterLimit);
  }
  if (options.dash !== undefined || options.dashPhase !== undefined) {
    const dash = options.dash ?? this.current.lineStyle.dash ?? [];
    const dashPhase =
      options.dashPhase ?? this.current.lineStyle.dashPhase ?? 0;
    this.current.lineStyle.dash = dash;
    this.current.lineStyle.dashPhase = dashPhase;
  }
  return this._setLineStyle(options);
};

/**
 * Write the given line style options to the page content context.
 * @private
 * @param {Object} [options] - The lineStyle() options.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If no page is active.
 */
exports._setLineStyle = function _setLineStyle(options = {}) {
  if (options.width !== undefined || options.lineWidth !== undefined)
    this.pageContext.w(options.width ?? options.lineWidth);
  if (options.cap !== undefined) this.pageContext.J(options.cap);
  if (options.join !== undefined) this.pageContext.j(options.join);
  if (options.miterLimit !== undefined) this.pageContext.M(options.miterLimit);
  if (options.dash !== undefined || options.dashPhase !== undefined)
    this.pageContext.d(
      options.dash ?? this.current.lineStyle.dash ?? [],
      options.dashPhase ?? this.current.lineStyle.dashPhase ?? 0,
    );
  return this;
};

/**
 * Set the line width.
 *
 * @name lineWidth
 * @function
 * @memberof Recipe#
 * @param {number} width - The line width.
 * @returns {Recipe} The recipe instance.
 */
exports.lineWidth = function lineWidth(width) {
  return this.lineStyle({ width });
};

/**
 * Set fill and stroke opacity.
 *
 * @name opacity
 * @function
 * @memberof Recipe#
 * @param {number} value - The requested opacity from 0 (transparent) to 1 (opaque).
 * @returns {Recipe} The recipe instance.
 */
exports.opacity = function opacity(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError("Opacity must be a finite number between 0 and 1");
  }
  this.current.opacity = value;
  return this;
};

/**
 * Fill the current path.
 *
 * This compatibility method currently has no effect.
 * @name fill
 * @function
 * @memberof Recipe#
 * @returns {Recipe} The recipe instance.
 */
exports.fill = function fill() {
  return this;
};

/**
 * Stroke the current path.
 *
 * This compatibility method currently has no effect.
 * @name stroke
 * @function
 * @memberof Recipe#
 * @returns {Recipe} The recipe instance.
 */
exports.stroke = function stroke() {
  return this;
};

/**
 * Fill and stroke the current path.
 *
 * This compatibility method currently has no effect.
 * @name fillAndStroke
 * @function
 * @memberof Recipe#
 * @returns {Recipe} The recipe instance.
 */
exports.fillAndStroke = function fillAndStroke() {
  return this;
};
