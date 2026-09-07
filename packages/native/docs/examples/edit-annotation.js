var muhammara = require("@muhammara/native");

function getAnnotationIds(reader, pageIndex) {
  var page = reader.parsePage(pageIndex).getDictionary();
  var annotations = reader.queryDictionaryObject(page, "Annots");

  if (!annotations) {
    return [];
  }

  return annotations
    .toPDFArray()
    .toJSArray()
    .map(function (annotation) {
      return annotation.toPDFIndirectObjectReference().getObjectID();
    });
}

function readContents(reader, annotationId) {
  var contents = reader
    .parseNewObject(annotationId)
    .toPDFDictionary()
    .toJSObject().Contents;

  return contents ? contents.toText() : "";
}

function findAnnotationId(inputPath, pageIndex, contents) {
  var reader = muhammara.createReader(inputPath);

  try {
    return getAnnotationIds(reader, pageIndex).find(function (annotationId) {
      return readContents(reader, annotationId) === contents;
    });
  } finally {
    reader.end();
  }
}

function editAnnotationContents(inputPath, outputPath, annotationId, contents) {
  var writer = muhammara.createWriterToModify(inputPath, {
    modifiedFilePath: outputPath,
  });
  var copyingContext = writer.createPDFCopyingContextForModifiedFile();
  var existing = copyingContext
    .getSourceDocumentParser()
    .parseNewObject(annotationId)
    .toPDFDictionary()
    .toJSObject();
  var objectsContext = writer.getObjectsContext();

  objectsContext.startModifiedIndirectObject(annotationId);

  var dictionary = objectsContext.startDictionary();

  Object.keys(existing).forEach(function (key) {
    // Contents is rewritten below; AP caches the rendered look of the old text.
    if (key === "Contents" || key === "AP") {
      return;
    }
    dictionary.writeKey(key);
    copyingContext.copyDirectObjectAsIs(existing[key]);
  });
  dictionary.writeKey("Contents").writeLiteralStringValue(contents);
  objectsContext.endDictionary(dictionary);
  objectsContext.endIndirectObject();
  copyingContext.end();
  writer.end();
}

function removeAnnotation(inputPath, outputPath, pageIndex, annotationId) {
  var writer = muhammara.createWriterToModify(inputPath, {
    modifiedFilePath: outputPath,
  });
  var copyingContext = writer.createPDFCopyingContextForModifiedFile();
  var parser = copyingContext.getSourceDocumentParser();
  var pageId = parser.getPageObjectID(pageIndex);
  var page = parser.parsePage(pageIndex).getDictionary().toJSObject();
  var keptIds = getAnnotationIds(parser, pageIndex).filter(function (id) {
    return id !== annotationId;
  });
  var objectsContext = writer.getObjectsContext();

  objectsContext.startModifiedIndirectObject(pageId);

  var dictionary = objectsContext.startDictionary();

  Object.keys(page).forEach(function (key) {
    dictionary.writeKey(key);
    if (key !== "Annots") {
      copyingContext.copyDirectObjectAsIs(page[key]);
      return;
    }
    objectsContext.startArray();
    keptIds.forEach(function (id) {
      objectsContext.writeIndirectObjectReference(id);
    });
    objectsContext.endArray(muhammara.eTokenSeparatorEndLine);
  });
  objectsContext.endDictionary(dictionary);
  objectsContext.endIndirectObject();
  copyingContext.end();
  writer.end();
}

module.exports = {
  findAnnotationId: findAnnotationId,
  editAnnotationContents: editAnnotationContents,
  removeAnnotation: removeAnnotation,
};
