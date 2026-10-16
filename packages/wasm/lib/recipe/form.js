// Reads the interactive form (AcroForm) fields of the source document.

import { AnnotSubtype, FormFieldFlag, FormFieldKind } from "../value-sets.js";

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
var INHERITED_KEYS = ["FT", "Ff", "V", "DV", "MaxLen"];

// The appearance state name of an unchecked button.
var OFF_STATE = "Off";

/**
 * @private
 * @param {object} [value] - A PDF object.
 * @returns {object|null} The value as an array, or null.
 */
function asArray(value) {
  return value?.toPDFArray?.() || (value?.toJSArray ? value : null);
}

/**
 * @private
 * @param {object} [value] - A PDF object.
 * @returns {object|null} The value as a dictionary, or null.
 */
function asDictionary(value) {
  return value?.toPDFDictionary?.() || (value?.toJSObject ? value : null);
}

/**
 * Resolve an indirect array entry to its dictionary. Fields and widgets are
 * always indirect objects (ISO 32000-1, 12.7.2); a direct entry or a
 * reference to a missing object resolves to null.
 * @private
 * @param {object} parser - The source PDF parser.
 * @param {object} entry - The array entry.
 * @returns {{objectID: number, dictionary: object}|null} The node.
 */
function resolveNode(parser, entry) {
  var reference = entry.toPDFIndirectObjectReference?.();
  if (!reference) return null;
  var objectID = reference.getObjectID();
  var object;
  try {
    object = parser.parseNewObject(objectID);
  } catch {
    return null;
  }
  var dictionary = asDictionary(object);
  return dictionary ? { objectID, dictionary } : null;
}

/**
 * @private
 * @param {object} [value] - A PDF object.
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
 * @param {object} [value] - A PDF object.
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
 * @param {object} [value] - A PDF object.
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
 * skipped.
 * @private
 * @param {object} parser - The source PDF parser.
 * @param {object} field - The field dictionary.
 * @returns {Array<{value: string, label: string}>} The choices.
 */
function choiceOptions(parser, field) {
  var options = asArray(parser.queryDictionaryObject(field, "Opt"));
  if (!options) return [];
  return options.toJSArray().flatMap((entry) => {
    var [value, label] = (asArray(entry)?.toJSArray() || [entry]).map(
      decodeText,
    );
    return value === null ? [] : [{ value, label: label ?? value }];
  });
}

/**
 * Read the on-states of a checkbox or radio field from the keys of its
 * widgets' normal appearance dictionaries. With `/Opt`, the entry at a
 * widget's index is the label of that widget's state.
 * @private
 * @param {object} parser - The source PDF parser.
 * @param {object} field - The field dictionary.
 * @param {Array<{dictionary: object}>} widgets - The field's widgets.
 * @returns {Array<{value: string, label: string}>} The states.
 */
function buttonStates(parser, field, widgets) {
  var labels = asArray(parser.queryDictionaryObject(field, "Opt"));
  labels = labels ? labels.toJSArray().map(decodeText) : [];
  var states = new Map();
  widgets.forEach((widget, index) => {
    var appearance = asDictionary(
      parser.queryDictionaryObject(widget.dictionary, "AP"),
    );
    var normal =
      appearance && asDictionary(parser.queryDictionaryObject(appearance, "N"));
    Object.keys(normal ? normal.toJSObject() : {}).forEach((state) => {
      if (state !== OFF_STATE) {
        states.set(state, labels[index] ?? state);
      }
    });
  });
  return Array.from(states, ([value, label]) => ({ value, label }));
}

/**
 * @private
 * @param {object} parser - The source PDF parser.
 * @param {object} widget - The widget annotation dictionary.
 * @returns {number[]|null} The `/Rect` in PDF user space, or null.
 */
function widgetRect(parser, widget) {
  var rect = asArray(parser.queryDictionaryObject(widget, "Rect"));
  var numbers = rect ? rect.toJSArray().map(decodeNumber) : [];
  return numbers.length && !numbers.includes(null) ? numbers : null;
}

/**
 * Map the object ID of every page annotation to its one-based page number.
 * @private
 * @param {object} parser - The source PDF parser.
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
 * @param {object} parser - The source PDF parser.
 * @param {object} [array] - The PDF array.
 * @returns {Array<{objectID: number, dictionary: object}>} The nodes.
 */
function resolveKids(parser, array) {
  return (asArray(array)?.toJSArray() || [])
    .map((entry) => resolveNode(parser, entry))
    .filter(Boolean);
}

/**
 * Read one field node and its descendants into `state.fields`. A node is a
 * terminal field when none of its kids has a partial name `/T`; its kids are
 * then its widgets. A terminal field without kids is its own widget.
 * @private
 * @param {object} parser - The source PDF parser.
 * @param {{objectID: number, dictionary: object}} node - The field node.
 * @param {{name: string, inherited: object}} parent - The fully qualified
 *   name and inherited attributes of the parent.
 * @param {object} state - Shared walk state: pages, visited and fields.
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
  state.fields.push({
    name,
    kind: fieldKind(type, flags),
    value: decodeValue(inherited.V),
    defaultValue: decodeValue(inherited.DV),
    flags,
    maxLength: decodeNumber(inherited.MaxLen),
    options:
      type === FieldType.CHOICE
        ? choiceOptions(parser, field)
        : buttonStates(parser, field, widgets),
    widgets: widgets.map((widget) => ({
      pageNumber: state.pages.get(widget.objectID) ?? null,
      rect: widgetRect(parser, widget.dictionary),
    })),
  });
}

/**
 * Create the form methods of Recipe.
 * @param {object} dependencies - Factory dependencies.
 * @param {Function} dependencies.createReader - Opens PDF bytes for reading.
 * @returns {object} Prototype methods for Recipe.
 */
export function createFormMethods({ createReader }) {
  return {
    /**
     * List the interactive form (AcroForm) fields of the source document.
     * Each entry is a terminal field with its fully qualified name, inherited
     * type, flags and value, and its widgets. Fields added or filled by this
     * Recipe are not included; a new document has no fields.
     * @name formFields
     * @function
     * @memberof Recipe#
     * @returns {RecipeFormField[]} The form fields, in field tree order.
     * @throws {Error} If endPDF() already finished the source document.
     */
    formFields: function () {
      if (!this._sourceMode) return [];
      if (this._endedBytes) {
        throw new Error(
          "The source PDF reader has been released by endPDF(). Read the source before ending the document.",
        );
      }
      // The modifier opens the source without a password; like _inspectBytes,
      // read with the Recipe password so an encrypted source decrypts.
      var parser = createReader(this._sourceBytes, {
        password: this._getEncryptOptions(this.options).password,
      });
      try {
        return readFields(parser);
      } finally {
        parser.end();
      }
    },
  };
}

/**
 * Read the terminal fields of a parsed document's AcroForm.
 * @private
 * @param {object} parser - The source PDF parser.
 * @returns {RecipeFormField[]} The form fields, in field tree order.
 */
function readFields(parser) {
  var catalog = asDictionary(
    parser.queryDictionaryObject(parser.getTrailer(), "Root"),
  );
  var acroForm =
    catalog && asDictionary(parser.queryDictionaryObject(catalog, "AcroForm"));
  if (!acroForm) return [];
  var state = {
    pages: annotationPages(parser),
    visited: new Set(),
    fields: [],
  };
  resolveKids(parser, parser.queryDictionaryObject(acroForm, "Fields")).forEach(
    (node) => readField(parser, node, { name: "", inherited: {} }, state),
  );
  return state.fields;
}
