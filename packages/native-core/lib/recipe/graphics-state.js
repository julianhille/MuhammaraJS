/**
 * Rotate subsequent content around a point in Recipe coordinates.
 * @name rotateContent
 * @function
 * @memberof Recipe#
 * @param {number} degrees - Clockwise rotation in degrees.
 * @param {number} [x=0] - Rotation origin x coordinate.
 * @param {number} [y=0] - Rotation origin y coordinate.
 * @returns {Recipe} The recipe instance.
 */
exports.rotateContent = function rotateContent(degrees, x = 0, y = 0) {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const point = this._calibrateCoordinate(x, y);
  this.pageContext.cm(1, 0, 0, 1, point.nx, point.ny);
  this.pageContext.cm(cosine, sine, -sine, cosine, 0, 0);
  this.pageContext.cm(1, 0, 0, 1, -point.nx, -point.ny);
  return this;
};
