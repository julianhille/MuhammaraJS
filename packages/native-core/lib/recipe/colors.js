const muhammara = require("../muhammara");
const fs = require("fs");
const { Colorspace, ChromaCommand } = require("../recipe-constants");

this.knownColors = {
  // knownColors.colorspace.colorName = value
  rgb: {
    red: "ff0000",
    green: "00ff00",
    blue: "0000ff",
  },
  cmyk: {
    cyan: "ff000000",
    magenta: "00ff0000",
    yellow: "0000ff00",
    black: "000000ff",
  },
  gray: {
    white: "ff",
    black: "00",
  },
  separation: {
    // meant for printing, so using cmyk values initially
    cyan: "ff000000",
    magenta: "00ff0000",
    yellow: "0000ff00",
    black: "000000ff",
    nans: "%,35,6,0", // a great PDF collaborator!
  },
};

/**
 * Associate color values to names
 *
 * The colorspace parameter is optional. When it is missing, the colorspace
 * is automatically determined by the given color value. Note that the special
 * PDF color space called 'separation' may also be used. The color value is then
 * treated as the alternative color when the named 'separation' color is unavailable.
 *
 * If the 'name' parameter is `Recipe.ChromaCommand.LOAD` ('!load'), the second parameter is the name of a JSON
 * formatted file containing a formatted list of defined colors associated with the
 * color spaces rgb, cmyk, gray, or separation (think PANTONE color definitions).
 * This file will be merged with existing set of known colors. The color values
 * must be specified as hex values.
 *
 * For example,
 *   {
 *      'rgb':  {'purple':'ff00ff', 'red':'#ff0000'},
 *      'cmyk': {'cyan':'ff000000', 'magenta':'%0,100,0,0'},
 *      'gray': {'grey':'#33'}
 *   }
 *
 * @name chroma
 * @function
 * @memberof Recipe#
 * @param {string} name - the name to be associated to given color value, or `Recipe.ChromaCommand.LOAD`
 * @param {string|number[]} value - the color value (HexColor, DecimalColor, or PercentColor), or the path of the JSON file to load
 * @param {Recipe.Colorspace|""} [colorspace=''] - One of the `Recipe.Colorspace`
 *   values; empty picks gray, rgb or cmyk from the value length.
 * @returns {Recipe} The recipe instance.
 * @throws {Error} If the file to load cannot be read or is not valid JSON.
 * @throws {Error} If a loaded color definition has an unrecognized colorspace.
 * @throws {Error} If a color value has an invalid size.
 * @throws {TypeError} If the colorspace is unknown.
 */
exports.chroma = function chroma(name, value, colorspace = "") {
  if (name) {
    if (name === ChromaCommand.LOAD) {
      let newColors = JSON.parse(fs.readFileSync(value));
      // Add new colors to existing colorspaces
      for (let cs in newColors) {
        if (this.knownColors[cs]) {
          Object.assign(this.knownColors[cs], newColors[cs]);
        } else {
          throw new Error(`Unrecognized colorspace: ${cs}`);
        }
      }
    } else {
      if (Array.isArray(value)) {
        value = arrayToHex(value);
      } else if (value.startsWith("%")) {
        value = percentToHex(value.replace("%", ""));
      } else {
        value = value.replace("#", "");
      }

      // Only deal with valid hex codes from the
      // device colorspaces gray, rgb, and cmyk.
      if (![2, 6, 8].includes(value.toString().length)) {
        throw new Error(
          "Color value has incorrect size for gray, rgb, or cmyk colorspaces",
        );
      }

      // Determine colorspace by length of given input
      // value when colorspace not provided in call.
      if (colorspace === "") {
        const colorSpaces = {
          2: Colorspace.GRAY,
          6: Colorspace.RGB,
          8: Colorspace.CMYK,
        };
        colorspace = colorSpaces[`${value.length}`];
      } else if (!Object.values(Colorspace).includes(colorspace)) {
        throw new TypeError(`Unknown colorspace: ${colorspace}`);
      }

      if (colorspace) {
        this.knownColors[colorspace][name] = value;
      }
    }
  }

  return this;
};

/**
 * Write a Separation color space for a named color once per Recipe and
 * return its object ID.
 * @private
 * @param {Recipe} self - The recipe instance that owns the cache.
 * @param {string} colorName - The separation color name.
 * @param {number[]} color - The alternate device color components, 0 to 1.
 * @returns {number} The object ID of the Separation color space.
 */
function createColorSpaces(self, colorName, color) {
  const deviceCS = { 1: "DeviceGray", 3: "DeviceRGB", 4: "DeviceCMYK" };
  const altCS = deviceCS[`${color.length}`];
  // Cache per Recipe: the IDs belong to this Recipe's PDF writer.
  self.colorSpaces = self.colorSpaces || {};
  self.colorSpaces[altCS] = self.colorSpaces[altCS] || {};
  let colorSpaceID = self.colorSpaces[altCS][colorName];

  if (!colorSpaceID) {
    const transformFunction = tintTransform(self, color);
    self.pauseContext();
    const objCxt = self.writer.getObjectsContext();
    colorSpaceID = objCxt.startNewIndirectObject();
    objCxt
      .startArray()
      .writeName("Separation")
      .writeName(colorName)
      .writeName(altCS)
      .writeIndirectObjectReference(transformFunction)
      .endArray(muhammara.eTokenSeparatorEndLine)
      .endIndirectObject();
    self.resumeContext();
    self.colorSpaces[altCS][colorName] = colorSpaceID;
  }

  return colorSpaceID;
}

/**
 * Write the type 2 tint transform function that maps a separation tint to
 * its alternate device color.
 * @private
 * @param {Recipe} self - The recipe instance.
 * @param {number[]} color - The alternate device color components, 0 to 1.
 * @returns {number} The object ID of the function.
 */
function tintTransform(self, color) {
  const rangeCount = color.length;
  self.pauseContext();
  const objCxt = self.writer.getObjectsContext();
  const tintFuncID = objCxt.startNewIndirectObject();
  const dict = objCxt.startDictionary();
  dict.writeKey("FunctionType").writeNumberValue(2).writeKey("Domain");
  objCxt.startArray().writeNumber(0.0).writeNumber(1.0).endArray();
  dict.writeKey("Range");
  objCxt.startArray();
  for (let index = 0; index < rangeCount; index++) {
    objCxt.writeNumber(0.0).writeNumber(1.0);
  }
  objCxt.endArray();
  dict.writeKey("N");
  dict.writeNumberValue(1);
  dict.writeKey("C0");
  objCxt.startArray();
  for (let index = 0; index < rangeCount; index++) {
    objCxt.writeNumber(0.0);
  }
  objCxt.endArray();

  dict.writeKey("C1");
  objCxt.startArray();
  for (let index = 0; index < rangeCount; index++) {
    objCxt.writeNumber(color[index]);
  }
  objCxt.endArray();
  objCxt.endDictionary(dict);
  objCxt.endIndirectObject();
  self.resumeContext();

  return tintFuncID;
}

/**
 * Write the stroke and fill opacity graphics states for a value once per
 * Recipe.
 * @private
 * @param {number} value - The opacity, from 0 to 1.
 * @returns {{stroke: number, fill: number}} The object IDs of the stroking
 *   (CA) and non-stroking (ca) ExtGState dictionaries.
 */
exports._createExtGStates = function _createExtGStates(value) {
  this.extGStates = this.extGStates || {};
  if (this.extGStates[value]) {
    return this.extGStates[value];
  }

  const write = (key, value) => {
    this.pauseContext();
    const objCxt = this.writer.getObjectsContext();
    const gsId = objCxt.startNewIndirectObject();
    const dict = objCxt.startDictionary();
    dict.writeKey("Type");
    dict.writeNameValue("ExtGState");
    dict.writeKey(key);
    objCxt.writeNumber(value);
    objCxt.endLine();
    objCxt.endDictionary(dict);
    objCxt.endIndirectObject(); // new here [seh]
    this.resumeContext();
    return gsId;
  };
  this.extGStates[value] = {
    stroke: write("CA", value),
    fill: write("ca", value),
  };
  return this.extGStates[value];
};

/**
 * The hex color used when a color value is missing or invalid.
 * @private
 * @param {Recipe.Colorspace} [colorspace=Recipe.Colorspace.RGB] - The colorspace.
 * @returns {string} The default color as a hex string without '#'.
 */
function _defaultColor(colorspace = Colorspace.RGB) {
  let defaultColor;
  switch (colorspace) {
    case Colorspace.CMYK:
      defaultColor = "FF000000";
      break;
    case Colorspace.GRAY:
      defaultColor = "00";
      break;
    case Colorspace.RGB:
    default:
      defaultColor = "1777d1";
      break;
  }

  return defaultColor;
}

/**
 * Convert given color code int color model object
 *
 * ColorModel consists of: {
 *   color: number,
 *   colorspace: string {'rgb', 'cmyk', 'gray'},
 *   (colorspace == 'rgb')  r, g, b
 *   (colorspace == 'cmyk') c, m, y, k
 *   (colorspace == 'gray') gray
 * }
 *
 * where r,g,b,c,m,y,k,gray are all numbers between 0 and 1
 *
 * @private
 * @param {Recipe} self The recipe instance.
 * @param {string} code the color encoding as HexColor
 * @param {Recipe.Colorspace} colorspace the name of the colorspace of given color code
 * @param {string} colorName the name to be associated with given color code
 * @returns {Object} The color model.
 */
function toColorModel(self, code, colorspace, colorName) {
  const cmodel = {};
  let color = hexToArray(code);

  cmodel.color = parseInt(code, 16);

  // The initial decider of color space is length of given 'code'.

  switch (color.length) {
    default:
      color = hexToArray(_defaultColor(Colorspace.RGB));
    // purposely want to fall through to 'rgb' case below.
    case 3:
      cmodel.colorspace = Colorspace.RGB;
      cmodel.r = color[0];
      cmodel.g = color[1];
      cmodel.b = color[2];
      break;

    case 4:
      cmodel.colorspace = Colorspace.CMYK;
      cmodel.c = color[0];
      cmodel.m = color[1];
      cmodel.y = color[2];
      cmodel.k = color[3];
      break;

    case 1:
      cmodel.colorspace = Colorspace.GRAY;
      cmodel.gray = color[0];
      break;
  }

  // When creating a separation color space,
  // use the colorspace from above as the
  // alternative color transformation when
  // the named color is unavailable.
  if (colorspace === Colorspace.SEPARATION && colorName !== "") {
    cmodel.colorspace = colorspace;
    cmodel.colorName = colorName;
    cmodel.colorspaceId = createColorSpaces(self, colorName, color);
  }

  return cmodel;
}

/**
 * Convert percentage string into hex string (x / 100 * 255)
 *
 * @private
 * @param {string} code numbers separated by commas with values ranging between 0-100.
 * @returns {string} massaged hexadecimal string that can be used as input to hexToArray.
 */
function percentToHex(code) {
  return arrayToHex(code.split(",").map((x) => Math.round(x * 2.55)));
}

/**
 * Transform color code into a numeric value or color model.
 *
 * @private
 * @param {string|number[]} [code=''] Color specification in the form of HexColor (string beginning with '#'),
 *             DecimalColor (1, 3, or 4 element array with values between 0-255),
 *             PercentColor (string, begins with '%' followed by values separated
 *             by commas with values between 0-100), or a color name known to
 *             `chroma()`
 * @param {Object} [opt] - The options.
 * @param {Recipe.Colorspace} [opt.colorspace] - The colorspace; when omitted it
 *   is picked from the value length.
 * @param {boolean} [opt.wantColorModel=false] - Return a color model instead of a number.
 * @param {string} [opt.colorName] - The name to record the color under.
 * @returns {number|Object} The color as a number, or the color model when
 *   `opt.wantColorModel` is set. Invalid values fall back to the default color.
 * @throws {TypeError} If `opt.colorspace` is not a `Recipe.Colorspace` value.
 */
exports._transformColor = function _transformColor(code = "", opt = {}) {
  this.knownColors = this.knownColors || {};
  if (opt.colorspace && !Object.values(Colorspace).includes(opt.colorspace)) {
    throw new TypeError(`Unknown colorspace: ${opt.colorspace}`);
  }
  let colorspace = opt.colorspace || Colorspace.RGB;
  let wantColorModel = opt.wantColorModel || false;
  let colorName = opt.colorName || "";
  let defaultColor = _defaultColor(colorspace);
  let transformation;

  if (Array.isArray(code)) {
    code = arrayToHex(code);
  } else if (code.startsWith("#")) {
    code = code.replace("#", "");
  } else if (code.startsWith("%")) {
    code = percentToHex(code.replace("%", ""));
  } else if (code !== "") {
    let color = this.knownColors[colorspace][code]; // assuming code is a color name
    if (!color) {
      color = "";
      code = defaultColor;
    } else {
      colorName = code;

      // The following handles known colors in hex form,
      // with or without initial '#' and percent form.
      if (color.startsWith("#")) {
        code = color.replace("#", "");
      } else if (color.startsWith("%")) {
        code = percentToHex(color.replace("%", ""));
      } else {
        code = color;
      }
    }
  }

  // When colorspace is not explicitly given,
  // use size of value to determine colorspace.
  if (!opt.colorspace) {
    colorspace =
      { 2: Colorspace.GRAY, 6: Colorspace.RGB, 8: Colorspace.CMYK }[
        `${code.length}`
      ] || Colorspace.RGB;
    defaultColor = _defaultColor(colorspace);
  }

  // Suppply default color:
  //  when colorspace is given and given color code does not have appropriate length, or
  //  when colorspace is missing, verify allowable hex value sizes for rgb, cmyk, or gray.
  if (
    ([Colorspace.RGB, Colorspace.CMYK, Colorspace.GRAY].includes(colorspace) &&
      code.length != defaultColor.length) ||
    ![2, 6, 8].includes(code.toString().length)
  ) {
    code = defaultColor;
  }

  if (wantColorModel) {
    transformation = toColorModel(this, code, colorspace, colorName);
    if (colorName && !this.knownColors[colorspace][colorName]) {
      this.chroma(colorName, code, colorspace);
    }
  } else {
    transformation = parseInt(`0x${code.toUpperCase()}`, 16);
  }

  return transformation;
};

/**
 * Convert DecimalColor components (0 to 255) to a hex string.
 * @private
 * @param {number[]} [color] - The color components.
 * @returns {string} The hex string without '#'.
 */
function arrayToHex(color = []) {
  let code = "";
  color.forEach((item) => {
    let hex = item.toString(16);
    hex = hex.length == 1 ? "0" + hex : hex;
    code += hex;
  });
  return code;
}

/**
 * Convert a 2, 6 or 8 digit hex color to components between 0 and 1.
 * @private
 * @param {string} hex - The hex color, with or without '#'.
 * @returns {number[]} One gray, three RGB or four CMYK components.
 * @throws {TypeError} If the value is not a 2, 4, 6 or 8 digit hex string.
 */
function hexToArray(hex) {
  const result =
    /^#?([a-f\d]{2})([a-f\d]{2})?([a-f\d]{2})?([a-f\d]{2})?$/i.exec(hex);
  return result.reduce((array, item, index) => {
    if (index >= 1 && index <= hex.length / 2) {
      array.push(parseInt(item, 16) / 255);
    }
    return array;
  }, []);
}

/**
 * Split an RGB color number into its 0 to 255 components.
 * @private
 * @param {number} bigint - The color as 0xRRGGBB.
 * @returns {{r: number, g: number, b: number}} The components; black for 0 or
 *   a missing value.
 */
exports._colorNumberToRGB = (bigint) => {
  if (!bigint) {
    return {
      r: 0,
      g: 0,
      b: 0,
    };
  } else {
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  }
};
