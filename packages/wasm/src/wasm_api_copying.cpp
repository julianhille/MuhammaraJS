#include "wasm_api_internal.h"

extern "C" {

WASM_EXPORT WasmCopyingContext* muhammara_wasm_modifier_create_copying_context(
    WasmModifier* modifier, const char* path) {
  if (modifier == nullptr || path == nullptr || modifier->finished) return nullptr;
  PDFDocumentCopyingContext* context = modifier->writer.CreatePDFCopyingContext(path);
  if (context == nullptr) return nullptr;
  WasmCopyingContext* handle = new WasmCopyingContext();
  handle->modifier = modifier;
  handle->context = context;
  return handle;
}

WASM_EXPORT WasmCopyingContext*
muhammara_wasm_modifier_create_copying_context_for_modified_file(
    WasmModifier* modifier) {
  if (modifier == nullptr || modifier->finished) return nullptr;
  PDFDocumentCopyingContext* context =
      modifier->writer.CreatePDFCopyingContextForModifiedFile();
  if (context == nullptr) return nullptr;
  WasmCopyingContext* handle = new WasmCopyingContext();
  handle->modifier = modifier;
  handle->context = context;
  return handle;
}

WASM_EXPORT WasmCopyingContext* muhammara_wasm_writer_create_copying_context(
    WasmRecipe* recipe, const char* path) {
  if (recipe == nullptr || path == nullptr || recipe->finished) return nullptr;
  PDFDocumentCopyingContext* context = recipe->writer.CreatePDFCopyingContext(path);
  if (context == nullptr) return nullptr;
  WasmCopyingContext* handle = new WasmCopyingContext();
  handle->recipe = recipe;
  handle->context = context;
  return handle;
}

WASM_EXPORT unsigned long* muhammara_wasm_writer_create_forms_from_pdf(
    WasmRecipe* recipe, unsigned char* bytes, unsigned long length, int pageBox,
    const unsigned long* ranges, unsigned int rangeCount,
    const double* cropBox, const double* transformationMatrix,
    const unsigned long* additionalObjectIds, unsigned int additionalObjectCount,
    unsigned int* outputCount) {
  if (outputCount == nullptr) return nullptr;
  *outputCount = 0;
  if (recipe == nullptr || bytes == nullptr || length == 0 || recipe->finished ||
       pageBox < ePDFPageBoxMediaBox || pageBox > ePDFPageBoxArtBox ||
       (rangeCount != 0 && ranges == nullptr) ||
       (additionalObjectCount != 0 && additionalObjectIds == nullptr)) return nullptr;

  PDFPageRange pageRange;
  if (rangeCount != 0) {
    pageRange.mType = PDFPageRange::eRangeTypeSpecific;
    for (unsigned int index = 0; index < rangeCount; ++index) {
      unsigned long start = ranges[index * 2];
      unsigned long end = ranges[index * 2 + 1];
      if (end < start) return nullptr;
      pageRange.mSpecificRanges.push_back(ULongAndULong(start, end));
    }
  }
  ObjectIDTypeList additionalObjects;
  for (unsigned int index = 0; index < additionalObjectCount; ++index) {
    additionalObjects.push_back(additionalObjectIds[index]);
  }
  InputByteArrayStream stream(bytes, length);
  EStatusCodeAndObjectIDTypeList result;
  if (cropBox != nullptr) {
    result = recipe->writer.CreateFormXObjectsFromPDF(
        &stream, pageRange,
        PDFRectangle(cropBox[0], cropBox[1], cropBox[2], cropBox[3]),
        transformationMatrix, additionalObjects);
  } else {
    result = recipe->writer.CreateFormXObjectsFromPDF(
        &stream, pageRange, static_cast<EPDFPageBox>(pageBox),
        transformationMatrix, additionalObjects);
  }
  if (result.first != PDFHummus::eSuccess || result.second.empty()) return nullptr;

  unsigned int count = static_cast<unsigned int>(result.second.size());
  unsigned long* ids = static_cast<unsigned long*>(
      std::malloc(sizeof(unsigned long) * count));
  if (ids == nullptr) return nullptr;
  unsigned int index = 0;
  for (ObjectIDType id : result.second) ids[index++] = id;
  *outputCount = count;
  return ids;
}

// This deliberately uses PDFWriter's stream overload instead of creating a
// copying context: append is an immediate writer operation with page IDs.
WASM_EXPORT unsigned long* muhammara_wasm_writer_append_pages_from_pdf(
    WasmRecipe* recipe, unsigned char* bytes, unsigned long length,
    const unsigned long* ranges, unsigned int rangeCount, int* errorCode,
    unsigned int* outputCount) {
  if (errorCode == nullptr || outputCount == nullptr) return nullptr;
  *errorCode = 1;
  *outputCount = 0;
  if (recipe == nullptr || bytes == nullptr || length == 0 || recipe->finished ||
      recipe->page != nullptr || (rangeCount != 0 && ranges == nullptr)) {
    return nullptr;
  }

  {
    InputByteArrayStream inspectionStream(bytes, length);
    PDFParser parser;
    if (parser.StartPDFParsing(&inspectionStream) != PDFHummus::eSuccess) {
      return nullptr;
    }
    if (parser.IsEncrypted()) {
      *errorCode = 2;
      return nullptr;
    }
  }

  PDFPageRange pageRange;
  if (rangeCount != 0) {
    pageRange.mType = PDFPageRange::eRangeTypeSpecific;
    for (unsigned int index = 0; index < rangeCount; ++index) {
      unsigned long start = ranges[index * 2];
      unsigned long end = ranges[index * 2 + 1];
      if (end < start) return nullptr;
      pageRange.mSpecificRanges.push_back(ULongAndULong(start, end));
    }
  }
  InputByteArrayStream stream(bytes, length);
  EStatusCodeAndObjectIDTypeList result = recipe->writer.AppendPDFPagesFromPDF(
      &stream, pageRange);
  if (result.first != PDFHummus::eSuccess) return nullptr;

  *errorCode = 0;
  unsigned int count = static_cast<unsigned int>(result.second.size());
  *outputCount = count;
  if (count == 0) return nullptr;
  unsigned long* ids = static_cast<unsigned long*>(
      std::malloc(sizeof(unsigned long) * count));
  if (ids == nullptr) {
    *errorCode = 1;
    *outputCount = 0;
    return nullptr;
  }
  unsigned int index = 0;
  for (ObjectIDType id : result.second) ids[index++] = id;
  return ids;
}

// Like append, this uses PDFWriter's stream overload directly. The target page
// may have an open content context so callers can surround merged content.
WASM_EXPORT int muhammara_wasm_writer_merge_pages_to_page_from_pdf(
    WasmRecipe* recipe, unsigned char* bytes, unsigned long length,
    const unsigned long* ranges, unsigned int rangeCount, int* errorCode) {
  if (errorCode == nullptr) return 0;
  *errorCode = 1;
  if (recipe == nullptr || bytes == nullptr || length == 0 || recipe->finished ||
      recipe->page == nullptr || (rangeCount != 0 && ranges == nullptr)) {
    return 0;
  }

  {
    InputByteArrayStream inspectionStream(bytes, length);
    PDFParser parser;
    if (parser.StartPDFParsing(&inspectionStream) != PDFHummus::eSuccess) {
      return 0;
    }
    if (parser.IsEncrypted()) {
      *errorCode = 2;
      return 0;
    }
  }

  PDFPageRange pageRange;
  if (rangeCount != 0) {
    pageRange.mType = PDFPageRange::eRangeTypeSpecific;
    for (unsigned int index = 0; index < rangeCount; ++index) {
      unsigned long start = ranges[index * 2];
      unsigned long end = ranges[index * 2 + 1];
      if (end < start) return 0;
      pageRange.mSpecificRanges.push_back(ULongAndULong(start, end));
    }
  }
  InputByteArrayStream stream(bytes, length);
  if (recipe->writer.MergePDFPagesToPage(recipe->page, &stream, pageRange) !=
      PDFHummus::eSuccess) {
    return 0;
  }
  *errorCode = 0;
  return 1;
}

WASM_EXPORT void muhammara_wasm_modifier_destroy_copying_context(WasmCopyingContext* context) {
  delete context;
}

WASM_EXPORT unsigned long muhammara_wasm_copying_context_append_page(
    WasmCopyingContext* context, unsigned long pageIndex) {
  if (context == nullptr || context->context == nullptr || context->ended ||
       (context->modifier != nullptr && context->modifier->finished) ||
       (context->recipe != nullptr && context->recipe->finished)) return 0;
  EStatusCodeAndObjectIDType result = context->context->AppendPDFPageFromPDF(pageIndex);
  return result.first == PDFHummus::eSuccess ? result.second : 0;
}

WASM_EXPORT int muhammara_wasm_copying_context_merge_page(WasmCopyingContext* context,
                                               unsigned long pageIndex) {
  if (context == nullptr || context->context == nullptr || context->ended) return 0;
  PDFPage* page = context->modifier == nullptr
                      ? (context->recipe == nullptr ? nullptr : context->recipe->page)
                      : context->modifier->newPage;
  return page != nullptr && context->context->MergePDFPageToPage(page, pageIndex) ==
                                PDFHummus::eSuccess;
}

WASM_EXPORT unsigned long muhammara_wasm_copying_context_create_form_from_page(
    WasmCopyingContext* context, unsigned long pageIndex, int pageBox,
    const double* cropBox, const double* transformation) {
  if (context == nullptr || context->context == nullptr || context->ended ||
      (cropBox == nullptr &&
       (pageBox < ePDFPageBoxMediaBox || pageBox > ePDFPageBoxArtBox))) return 0;
  EStatusCodeAndObjectIDType result = cropBox == nullptr
      ? context->context->CreateFormXObjectFromPDFPage(
            pageIndex, static_cast<EPDFPageBox>(pageBox), transformation)
      : context->context->CreateFormXObjectFromPDFPage(
            pageIndex, PDFRectangle(cropBox[0], cropBox[1], cropBox[2], cropBox[3]),
            transformation);
  return result.first == PDFHummus::eSuccess ? result.second : 0;
}

WASM_EXPORT int muhammara_wasm_copying_context_merge_page_to_form(
    WasmCopyingContext* context, WasmForm* form, unsigned long pageIndex) {
  if (context == nullptr || context->context == nullptr || context->ended ||
       form == nullptr || form->form == nullptr || form->ended ||
       (context->recipe != nullptr &&
         (context->recipe->finished || form->recipe != context->recipe)) ||
       (context->modifier != nullptr &&
        (context->modifier->finished || form->modifier != context->modifier))) return 0;
  return context->context->MergePDFPageToFormXObject(form->form, pageIndex) ==
          PDFHummus::eSuccess;
}

WASM_EXPORT WasmCopyingParser* muhammara_wasm_copying_context_get_source_document_parser(
    WasmCopyingContext* context) {
  if (context == nullptr || context->context == nullptr || context->ended) return nullptr;
  PDFParser* parser = context->context->GetSourceDocumentParser();
  if (parser == nullptr) return nullptr;
  WasmCopyingParser* handle = new WasmCopyingParser(context, parser);
  context->parsers.push_back(handle);
  return handle;
}

WASM_EXPORT WasmByteReader*
muhammara_wasm_copying_context_get_source_document_stream(
    WasmCopyingContext* context) {
  if (context == nullptr || context->context == nullptr || context->ended) {
    return nullptr;
  }
  IByteReaderWithPosition* stream = context->context->GetSourceDocumentStream();
  if (stream == nullptr) return nullptr;
  WasmByteReader* handle = new WasmByteReader(stream, nullptr);
  context->byteReaders.push_back(handle);
  return handle;
}

WASM_EXPORT unsigned long muhammara_wasm_copying_parser_get_pages_count(
    WasmCopyingParser* parser) {
  return parser == nullptr || !parser->active ? 0 : parser->GetParser().GetPagesCount();
}

WASM_EXPORT unsigned long muhammara_wasm_copying_parser_get_page_object_id(
    WasmCopyingParser* parser, unsigned long index) {
  if (parser == nullptr || !parser->active || index >= parser->GetParser().GetPagesCount()) {
    return 0;
  }
  return parser->GetParser().GetPageObjectID(index);
}

WASM_EXPORT WasmObject* muhammara_wasm_copying_parser_parse_page(
    WasmCopyingParser* parser, unsigned long index) {
  if (parser == nullptr || !parser->active || index >= parser->GetParser().GetPagesCount()) {
    return nullptr;
  }
  return addCopyingObject(parser, parser->GetParser().ParsePage(index));
}

WASM_EXPORT WasmObject* muhammara_wasm_copying_parser_query_dictionary_object(
    WasmCopyingParser* parser, WasmObject* dictionary, const char* key) {
  if (parser == nullptr || !parser->active || dictionary == nullptr ||
      dictionary->copyingParser != parser || key == nullptr ||
      dictionary->object->GetType() != PDFObject::ePDFObjectDictionary) {
    return nullptr;
  }
  return addCopyingObject(parser, parser->GetParser().QueryDictionaryObject(
      static_cast<PDFDictionary*>(dictionary->object), key));
}

WASM_EXPORT WasmObject* muhammara_wasm_copying_parser_query_array_object(
    WasmCopyingParser* parser, WasmObject* array, unsigned long index) {
  if (parser == nullptr || !parser->active || array == nullptr ||
      array->copyingParser != parser ||
      array->object->GetType() != PDFObject::ePDFObjectArray) {
    return nullptr;
  }
  return addCopyingObject(parser, parser->GetParser().QueryArrayObject(
      static_cast<PDFArray*>(array->object), index));
}

WASM_EXPORT int muhammara_wasm_copying_context_copy_direct_object_as_is(
    WasmCopyingContext* context, WasmObject* object) {
  if (context == nullptr || context->context == nullptr || context->ended ||
      object == nullptr || object->copyingParser == nullptr ||
      !object->copyingParser->active || object->copyingParser->owner != context) {
    return 0;
  }
  return context->context->CopyDirectObjectAsIs(object->object) == PDFHummus::eSuccess;
}

static bool isActiveCopyingContext(WasmCopyingContext* context) {
  return context != nullptr && context->context != nullptr && !context->ended &&
         (context->recipe == nullptr || !context->recipe->finished) &&
         (context->modifier == nullptr || !context->modifier->finished);
}

WASM_EXPORT int muhammara_wasm_copying_context_copy_object(
    WasmCopyingContext* context, unsigned long sourceObjectId,
    unsigned long* copiedObjectId) {
  if (!isActiveCopyingContext(context) || copiedObjectId == nullptr) return 0;
  EStatusCodeAndObjectIDType result = context->context->CopyObject(sourceObjectId);
  if (result.first != PDFHummus::eSuccess) return 0;
  *copiedObjectId = result.second;
  return 1;
}

WASM_EXPORT int muhammara_wasm_copying_context_copy_direct_object_with_deep_copy(
    WasmCopyingContext* context, WasmObject* object, unsigned long** objectIds,
    unsigned int* objectCount) {
  if (objectIds == nullptr || objectCount == nullptr) return 0;
  *objectIds = nullptr;
  *objectCount = 0;
  if (!isActiveCopyingContext(context) || object == nullptr ||
      object->copyingParser == nullptr || !object->copyingParser->active ||
      object->copyingParser->owner != context) return 0;
  EStatusCodeAndObjectIDTypeList result =
      context->context->CopyDirectObjectWithDeepCopy(object->object);
  if (result.first != PDFHummus::eSuccess) return 0;
  if (result.second.empty()) return 1;
  unsigned long* ids = static_cast<unsigned long*>(
      std::malloc(sizeof(unsigned long) * result.second.size()));
  if (ids == nullptr) return 0;
  unsigned int index = 0;
  for (ObjectIDType id : result.second) ids[index++] = id;
  *objectIds = ids;
  *objectCount = index;
  return 1;
}

WASM_EXPORT int muhammara_wasm_copying_context_copy_new_objects_for_direct_object(
    WasmCopyingContext* context, const unsigned long* objectIds,
    unsigned int objectCount) {
  if (!isActiveCopyingContext(context) ||
      (objectCount != 0 && objectIds == nullptr)) return 0;
  ObjectIDTypeList ids;
  for (unsigned int index = 0; index < objectCount; ++index) ids.push_back(objectIds[index]);
  return context->context->CopyNewObjectsForDirectObject(ids) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_copying_context_get_copied_object_id(
    WasmCopyingContext* context, unsigned long sourceObjectId,
    unsigned long* copiedObjectId) {
  if (!isActiveCopyingContext(context) || copiedObjectId == nullptr) return 0;
  EStatusCodeAndObjectIDType result = context->context->GetCopiedObjectID(sourceObjectId);
  if (result.first != PDFHummus::eSuccess) return 0;
  *copiedObjectId = result.second;
  return 1;
}

WASM_EXPORT int muhammara_wasm_copying_context_get_copied_objects(
    WasmCopyingContext* context, unsigned long** sourceObjectIds,
    unsigned long** copiedObjectIds, unsigned int* objectCount) {
  if (sourceObjectIds == nullptr || copiedObjectIds == nullptr || objectCount == nullptr) return 0;
  *sourceObjectIds = nullptr;
  *copiedObjectIds = nullptr;
  *objectCount = 0;
  if (!isActiveCopyingContext(context)) return 0;
  ObjectIDTypeToObjectIDTypeMap mapping;
  MapIterator<ObjectIDTypeToObjectIDTypeMap> iterator =
      context->context->GetCopiedObjectsMappingIterator();
  while (iterator.MoveNext()) mapping.insert(
      ObjectIDTypeToObjectIDTypeMap::value_type(iterator.GetKey(), iterator.GetValue()));
  if (mapping.empty()) return 1;
  unsigned long* sources = static_cast<unsigned long*>(
      std::malloc(sizeof(unsigned long) * mapping.size()));
  unsigned long* copies = static_cast<unsigned long*>(
      std::malloc(sizeof(unsigned long) * mapping.size()));
  if (sources == nullptr || copies == nullptr) {
    std::free(sources);
    std::free(copies);
    return 0;
  }
  unsigned int index = 0;
  for (const auto& entry : mapping) {
    sources[index] = entry.first;
    copies[index++] = entry.second;
  }
  *sourceObjectIds = sources;
  *copiedObjectIds = copies;
  *objectCount = index;
  return 1;
}

WASM_EXPORT int muhammara_wasm_copying_context_replace_source_objects(
    WasmCopyingContext* context, const unsigned long* sourceObjectIds,
    const unsigned long* replacementObjectIds, unsigned int objectCount) {
  if (!isActiveCopyingContext(context) ||
      (objectCount != 0 && (sourceObjectIds == nullptr || replacementObjectIds == nullptr))) {
    return 0;
  }
  ObjectIDTypeToObjectIDTypeMap replacements;
  for (unsigned int index = 0; index < objectCount; ++index) {
    replacements.insert(ObjectIDTypeToObjectIDTypeMap::value_type(
        sourceObjectIds[index], replacementObjectIds[index]));
  }
  context->context->ReplaceSourceObjects(replacements);
  return 1;
}

WASM_EXPORT int muhammara_wasm_copying_context_end(WasmCopyingContext* context) {
  if (context == nullptr || context->context == nullptr || context->ended) return 0;
  for (WasmCopyingParser* parser : context->parsers) {
    parser->active = false;
    delete parser;
  }
  context->parsers.clear();
  for (WasmByteReader* reader : context->byteReaders) {
    reader->active = false;
    delete reader;
  }
  context->byteReaders.clear();
  context->context->End();
  context->ended = true;
  return 1;
}

}  // extern "C"
