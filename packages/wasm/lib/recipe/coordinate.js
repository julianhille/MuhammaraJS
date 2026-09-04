/** Recipe coordinate conversion methods. */
export var coordinateMethods = {
  _centrify: function (x, y, pageNumber) {
    var page = this.pageInfo(
      pageNumber || this._activePageNumber || this._pages.length,
    );
    if (!page) return [x, y];
    return [
      x === "center" ? page.width / 2 : x,
      y === "center" ? page.height / 2 : y,
    ];
  },

  /**
   * Converts top-left Recipe coordinates to bottom-left PDF coordinates.
   *
   * @returns {{nx: number, ny: number}} Coordinates with the Y axis flipped.
   * @throws {Error} When no target page is available.
   */
  _calibrateCoordinate: function (x, y, offsetX = 0, offsetY = 0, pageNumber) {
    var page = this.pageInfo(
      pageNumber || this._activePageNumber || this._pages.length,
    );
    if (!page) throw new Error("A page is required for coordinates");
    [x, y] = this._centrify(x, y, pageNumber);
    return {
      nx: x + offsetX + page.offsetX,
      ny: page.height - y + offsetY + page.offsetY,
    };
  },

  _reverseCoordinate: function (x, y, offsetX = 0, offsetY = 0, pageNumber) {
    var page = this.pageInfo(
      pageNumber || this._activePageNumber || this._pages.length,
    );
    if (!page) throw new Error("A page is required for coordinates");
    return {
      ox: x - offsetX - page.offsetX,
      oy: page.height - (y - page.offsetY) - offsetY,
    };
  },

  _calibrateCoordinateForAnnots: function (
    x,
    y,
    offsetX = 0,
    offsetY = 0,
    pageNumber,
  ) {
    var page = this.pageInfo(
      pageNumber || this._activePageNumber || this._pages.length,
    );
    var point = this._calibrateCoordinate(x, y, offsetX, offsetY, pageNumber);
    var nx = point.nx;
    var ny = point.ny;
    if (page.rotate === 90) {
      nx = page.height - page.offsetX - point.ny;
      ny = page.offsetY + point.nx;
    } else if (page.rotate === 180) {
      nx = page.width - point.nx;
      ny = page.height - point.ny;
    } else if (page.rotate === 270) {
      nx = page.offsetX + point.ny;
      ny = page.width - page.offsetY - point.nx;
    }
    return { nx, ny };
  },
};
