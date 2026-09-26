const muhammara = require("../muhammara");
const { Colorspace } = require("../recipe-constants");

/**
 * move the current position to target position
 * @name moveTo
 * @function
 * @memberof Recipe#
 * @param {number|"center"} x - The coordinate x
 * @param {number|"center"} y - The coordinate y
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If no page is active.
 */
exports.moveTo = function moveTo(x, y) {
  const { nx, ny } = this._calibrateCoordinate(x, y);
  this._position = {
    x: nx,
    y: ny,
  };
  return this;
};

/**
 * Draw a line from current position
 * @name lineTo
 * @function
 * @memberof Recipe#
 * @param {number|"center"} x - The coordinate x
 * @param {number|"center"} y - The coordinate y
 * @param {Object} [options] - The options
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If no page is active.
 * @param {string|number[]} [options.color] - HexColor, PercentColor or DecimalColor
 * @param {string|number[]} [options.stroke] - HexColor, PercentColor or DecimalColor
 * @param {number} [options.lineWidth] - The line width
 * @param {number} [options.opacity] - how transparent should line be, from 0: invisible to 1: opaque
 * @param {number[]} [options.dash] - The dash pattern [dashSize, gapSize] or [dashAndGapSize]
 * @param {number} [options.dashPhase] - distance into dash pattern at which to start dash (default: 0, immediately)
 * @param {Recipe.LineCap} [options.lineCap] -  open line end style, a `Recipe.LineCap` value (default: 'round')
 * @param {Recipe.LineJoin} [options.lineJoin] - joined line end style, a `Recipe.LineJoin` value (default: 'round')
 * @param {number} [options.miterLimit] - limit at which 'miter' joins are forced to 'bevel' (default: 1.414)
 */
exports.lineTo = function lineTo(x, y, options = {}) {
  const fromX = this._position.x;
  const fromY = this._position.y;
  const { nx, ny } = this._calibrateCoordinate(x, y);
  // _getPathOptions() may pause the page to write graphics states, and an
  // edited page resumes into a new context, so read the context afterwards.
  const pathOptions = this._getPathOptions(options);
  const context = this.pageContext;
  pathOptions.type = muhammara.DrawingPathType.STROKE;

  if (pathOptions.stroke !== undefined) {
    pathOptions.color = pathOptions.stroke;
    pathOptions.colorspace = pathOptions.strokeModel.colorspace;
  }

  const colorModel = pathOptions.strokeModel || pathOptions.colorModel;
  const drawLine = (ctx, originX, originY) =>
    ctx
      .J(pathOptions.lineCap)
      .j(pathOptions.lineJoin)
      .d(pathOptions.dash, pathOptions.dashPhase)
      .M(pathOptions.miterLimit)
      .drawPath(
        fromX - originX,
        fromY - originY,
        nx - originX,
        ny - originY,
        this._devicePathOptions(pathOptions),
      );

  if (colorModel.colorspace === Colorspace.SEPARATION) {
    // A Separation color space is a resource, so draw through a form XObject
    // as the other shapes do; the padding keeps the line caps inside it.
    const padding = pathOptions.width;
    const left = Math.min(fromX, nx) - padding;
    const bottom = Math.min(fromY, ny) - padding;
    this._drawObject(
      this,
      left,
      bottom,
      Math.abs(nx - fromX) + padding * 2,
      Math.abs(ny - fromY) + padding * 2,
      {},
      (ctx, xObject) => {
        this._setSeparationColor(xObject, colorModel, true);
        drawLine(ctx, left, bottom);
      },
    );
  } else {
    drawLine(context.q(), 0, 0).Q();
  }
  this.moveTo(x, y);
  return this;
};

/**
 * Draw a line through coordinate pairs, or from (startX, startY) to
 * (endX, endY) when called as `line(startX, startY, endX, endY, options?)`.
 * @name line
 * @function
 * @memberof Recipe#
 * @param {number[][]|number} coordinates - The array of coordinate [[x,y], [m,n]], or the start x
 * @param {Object} [options] - The options, or the start y in the four-number form
 * @returns {Recipe} The recipe instance.
 * @param {string|number[]} [options.color] - HexColor, PercentColor or DecimalColor
 * @param {string|number[]} [options.stroke] - HexColor, PercentColor or DecimalColor
 * @param {number} [options.lineWidth] - The line width
 * @param {number} [options.opacity] - how transparent should line be, from 0: invisible to 1: opaque
 * @param {number[]} [options.dash] - The dash pattern [dashSize, gapSize] or [dashAndGapSize]
 * @param {number} [options.dashPhase] - distance into dash pattern at which to start dash (default: 0, immediately)
 * @param {Recipe.LineCap} [options.lineCap] -  open line end style, a `Recipe.LineCap` value (default: 'round')
 * @param {Recipe.LineJoin} [options.lineJoin] - joined line end style, a `Recipe.LineJoin` value (default: 'round')
 * @param {number} [options.miterLimit] - limit at which 'miter' joins are forced to 'bevel' (default: 1.414)
 * @throws {TypeError} If no page is active.
 */
exports.line = function line(coordinates = [], options = {}) {
  if (typeof coordinates === "number") {
    // line(startX, startY, endX, endY, options?), as in Wasm.
    const [startX, startY, endX, endY, lineOptions = {}] = arguments;
    coordinates = [
      [startX, startY],
      [endX, endY],
    ];
    options = lineOptions;
  }
  coordinates.forEach((coordinate, index) => {
    if (index === 0) {
      this.moveTo(coordinate[0], coordinate[1]);
    } else {
      this.lineTo(coordinate[0], coordinate[1], options);
    }
  });
  return this;
};
