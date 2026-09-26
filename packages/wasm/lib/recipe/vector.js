/**
 * Creates Recipe vector shape and path methods.
 * @param {object} runtime - Module and export helpers.
 * @returns {object} Methods mixed into Recipe.prototype.
 */
export function createVectorMethods(runtime) {
  /**
   * Adds a link over a shape when `options.link` is set.
   * @param {Recipe} recipe - Recipe instance.
   * @param {object} options - Shape options; `useGivenCoords` selects PDF coordinates.
   * @param {number} x - Left.
   * @param {number} y - Top, or bottom for PDF coordinates.
   * @param {number} width - Width.
   * @param {number} height - Height.
   * @returns {void}
   */
  function addLink(recipe, options, x, y, width, height) {
    if (!options.link) return;
    if (options.useGivenCoords)
      recipe._linkPdf(options.link, x, y, width, height);
    else recipe.link(options.link, x, y, width, height);
  }

  /**
   * Appends an arc as Bezier segments of at most 90 degrees.
   * @param {Recipe} recipe - Recipe instance.
   * @param {number} x - Center x in PDF coordinates.
   * @param {number} y - Center y in PDF coordinates.
   * @param {number} radius - Radius.
   * @param {number} start - Start angle in radians.
   * @param {number} end - End angle in radians.
   * @returns {void}
   */
  function curve(recipe, x, y, radius, start, end) {
    var segments = Math.ceil(Math.abs(end - start) / (Math.PI / 2));
    var step = (end - start) / segments;
    recipe._movePdf(x + Math.cos(start) * radius, y + Math.sin(start) * radius);
    for (var index = 0; index < segments; index += 1) {
      var current = start + index * step;
      var next = current + step;
      var handle = (step / (Math.PI / 2)) * 0.551784 * radius;
      recipe._curvePdf(
        x + Math.cos(current) * radius - Math.sin(current) * handle,
        y + Math.sin(current) * radius + Math.cos(current) * handle,
        x + Math.cos(next) * radius + Math.sin(next) * handle,
        y + Math.sin(next) * radius - Math.cos(next) * handle,
        x + Math.cos(next) * radius,
        y + Math.sin(next) * radius,
      );
    }
  }

  /** Paints a nominal fill and a shape-specific inset stroke. */
  function paintInsetShape(recipe, options, x, y, drawPath) {
    var fill = options.fill;
    var stroke = options.stroke || options.color || options.colour;
    if (fill !== undefined) {
      var fillOptions = Object.create(options, {
        fill: { value: fill },
        stroke: { value: undefined },
        color: { value: undefined },
        colour: { value: undefined },
      });
      recipe._beginPath(fillOptions, x, y);
      drawPath(0);
      recipe._finishPath(fillOptions);
    }
    if (stroke !== undefined || fill === undefined) {
      var strokeOptions = Object.create(options, {
        fill: { value: undefined },
        stroke: { value: stroke },
        color: { value: undefined },
        colour: { value: undefined },
      });
      var style = recipe._beginPath(strokeOptions, x, y);
      drawPath(style.width / 2);
      recipe._finishPath(strokeOptions);
    }
    return recipe;
  }

  return {
    /**
     * Draws a rectangle.
     *
     * `(x, y)` is the top-left corner in Recipe coordinates. Set
     * `useGivenCoords` to use native PDF bottom-left coordinates instead. An
     * active page is required.
     *
     * @name rectangle
     * @function
     * @memberof Recipe#
     * @param {number} x - The horizontal corner coordinate in points.
     * @param {number} y - The vertical corner coordinate in points.
     * @param {number} width - The rectangle width in points.
     * @param {number} height - The rectangle height in points.
     * @param {RecipeRectangleOptions} [options] - Rectangle path, rounded-corner, and transformation options.
     * @returns {Recipe} The recipe instance.
     * @throws {Error} If no target page is available or an unsupported color is requested.
     * @throws {TypeError} If the requested color space is unknown.
     */
    rectangle: function (x, y, width, height, options = {}) {
      if (options.borderRadius)
        return this._roundedRectangle(x, y, width, height, options);
      var point = options.useGivenCoords
        ? { nx: x, ny: y }
        : this._calibrateCoordinate(x, y, 0, -height);
      var recipe = this;
      var result = paintInsetShape(this, options, x, y, function (inset) {
        var insetX = Math.min(inset, width / 2);
        var insetY = Math.min(inset, height / 2);
        var pathX = point.nx + insetX;
        var pathY = point.ny + insetY;
        var pathWidth = width - insetX * 2;
        var pathHeight = height - insetY * 2;
        if (recipe._pageContext) {
          recipe._pageContext.re(pathX, pathY, pathWidth, pathHeight);
        } else {
          runtime.call(
            "_muhammara_wasm_recipe_rectangle_path",
            recipe._recipe,
            pathX,
            pathY,
            pathWidth,
            pathHeight,
          );
        }
      });
      addLink(this, options, x, y, width, height);
      return result;
    },
    /**
     * Draws a rectangle with normalized corner radii.
     * @private
     */
    _roundedRectangle: function (x, y, width, height, options) {
      var linkX = x;
      var linkY = y;
      var source = Array.isArray(options.borderRadius)
        ? options.borderRadius
        : [options.borderRadius];
      var radii = [
        source[0],
        source[1] ?? source[0],
        source[2] ?? source[0],
        source[3] ?? source[1] ?? source[0],
      ].map((radius) => Math.max(0, Number(radius) || 0));
      var point = options.useGivenCoords
        ? { nx: x, ny: y }
        : this._calibrateCoordinate(x, y, 0, -height);
      var recipe = this;
      var result = paintInsetShape(this, options, x, y, function (inset) {
        inset = Math.min(inset, width / 2, height / 2);
        var left = point.nx + inset;
        var bottom = point.ny + inset;
        var right = point.nx + width - inset;
        var top = point.ny + height - inset;
        // Keep the inset corners concentric with the nominal corners.
        var [topLeft, topRight, bottomRight, bottomLeft] = radii.map((radius) =>
          Math.max(0, radius - inset),
        );
        var k = 0.551784;
        recipe
          ._movePdf(left + bottomLeft, bottom)
          ._linePdf(right - bottomRight, bottom)
          ._curvePdf(
            right - bottomRight + bottomRight * k,
            bottom,
            right,
            bottom + bottomRight - bottomRight * k,
            right,
            bottom + bottomRight,
          )
          ._linePdf(right, top - topRight)
          ._curvePdf(
            right,
            top - topRight + topRight * k,
            right - topRight + topRight * k,
            top,
            right - topRight,
            top,
          )
          ._linePdf(left + topLeft, top)
          ._curvePdf(
            left + topLeft - topLeft * k,
            top,
            left,
            top - topLeft + topLeft * k,
            left,
            top - topLeft,
          )
          ._linePdf(left, bottom + bottomLeft)
          ._curvePdf(
            left,
            bottom + bottomLeft - bottomLeft * k,
            left + bottomLeft - bottomLeft * k,
            bottom,
            left + bottomLeft,
            bottom,
          );
        if (recipe._pageContext) recipe._pageContext.h();
        else runtime.call("_muhammara_wasm_recipe_close_path", recipe._recipe);
      });
      addLink(this, options, linkX, linkY, width, height);
      return result;
    },
    /**
     * Draws a circle centered at `(x, y)` in Recipe's top-left coordinate system.
     *
     * An active page is required. A link option covers the circle's bounding box.
     *
     * @name circle
     * @function
     * @memberof Recipe#
     * @param {number} x - The center X coordinate in points.
     * @param {number} y - The center Y coordinate in points.
     * @param {number} radius - The radius in points.
     * @param {RecipePathOptions} [options] - Path painting and transformation options.
     * @returns {Recipe} The recipe instance.
     * @throws {Error} If no target page is available or an unsupported color is requested.
     * @throws {TypeError} If the requested color space is unknown.
     */
    circle: function (x, y, radius, options = {}) {
      var point = this._calibrateCoordinate(x, y);
      var recipe = this;
      var result = paintInsetShape(this, options, x, y, function (inset) {
        var pathRadius = Math.max(0, radius - inset);
        var handle = pathRadius * 0.551784;
        recipe
          ._movePdf(point.nx - pathRadius, point.ny)
          ._curvePdf(
            point.nx - pathRadius,
            point.ny - handle,
            point.nx - handle,
            point.ny - pathRadius,
            point.nx,
            point.ny - pathRadius,
          )
          ._curvePdf(
            point.nx + handle,
            point.ny - pathRadius,
            point.nx + pathRadius,
            point.ny - handle,
            point.nx + pathRadius,
            point.ny,
          )
          ._curvePdf(
            point.nx + pathRadius,
            point.ny + handle,
            point.nx + handle,
            point.ny + pathRadius,
            point.nx,
            point.ny + pathRadius,
          )
          ._curvePdf(
            point.nx - handle,
            point.ny + pathRadius,
            point.nx - pathRadius,
            point.ny + handle,
            point.nx - pathRadius,
            point.ny,
          );
      });
      addLink(this, options, x - radius, y - radius, radius * 2, radius * 2);
      return result;
    },
    /**
     * Draws an ellipse centered at `(cx, cy)` in Recipe's top-left coordinate system.
     *
     * An active page is required. A link option covers the ellipse's bounding box.
     *
     * @name ellipse
     * @function
     * @memberof Recipe#
     * @param {number} cx - The center X coordinate in points.
     * @param {number} cy - The center Y coordinate in points.
     * @param {number} rx - The horizontal radius in points.
     * @param {number} ry - The vertical radius in points.
     * @param {RecipePathOptions} [options] - Path painting and transformation options.
     * @returns {Recipe} The recipe instance.
     * @throws {Error} If no target page is available or an unsupported color is requested.
     * @throws {TypeError} If the requested color space is unknown.
     */
    ellipse: function (cx, cy, rx, ry, options = {}) {
      var point = this._calibrateCoordinate(cx, cy);
      var x = point.nx;
      var y = point.ny;
      var k = 0.551784;
      var recipe = this;
      var result = paintInsetShape(this, options, cx, cy, function (inset) {
        var pathRx = Math.max(0, rx - inset);
        var pathRy = Math.max(0, ry - inset);
        recipe
          ._movePdf(x - pathRx, y)
          ._curvePdf(
            x - pathRx,
            y - pathRy * k,
            x - pathRx * k,
            y - pathRy,
            x,
            y - pathRy,
          )
          ._curvePdf(
            x + pathRx * k,
            y - pathRy,
            x + pathRx,
            y - pathRy * k,
            x + pathRx,
            y,
          )
          ._curvePdf(
            x + pathRx,
            y + pathRy * k,
            x + pathRx * k,
            y + pathRy,
            x,
            y + pathRy,
          )
          ._curvePdf(
            x - pathRx * k,
            y + pathRy,
            x - pathRx,
            y + pathRy * k,
            x - pathRx,
            y,
          );
      });
      addLink(this, options, cx - rx, cy - ry, rx * 2, ry * 2);
      return result;
    },
    /**
     * Draws a circular arc centered at `(x, y)`.
     *
     * Coordinates use Recipe's top-left origin. Angles are degrees measured
     * clockwise; negative values run counterclockwise. An active page is required.
     *
     * @name arc
     * @function
     * @memberof Recipe#
     * @param {number} x - The center X coordinate in points.
     * @param {number} y - The center Y coordinate in points.
     * @param {number} radius - The radius in points.
     * @param {number} [startAngle=0] - The starting angle in degrees.
     * @param {number} [endAngle=360] - The ending angle in degrees.
     * @param {RecipeArcOptions} [options] - Arc path, sector, and transformation options.
     * @returns {Recipe} The recipe instance.
     * @throws {Error} If no target page is available or an unsupported color is requested.
     * @throws {TypeError} If the requested color space is unknown.
     */
    arc: function (x, y, radius, startAngle = 0, endAngle = 360, options = {}) {
      var point = this._calibrateCoordinate(x, y);
      var recipe = this;
      var result = paintInsetShape(this, options, x, y, function (inset) {
        curve(
          recipe,
          point.nx,
          point.ny,
          Math.max(0, radius - inset),
          (-startAngle * Math.PI) / 180,
          (-endAngle * Math.PI) / 180,
        );
        if (options.sector) {
          recipe._linePdf(point.nx, point.ny);
          if (recipe._pageContext) recipe._pageContext.h();
          else
            runtime.call("_muhammara_wasm_recipe_close_path", recipe._recipe);
        }
      });
      addLink(this, options, x - radius, y - radius, radius * 2, radius * 2);
      return result;
    },
    /**
     * Draws a closed circular sector centered at `(x, y)`.
     *
     * Coordinates use Recipe's top-left origin. Angles are degrees measured
     * clockwise; negative values run counterclockwise. An active page is required.
     *
     * @name pie
     * @function
     * @memberof Recipe#
     * @param {number} x - The center X coordinate in points.
     * @param {number} y - The center Y coordinate in points.
     * @param {number} radius - The radius in points.
     * @param {number} [startAngle=0] - The starting angle in degrees.
     * @param {number} [endAngle=360] - The ending angle in degrees.
     * @param {RecipePathOptions} [options] - Path painting and transformation options.
     * @returns {Recipe} The recipe instance.
     * @throws {Error} If no target page is available or an unsupported color is requested.
     * @throws {TypeError} If the requested color space is unknown.
     */
    pie: function (x, y, radius, startAngle, endAngle, options = {}) {
      return this.arc(x, y, radius, startAngle, endAngle, {
        ...options,
        sector: true,
      });
    },
    /**
     * Sets the default line width for subsequent Recipe paths.
     *
     * This updates the stored graphics state and applies it immediately when a
     * page context is active.
     *
     * @name lineWidth
     * @function
     * @memberof Recipe#
     * @param {number} width - The line width in points.
     * @returns {Recipe} The recipe instance.
     */
    lineWidth: function (width) {
      return this.lineStyle({ width });
    },
    /**
     * Compatibility method for filling the current path; currently a no-op.
     *
     * @name fill
     * @function
     * @memberof Recipe#
     * @returns {Recipe} The recipe instance.
     */
    fill: function () {
      return this;
    },
    /**
     * Compatibility method for stroking the current path; currently a no-op.
     *
     * @name stroke
     * @function
     * @memberof Recipe#
     * @returns {Recipe} The recipe instance.
     */
    stroke: function () {
      return this;
    },
    /**
     * Compatibility method for filling and stroking the current path; currently a no-op.
     *
     * @name fillAndStroke
     * @function
     * @memberof Recipe#
     * @returns {Recipe} The recipe instance.
     */
    fillAndStroke: function () {
      return this;
    },
  };
}
