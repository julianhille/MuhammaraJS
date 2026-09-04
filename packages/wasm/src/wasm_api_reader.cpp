#include "wasm_api_internal.h"

extern "C" {

WasmReader* muhammara_wasm_reader_create(const char* path) {
  if (path == nullptr) {
    return nullptr;
  }
  WasmReader* reader = new WasmReader();
  if (reader->input.OpenFile(path) != PDFHummus::eSuccess ||
      reader->parser.StartPDFParsing(reader->input.GetInputStream()) !=
          PDFHummus::eSuccess) {
    delete reader;
    return nullptr;
  }
  return reader;
}

// The modified-file parser belongs to PDFWriter. This reader wrapper owns only
// its derived handles, never the parser or its backing input.
WASM_EXPORT WasmReader* muhammara_wasm_modifier_get_modified_file_parser(
    WasmModifier* modifier) {
  if (modifier == nullptr || modifier->finished) return nullptr;
  PDFParser* parser = &modifier->writer.GetModifiedFileParser();
  if (parser->GetTrailer() == nullptr) return nullptr;
  WasmReader* reader = new WasmReader();
  reader->parserView = parser;
  return reader;
}

void muhammara_wasm_reader_destroy(WasmReader* reader) {
  delete reader;
}

unsigned long muhammara_wasm_reader_get_pages_count(WasmReader* reader) {
  return reader == nullptr ? 0 : reader->GetParser().GetPagesCount();
}

unsigned long muhammara_wasm_reader_get_page_object_id(WasmReader* reader,
                                                        unsigned long index) {
  if (reader == nullptr || index >= reader->GetParser().GetPagesCount()) {
    return 0;
  }
  return reader->GetParser().GetPageObjectID(index);
}

WASM_EXPORT unsigned long muhammara_wasm_reader_get_xref_size(WasmReader* reader) {
  return reader == nullptr ? 0 : reader->GetParser().GetXrefSize();
}

WASM_EXPORT double muhammara_wasm_reader_get_xref_position(WasmReader* reader) {
  return reader == nullptr ? -1 : static_cast<double>(reader->GetParser().GetXrefPosition());
}

WASM_EXPORT int muhammara_wasm_reader_get_xref_entry(WasmReader* reader,
                                                      unsigned long objectId,
                                                      double* values) {
  if (reader == nullptr || values == nullptr) {
    return 0;
  }
  XrefEntryInput* entry = reader->GetParser().GetXrefEntry(objectId);
  if (entry == nullptr) {
    return 0;
  }
  values[0] = static_cast<double>(entry->mObjectPosition);
  values[1] = static_cast<double>(entry->mRivision);
  values[2] = static_cast<double>(entry->mType);
  return 1;
}

WASM_EXPORT int muhammara_wasm_reader_get_trailer_entry_type(WasmReader* reader,
                                                              const char* key) {
  if (reader == nullptr || key == nullptr || reader->GetParser().GetTrailer() == nullptr) {
    return -1;
  }
  PDFObject* object = reader->GetParser().QueryDictionaryObject(reader->GetParser().GetTrailer(), key);
  if (object == nullptr) {
    return -1;
  }
  int type = object->GetType();
  object->Release();
  return type;
}

WASM_EXPORT WasmObject* muhammara_wasm_reader_get_trailer(WasmReader* reader) {
  if (reader == nullptr || reader->GetParser().GetTrailer() == nullptr) return nullptr;
  PDFDictionary* trailer = reader->GetParser().GetTrailer();
  trailer->AddRef();
  return addReaderObject(reader, trailer);
}

WASM_EXPORT WasmObject* muhammara_wasm_reader_query_dictionary_object(
    WasmReader* reader, WasmObject* dictionary, const char* key) {
  if (reader == nullptr || dictionary == nullptr || key == nullptr ||
      dictionary->reader != reader ||
      dictionary->object->GetType() != PDFObject::ePDFObjectDictionary) return nullptr;
  return addReaderObject(reader, reader->GetParser().QueryDictionaryObject(
      static_cast<PDFDictionary*>(dictionary->object), key));
}

WASM_EXPORT WasmObject* muhammara_wasm_reader_query_array_object(
    WasmReader* reader, WasmObject* array, unsigned long index) {
  if (reader == nullptr || array == nullptr ||
      array->reader != reader ||
      array->object->GetType() != PDFObject::ePDFObjectArray) return nullptr;
  return addReaderObject(reader, reader->GetParser().QueryArrayObject(
      static_cast<PDFArray*>(array->object), index));
}

WASM_EXPORT WasmObject* muhammara_wasm_reader_parse_object(WasmReader* reader,
                                                             unsigned long objectId) {
  return reader == nullptr ? nullptr : addReaderObject(reader,
      reader->GetParser().ParseNewObject(objectId));
}

WASM_EXPORT WasmObject* muhammara_wasm_reader_parse_page_dictionary(
    WasmReader* reader, unsigned long index) {
  return reader == nullptr ? nullptr : addReaderObject(reader,
      reader->GetParser().ParsePage(index));
}

WASM_EXPORT WasmPageInput* muhammara_wasm_reader_parse_page(
    WasmReader* reader, unsigned long index) {
  if (reader == nullptr || index >= reader->GetParser().GetPagesCount()) return nullptr;
  RefCountPtr<PDFDictionary> dictionary(reader->GetParser().ParsePage(index));
  if (!dictionary) return nullptr;
  WasmPageInput* page = new WasmPageInput(reader, dictionary);
  if (!page->page) {
    delete page;
    return nullptr;
  }
  reader->pages.push_back(page);
  return page;
}

// status: 1 success, 2 invalid input or missing/invalid page, 3 extraction safety limit.
WASM_EXPORT WasmTextExtraction* muhammara_wasm_reader_extract_page_text(
    WasmReader* reader, unsigned long index, unsigned int maxElements,
    unsigned int maxOperands, unsigned int maxTextBytes,
    unsigned int maxParsedObjects, int* status) {
  if (status == nullptr) return nullptr;
  *status = 2;
  if (reader == nullptr || maxElements == 0 || maxOperands == 0 ||
      maxTextBytes == 0 || maxParsedObjects == 0 ||
      index >= reader->GetParser().GetPagesCount()) return nullptr;
  RefCountPtr<PDFDictionary> page(reader->GetParser().ParsePage(index));
  if (!page) return nullptr;
  WasmTextExtraction* extraction = new WasmTextExtraction();
  if (!extractPageText(&reader->GetParser(), page.GetPtr(), extraction->elements,
                       maxElements, maxOperands, maxTextBytes,
                       maxParsedObjects)) {
    delete extraction;
    *status = 3;
    return nullptr;
  }
  *status = 1;
  return extraction;
}

WASM_EXPORT void muhammara_wasm_text_extraction_destroy(
    WasmTextExtraction* extraction) {
  delete extraction;
}

WASM_EXPORT unsigned long muhammara_wasm_text_extraction_get_count(
    WasmTextExtraction* extraction) {
  return extraction == nullptr ? 0 : extraction->elements.size();
}

WASM_EXPORT unsigned char* muhammara_wasm_text_extraction_get_content(
    WasmTextExtraction* extraction, unsigned long index, unsigned int* length) {
  if (extraction == nullptr || index >= extraction->elements.size()) return nullptr;
  return copyObjectString(extraction->elements[index].content, length);
}

WASM_EXPORT unsigned char* muhammara_wasm_text_extraction_get_font_resource(
    WasmTextExtraction* extraction, unsigned long index, unsigned int* length) {
  if (extraction == nullptr || index >= extraction->elements.size()) return nullptr;
  return copyObjectString(extraction->elements[index].fontResource, length);
}

WASM_EXPORT double muhammara_wasm_text_extraction_get_font_size(
    WasmTextExtraction* extraction, unsigned long index) {
  return extraction == nullptr || index >= extraction->elements.size()
             ? 0
             : extraction->elements[index].fontSize;
}

WASM_EXPORT double muhammara_wasm_text_extraction_get_text_matrix(
    WasmTextExtraction* extraction, unsigned long index, unsigned long matrixIndex) {
  return extraction == nullptr || index >= extraction->elements.size() || matrixIndex >= 6
             ? 0
             : extraction->elements[index].textMatrix[matrixIndex];
}

WASM_EXPORT WasmObject* muhammara_wasm_page_input_get_dictionary(
    WasmPageInput* page) {
  if (page == nullptr || page->owner == nullptr || !page->dictionary) return nullptr;
  page->dictionary->AddRef();
  return addReaderObject(page->owner, page->dictionary);
}

static int getPageInputBox(WasmPageInput* page, int box, double* values) {
  if (page == nullptr || values == nullptr) return 0;
  PDFRectangle rectangle;
  switch (box) {
    case 0: rectangle = page->page.GetMediaBox(); break;
    case 1: rectangle = page->page.GetCropBox(); break;
    case 2: rectangle = page->page.GetTrimBox(); break;
    case 3: rectangle = page->page.GetBleedBox(); break;
    case 4: rectangle = page->page.GetArtBox(); break;
    default: return 0;
  }
  values[0] = rectangle.LowerLeftX;
  values[1] = rectangle.LowerLeftY;
  values[2] = rectangle.UpperRightX;
  values[3] = rectangle.UpperRightY;
  return 1;
}

WASM_EXPORT int muhammara_wasm_page_input_get_box(
    WasmPageInput* page, int box, double* values) {
  return getPageInputBox(page, box, values);
}

WASM_EXPORT int muhammara_wasm_page_input_get_rotate(WasmPageInput* page,
                                                      int* value) {
  if (page == nullptr || value == nullptr) return 0;
  *value = page->page.GetRotate();
  return 1;
}

WASM_EXPORT WasmObjectParser* muhammara_wasm_reader_start_reading_objects_from_stream(
    WasmReader* reader, WasmObject* stream) {
  if (reader == nullptr || stream == nullptr || stream->reader != reader ||
      stream->object->GetType() != PDFObject::ePDFObjectStream) return nullptr;
  PDFObjectParser* parser = reader->GetParser().StartReadingObjectsFromStream(
      static_cast<PDFStreamInput*>(stream->object));
  if (parser == nullptr) return nullptr;
  WasmObjectParser* handle = new WasmObjectParser(parser);
  reader->objectParsers.push_back(handle);
  return handle;
}

WASM_EXPORT WasmObjectParser*
muhammara_wasm_reader_start_reading_objects_from_streams(WasmReader* reader,
                                                         WasmObject* streams) {
  if (reader == nullptr || streams == nullptr || streams->reader != reader ||
      streams->object->GetType() != PDFObject::ePDFObjectArray) {
    return nullptr;
  }
  PDFObjectParser* parser = reader->GetParser().StartReadingObjectsFromStreams(
      static_cast<PDFArray*>(streams->object));
  if (parser == nullptr) return nullptr;
  WasmObjectParser* handle = new WasmObjectParser(parser);
  reader->objectParsers.push_back(handle);
  return handle;
}

WASM_EXPORT WasmByteReader* muhammara_wasm_reader_start_reading_from_stream(
    WasmReader* reader, WasmObject* stream, int plainCopying) {
  if (reader == nullptr || stream == nullptr || stream->reader != reader ||
      stream->object->GetType() != PDFObject::ePDFObjectStream) {
    return nullptr;
  }
  IByteReader* nativeReader = plainCopying
                                   ? reader->GetParser().StartReadingFromStreamForPlainCopying(
                                        static_cast<PDFStreamInput*>(stream->object))
                                   : reader->GetParser().StartReadingFromStream(
                                        static_cast<PDFStreamInput*>(stream->object));
  if (nativeReader == nullptr) return nullptr;
  WasmByteReader* handle = new WasmByteReader(nativeReader, reader);
  reader->byteReaders.push_back(handle);
  return handle;
}

WASM_EXPORT WasmByteReader* muhammara_wasm_reader_get_parser_stream(
    WasmReader* reader) {
  if (reader == nullptr) return nullptr;
  WasmByteReader* handle = new WasmByteReader(reader->GetParser().GetParserStream(), reader);
  reader->byteReaders.push_back(handle);
  return handle;
}

WASM_EXPORT int muhammara_wasm_byte_reader_read(WasmByteReader* reader,
                                                unsigned char* bytes,
                                                unsigned int length) {
  if (reader == nullptr || !reader->active || reader->reader == nullptr ||
      (bytes == nullptr && length != 0)) return -1;
  return static_cast<int>(reader->reader->Read(bytes, length));
}

WASM_EXPORT int muhammara_wasm_byte_reader_not_ended(WasmByteReader* reader) {
  return reader != nullptr && reader->active && reader->reader != nullptr &&
         reader->reader->NotEnded();
}

WASM_EXPORT int muhammara_wasm_byte_reader_set_position(WasmByteReader* reader,
                                                         double position) {
  if (reader == nullptr || !reader->active || reader->positionedReader == nullptr ||
      !std::isfinite(position) || position < 0 ||
      position > static_cast<double>(std::numeric_limits<long long>::max())) {
    return 0;
  }
  reader->positionedReader->SetPosition(
      static_cast<IOBasicTypes::LongFilePositionType>(position));
  return 1;
}

WASM_EXPORT int muhammara_wasm_byte_reader_set_position_from_end(
    WasmByteReader* reader, double position) {
  if (reader == nullptr || !reader->active || reader->positionedReader == nullptr ||
      !std::isfinite(position) || position < 0 ||
      position > static_cast<double>(std::numeric_limits<long long>::max())) {
    return 0;
  }
  reader->positionedReader->SetPositionFromEnd(
      static_cast<IOBasicTypes::LongFilePositionType>(position));
  return 1;
}

WASM_EXPORT int muhammara_wasm_byte_reader_skip(WasmByteReader* reader,
                                                double amount) {
  if (reader == nullptr || !reader->active || reader->positionedReader == nullptr ||
      !std::isfinite(amount) || amount < 0 ||
      amount > static_cast<double>(std::numeric_limits<size_t>::max())) {
    return 0;
  }
  reader->positionedReader->Skip(
      static_cast<IOBasicTypes::LongBufferSizeType>(amount));
  return 1;
}

WASM_EXPORT double muhammara_wasm_byte_reader_get_current_position(
    WasmByteReader* reader) {
  if (reader == nullptr || !reader->active || reader->positionedReader == nullptr) {
    return -1;
  }
  return static_cast<double>(reader->positionedReader->GetCurrentPosition());
}

WASM_EXPORT void muhammara_wasm_byte_reader_destroy(WasmByteReader* reader) {
  if (reader == nullptr || !reader->active) return;
  if (reader->ownsReader) delete reader->reader;
  reader->reader = nullptr;
  reader->positionedReader = nullptr;
  reader->active = false;
}

WASM_EXPORT int muhammara_wasm_object_get_type(WasmObject* object) {
  return object == nullptr ? -1 : object->object->GetType();
}

WASM_EXPORT unsigned char* muhammara_wasm_object_get_string(
    WasmObject* object, unsigned int* outputLength) {
  if (object == nullptr) return nullptr;
  std::string value;
  switch (object->object->GetType()) {
    case PDFObject::ePDFObjectName: value = static_cast<PDFName*>(object->object)->GetValue(); break;
    case PDFObject::ePDFObjectLiteralString: value = static_cast<PDFLiteralString*>(object->object)->GetValue(); break;
    case PDFObject::ePDFObjectHexString: value = static_cast<PDFHexString*>(object->object)->GetValue(); break;
    case PDFObject::ePDFObjectInteger: value = std::to_string(static_cast<PDFInteger*>(object->object)->GetValue()); break;
    case PDFObject::ePDFObjectReal: value = std::to_string(static_cast<PDFReal*>(object->object)->GetValue()); break;
    case PDFObject::ePDFObjectSymbol: value = static_cast<PDFSymbol*>(object->object)->GetValue(); break;
    case PDFObject::ePDFObjectBoolean: value = static_cast<PDFBoolean*>(object->object)->GetValue() ? "true" : "false"; break;
    default: value = PDFObject::scPDFObjectTypeLabel(object->object->GetType()); break;
  }
  return copyObjectString(value, outputLength);
}

// Literal and hex strings retain their decoded PDF bytes, which may include
// NUL or invalid UTF-8 and therefore must not pass through a C string or text
// conversion boundary.
WASM_EXPORT unsigned char* muhammara_wasm_object_get_string_bytes(
    WasmObject* object, unsigned int* outputLength) {
  if (object == nullptr || object->object == nullptr || outputLength == nullptr) {
    return nullptr;
  }
  *outputLength = 0;
  switch (object->object->GetType()) {
    case PDFObject::ePDFObjectLiteralString:
      return copyObjectString(
          static_cast<PDFLiteralString*>(object->object)->GetValue(), outputLength);
    case PDFObject::ePDFObjectHexString:
      return copyObjectString(
          static_cast<PDFHexString*>(object->object)->GetValue(), outputLength);
    default:
      return nullptr;
  }
}

WASM_EXPORT int muhammara_wasm_object_get_number(WasmObject* object, double* value) {
  if (object == nullptr || value == nullptr) return 0;
  if (object->object->GetType() == PDFObject::ePDFObjectInteger) {
    *value = static_cast<PDFInteger*>(object->object)->GetValue();
  } else if (object->object->GetType() == PDFObject::ePDFObjectReal) {
    *value = static_cast<PDFReal*>(object->object)->GetValue();
  } else return 0;
  return 1;
}

WASM_EXPORT int muhammara_wasm_object_get_boolean(WasmObject* object, int* value) {
  if (object == nullptr || value == nullptr || object->object->GetType() !=
      PDFObject::ePDFObjectBoolean) return 0;
  *value = static_cast<PDFBoolean*>(object->object)->GetValue();
  return 1;
}

WASM_EXPORT unsigned long muhammara_wasm_object_array_length(WasmObject* object) {
  return object != nullptr && object->object->GetType() == PDFObject::ePDFObjectArray
             ? static_cast<PDFArray*>(object->object)->GetLength() : 0;
}

WASM_EXPORT WasmObject* muhammara_wasm_reader_object_array_query(
    WasmReader* reader, WasmObject* array, unsigned long index) {
  if (reader == nullptr || array == nullptr || array->reader != reader ||
      array->object->GetType() !=
      PDFObject::ePDFObjectArray) return nullptr;
  PDFArray* nativeArray = static_cast<PDFArray*>(array->object);
  return index < nativeArray->GetLength()
             ? addReaderObject(reader, nativeArray->QueryObject(index)) : nullptr;
}

WASM_EXPORT WasmObject* muhammara_wasm_object_array_query(WasmObjectParser* parser,
                                                            WasmObject* array,
                                                            unsigned long index) {
  if (parser == nullptr || array == nullptr || array->objectParser != parser ||
      array->object->GetType() !=
      PDFObject::ePDFObjectArray) return nullptr;
  PDFArray* nativeArray = static_cast<PDFArray*>(array->object);
  return index < nativeArray->GetLength()
              ? addObject(parser, nativeArray->QueryObject(index)) : nullptr;
}

WASM_EXPORT WasmObject* muhammara_wasm_object_dictionary_query(WasmObjectParser* parser,
                                                                 WasmObject* dictionary,
                                                                 const char* key) {
  if (parser == nullptr || dictionary == nullptr || key == nullptr ||
      dictionary->objectParser != parser ||
      dictionary->object->GetType() != PDFObject::ePDFObjectDictionary) return nullptr;
  PDFDictionary* nativeDictionary = static_cast<PDFDictionary*>(dictionary->object);
  return nativeDictionary->Exists(key) ? addObject(parser,
      nativeDictionary->QueryDirectObject(key)) : nullptr;
}

WASM_EXPORT WasmObject* muhammara_wasm_reader_object_dictionary_query(
    WasmReader* reader, WasmObject* dictionary, const char* key) {
  if (reader == nullptr || dictionary == nullptr || key == nullptr ||
      dictionary->reader != reader ||
      dictionary->object->GetType() != PDFObject::ePDFObjectDictionary) return nullptr;
  PDFDictionary* nativeDictionary = static_cast<PDFDictionary*>(dictionary->object);
  return nativeDictionary->Exists(key) ? addReaderObject(reader,
      nativeDictionary->QueryDirectObject(key)) : nullptr;
}

WASM_EXPORT unsigned char* muhammara_wasm_object_dictionary_keys(
    WasmObject* dictionary, unsigned int* outputLength) {
  if (dictionary == nullptr || dictionary->object->GetType() !=
      PDFObject::ePDFObjectDictionary) return nullptr;
  std::string keys;
  MapIterator<PDFNameToPDFObjectMap> iterator =
      static_cast<PDFDictionary*>(dictionary->object)->GetIterator();
  while (iterator.MoveNext()) {
    keys += iterator.GetKey()->GetValue();
    keys += '\0';
  }
  return copyObjectString(keys, outputLength);
}

WASM_EXPORT WasmObject* muhammara_wasm_object_stream_dictionary(WasmObjectParser* parser,
                                                                  WasmObject* stream) {
  if (parser == nullptr || stream == nullptr || stream->objectParser != parser ||
      stream->object->GetType() !=
      PDFObject::ePDFObjectStream) return nullptr;
  return addObject(parser, static_cast<PDFStreamInput*>(stream->object)
      ->QueryStreamDictionary());
}

WASM_EXPORT WasmObject* muhammara_wasm_reader_object_stream_dictionary(
    WasmReader* reader, WasmObject* stream) {
  if (reader == nullptr || stream == nullptr || stream->reader != reader ||
      stream->object->GetType() !=
      PDFObject::ePDFObjectStream) return nullptr;
  return addReaderObject(reader, static_cast<PDFStreamInput*>(stream->object)
      ->QueryStreamDictionary());
}

WASM_EXPORT double muhammara_wasm_object_stream_content_start(WasmObject* stream) {
  return stream != nullptr && stream->object->GetType() == PDFObject::ePDFObjectStream
             ? static_cast<double>(static_cast<PDFStreamInput*>(stream->object)
                 ->GetStreamContentStart()) : -1;
}

WASM_EXPORT int muhammara_wasm_object_indirect_reference(WasmObject* object,
                                                           unsigned long* values) {
  if (object == nullptr || values == nullptr || object->object->GetType() !=
      PDFObject::ePDFObjectIndirectObjectReference) return 0;
  PDFIndirectObjectReference* reference =
      static_cast<PDFIndirectObjectReference*>(object->object);
  values[0] = reference->mObjectID;
  values[1] = reference->mVersion;
  return 1;
}

WASM_EXPORT WasmObject* muhammara_wasm_object_parser_parse(WasmObjectParser* parser) {
  return parser == nullptr ? nullptr : addObject(parser,
      parser->parser->ParseNewObject());
}

double muhammara_wasm_reader_get_pdf_level(WasmReader* reader) {
  return reader == nullptr ? 0 : reader->GetParser().GetPDFLevel();
}

int muhammara_wasm_reader_get_page_info(WasmReader* reader, unsigned long index,
                                        double* values) {
  if (reader == nullptr || values == nullptr || index >= reader->GetParser().GetPagesCount()) {
    return 0;
  }
  PDFPageInput page(&reader->GetParser(), reader->GetParser().ParsePage(index));
  if (!page) {
    return 0;
  }
  PDFRectangle mediaBox = page.GetMediaBox();
  values[0] = mediaBox.LowerLeftX;
  values[1] = mediaBox.LowerLeftY;
  values[2] = mediaBox.UpperRightX;
  values[3] = mediaBox.UpperRightY;
  values[4] = page.GetRotate();
  return 1;
}

unsigned long muhammara_wasm_reader_get_objects_count(WasmReader* reader) {
  return reader == nullptr ? 0 : reader->GetParser().GetObjectsCount();
}

int muhammara_wasm_reader_is_encrypted(WasmReader* reader) {
  return reader != nullptr && reader->GetParser().IsEncrypted();
}

int muhammara_wasm_reader_get_page_box(WasmReader* reader, unsigned long index,
                                       int box, double* values) {
  if (reader == nullptr || values == nullptr || index >= reader->GetParser().GetPagesCount()) {
    return 0;
  }
  PDFPageInput page(&reader->GetParser(), reader->GetParser().ParsePage(index));
  if (!page) {
    return 0;
  }
  PDFRectangle rectangle;
  switch (box) {
    case 0:
      rectangle = page.GetMediaBox();
      break;
    case 1:
      rectangle = page.GetCropBox();
      break;
    case 2:
      rectangle = page.GetTrimBox();
      break;
    case 3:
      rectangle = page.GetBleedBox();
      break;
    case 4:
      rectangle = page.GetArtBox();
      break;
    default:
      return 0;
  }
  values[0] = rectangle.LowerLeftX;
  values[1] = rectangle.LowerLeftY;
  values[2] = rectangle.UpperRightX;
  values[3] = rectangle.UpperRightY;
  return 1;
}

}  // extern "C"
