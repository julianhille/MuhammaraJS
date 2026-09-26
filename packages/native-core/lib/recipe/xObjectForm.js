const { Colorspace } = require("../recipe-constants");

/**
 * Writes device color operators for a color model.
 * @private
 */
const Color = class Color {
  /** Not meant to be instantiated; use the static methods. */
  constructor() {}

  /**
   * Set the fill color.
   * @param {Object} ctx - The content context.
   * @param {Object} colorModel - The color model from _transformColor().
   * @returns {void}
   */
  static fill(ctx, colorModel) {
    switch (colorModel.colorspace) {
      case Colorspace.RGB:
        ctx.rg(colorModel.r, colorModel.g, colorModel.b);
        break;

      case Colorspace.CMYK:
        ctx.k(colorModel.c, colorModel.m, colorModel.y, colorModel.k);
        break;

      case Colorspace.GRAY:
        ctx.g(colorModel.gray);
        break;
    }
  }

  /**
   * Set the stroke color.
   * @param {Object} ctx - The content context.
   * @param {Object} colorModel - The color model from _transformColor().
   * @returns {void}
   */
  static stroke(ctx, colorModel) {
    switch (colorModel.colorspace) {
      case Colorspace.RGB:
        ctx.RG(colorModel.r, colorModel.g, colorModel.b);
        break;

      case Colorspace.CMYK:
        ctx.K(colorModel.c, colorModel.m, colorModel.y, colorModel.k);
        break;

      case Colorspace.GRAY:
        ctx.G(colorModel.gray);
        break;
    }
  }
};

exports.Color = Color;

/**
 * Creates a writer form XObject extended with Recipe helpers; the
 * constructor returns the form itself.
 * @private
 */
exports.xObjectForm = class xObjectForm {
  /**
   * @param {Object} pdfWriter - The PDF writer.
   * @param {number} [width=100] - The form width.
   * @param {number} [height=100] - The form height.
   */
  constructor(pdfWriter, width = 100, height = 100) {
    const xObject = pdfWriter.createFormXObject(0, 0, width, height);
    xObject.pdfWriter = pdfWriter;
    xObject.getGsName = this.getGsName;
    xObject.getCsName = this.getCsName;
    xObject.end = this.end;
    xObject.get = this.get;
    xObject.set = this.set;
    xObject.fill = this.fill;
    xObject.stroke = this.stroke;
    return xObject;
  }

  set(key, value) {
    this._values = this._values || {};
    this._values[key] = value;
  }

  get(key) {
    this._values = this._values || {};
    return this._values[key];
  }

  getGsName(gsId) {
    const resourcesDict = this.getResourcesDictinary();
    const gsName = resourcesDict.addExtGStateMapping(gsId);
    return gsName;
  }

  getCsName(csId) {
    const resourcesDict = this.getResourcesDictinary();
    const csName = resourcesDict.addColorSpaceMapping(csId);
    return csName;
  }

  end() {
    this.pdfWriter.endFormXObject(this);
  }

  fill(colorModel) {
    const ctx = this.getContentContext();
    switch (colorModel.colorspace) {
      default:
        Color.fill(ctx, colorModel);
        break;

      case "separation":
        ctx.cs(this.getCsName(colorModel.colorspaceId));
        ctx.scn(1);
        break;
    }
    return this;
  }

  stroke(colorModel) {
    const ctx = this.getContentContext();
    switch (colorModel.colorspace) {
      default:
        Color.stroke(ctx, colorModel);
        break;

      case "separation":
        ctx.CS(this.getCsName(colorModel.colorspaceId));
        ctx.SCN(1);
        break;
    }
    return this;
  }
};
