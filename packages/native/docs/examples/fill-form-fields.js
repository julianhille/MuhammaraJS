var Recipe = require("@muhammara/native").Recipe;

/**
 * Fills form fields of a PDF and writes the filled copy.
 *
 * @param {string} inputPath The form to fill.
 * @param {string} outputPath Where to write the filled PDF.
 * @param {Object<string, *>} values The values by field name.
 * @returns {void}
 */
function fillFormFields(inputPath, outputPath, values) {
  new Recipe(inputPath, outputPath).fillForm(values).endPDF();
}

module.exports = fillFormFields;
