const { xObjectForm } = require("./xObjectForm");
const { resolveFontSize } = require("./utils");
const { LineCap, LineJoin } = require("../recipe-constants");

/**
 * Resolve drawing and text options into path options: font, size, colors
 * and color models, line style, opacity graphics states, rotation, skew and
 * dash. Clamps `options.opacity` to 0..1 in place.
 * @private
 * @param {Object} [options] - The drawing or text options.
 * @param {number} originX - The PDF x of the default rotation origin.
 * @param {number} originY - The PDF y of the default rotation origin.
 * @returns {Object} The resolved path options.
 * @throws {RangeError} If a given font size is not greater than zero.
 * @throws {Error} If the font cannot be loaded.
 */
exports._getPathOptions = function _getPathOptions(
  options = {},
  originX,
  originY,
) {
  this.current = this.current || {};
  const colorspace = options.colorspace || this.options.colorspace;
  const colorName = options.colorName;

  const pathOptions = {
    originX,
    originY,
    font: this._getFont(options),
    size: resolveFontSize(options, this.current.defaultFontSize),
    charSpace: options.charSpace || 0,
    underline: false,
    strikeOut: false,
    color: this._transformColor(options.color, {
      colorspace: colorspace,
      colorName: options.colorName,
    }),
    colorspace,
    colorName,
    colorArray: [],
    lineCap: this._lineCap(),
    lineJoin: this._lineJoin(),
    miterLimit: 1.414,
    width: 2,
    align: options.align,
  };
  const lineStyle = this.current.lineStyle || {};

  if (lineStyle.width !== undefined) pathOptions.width = lineStyle.width;
  if (lineStyle.cap !== undefined) pathOptions.lineCap = lineStyle.cap;
  if (lineStyle.join !== undefined) pathOptions.lineJoin = lineStyle.join;
  if (lineStyle.miterLimit !== undefined)
    pathOptions.miterLimit = lineStyle.miterLimit;
  if (lineStyle.dash !== undefined) pathOptions.dash = lineStyle.dash;
  if (lineStyle.dashPhase !== undefined)
    pathOptions.dashPhase = lineStyle.dashPhase;
  if (pathOptions.dash === undefined) pathOptions.dash = [];
  if (pathOptions.dashPhase === undefined) pathOptions.dashPhase = 0;

  if (options.opacity == void 0 || isNaN(options.opacity)) {
    options.opacity = this.current.opacity ?? 1;
  } else {
    options.opacity =
      options.opacity < 0 ? 0 : options.opacity > 1 ? 1 : options.opacity;
  }
  pathOptions.opacity = options.opacity;
  const extGStates = this._createExtGStates(options.opacity);
  pathOptions.strokeGsId = extGStates.stroke;
  pathOptions.fillGsId = extGStates.fill;

  if (options.width || options.lineWidth) {
    const width = options.width || options.lineWidth;
    if (!isNaN(width)) {
      pathOptions.width = width <= 0 ? 1 : width;
    }
  }

  const colorOpts = {
    colorspace: colorspace,
    wantColorModel: true,
    colorName: options.colorName,
  };

  if (options.stroke) {
    pathOptions.strokeModel = this._transformColor(options.stroke, colorOpts);
    pathOptions.stroke = pathOptions.strokeModel.color;
  }

  if (options.fill) {
    pathOptions.fillModel = this._transformColor(options.fill, colorOpts);
    pathOptions.fill = pathOptions.fillModel.color;
  }

  pathOptions.colorModel = this._transformColor(
    options.color || options.colour,
    colorOpts,
  );
  pathOptions.color = pathOptions.colorModel.color;
  pathOptions.colorspace = pathOptions.colorModel.colorspace;

  // rotation
  if (options.rotation !== void 0) {
    const rotation = parseFloat(options.rotation);
    pathOptions.rotation = rotation;
    pathOptions.rotationOrigin = options.rotationOrigin || null;
  }

  // skew
  if (options.skewX !== void 0) {
    pathOptions.skewX = options.skewX;
  }

  if (options.skewY != void 0) {
    pathOptions.skewY = options.skewY;
  }

  // Page 127 of PDF 1.7 specification
  if (Array.isArray(options.dash)) pathOptions.dash = options.dash;
  if (!isNaN(options.dashPhase)) pathOptions.dashPhase = options.dashPhase;
  if (pathOptions.dash[0] == 0 && pathOptions.dash[1] == 0) {
    pathOptions.dash = []; // no dash, solid unbroken line
    pathOptions.dashPhase = 0;
  }

  // Page 125-126 of PDF 1.7 specification
  if (options.lineJoin !== void 0) {
    pathOptions.lineJoin = this._lineJoin(options.lineJoin);
  }
  if (options.lineCap !== void 0) {
    pathOptions.lineCap = this._lineCap(options.lineCap);
  }

  if (options.miterLimit !== void 0) {
    if (!isNaN(options.miterLimit)) {
      pathOptions.miterLimit = options.miterLimit;
    }
  }

  return pathOptions;
};

/**
 * The distance between two points.
 * @private
 * @param {number[]} coordA - The first [x, y] point.
 * @param {number[]} coordB - The second [x, y] point.
 * @returns {number} The distance.
 */
exports._getDistance = function _getDistance(coordA, coordB) {
  const disX = Math.abs(coordB[0] - coordA[0]);
  const disY = Math.abs(coordB[1] - coordA[1]);
  const distance = Math.sqrt(disX * disX + disY * disY);

  return distance;
};

exports._getTransformParams = getTransformParams;

/**
 * The transformation matrix that rotates content around an origin.
 * @private
 * @param {number} inAngle - The rotation in degrees.
 * @param {number} x - The origin x.
 * @param {number} y - The origin y.
 * @param {number} offsetX - The content x relative to the origin.
 * @param {number} offsetY - The content y relative to the origin.
 * @returns {number[]} The [a, b, c, d, e, f] matrix.
 */
function getTransformParams(inAngle, x, y, offsetX, offsetY) {
  const theta = toRadians(inAngle);
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const nx = cosTheta * -offsetX + sinTheta * -offsetY;
  const ny = cosTheta * -offsetY - sinTheta * -offsetX;
  return [cosTheta, -sinTheta, sinTheta, cosTheta, x - nx, y - ny];
}

/**
 * Translate a content context to a point and apply the rotation options.
 * @private
 * @param {Object} context - The content context.
 * @param {number} x - The PDF x.
 * @param {number} y - The PDF y.
 * @param {Object} options - The path options: rotation, rotationOrigin,
 *   useGivenCoords, originX, originY and deltaY.
 * @returns {void}
 * @throws {TypeError} If a Recipe rotation origin is converted without an active page.
 */
exports._setRotationContext = function _setRotationTransform(
  context,
  x,
  y,
  options,
) {
  const deltaY = options.deltaY ? options.deltaY : 0;

  if (options.rotation === undefined || options.rotation === 0) {
    context.cm(1, 0, 0, 1, x, y - deltaY); // no rotation
  } else {
    let rotationOrigin;

    if (!hasRotation(options)) {
      rotationOrigin = [options.originX, options.originY]; // supply default
    } else {
      if (options.useGivenCoords) {
        rotationOrigin = options.rotationOrigin;
      } else {
        const orig = this._calibrateCoordinate(
          options.rotationOrigin[0],
          options.rotationOrigin[1],
        );
        rotationOrigin = [orig.nx, orig.ny];
      }
    }

    const rm = getTransformParams(
      // rotation matrix
      options.rotation,
      rotationOrigin[0],
      rotationOrigin[1],
      x - rotationOrigin[0],
      y - rotationOrigin[1] - deltaY,
    );

    context.cm(rm[0], rm[1], rm[2], rm[3], rm[4], rm[5]);
  }
};

/**
 * Whether the options carry an explicit [x, y] rotation origin.
 * @private
 * @param {Object} options - The path options.
 * @returns {boolean} True for a two-element rotationOrigin array.
 */
function hasRotation(options) {
  return (
    options.rotationOrigin &&
    Array.isArray(options.rotationOrigin) &&
    options.rotationOrigin.length === 2
  );
}

/**
 * Convert degrees to radians, wrapping at 360.
 * @private
 * @param {number} angle - The angle in degrees.
 * @returns {number} The angle in radians.
 */
function toRadians(angle) {
  return 2 * Math.PI * ((angle % 360) / 360);
}

/**
 * The transformation matrix for skew angles.
 * @private
 * @param {number} [skewXAngle=0] - The skew off the x axis, in degrees.
 * @param {number} [skewYAngle=0] - The skew off the y axis, in degrees.
 * @returns {number[]} The [a, b, c, d, e, f] matrix.
 */
function getSkewTransform(skewXAngle = 0, skewYAngle = 0) {
  const alpha = toRadians(skewXAngle);
  const beta = toRadians(skewYAngle);
  const tanAlpha = Math.tan(alpha);
  const tanBeta = Math.tan(beta);

  return [1, tanAlpha, tanBeta, 1, 0, 0];
}

/**
 * Apply the skew options to a content context.
 * @private
 * @param {Object} context - The content context.
 * @param {Object} options - The path options: skewX and skewY.
 * @returns {void}
 */
exports._setSkewContext = function _setSkewTransform(context, options) {
  if (options.skewX || options.skewY) {
    const sm = getSkewTransform(options.skewX, options.skewY);

    context.cm(sm[0], sm[1], sm[2], sm[3], sm[4], sm[5]);
  }
};

/**
 * Apply a [scaleX, scaleY] ratio to a content context.
 * @private
 * @param {Object} context - The content context.
 * @param {Object} options - The path options: ratio.
 * @returns {void}
 */
exports._setScalingTransform = function _setScalingTransform(context, options) {
  if (options.ratio) {
    context.cm(options.ratio[0], 0, 0, options.ratio[1], 0, 0);
  }
};

/**
 * Draw content through a form XObject, creating it with the callback unless
 * `options.xObject` supplies one, then place it with rotation, skew and
 * scaling.
 * @private
 * @param {Recipe} self - The recipe instance.
 * @param {number} x - The PDF x.
 * @param {number} y - The PDF y.
 * @param {number} width - The form width.
 * @param {number} height - The form height.
 * @param {Object} options - The path options.
 * @param {function(Object, xObjectForm): void} callback - Draws into a new form.
 * @returns {void}
 * @throws {Error} If no page content context is active.
 */
exports._drawObject = function _drawObject(
  self,
  x,
  y,
  width,
  height,
  options,
  callback,
) {
  let xObject = options.xObject; // allows caller to supply existing form object

  if (!xObject) {
    self.pauseContext();

    xObject = new xObjectForm(self.writer, width, height);
    const xObjectCtx = xObject.getContentContext();

    xObjectCtx.q();
    callback(xObjectCtx, xObject);
    xObjectCtx.Q();
    xObject.end();

    self.resumeContext();
  }

  const context = self.pageContext;
  context.q();
  self._setRotationContext(context, x, y, options);
  self._setSkewContext(context, options);
  self._setScalingTransform(context, options);
  context.doXObject(xObject).Q();
};

/**
 * The PDF line cap number of a `Recipe.LineCap` value.
 * @private
 * @param {Recipe.LineCap} [type] - The cap style; round when omitted or unknown.
 * @returns {number} 0 for butt, 1 for round, 2 for square.
 */
exports._lineCap = function _lineCap(type) {
  const round = 1;
  let cap = round;

  if (type) {
    // In PDF line cap order.
    const capStyle = [LineCap.BUTT, LineCap.ROUND, LineCap.SQUARE];
    const capType = capStyle.indexOf(type);
    cap = capType !== -1 ? capType : round;
  }

  return cap;
};

/**
 * The PDF line join number of a `Recipe.LineJoin` value.
 * @private
 * @param {Recipe.LineJoin} [type] - The join style; round when omitted or unknown.
 * @returns {number} 0 for miter, 1 for round, 2 for bevel.
 */
exports._lineJoin = function _lineJoin(type) {
  const round = 1;
  let join = round;

  if (type) {
    // In PDF line join order.
    const joinStyle = [LineJoin.MITER, LineJoin.ROUND, LineJoin.BEVEL];
    const joinType = joinStyle.indexOf(type);
    join = joinType !== -1 ? joinType : round;
  }

  return join;
};
