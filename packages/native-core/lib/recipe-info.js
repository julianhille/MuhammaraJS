// Metadata fields accepted by Recipe constructor options and info().
var recipeInfoKeys = Object.freeze({
  author: "author",
  title: "title",
  subject: "subject",
  keywords: "keywords",
});
var standardInfoKeys = Object.freeze(Object.values(recipeInfoKeys));

module.exports = { recipeInfoKeys, standardInfoKeys };
