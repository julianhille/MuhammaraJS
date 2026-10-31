// Metadata fields accepted by Recipe constructor options and info().
export var recipeInfoKeys = Object.freeze({
  author: "author",
  title: "title",
  subject: "subject",
  keywords: "keywords",
});
export var standardInfoKeys = Object.freeze(Object.values(recipeInfoKeys));

// The source writer also exposes these provenance fields as properties.
export var writableInfoKeys = Object.freeze([
  ...standardInfoKeys,
  "creator",
  "producer",
]);
