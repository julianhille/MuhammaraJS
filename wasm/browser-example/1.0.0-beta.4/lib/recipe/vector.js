/** Creates Recipe vector shape and path methods. */
export function createVectorMethods(runtime) {
  function addLink(recipe, options, x, y, width, height) {
    if (!options.link) return;
    if (options.useGivenCoords)
      recipe._linkPdf(options.link, x, y, width, height);
    else recipe.link(options.link, x, y, width, height);
  }

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
      this._beginPath(options, x, y);
      var point = options.useGivenCoords
        ? { nx: x, ny: y }
        : this._calibrateCoordinate(x, y, 0, -height);
      if (this._pageContext) {
        this._pageContext.re(point.nx, point.ny, width, height);
        var result = this._finishPath(options);
        addLink(this, options, x, y, width, height);
        return result;
      }
      runtime.call(
        "_muhammara_wasm_recipe_rectangle_path",
        this._recipe,
        point.nx,
        point.ny,
        width,
        height,
      );
      var result = this._finishPath(options);
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
      var [topLeft, topRight, bottomRight, bottomLeft] = radii;
      this._beginPath(options, x, y);
      var point = options.useGivenCoords
        ? { nx: x, ny: y }
        : this._calibrateCoordinate(x, y, 0, -height);
      x = point.nx;
      var bottom = point.ny;
      var right = x + width;
      var top = bottom + height;
      var k = 0.551784;
      this._movePdf(x + bottomLeft, bottom)
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
        ._linePdf(x + topLeft, top)
        ._curvePdf(
          x + topLeft - topLeft * k,
          top,
          x,
          top - topLeft + topLeft * k,
          x,
          top - topLeft,
        )
        ._linePdf(x, bottom + bottomLeft)
        ._curvePdf(
          x,
          bottom + bottomLeft - bottomLeft * k,
          x + bottomLeft - bottomLeft * k,
          bottom,
          x + bottomLeft,
          bottom,
        );
      if (this._pageContext) this._pageContext.h();
      else runtime.call("_muhammara_wasm_recipe_close_path", this._recipe);
      var result = this._finishPath(options);
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
      return this.ellipse(x, y, radius, radius, options);
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
      this._beginPath(options, cx, cy);
      this._movePdf(x - rx, y)
        ._curvePdf(x - rx, y - ry * k, x - rx * k, y - ry, x, y - ry)
        ._curvePdf(x + rx * k, y - ry, x + rx, y - ry * k, x + rx, y)
        ._curvePdf(x + rx, y + ry * k, x + rx * k, y + ry, x, y + ry)
        ._curvePdf(x - rx * k, y + ry, x - rx, y + ry * k, x - rx, y);
      var result = this._finishPath(options);
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
      this._beginPath(options, x, y);
      var point = this._calibrateCoordinate(x, y);
      curve(
        this,
        point.nx,
        point.ny,
        radius,
        (-startAngle * Math.PI) / 180,
        (-endAngle * Math.PI) / 180,
      );
      if (options.sector) {
        this._linePdf(point.nx, point.ny);
        if (this._pageContext) this._pageContext.h();
        else runtime.call("_muhammara_wasm_recipe_close_path", this._recipe);
      }
      var result = this._finishPath(options);
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
