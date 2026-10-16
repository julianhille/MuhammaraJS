// Metadata fields accepted by Recipe constructor options and info().
var recipeInfoKeys = Object.freeze({
  author: "author",
  title: "title",
  subject: "subject",
  keywords: "keywords",
});
var standardInfoKeys = Object.freeze(Object.values(recipeInfoKeys));

// The Info dictionary names of the standard fields (ISO 32000-1, 14.3.3);
// without a prototype, so that keys such as constructor are no field.
var pdfInfoNames = Object.freeze({
  __proto__: null,
  Title: recipeInfoKeys.title,
  Author: recipeInfoKeys.author,
  Subject: recipeInfoKeys.subject,
  Keywords: recipeInfoKeys.keywords,
});

// The Info entries Recipe writes itself.
var recipeInfoEntries = Object.freeze([
  "Creator",
  "Producer",
  "CreationDate",
  "ModDate",
  "Trapped",
  "source-Creator",
  "source-Producer",
  "source-ModDate",
]);

/**
 * The info() name of an option key: the Info name of a standard field, such
 * as Title, is the field; other keys are custom entries as spelled.
 * @param {string} key - The option key.
 * @returns {string} The name.
 * @throws {TypeError} For an empty key, or an Info entry Recipe writes
 *   itself.
 */
function infoOptionName(key) {
  if (key === "") throw new TypeError("An Info entry needs a name");
  if (recipeInfoEntries.includes(key)) {
    throw new TypeError(`Recipe writes the ${key} Info entry itself`);
  }
  return pdfInfoNames[key] || key;
}

module.exports = {
  recipeInfoKeys,
  standardInfoKeys,
  pdfInfoNames,
  infoOptionName,
};
