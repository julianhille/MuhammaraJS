var Recipe = require("@muhammara/native").Recipe;

/**
 * Lists the ID, name, kind, value and pages of every form field in a PDF.
 *
 * @param {string} inputPath The PDF to read.
 * @returns {Array<object>} One summary per form field.
 */
function readFormFields(inputPath) {
  return new Recipe(inputPath).formFields().map(function (field) {
    return {
      id: field.id,
      name: field.name,
      kind: field.kind,
      value: field.value,
      readOnly: Boolean(field.flags & Recipe.FormFieldFlag.READ_ONLY),
      pages: field.widgets.map(function (widget) {
        return widget.pageNumber;
      }),
    };
  });
}

module.exports = readFormFields;
