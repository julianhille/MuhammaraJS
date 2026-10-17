// Reads and fills the interactive form (AcroForm) fields of the source
// document.

var {
  AnnotSubtype,
  FormAppearances,
  FormFieldFlag,
  FormFieldKind,
} = require("../recipe-constants");
var {
  buildButtonAppearances,
  buildTextAppearance,
} = require("./form-appearance");
var {
  planPrunedValue,
  setCatalogEntry,
  writePrunedPlan,
} = require("./page-references");

/**
 * Field types of `/FT` (ISO 32000-1, 12.7.3.1).
 * @private
 * @readonly
 * @enum {string}
 */
var FieldType = Object.freeze({
  TEXT: "Tx",
  BUTTON: "Btn",
  CHOICE: "Ch",
  SIGNATURE: "Sig",
});

// Field attributes a terminal field inherits from its ancestors.
var INHERITED_KEYS = ["FT", "Ff", "V", "DV", "MaxLen", "DA", "Q"];

// What the reader makes of name bytes that are not UTF-8; such a name cannot
// be written back.
var REPLACEMENT_CHARACTER = "\uFFFD";

// The appearance state names of an unchecked button, and of a checked one
// that has no states of its own.
var OFF_STATE = "Off";
var ON_STATE = "Yes";

/**
 * @private
 * @param {Object} [value] - A PDF object.
 * @returns {Object|null} The value as an array, or null.
 */
function asArray(value) {
  return value?.toPDFArray?.() || (value?.toJSArray ? value : null);
}

/**
 * @private
 * @param {Object} [value] - A PDF object.
 * @returns {Object|null} The value as a dictionary, or null.
 */
function asDictionary(value) {
  return value?.toPDFDictionary?.() || (value?.toJSObject ? value : null);
}

/**
 * Resolve an indirect array entry to its dictionary. Fields and widgets are
 * always indirect objects (ISO 32000-1, 12.7.2); a direct entry or a
 * reference to a missing object resolves to null.
 * @private
 * @param {Object} parser - The source PDF parser.
 * @param {Object} entry - The array entry.
 * @returns {{objectID: number, generation: number, dictionary: Object}|null}
 *   The node.
 */
function resolveNode(parser, entry) {
  var reference = entry.toPDFIndirectObjectReference?.();
  if (!reference) return null;
  var objectID = reference.getObjectID();
  var generation = reference.getVersion();
  var object;
  try {
    object = parser.parseNewObject(objectID);
  } catch {
    return null;
  }
  var dictionary = asDictionary(object);
  return dictionary ? { objectID, generation, dictionary } : null;
}

/**
 * @private
 * @param {Object} [value] - A PDF object.
 * @returns {string|null} The text of a PDF string, or null for anything else.
 */
function decodeText(value) {
  return value?.toText ? value.toText() : null;
}

/**
 * Decode a field value: a name to its name, an array to the texts it holds
 * and a string to its text. Anything else, such as a signature dictionary,
 * is null.
 * @private
 * @param {Object} [value] - A PDF object.
 * @returns {string|string[]|null} The decoded value.
 */
function decodeValue(value) {
  var name = value?.toPDFName?.();
  if (name) return name.value;
  var array = asArray(value);
  if (!array) return decodeText(value);
  return array
    .toJSArray()
    .map(decodeText)
    .filter((text) => text !== null);
}

/**
 * @private
 * @param {Object} [value] - A PDF object.
 * @returns {number|null} The number, or null when the value is no number.
 */
function decodeNumber(value) {
  return typeof value?.value === "number" ? value.value : null;
}

/**
 * @private
 * @param {string|null} type - The field type `/FT`.
 * @param {number} flags - The field flags `/Ff`.
 * @returns {string|null} The FormFieldKind, or null for an unknown type.
 */
function fieldKind(type, flags) {
  switch (type) {
    case FieldType.TEXT:
      return FormFieldKind.TEXT;
    case FieldType.BUTTON:
      if (flags & FormFieldFlag.PUSHBUTTON) return FormFieldKind.PUSH_BUTTON;
      return flags & FormFieldFlag.RADIO
        ? FormFieldKind.RADIO
        : FormFieldKind.CHECKBOX;
    case FieldType.CHOICE:
      return flags & FormFieldFlag.COMBO
        ? FormFieldKind.COMBO_BOX
        : FormFieldKind.LIST_BOX;
    case FieldType.SIGNATURE:
      return FormFieldKind.SIGNATURE;
    default:
      return null;
  }
}

/**
 * Read the choices of a choice field from `/Opt`, whose entries are either
 * a text or an [export value, display text] pair. Entries without text are
 * skipped; `index` is a choice's position in `/Opt`.
 * @private
 * @param {Object} parser - The source PDF parser.
 * @param {Object} field - The field dictionary.
 * @returns {Array<{value: string, label: string, index: number}>} The
 *   choices.
 */
function choiceOptions(parser, field) {
  var options = asArray(parser.queryDictionaryObject(field, "Opt"));
  if (!options) return [];
  return options.toJSArray().flatMap((entry, index) => {
    var [value, label] = (asArray(entry)?.toJSArray() || [entry]).map(
      decodeText,
    );
    return value === null ? [] : [{ value, label: label ?? value, index }];
  });
}

/**
 * Read the on-states of a checkbox or radio field from the keys of its
 * widgets' normal appearance dictionaries. With `/Opt`, the entry at a
 * widget's index is the label of that widget's state.
 * @private
 * @param {Object} parser - The source PDF parser.
 * @param {Object} field - The field dictionary.
 * @param {Array<{states: string[]}>} widgets - The field's widget looks.
 * @returns {Array<{value: string, label: string}>} The states.
 */
function buttonStates(parser, field, widgets) {
  var labels = asArray(parser.queryDictionaryObject(field, "Opt"));
  labels = labels ? labels.toJSArray().map(decodeText) : [];
  var states = new Map();
  widgets.forEach((widget, index) => {
    widget.states.forEach((state) => {
      if (state !== OFF_STATE) {
        states.set(state, labels[index] ?? state);
      }
    });
  });
  return Array.from(states, ([value, label]) => ({ value, label }));
}

/**
 * Map the object ID of every page annotation to its one-based page number.
 * @private
 * @param {Object} parser - The source PDF parser.
 * @returns {Map<number, number>} Annotation object ID to page number.
 */
function annotationPages(parser) {
  var pages = new Map();
  for (var index = 0; index < parser.getPagesCount(); index++) {
    var annots = asArray(
      parser.queryDictionaryObject(parser.parsePageDictionary(index), "Annots"),
    );
    (annots ? annots.toJSArray() : []).forEach((entry) => {
      var reference = entry.toPDFIndirectObjectReference?.();
      if (reference) {
        pages.set(reference.getObjectID(), index + 1);
      }
    });
  }
  return pages;
}

/**
 * Resolve the dictionaries of a `/Kids` or `/Fields` array.
 * @private
 * @param {Object} parser - The source PDF parser.
 * @param {Object} [array] - The PDF array.
 * @returns {Array<{objectID: number, generation: number, dictionary: Object}>}
 *   The nodes.
 */
function resolveKids(parser, array) {
  return (asArray(array)?.toJSArray() || [])
    .map((entry) => resolveNode(parser, entry))
    .filter(Boolean);
}

/**
 * @private
 * @param {Object} parser - The source PDF parser.
 * @param {Object} dictionary - A dictionary.
 * @param {string} key - The key of a numeric array.
 * @returns {number[]|null} The numbers, or null when the entry is missing or
 *   holds anything else.
 */
function numberArray(parser, dictionary, key) {
  var array = asArray(parser.queryDictionaryObject(dictionary, key));
  var numbers = array ? array.toJSArray().map(decodeNumber) : [];
  return numbers.length && !numbers.includes(null) ? numbers : null;
}

/**
 * Read what filling needs of a widget besides its rectangle: its own `/DA`
 * and `/Q`, its rotation, colours and border width from `/MK` and `/BS`, and
 * the names of its normal appearance states.
 * @private
 * @param {Object} parser - The source PDF parser.
 * @param {Object} widget - The widget annotation dictionary.
 * @returns {Object} The da, quadding, rotation, background, borderColor,
 *   borderWidth and states.
 */
function widgetLook(parser, widget) {
  var characteristics = asDictionary(
    parser.queryDictionaryObject(widget, "MK"),
  );
  var borderStyle = asDictionary(parser.queryDictionaryObject(widget, "BS"));
  var borderWidth =
    borderStyle && decodeNumber(parser.queryDictionaryObject(borderStyle, "W"));
  var appearance = asDictionary(parser.queryDictionaryObject(widget, "AP"));
  var normal =
    appearance && asDictionary(parser.queryDictionaryObject(appearance, "N"));
  return {
    da: decodeText(parser.queryDictionaryObject(widget, "DA")),
    quadding: decodeNumber(parser.queryDictionaryObject(widget, "Q")),
    rotation:
      characteristics &&
      decodeNumber(parser.queryDictionaryObject(characteristics, "R")),
    background: characteristics && numberArray(parser, characteristics, "BG"),
    borderColor: characteristics && numberArray(parser, characteristics, "BC"),
    borderWidth: borderWidth ?? 1,
    states: Object.keys(normal ? normal.toJSObject() : {}),
  };
}

/**
 * Read one field node and its descendants into `state.records`. A node is a
 * terminal field when none of its kids has a partial name `/T`; its kids are
 * then its widgets. A terminal field without kids is its own widget.
 * @private
 * @param {Object} parser - The source PDF parser.
 * @param {{objectID: number, generation: number, dictionary: Object}} node -
 *   The field node.
 * @param {{name: string, inherited: Object}} parent - The fully qualified
 *   name and inherited attributes of the parent.
 * @param {Object} state - Shared walk state: pages, visited, records and
 *   forFill.
 * @returns {void}
 */
function readField(parser, node, parent, state) {
  // Each node is read once, which stops /Kids cycles and keeps a kid that
  // /Fields also lists under its parent.
  if (state.visited.has(node.objectID)) return;
  state.visited.add(node.objectID);
  var field = node.dictionary;
  var partialName = decodeText(parser.queryDictionaryObject(field, "T"));
  var name =
    partialName === null
      ? parent.name
      : parent.name
        ? parent.name + "." + partialName
        : partialName;
  var inherited = Object.assign({}, parent.inherited);
  INHERITED_KEYS.forEach((key) => {
    var value = parser.queryDictionaryObject(field, key);
    if (value) inherited[key] = value;
  });
  // An indirect /Kids array belongs to one field; reading it once keeps
  // fields that share one linear.
  var kidsID = field
    .toJSObject()
    .Kids?.toPDFIndirectObjectReference?.()
    ?.getObjectID();
  var kids = state.visited.has(kidsID)
    ? []
    : resolveKids(parser, parser.queryDictionaryObject(field, "Kids"));
  if (kidsID !== undefined) state.visited.add(kidsID);
  if (kids.some((kid) => parser.queryDictionaryObject(kid.dictionary, "T"))) {
    kids.forEach((kid) => readField(parser, kid, { name, inherited }, state));
    return;
  }
  var subtype = parser.queryDictionaryObject(field, "Subtype");
  var widgets =
    kids.length || decodeValue(subtype) !== AnnotSubtype.WIDGET ? kids : [node];
  var type = decodeValue(inherited.FT);
  // /Ff is a set of 32 flag bits (ISO 32000-1, 12.7.3.1).
  var flags = decodeNumber(inherited.Ff) >>> 0;
  var looks = widgets.map((widget) => widgetLook(parser, widget.dictionary));
  var choices = type === FieldType.CHOICE ? choiceOptions(parser, field) : null;
  var topIndex = decodeNumber(parser.queryDictionaryObject(field, "TI")) || 0;
  var publicField = {
    id: node.objectID,
    name,
    kind: fieldKind(type, flags),
    value: decodeValue(inherited.V),
    defaultValue: decodeValue(inherited.DV),
    flags,
    maxLength: decodeNumber(inherited.MaxLen),
    options: choices
      ? choices.map(({ value, label }) => ({ value, label }))
      : buttonStates(parser, field, looks),
    widgets: widgets.map((widget) => ({
      id: widget.objectID,
      pageNumber: state.pages.get(widget.objectID) ?? null,
      rect: numberArray(parser, widget.dictionary, "Rect"),
    })),
  };
  state.records.push({
    field: publicField,
    // fillForm() rewrites the field and its widgets, so each must have
    // generation 0 and keys it can write back. Only fillForm() asks, as listing
    // every key costs time on large forms.
    rewritable:
      state.forFill &&
      [...new Set([node, ...widgets])].every(
        (one) =>
          one.generation === 0 &&
          !Object.keys(one.dictionary.toJSObject()).some((key) =>
            key.includes(REPLACEMENT_CHARACTER),
          ),
      ),
    da: decodeText(inherited.DA),
    quadding: decodeNumber(inherited.Q) ?? 0,
    // /TI counts /Opt entries, including those choiceOptions() skips.
    topIndex: Math.max(
      choices?.findIndex((choice) => choice.index >= topIndex) ?? 0,
      0,
    ),
    optionIndexes: choices?.map((choice) => choice.index),
    widgets: publicField.widgets.map((widget, index) => ({
      ...widget,
      ...looks[index],
    })),
  });
}

/**
 * Read the field tree of the source's AcroForm.
 * @private
 * @param {Object} parser - The source PDF parser.
 * @param {boolean} [forFill=false] - Whether to check that fillForm() can
 *   rewrite each field's objects.
 * @returns {Object[]} What filling needs of each field, with the public
 *   field as `field`, in field tree order.
 */
function readForm(parser, forFill = false) {
  var catalog = asDictionary(
    parser.queryDictionaryObject(parser.getTrailer(), "Root"),
  );
  var acroForm =
    catalog && asDictionary(parser.queryDictionaryObject(catalog, "AcroForm"));
  if (!acroForm) return [];
  var state = {
    pages: annotationPages(parser),
    visited: new Set(),
    records: [],
    forFill,
  };
  // Fields inherit /DA and /Q from the AcroForm (ISO 32000-1, 12.7.3.3).
  var inherited = {
    DA: parser.queryDictionaryObject(acroForm, "DA"),
    Q: parser.queryDictionaryObject(acroForm, "Q"),
  };
  resolveKids(parser, parser.queryDictionaryObject(acroForm, "Fields")).forEach(
    (node) => readField(parser, node, { name: "", inherited }, state),
  );
  return state.records;
}

/**
 * List the interactive form (AcroForm) fields of the source document. Each
 * entry is a terminal field with its object ID, fully qualified name,
 * inherited type, flags and value, and its widgets. Fields added or filled
 * by this Recipe are not included; a new document has no fields.
 * @name formFields
 * @function
 * @memberof Recipe#
 * @returns {RecipeFormField[]} The form fields, in field tree order.
 * @throws {Error} If the source reader was released by endPDF().
 * @example
 * const recipe = new Recipe("form.pdf", "out.pdf");
 * for (const field of recipe.formFields()) {
 *   console.log(field.name, field.kind, field.value);
 * }
 */
exports.formFields = function formFields() {
  if (this.isNewPDF) return [];
  return readForm(this._getReader()).map((record) => record.field);
};

/**
 * Find the field a `fillForm()` key names: the field with that fully
 * qualified name, or else, for a key of digits, the field with that ID.
 * @private
 * @param {Object[]} records - The field records of readForm().
 * @param {string} key - The key.
 * @returns {Object} The record.
 * @throws {Error} If no field matches, or several fields have the name.
 */
function findField(records, key) {
  var named = records.filter((record) => record.field.name === key);
  if (named.length > 1) {
    throw new Error(
      `Form field name "${key}" is ambiguous; fill it by one of its ids: ${named
        .map((record) => record.field.id)
        .join(", ")}`,
    );
  }
  var record =
    named[0] ||
    (/^\d+$/.test(key) &&
      records.find((record) => record.field.id === Number(key)));
  if (!record) throw new Error(`No form field "${key}"`);
  return record;
}

/**
 * Check one value against its field and turn it into what is written: `/V`,
 * the on-state of buttons, the text shown and the selected options.
 * @private
 * @param {Object} record - The field record.
 * @param {*} value - The value passed to fillForm().
 * @returns {Object} The fill: value (text, texts, or null to remove `/V`),
 *   state (the `/V` name of buttons), text and selected.
 * @throws {TypeError} If the value has the wrong type for the field.
 * @throws {Error} If the field cannot be filled or the value does not fit.
 */
function normalizeFill(record, value) {
  var field = record.field;
  var label = `Form field "${field.name}"`;
  var states = field.options.map((option) => option.value);
  var choice = (text) => {
    var index = states.indexOf(text);
    return index >= 0
      ? index
      : field.options.findIndex((option) => option.label === text);
  };
  var asText = (text) => {
    if (typeof text === "string") return text;
    if (Number.isFinite(text)) return String(text);
    throw new TypeError(
      `${label} takes text or a finite number, not ${typeof text === "number" ? text : typeof text}`,
    );
  };
  switch (field.kind) {
    case FormFieldKind.TEXT: {
      var text = asText(value ?? "");
      if (
        field.maxLength !== null &&
        Array.from(text).length > field.maxLength
      ) {
        throw new Error(`${label} takes at most ${field.maxLength} characters`);
      }
      if (/[\r\n]/.test(text) && !(field.flags & FormFieldFlag.MULTILINE)) {
        throw new Error(`${label} is a single line; remove the line breaks`);
      }
      return { value: text, text };
    }
    case FormFieldKind.CHECKBOX:
    case FormFieldKind.RADIO: {
      var radio = field.kind === FormFieldKind.RADIO;
      var state;
      if (value === false || value == null) {
        state = OFF_STATE;
      } else if (value === true && !radio) {
        if (states.length > 1) {
          throw new Error(
            `${label} has several on-states (${states.join(", ")}); fill it with one of them`,
          );
        }
        state = states[0] || ON_STATE;
      } else if (typeof value === "string") {
        // A checkbox without appearance states takes any state.
        state =
          value === OFF_STATE || (!radio && !states.length)
            ? value
            : states[choice(value)];
        if (state === undefined) {
          throw new Error(
            `${label} has no state "${value}"; use one of: ${states.join(", ")}`,
          );
        }
      } else {
        throw new TypeError(
          radio
            ? `${label} takes the name of an on-state`
            : `${label} takes true, false or the name of an on-state`,
        );
      }
      if (
        radio &&
        state === OFF_STATE &&
        field.flags & FormFieldFlag.NO_TOGGLE_TO_OFF
      ) {
        throw new Error(`${label} cannot be turned off`);
      }
      // A lossy state name from the source cannot be written back; any name
      // the caller gives a checkbox without states can.
      if (states.includes(state) && state.includes(REPLACEMENT_CHARACTER)) {
        throw new Error(`${label} has a state name that is not UTF-8`);
      }
      return { value: state, state };
    }
    case FormFieldKind.COMBO_BOX: {
      if (value == null) return { value: null, text: "" };
      text = asText(value);
      var option = field.options[choice(text)];
      if (!option && !(field.flags & FormFieldFlag.EDIT)) {
        throw new Error(
          `${label} has no option "${text}"; use one of: ${states.join(", ")}`,
        );
      }
      return option
        ? { value: option.value, text: option.label }
        : { value: text, text };
    }
    case FormFieldKind.LIST_BOX: {
      var values = [].concat(value ?? []).map(asText);
      if (values.length > 1 && !(field.flags & FormFieldFlag.MULTI_SELECT)) {
        throw new Error(`${label} takes one option, not several`);
      }
      var selected = values.map((one) => {
        var found = choice(one);
        if (found < 0) {
          throw new Error(
            `${label} has no option "${one}"; use one of: ${states.join(", ")}`,
          );
        }
        return found;
      });
      selected = Array.from(new Set(selected)).sort((a, b) => a - b);
      var exported = selected.map((one) => field.options[one].value);
      return {
        value: exported.length > 1 ? exported : (exported[0] ?? null),
        selected,
      };
    }
    default:
      throw new Error(
        `${label} is ${field.kind ? `a ${field.kind} field` : "a field of an unknown type"}, which fillForm() cannot fill`,
      );
  }
}

/**
 * Check fillForm() values against the source's fields and queue them for
 * endPDF(); a later value for the same field replaces an earlier one.
 * @private
 * @param {Object} recipe - The Recipe.
 * @param {Object[]} records - The field records of readForm().
 * @param {Object} values - The values by field name or id.
 * @param {Object} [options] - The fillForm() options.
 * @returns {void}
 * @throws {TypeError} If the values or options are invalid.
 * @throws {Error} If a field is missing, ambiguous, cannot be filled or does
 *   not take its value.
 */
function queueFormFills(recipe, records, values, options = {}) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new TypeError("fillForm values must be an object");
  }
  if (!options || typeof options !== "object") {
    throw new TypeError("fillForm options must be an object");
  }
  var appearances = options.appearances ?? FormAppearances.GENERATE;
  if (!Object.values(FormAppearances).includes(appearances)) {
    throw new TypeError(
      `fillForm appearances must be one of: ${Object.values(FormAppearances).join(", ")}`,
    );
  }
  if (options.font !== undefined && typeof options.font !== "string") {
    throw new TypeError("fillForm font must be a registered font name");
  }
  var settings = { appearances, font: options.font };
  var fills = Object.entries(values).map(([key, value]) => {
    var record = findField(records, key);
    if (!record.rewritable) {
      throw new Error(
        `Form field "${record.field.name}" cannot be rewritten: its field or widget object has a nonzero generation or a dictionary key that is not UTF-8`,
      );
    }
    return { record, fill: normalizeFill(record, value), settings };
  });
  recipe._formFills = recipe._formFills || new Map();
  fills.forEach((entry) => recipe._formFills.set(entry.record.field.id, entry));
}

/**
 * Fill interactive form (AcroForm) fields of the source document. Text
 * fields take text, checkboxes true, false or an on-state name, radios an
 * on-state name or its `/Opt` label, combo boxes an option, and list boxes
 * an option or, with MULTI_SELECT, an array of them; null clears a field.
 * The values are written by endPDF(), each changed widget with a new
 * appearance stream.
 * @name fillForm
 * @function
 * @memberof Recipe#
 * @param {Object<string, string|number|boolean|Array<string|number>|null>} values - The
 *   values, keyed by fully qualified field name, or by field id when a name
 *   is not unique.
 * @param {Object} [options] - The options.
 * @param {Recipe.FormAppearances} [options.appearances="generate"] - Draw
 *   the appearance of each changed widget, or set `/NeedAppearances` and let
 *   the viewer draw it.
 * @param {string} [options.font] - The registered font family that draws
 *   text appearances; the default font when omitted.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If the values or options are invalid.
 * @throws {Error} For a new document, after endPDF() or insertPage(), for a
 *   source that needs its password, or when a field is missing, ambiguous,
 *   cannot be filled or does not take the value.
 * @example
 * new Recipe("form.pdf", "filled.pdf")
 *   .fillForm({ "person.name": "Ada Lovelace", agree: true })
 *   .endPDF();
 */
exports.fillForm = function fillForm(values, options) {
  if (this.isNewPDF) {
    throw new Error("fillForm() needs a source PDF with a form");
  }
  if (this.ended) throw new Error("Cannot fill a form after endPDF");
  if (this.sourceNeedsPassword_) {
    throw new Error(
      "Editing a password-protected source is unsupported; decrypt it with recrypt() first",
    );
  }
  if (this.needToInsertPages)
    throw new Error("insertPage() cannot be combined with fillForm()");
  // The source does not change before endPDF(): read its form once.
  this._formRecords = this._formRecords || readForm(this._getReader(), true);
  queueFormFills(this, this._formRecords, values, options);
  return this;
};

/**
 * Write a form XObject of the given size and return its object ID.
 * @private
 * @param {Object} writer - The PDF writer.
 * @param {{width: number, height: number}} size - The form size.
 * @param {Array<Array>} operations - The drawing operations.
 * @param {Object} [font] - The writer font for text.
 * @returns {number} The form object ID.
 */
function writeAppearanceForm(writer, { width, height }, operations, font) {
  var form = writer.createFormXObject(
    0,
    0,
    Math.max(width, 1),
    Math.max(height, 1),
  );
  var context = form.getContentContext();
  operations.forEach(([operator, ...args]) => {
    if (operator === "font") context.Tf(font, args[0]);
    else if (operator === "free") context.writeFreeCode(args[0]);
    else context[operator](...args);
  });
  writer.endFormXObject(form);
  return form.id;
}

/**
 * @private
 * @param {string} name - A name.
 * @returns {string} The name as a PDF name token, with `#` escapes.
 */
function nameToken(name) {
  var token = "/";
  new TextEncoder().encode(name).forEach((byte) => {
    var character = String.fromCharCode(byte);
    token +=
      byte > 32 && byte < 127 && !/[#%()<>[\]{}/]/.test(character)
        ? character
        : "#" + byte.toString(16).padStart(2, "0");
  });
  return token;
}

/**
 * Write an appearance dictionary as a new indirect object: `/N` refers to
 * the normal appearance stream, or for a button holds its states directly,
 * as Poppler does not resolve an indirect state dictionary. The object is
 * written as raw text, since the Wasm objects context does not nest
 * dictionaries.
 * @private
 * @param {Object} objectsContext - The writer's objects context.
 * @param {number|Array<Array>} normal - The normal appearance
 *   stream ID, or [state name, stream ID] pairs.
 * @returns {number} The object ID.
 */
function writeAppearanceDictionary(objectsContext, normal) {
  var value = Array.isArray(normal)
    ? `<< ${normal.map(([state, id]) => `${nameToken(state)} ${id} 0 R`).join(" ")} >>`
    : `${normal} 0 R`;
  var objectID = objectsContext.startNewIndirectObject();
  var text = `<< /N ${value} >>\n`;
  objectsContext
    .startFreeContext()
    .write(Uint8Array.from(text, (character) => character.charCodeAt(0)));
  objectsContext.endFreeContext();
  objectsContext.endIndirectObject();
  return objectID;
}

/**
 * Write the `/V` of a fill: the state name of a button, else its text or
 * texts.
 * @private
 * @param {Object} writer - The PDF writer.
 * @param {Object} dictionary - The dictionary context.
 * @param {Object} fill - The fill of normalizeFill().
 * @returns {void}
 */
function writeFieldValue(writer, dictionary, fill) {
  var textString = (text) => writer.createPDFTextString(text).toBytesArray();
  if (fill.state !== undefined) {
    dictionary.writeNameValue(fill.state);
  } else if (Array.isArray(fill.value)) {
    var objectsContext = writer.getObjectsContext();
    objectsContext.startArray();
    fill.value.forEach((text) =>
      objectsContext.writeLiteralString(textString(text)),
    );
    objectsContext.endArray();
  } else {
    dictionary.writeLiteralStringValue(textString(fill.value));
  }
}

/**
 * Plan the rewrite of one object: a map from each key to set to the function
 * that writes its value, or to null to drop the key.
 * @private
 * @param {Map<number, Map>} rewrites - Rewrites by object ID.
 * @param {number} objectID - The object.
 * @returns {Map<string, function|null>} Its rewrite.
 */
function rewriteOf(rewrites, objectID) {
  if (!rewrites.has(objectID)) rewrites.set(objectID, new Map());
  return rewrites.get(objectID);
}

/**
 * Write a dictionary of the source with the planned entries, copying the
 * others without their references to deleted pages, as page deletion does.
 * @private
 * @param {Object} objectsContext - The writer's objects context.
 * @param {Object} copyingContext - Copies unchanged values.
 * @param {Object} source - The source dictionary.
 * @param {Map<string, function|null>} rewrite - The rewrite.
 * @param {Set<number>} deletedPageIDs - Object IDs of the deleted pages.
 * @param {number} [objectID] - The object to replace; a new object when
 *   omitted.
 * @returns {number} The object ID.
 */
function writeRewrittenObject(
  objectsContext,
  copyingContext,
  source,
  rewrite,
  deletedPageIDs,
  objectID,
) {
  // Planned before the object starts: pruning writes changed nested
  // dictionaries as objects of their own.
  var kept = Object.entries(source.toJSObject())
    .filter(([key]) => !rewrite.has(key))
    .map(([key, value]) => [
      key,
      planPrunedValue(
        objectsContext,
        copyingContext,
        value,
        deletedPageIDs,
        true,
      ),
    ]);
  if (objectID) objectsContext.startModifiedIndirectObject(objectID);
  else objectID = objectsContext.startNewIndirectObject();
  var dictionary = objectsContext.startDictionary();
  kept.forEach(([key, plan]) => {
    dictionary.writeKey(key);
    writePrunedPlan(objectsContext, copyingContext, plan);
  });
  rewrite.forEach((write, key) => {
    if (!write) return;
    dictionary.writeKey(key);
    write(dictionary);
  });
  objectsContext.endDictionary(dictionary);
  objectsContext.endIndirectObject();
  return objectID;
}

/**
 * Write the values queued by fillForm(): new appearance streams first, then
 * each changed field and widget object as an incremental update, then the
 * `/AcroForm` when it gains `/NeedAppearances` or loses the `/XFA` of a
 * hybrid form.
 * @private
 * @param {Object} recipe - The Recipe, modifying its source.
 * @param {Function} fontFor - Takes a font family, or undefined for the
 *   default font, and returns the writer font.
 * @returns {void}
 */
function writeFormFills(recipe, fontFor) {
  if (!recipe._formFills?.size) return;
  var writer = recipe.writer;
  var objectsContext = writer.getObjectsContext();
  var copyingContext = writer.createPDFCopyingContextForModifiedFile();
  var parser = copyingContext.getSourceDocumentParser();
  var deletedPageIDs = recipe._deletedPageIDs || new Set();
  var rewrites = new Map();
  var acroFormRewrite = new Map();
  recipe._formFills.forEach(({ record, fill, settings }) => {
    var { field, widgets } = record;
    var generate = settings.appearances === FormAppearances.GENERATE;
    if (!generate) {
      acroFormRewrite.set("NeedAppearances", (dictionary) =>
        dictionary.writeBooleanValue(true),
      );
    }
    var fieldRewrite = rewriteOf(rewrites, field.id);
    fieldRewrite.set(
      "V",
      fill.value === null
        ? null
        : (dictionary) => writeFieldValue(writer, dictionary, fill),
    );
    var kind = field.kind;
    if (kind === FormFieldKind.CHECKBOX || kind === FormFieldKind.RADIO) {
      widgets.forEach((widget) => {
        var rewrite = rewriteOf(rewrites, widget.id);
        // A checkbox widget without appearance states takes the state as it
        // is, and gets a check mark to show.
        var bare = !widget.states.length && kind === FormFieldKind.CHECKBOX;
        var state =
          bare || widget.states.includes(fill.state) ? fill.state : OFF_STATE;
        if (bare && generate && widget.rect?.length === 4) {
          var onState = fill.state === OFF_STATE ? ON_STATE : fill.state;
          var built = buildButtonAppearances(widget);
          var ap = writeAppearanceDictionary(objectsContext, [
            [onState, writeAppearanceForm(writer, built, built.on)],
            [OFF_STATE, writeAppearanceForm(writer, built, built.off)],
          ]);
          rewrite.set("AP", (dictionary) =>
            dictionary.writeObjectReferenceValue(ap),
          );
        }
        rewrite.set("AS", (dictionary) => dictionary.writeNameValue(state));
      });
      return;
    }
    if (kind === FormFieldKind.LIST_BOX || kind === FormFieldKind.COMBO_BOX) {
      fieldRewrite.set(
        "I",
        fill.selected?.length
          ? () => {
              objectsContext.startArray();
              fill.selected.forEach((index) =>
                objectsContext.writeNumber(record.optionIndexes[index]),
              );
              objectsContext.endArray();
            }
          : null,
      );
    }
    if (!generate) return;
    var font = fontFor(settings.font);
    var measure = (text, size) => font.calculateTextDimensions(text, size);
    widgets.forEach((widget) => {
      if (widget.rect?.length !== 4) return;
      var built = buildTextAppearance(
        widget,
        {
          kind,
          flags: field.flags,
          maxLength: field.maxLength,
          da: widget.da ?? record.da,
          quadding: widget.quadding ?? record.quadding,
          text: fill.text,
          options: field.options.map((option) => option.label),
          selected: fill.selected,
          topIndex: record.topIndex,
        },
        measure,
      );
      var normal = writeAppearanceForm(writer, built, built.operations, font);
      var ap = writeAppearanceDictionary(objectsContext, normal);
      rewriteOf(rewrites, widget.id).set("AP", (dictionary) =>
        dictionary.writeObjectReferenceValue(ap),
      );
    });
  });
  rewrites.forEach((rewrite, objectID) => {
    writeRewrittenObject(
      objectsContext,
      copyingContext,
      parser.parseNewObject(objectID).toPDFDictionary(),
      rewrite,
      deletedPageIDs,
      objectID,
    );
  });
  var catalog = parser.queryDictionaryObject(parser.getTrailer(), "Root");
  var acroForm = asDictionary(
    parser.queryDictionaryObject(catalog, "AcroForm"),
  );
  // Viewers show the old data of a hybrid form's XFA instead of its fields:
  // drop it, as pdf-lib does.
  if (parser.queryDictionaryObject(acroForm, "XFA")) {
    acroFormRewrite.set("XFA", null);
  }
  if (!acroFormRewrite.size) return;
  // The /AcroForm moves to a new object, whether it was direct or not.
  setCatalogEntry(
    writer,
    "AcroForm",
    writeRewrittenObject(
      objectsContext,
      copyingContext,
      acroForm,
      acroFormRewrite,
      deletedPageIDs,
    ),
  );
}

/**
 * Write the values queued by fillForm(), before the writer ends.
 * @private
 * @returns {void}
 */
exports._writeFormFills = function _writeFormFills() {
  writeFormFills(this, (family) => this._getFont({ font: family }));
};
