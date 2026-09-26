import { Colorspace, ChromaCommand } from "../value-sets.js";
import { PAGE_CONTEXT_STATE } from "./context-state.js";

/** Device color space of a hex color code, keyed by its length. */
var deviceColorspaceByLength = {
  2: Colorspace.GRAY,
  6: Colorspace.RGB,
  8: Colorspace.CMYK,
};

/** Hex code length of each device color space. */
var codeLengthByColorspace = {
  [Colorspace.GRAY]: 2,
  [Colorspace.RGB]: 6,
  [Colorspace.CMYK]: 8,
};

/** Color used for a missing or invalid value in each device color space. */
var defaultCodeByColorspace = {
  [Colorspace.GRAY]: "00",
  [Colorspace.RGB]: "1777d1",
  [Colorspace.CMYK]: "ff000000",
};

/** PDF names of the Separation alternate color spaces. */
var alternateColorspaceNames = {
  [Colorspace.GRAY]: "DeviceGray",
  [Colorspace.RGB]: "DeviceRGB",
  [Colorspace.CMYK]: "DeviceCMYK",
};

/** Built-in Recipe colors grouped by color space. */
export var knownColors = {
  [Colorspace.RGB]: { red: "ff0000", green: "00ff00", blue: "0000ff" },
  [Colorspace.CMYK]: {
    cyan: "ff000000",
    magenta: "00ff0000",
    yellow: "0000ff00",
    black: "000000ff",
  },
  [Colorspace.GRAY]: { white: "ff", black: "00", grey: "00" },
  [Colorspace.SEPARATION]: {
    cyan: "ff000000",
    magenta: "00ff0000",
    yellow: "0000ff00",
    black: "000000ff",
  },
};

/**
 * Reports whether a value is a Recipe colorspace. Checking the `Colorspace`
 * values, as native does, keeps inherited keys such as `__proto__` out.
 * @param {string} colorspace - The requested colorspace.
 * @returns {boolean} Whether it is a `Colorspace` value.
 */
function isColorspace(colorspace) {
  return Object.values(Colorspace).includes(colorspace);
}

/**
 * Converts a Recipe color to its hex digits without a prefix.
 * @param {RecipeColor} value - `[r, g, b]` or `[c, m, y, k]` from 0 to 255, `#hex`, `%hex`, or a number.
 * @returns {string} Hex digits; empty for unsupported values.
 */
function hex(value) {
  if (Array.isArray(value))
    return value
      .map((part) =>
        Math.max(0, Math.min(255, Math.round(part)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  if (typeof value !== "string") return "";
  if (value.startsWith("%"))
    return hex(
      value
        .slice(1)
        .split(",")
        .map((part) => Number(part) * 2.55),
    );
  return value.replace(/^#/, "");
}

/**
 * Resolves a Recipe color value to a color-space model. As in native Recipe,
 * a separation color needs an ink name: a name registered for the separation
 * colorspace, or the `colorName` option, which registers the value under that
 * name. Other separation values use the device color space of their length.
 * @param {Recipe} recipe - Recipe instance with known colors.
 * @param {RecipeColor} value - Color value or registered name.
 * @param {object} [options={}] - Options with `colorspace` and `colorName`.
 * @returns {{colorspace: RecipeColorSpace, values: number[], name: string, alternate: (DeviceColorSpace|undefined)}} Components from 0 to 1.
 * @throws {TypeError} If the color space is unknown.
 */
export function colorModel(recipe, value, options = {}) {
  var colorspace = options.colorspace || recipe.options.colorspace || "";
  if (colorspace && !isColorspace(colorspace))
    throw new TypeError(`Unknown colorspace: ${colorspace}`);
  var name = "";
  var registered = false;
  if (
    typeof value === "string" &&
    !value.startsWith("#") &&
    !value.startsWith("%")
  ) {
    name = value;
    var colors = recipe.knownColors[colorspace || Colorspace.RGB];
    registered = Object.hasOwn(colors, value);
    var known = registered ? colors[value] : undefined;
    value = known || value;
  }
  var code = hex(value || "");
  if (!colorspace)
    colorspace = deviceColorspaceByLength[code.length] || Colorspace.RGB;
  var separationName = registered ? name : options.colorName || "";
  var separation =
    colorspace === Colorspace.SEPARATION && separationName !== "";
  if (colorspace === Colorspace.SEPARATION)
    colorspace = deviceColorspaceByLength[code.length] || Colorspace.RGB;
  if (
    code.length !== codeLengthByColorspace[colorspace] ||
    !/^[0-9a-f]+$/i.test(code)
  ) {
    code = defaultCodeByColorspace[colorspace];
  }
  var values = code.match(/../g).map((part) => Number.parseInt(part, 16) / 255);
  if (separation) {
    if (
      !registered &&
      !Object.hasOwn(recipe.knownColors.separation, separationName)
    )
      recipe.knownColors.separation[separationName] = code;
    return {
      colorspace: Colorspace.SEPARATION,
      alternate: colorspace,
      values,
      name: separationName,
    };
  }
  return { colorspace, values, name };
}

/** Creates the Recipe methods that write and select Separation colors. */
export function createSeparationMethods({
  module,
  rawObjectsContext,
  withString,
  withDoubles,
}) {
  /** Writes the type 2 function mapping a tint to its alternate color. */
  function writeTintTransform(objects, values) {
    var id = objects.startNewIndirectObject();
    var dictionary = objects.startDictionary();
    dictionary.writeKey("FunctionType").writeNumberValue(2);
    dictionary.writeKey("Domain");
    objects.startArray().writeNumber(0).writeNumber(1).endArray();
    dictionary.writeKey("Range");
    objects.startArray();
    values.forEach(() => objects.writeNumber(0).writeNumber(1));
    objects.endArray();
    dictionary.writeKey("N").writeNumberValue(1);
    dictionary.writeKey("C0");
    objects.startArray();
    values.forEach(() => objects.writeNumber(0));
    objects.endArray();
    dictionary.writeKey("C1");
    objects.startArray();
    values.forEach((value) => objects.writeNumber(value));
    objects.endArray();
    objects.endDictionary(dictionary);
    objects.endIndirectObject();
    return id;
  }

  /** Reads and frees a resource name returned by the native mapping. */
  function mapColorspace(resources, objectId) {
    var result = module._muhammara_wasm_resources_add_mapping(
      resources,
      2,
      objectId,
    );
    if (!result) throw new Error("Unable to add color space resource");
    try {
      var length = 0;
      while (module.HEAPU8[result + length]) length += 1;
      return new TextDecoder().decode(
        module.HEAPU8.subarray(result, result + length),
      );
    } finally {
      module._muhammara_wasm_free(result);
    }
  }

  return {
    /**
     * Returns the objects context of this Recipe's writer.
     * @private
     */
    _objectsContext: function () {
      if (this._sourceMode) return this.writer.getObjectsContext();
      if (!this._rawObjects) {
        var handle = module._muhammara_wasm_recipe_get_objects_context(
          this._recipe,
        );
        if (!handle) throw new Error("Unable to get objects context");
        this._rawObjects = rawObjectsContext(handle, () => {
          if (!this._recipe) throw new Error("Recipe has been disposed");
        });
      }
      return this._rawObjects;
    },

    /**
     * Returns the object ID of a Separation model's color space, writing the
     * color space and its tint transform once per Recipe. An active page
     * content stream is paused while the objects are written, so call this
     * before starting a path or text object.
     * @private
     */
    _separationColorspace: function (model) {
      this._separationColorspaces = this._separationColorspaces || new Map();
      var key = `${model.alternate}:${model.name}`;
      var id = this._separationColorspaces.get(key);
      if (id) return id;
      var active =
        this._contextState === PAGE_CONTEXT_STATE.ACTIVE_NEW ||
        this._contextState === PAGE_CONTEXT_STATE.ACTIVE_EDIT;
      if (active) this.pauseContext();
      try {
        var objects = this._objectsContext();
        var tintTransform = writeTintTransform(objects, model.values);
        id = objects.startNewIndirectObject();
        objects
          .startArray()
          .writeName("Separation")
          .writeName(model.name)
          .writeName(alternateColorspaceNames[model.alternate])
          .writeIndirectObjectReference(tintTransform)
          .endArray();
        objects.endIndirectObject();
      } finally {
        if (active) this.resumeContext();
      }
      this._separationColorspaces.set(key, id);
      return id;
    },

    /**
     * Writes the Separation color spaces a drawing will select, before any of
     * its content is emitted.
     * @private
     */
    _prepareSeparationColors: function (options = {}) {
      [options.fill, options.stroke || options.color || options.colour].forEach(
        (value) => {
          if (value === undefined) return;
          var model = colorModel(this, value, options);
          if (model.colorspace === Colorspace.SEPARATION)
            this._separationColorspace(model);
        },
      );
    },

    /**
     * Selects a Separation model at full tint for filling or stroking.
     * @private
     */
    _setSeparationColor: function (model, stroke) {
      var id = this._separationColorspace(model);
      if (this._pageContext) {
        var resources = this._editingPage
          ? this._page.getResourcesDictionary()
          : this._page._getNativeResources();
        var name = resources.addColorSpaceMapping(id);
        if (stroke) this._pageContext.CS(name).SCN(1);
        else this._pageContext.cs(name).scn(1);
        return;
      }
      var handle = module._muhammara_wasm_recipe_get_page_resources(
        this._recipe,
      );
      if (!handle) throw new Error("Unable to get page resources");
      var resourceName = mapColorspace(handle, id);
      withString(resourceName, (namePointer) => {
        if (
          !module._muhammara_wasm_recipe_structured_operator(
            this._recipe,
            stroke ? 3 : 4,
            namePointer,
            0,
            0,
            0,
          )
        )
          throw new Error("Unable to select the separation color space");
      });
      withDoubles([1], (components) =>
        withString("", (namePointer) => {
          if (
            !module._muhammara_wasm_recipe_structured_operator(
              this._recipe,
              stroke ? 6 : 8,
              namePointer,
              components,
              1,
              0,
            )
          )
            throw new Error("Unable to set the separation tint");
        }),
      );
    },
  };
}

/**
 * Creates Recipe color registration methods.
 * @returns {object} Methods mixed into Recipe.prototype.
 */
export function createColorMethods() {
  return {
    /**
     * Registers a named color for later use by Recipe drawing methods.
     *
     * Array components use values from 0 through 255. Hex strings may start
     * with `#`, and percentage strings may start with `%`. An empty name is a
     * no-op. A name registered for the `separation` colorspace draws as a
     * Separation (spot) color whose alternate device color is `value`.
     * WebAssembly does not support loading color files.
     *
     * @name chroma
     * @function
     * @memberof Recipe#
     * @param {string} name - The name to register.
     * @param {RecipeColor} value - A gray, RGB, or CMYK color value; for a
     *   separation color, its alternate device color.
     * @param {RecipeColorSpace} [colorspace] - The color space, inferred from the value when omitted.
     * @returns {Recipe} The recipe instance.
     * @throws {TypeError} If the color value has an invalid size or the color space is unknown.
     * @throws {Error} If `name` is `!load`.
     */
    chroma: function (name, value, colorspace = "") {
      if (!name) return this;
      if (name === ChromaCommand.LOAD)
        throw new Error(
          "Recipe chroma !load is unsupported in WebAssembly; register colors explicitly.",
        );
      var code = hex(value);
      if (![2, 6, 8].includes(code.length) || !/^[0-9a-f]+$/i.test(code))
        throw new TypeError(
          "Color value has incorrect size for gray, rgb, or cmyk colorspaces",
        );
      colorspace = colorspace || deviceColorspaceByLength[code.length];
      if (!isColorspace(colorspace))
        throw new TypeError(`Unknown colorspace: ${colorspace}`);
      this.knownColors[colorspace][name] = code;
      return this;
    },
  };
}
