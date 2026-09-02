#include "wasm_api_internal.h"

extern "C" {

WASM_EXPORT WasmRecipe* muhammara_wasm_recipe_create_with_options(
    int version, int compressStreams) {
  WasmRecipe* recipe = new WasmRecipe();
  if (((version < ePDFVersion10 || version > ePDFVersion17) &&
       version != ePDFVersion20) ||
       recipe->writer.StartPDFForStream(
           &recipe->output, static_cast<EPDFVersion>(version),
           LogConfiguration::DefaultLogConfiguration(),
           PDFCreationSettings(compressStreams != 0, true)) !=
      PDFHummus::eSuccess) {
    delete recipe;
    return nullptr;
  }
  return recipe;
}

WASM_EXPORT WasmRecipe* muhammara_wasm_recipe_create(int version) {
  return muhammara_wasm_recipe_create_with_options(version, 1);
}

WASM_EXPORT WasmObjectsContext* muhammara_wasm_recipe_get_objects_context(
    WasmRecipe* recipe) {
  if (recipe == nullptr || recipe->finished) return nullptr;
  WasmObjectsContext* context = new WasmObjectsContext(&recipe->writer.GetObjectsContext());
  recipe->objectsContexts.push_back(context);
  return context;
}

WASM_EXPORT WasmObjectsContext* muhammara_wasm_modifier_get_objects_context(
    WasmModifier* modifier) {
  if (modifier == nullptr || modifier->finished) return nullptr;
  WasmObjectsContext* context =
      new WasmObjectsContext(&modifier->writer.GetObjectsContext());
  modifier->objectsContexts.push_back(context);
  return context;
}

WASM_EXPORT ResourcesDictionary* muhammara_wasm_recipe_get_page_resources(
    WasmRecipe* recipe) {
  return recipe == nullptr || recipe->page == nullptr || recipe->finished
             ? nullptr
             : &recipe->page->GetResourcesDictionary();
}

WASM_EXPORT ResourcesDictionary* muhammara_wasm_modifier_get_page_resources(
    WasmModifier* modifier) {
  if (modifier == nullptr || modifier->finished) return nullptr;
  if (modifier->newPage != nullptr) return &modifier->newPage->GetResourcesDictionary();
  return modifier->page == nullptr ? nullptr : modifier->page->GetCurrentResourcesDictionary();
}

WASM_EXPORT ResourcesDictionary* muhammara_wasm_writer_get_form_resources(
    WasmRecipe* recipe, WasmForm* form) {
  return recipe == nullptr || form == nullptr || form->recipe != recipe ||
                 form->form == nullptr || recipe->finished
             ? nullptr
             : &form->form->GetResourcesDictionary();
}

WASM_EXPORT int muhammara_wasm_resources_add_procset(ResourcesDictionary* resources,
                                                      const char* name) {
  if (resources == nullptr || name == nullptr || *name == '\0') return 0;
  resources->AddProcsetResource(name);
  return 1;
}

WASM_EXPORT char* muhammara_wasm_resources_add_mapping(ResourcesDictionary* resources,
                                                        int type,
                                                        unsigned long objectId) {
  return addResourceMapping(resources, type, objectId);
}

WASM_EXPORT unsigned long muhammara_wasm_objects_allocate_new_object_id(
    WasmObjectsContext* context) {
  return context == nullptr ? 0
                            : context->context->GetInDirectObjectsRegistry()
                                  .AllocateNewObjectID();
}

WASM_EXPORT unsigned long muhammara_wasm_objects_start_indirect_object(
    WasmObjectsContext* context, unsigned long objectId) {
  if (context == nullptr || context->indirectObject || context->dictionary != nullptr ||
      context->stream != nullptr || context->freeContext) return 0;
  ObjectIDType id = objectId == 0 ? context->context->StartNewIndirectObject()
                                  : objectId;
  if (objectId != 0 &&
      context->context->StartNewIndirectObject(id) != PDFHummus::eSuccess) return 0;
  if (id == 0) return 0;
  context->indirectObject = true;
  return id;
}

WASM_EXPORT int muhammara_wasm_objects_end_indirect_object(WasmObjectsContext* context) {
  if (context == nullptr || !context->indirectObject || context->dictionary != nullptr ||
      context->stream != nullptr || context->freeContext) return 0;
  context->context->EndIndirectObject();
  context->indirectObject = false;
  return 1;
}

WASM_EXPORT int muhammara_wasm_objects_start_modified_indirect_object(
    WasmObjectsContext* context, unsigned long objectId) {
  if (context == nullptr || objectId == 0 || context->indirectObject ||
      context->dictionary != nullptr || context->stream != nullptr || context->freeContext ||
      context->context->StartModifiedIndirectObject(objectId) != PDFHummus::eSuccess) return 0;
  context->indirectObject = true;
  return 1;
}

WASM_EXPORT int muhammara_wasm_objects_delete_object(WasmObjectsContext* context,
                                                     unsigned long objectId) {
  if (context == nullptr || objectId == 0) return 0;
  context->context->GetInDirectObjectsRegistry().DeleteObject(objectId);
  return 1;
}

WASM_EXPORT WasmDictionaryContext* muhammara_wasm_objects_start_dictionary(
    WasmObjectsContext* context) {
  if (context == nullptr || context->dictionary != nullptr || context->stream != nullptr ||
      context->freeContext) return nullptr;
  DictionaryContext* dictionary = context->context->StartDictionary();
  if (dictionary == nullptr) return nullptr;
  context->dictionary = new WasmDictionaryContext(dictionary, context);
  context->dictionaries.push_back(context->dictionary);
  return context->dictionary;
}

WASM_EXPORT int muhammara_wasm_objects_end_dictionary(WasmObjectsContext* context,
                                                       WasmDictionaryContext* dictionary) {
  if (context == nullptr || dictionary == nullptr || context->dictionary != dictionary ||
      !dictionary->active ||
      context->context->EndDictionary(dictionary->context) != PDFHummus::eSuccess) return 0;
  dictionary->active = false;
  context->dictionary = nullptr;
  return 1;
}

WASM_EXPORT int muhammara_wasm_dictionary_write_key(WasmDictionaryContext* dictionary,
                                                     const char* key) {
  return dictionary != nullptr && dictionary->active && key != nullptr &&
         dictionary->context->WriteKey(key) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_dictionary_write_value(WasmDictionaryContext* dictionary,
                                                       int type, const char* value,
                                                       double number, unsigned long objectId,
                                                       int boolean) {
  if (dictionary == nullptr || !dictionary->active) return 0;
  switch (type) {
    case 0: dictionary->context->WriteNameValue(value == nullptr ? "" : value); break;
    case 1: dictionary->context->WriteLiteralStringValue(value == nullptr ? "" : value); break;
    case 2: dictionary->context->WriteHexStringValue(value == nullptr ? "" : value); break;
    case 3: dictionary->context->WriteDoubleValue(number); break;
    case 4: dictionary->context->WriteBooleanValue(boolean != 0); break;
    case 5: dictionary->context->WriteObjectReferenceValue(objectId, 0); break;
    case 6: dictionary->context->WriteNullValue(); break;
    default: return 0;
  }
  return 1;
}

WASM_EXPORT int muhammara_wasm_dictionary_write_bytes(
    WasmDictionaryContext* dictionary, int type, const unsigned char* value,
    unsigned int length) {
  if (dictionary == nullptr || !dictionary->active ||
      (value == nullptr && length != 0)) return 0;
  std::string bytes(reinterpret_cast<const char*>(value), length);
  if (type == 1) dictionary->context->WriteLiteralStringValue(bytes);
  else if (type == 2) dictionary->context->WriteHexStringValue(bytes);
  else return 0;
  return 1;
}

WASM_EXPORT int muhammara_wasm_dictionary_write_rectangle(
    WasmDictionaryContext* dictionary, double left, double bottom, double right, double top) {
  if (dictionary == nullptr || !dictionary->active) return 0;
  dictionary->context->WriteRectangleValue(PDFRectangle(left, bottom, right, top));
  return 1;
}

WASM_EXPORT int muhammara_wasm_objects_start_array(WasmObjectsContext* context) {
  if (context == nullptr || context->stream != nullptr || context->freeContext) return 0;
  context->context->StartArray();
  return 1;
}

WASM_EXPORT int muhammara_wasm_objects_end_array(WasmObjectsContext* context, int separator) {
  if (context == nullptr || separator < eTokenSeparatorSpace ||
      separator > eTokenSeparatorNone) return 0;
  context->context->EndArray(static_cast<ETokenSeparator>(separator));
  return 1;
}

WASM_EXPORT int muhammara_wasm_objects_write_number(WasmObjectsContext* context,
                                                     double value, int integer) {
  if (context == nullptr) return 0;
  if (integer) context->context->WriteInteger(static_cast<long long>(value));
  else context->context->WriteDouble(value);
  return 1;
}

WASM_EXPORT int muhammara_wasm_objects_write_string(WasmObjectsContext* context,
                                                     int type, const char* value) {
  if (context == nullptr || value == nullptr) return 0;
  switch (type) {
    case 0: context->context->WriteName(value); break;
    case 1: context->context->WriteLiteralString(value); break;
    case 2: context->context->WriteHexString(value); break;
    case 3: context->context->WriteKeyword(value); break;
    case 4: context->context->WriteComment(value); break;
    default: return 0;
  }
  return 1;
}

WASM_EXPORT int muhammara_wasm_objects_write_bytes(
    WasmObjectsContext* context, int type, const unsigned char* value,
    unsigned int length) {
  if (context == nullptr || (value == nullptr && length != 0)) return 0;
  std::string bytes(reinterpret_cast<const char*>(value), length);
  if (type == 1) context->context->WriteLiteralString(bytes);
  else if (type == 2) context->context->WriteHexString(bytes);
  else return 0;
  return 1;
}

WASM_EXPORT int muhammara_wasm_objects_write_boolean(WasmObjectsContext* context,
                                                      int value) {
  if (context == nullptr) return 0;
  context->context->WriteBoolean(value != 0);
  return 1;
}

WASM_EXPORT int muhammara_wasm_objects_write_reference(WasmObjectsContext* context,
                                                        unsigned long objectId,
                                                        unsigned long generation) {
  if (context == nullptr || objectId == 0) return 0;
  context->context->WriteIndirectObjectReference(objectId, generation);
  return 1;
}

WASM_EXPORT int muhammara_wasm_objects_end_line(WasmObjectsContext* context) {
  if (context == nullptr) return 0;
  context->context->EndLine();
  return 1;
}

WASM_EXPORT int muhammara_wasm_objects_set_compress_streams(WasmObjectsContext* context,
                                                             int value) {
  if (context == nullptr || context->stream != nullptr) return 0;
  context->context->SetCompressStreams(value != 0);
  return 1;
}

WASM_EXPORT WasmPDFStream* muhammara_wasm_objects_start_pdf_stream(
    WasmObjectsContext* context, WasmDictionaryContext* dictionary, int unfiltered) {
  if (context == nullptr || context->stream != nullptr || context->freeContext ||
      (dictionary != nullptr && (context->dictionary != dictionary || !dictionary->active))) {
    return nullptr;
  }
  PDFStream* stream = unfiltered
                          ? context->context->StartUnfilteredPDFStream(
                                dictionary == nullptr ? nullptr : dictionary->context)
                          : context->context->StartPDFStream(
                                dictionary == nullptr ? nullptr : dictionary->context);
  if (stream == nullptr) return nullptr;
  if (dictionary != nullptr) {
    dictionary->active = false;
    context->dictionary = nullptr;
  }
  context->stream = new WasmPDFStream(stream, context);
  context->streams.push_back(context->stream);
  return context->stream;
}

WASM_EXPORT WasmByteWriter* muhammara_wasm_pdf_stream_get_write_stream(
    WasmPDFStream* stream) {
  if (stream == nullptr || !stream->active) return nullptr;
  WasmByteWriter* writer =
      new WasmByteWriter(stream->stream->GetWriteStream(), stream->owner);
  stream->owner->writers.push_back(writer);
  return writer;
}

WASM_EXPORT int muhammara_wasm_byte_writer_write(WasmByteWriter* writer,
                                                 const unsigned char* bytes,
                                                 unsigned int length) {
  if (writer == nullptr || !writer->active || (bytes == nullptr && length != 0)) return -1;
  return static_cast<int>(writer->writer->Write(bytes, length));
}

WASM_EXPORT int muhammara_wasm_objects_end_pdf_stream(WasmObjectsContext* context,
                                                       WasmPDFStream* stream) {
  if (context == nullptr || stream == nullptr || context->stream != stream || !stream->active ||
      context->context->EndPDFStream(stream->stream) != PDFHummus::eSuccess) return 0;
  stream->active = false;
  delete stream->stream;
  stream->stream = nullptr;
  context->stream = nullptr;
  context->indirectObject = false;
  return 1;
}

WASM_EXPORT WasmContentStream* muhammara_wasm_page_content_get_stream(
    WasmRecipe* recipe) {
  if (recipe == nullptr || recipe->finished || recipe->context == nullptr)
    return nullptr;
  PDFStream* stream = recipe->context->GetCurrentPageContentStream();
  if (stream == nullptr) return nullptr;
  WasmContentStream* handle = new WasmContentStream(stream, recipe);
  recipe->contentStreams.push_back(handle);
  return handle;
}

WASM_EXPORT WasmContentStream* muhammara_wasm_form_get_content_stream(
    WasmRecipe* recipe, WasmForm* form) {
  if (recipe == nullptr || form == nullptr || form->recipe != recipe || form->form == nullptr ||
      form->ended || recipe->finished)
    return nullptr;
  PDFStream* stream = form->form->GetContentStream();
  if (stream == nullptr) return nullptr;
  WasmContentStream* handle = new WasmContentStream(stream, recipe, form);
  recipe->contentStreams.push_back(handle);
  return handle;
}

WASM_EXPORT WasmContentByteWriter*
muhammara_wasm_content_stream_get_write_stream(WasmContentStream* stream) {
  if (stream == nullptr || !stream->active || stream->recipe->finished ||
      (stream->form == nullptr && stream->recipe->context == nullptr) ||
      (stream->form != nullptr && stream->form->ended))
    return nullptr;
  WasmContentByteWriter* writer = new WasmContentByteWriter(stream);
  stream->recipe->contentWriters.push_back(writer);
  return writer;
}

WASM_EXPORT int muhammara_wasm_content_byte_writer_write(
    WasmContentByteWriter* writer, const unsigned char* bytes,
    unsigned int length) {
  if (writer == nullptr || !writer->active || writer->stream == nullptr ||
      !writer->stream->active || writer->stream->recipe->finished ||
      (writer->stream->form == nullptr &&
       writer->stream->recipe->context == nullptr) ||
      (writer->stream->form != nullptr && writer->stream->form->ended) ||
      (bytes == nullptr && length != 0))
    return -1;
  return static_cast<int>(
      writer->stream->stream->GetWriteStream()->Write(bytes, length));
}

WASM_EXPORT WasmByteWriter* muhammara_wasm_objects_start_free_context(
    WasmObjectsContext* context) {
  if (context == nullptr || context->freeContext || context->dictionary != nullptr ||
      context->stream != nullptr) return nullptr;
  context->freeWriter =
      new WasmByteWriter(context->context->StartFreeContext(), context);
  context->writers.push_back(context->freeWriter);
  context->freeContext = context->freeWriter->writer != nullptr;
  return context->freeWriter;
}

WASM_EXPORT int muhammara_wasm_objects_end_free_context(WasmObjectsContext* context) {
  if (context == nullptr || !context->freeContext) return 0;
  context->context->EndFreeContext();
  context->freeWriter->active = false;
  context->freeContext = false;
  context->freeWriter = nullptr;
  return 1;
}

WASM_EXPORT double muhammara_wasm_objects_get_current_position(
    WasmObjectsContext* context) {
  return context == nullptr ? -1 : static_cast<double>(context->context->GetCurrentPosition());
}

}  // extern "C"
