#include "wasm_api_internal.h"

extern "C" {

WasmModifier* muhammara_wasm_modifier_create(const char* path, int version,
                                              int compressStreams) {
  if (path == nullptr) {
    return nullptr;
  }
  WasmModifier* modifier = new WasmModifier();
  if ((version < ePDFVersion10 || version > ePDFVersion17) &&
      version != ePDFVersion20) {
    delete modifier;
    return nullptr;
  }
  if (modifier->input.OpenFile(path) != PDFHummus::eSuccess ||
       modifier->writer.ModifyPDFForStream(modifier->input.GetInputStream(),
                                           &modifier->output, false,
                                           static_cast<EPDFVersion>(version),
                                           LogConfiguration::DefaultLogConfiguration(),
                                           PDFCreationSettings(compressStreams != 0, true)) !=
          PDFHummus::eSuccess) {
    delete modifier;
    return nullptr;
  }
  modifier->writer.GetDocumentContext().AddDocumentContextExtender(
      &modifier->catalogUpdate);
  return modifier;
}

WASM_EXPORT int muhammara_wasm_modifier_pause_page(WasmModifier* modifier) {
  return modifier != nullptr && modifier->newPage != nullptr &&
         modifier->context != nullptr && !modifier->finished &&
         modifier->writer.PausePageContentContext(
             static_cast<PageContentContext*>(modifier->context)) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_write_page_and_return_id(
    WasmModifier* modifier, unsigned int* objectId) {
  if (objectId == nullptr) return 0;
  *objectId = 0;
  if (modifier == nullptr || modifier->newPage == nullptr || modifier->finished) return 0;
  if (modifier->context != nullptr &&
      modifier->writer.EndPageContentContext(
          static_cast<PageContentContext*>(modifier->context)) != PDFHummus::eSuccess) return 0;
  modifier->context = nullptr;
  EStatusCodeAndObjectIDType result =
      modifier->writer.WritePageReleaseAndReturnPageID(modifier->newPage);
  modifier->newPage = nullptr;
  if (result.first != PDFHummus::eSuccess) return 0;
  *objectId = static_cast<unsigned int>(result.second);
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_attach_url_link_to_current_page(
    WasmModifier* modifier, const char* url, double left, double bottom,
    double right, double top) {
  if (modifier == nullptr || modifier->finished || url == nullptr || right < left || top < bottom)
    return 0;
  PDFRectangle rectangle(left, bottom, right, top);
  if (modifier->page != nullptr)
    return modifier->page->AttachURLLinktoCurrentPage(url, rectangle) == PDFHummus::eSuccess;
  return modifier->newPage != nullptr &&
         modifier->writer.AttachURLLinktoCurrentPage(url, rectangle) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_register_annotation(
    WasmModifier* modifier, unsigned long objectId) {
  if (modifier == nullptr || modifier->finished || objectId == 0 ||
      (modifier->page == nullptr && modifier->newPage == nullptr)) return 0;
  modifier->writer.GetDocumentContext().RegisterAnnotationReferenceForNextPageWrite(objectId);
  return 1;
}

WASM_EXPORT unsigned long muhammara_wasm_modifier_create_annotation_for_current_page(
    WasmModifier* modifier, const char* subtype, const char* contents,
    const char* title, const char* name, double left, double bottom, double right,
    double top, const double* color, int colorLength, double borderWidth,
    const double* borderDash, int borderDashLength, const double* quadPoints,
    int quadPointsLength, unsigned long flags, int open, double opacity) {
  if (modifier == nullptr || modifier->finished ||
      (modifier->page == nullptr && modifier->newPage == nullptr)) return 0;
  return writeAnnotation(modifier->writer.GetObjectsContext(),
                         modifier->writer.GetDocumentContext(), subtype, contents, title,
                         name, left, bottom, right, top, color, colorLength, borderWidth,
                         borderDash, borderDashLength, quadPoints, quadPointsLength,
                         flags, open, opacity);
}

WASM_EXPORT int muhammara_wasm_modifier_set_info(WasmModifier* modifier,
                                                  const char* key, const char* value) {
  if (modifier == nullptr || modifier->finished || key == nullptr || value == nullptr) return 0;
  InfoDictionary& info = modifier->writer.GetDocumentContext().GetTrailerInformation().GetInfo();
  std::string property(key);
  if (property == "title") info.Title.FromUTF8(value);
  else if (property == "author") info.Author.FromUTF8(value);
  else if (property == "subject") info.Subject.FromUTF8(value);
  else if (property == "keywords") info.Keywords.FromUTF8(value);
  else if (property == "creator") info.Creator.FromUTF8(value);
  else if (property == "producer") info.Producer.FromUTF8(value);
  else info.AddAdditionalInfoEntry(property, PDFTextString().FromUTF8(value));
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_remove_info(WasmModifier* modifier,
                                                     const char* key) {
  if (modifier == nullptr || modifier->finished || key == nullptr) return 0;
  modifier->writer.GetDocumentContext().GetTrailerInformation().GetInfo()
      .RemoveAdditionalInfoEntry(key);
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_clear_info(WasmModifier* modifier) {
  if (modifier == nullptr || modifier->finished) return 0;
  modifier->writer.GetDocumentContext().GetTrailerInformation().GetInfo()
      .ClearAdditionalInfoEntries();
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_set_info_date(WasmModifier* modifier,
                                                       int modificationDate,
                                                       const char* value) {
  if (modifier == nullptr || modifier->finished || value == nullptr) return 0;
  PDFDate date;
  date.ParseString(value);
  InfoDictionary& info = modifier->writer.GetDocumentContext().GetTrailerInformation().GetInfo();
  if (modificationDate) info.ModDate = date;
  else info.CreationDate = date;
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_set_info_trapped(WasmModifier* modifier,
                                                          int trapped) {
  if (modifier == nullptr || modifier->finished || trapped < EInfoTrappedTrue ||
      trapped > EInfoTrappedUnknown) return 0;
  modifier->writer.GetDocumentContext().GetTrailerInformation().GetInfo().Trapped =
      static_cast<EInfoTrapped>(trapped);
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_image_dimensions(
    WasmModifier* modifier, unsigned char* bytes, unsigned long length,
    unsigned long imageIndex, double* values) {
  if (modifier == nullptr || modifier->finished || bytes == nullptr || length == 0 ||
      values == nullptr) return 0;
  InputByteArrayStream stream(bytes, length);
  DoubleAndDoublePair dimensions = modifier->writer.GetImageDimensions(&stream, imageIndex);
  if (dimensions.first <= 0 || dimensions.second <= 0) return 0;
  values[0] = dimensions.first;
  values[1] = dimensions.second;
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_get_image_type(WasmModifier* modifier,
                                                        const char* path) {
  return modifier != nullptr && !modifier->finished && path != nullptr
             ? static_cast<int>(modifier->writer.GetImageType(path, 0)) : 0;
}

WASM_EXPORT unsigned long muhammara_wasm_modifier_get_image_pages_count(
    WasmModifier* modifier, const char* path) {
  return modifier != nullptr && !modifier->finished && path != nullptr
             ? modifier->writer.GetImagePagesCount(path) : 0;
}

WASM_EXPORT int muhammara_wasm_modifier_retrieve_jpg_image_information(
    WasmModifier* modifier, unsigned char* bytes, unsigned long length, double* values) {
  if (modifier == nullptr || modifier->finished || bytes == nullptr || length == 0 ||
      values == nullptr) return 0;
  InputByteArrayStream stream(bytes, length);
  BoolAndJPEGImageInformation result =
      modifier->writer.GetDocumentContext().GetJPEGImageHandler().RetrieveImageInformation(&stream);
  if (!result.first) return 0;
  const JPEGImageInformation& info = result.second;
  values[0] = info.SamplesWidth; values[1] = info.SamplesHeight;
  values[2] = info.ColorComponentsCount; values[3] = info.JFIFInformationExists;
  values[4] = info.JFIFUnit; values[5] = info.JFIFXDensity; values[6] = info.JFIFYDensity;
  values[7] = info.ExifInformationExists; values[8] = info.ExifUnit;
  values[9] = info.ExifXDensity; values[10] = info.ExifYDensity;
  values[11] = info.PhotoshopInformationExists;
  values[12] = info.PhotoshopXDensity; values[13] = info.PhotoshopYDensity;
  return 1;
}

WASM_EXPORT WasmImage* muhammara_wasm_modifier_create_jpg_image(
    WasmModifier* modifier, const char* path, unsigned long objectId) {
  if (modifier == nullptr || modifier->finished || path == nullptr) return nullptr;
  PDFImageXObject* image = objectId == 0
      ? modifier->writer.CreateImageXObjectFromJPGFile(path)
      : modifier->writer.CreateImageXObjectFromJPGFile(path, objectId);
  if (image == nullptr) return nullptr;
  WasmImage* handle = new WasmImage();
  handle->image = image;
  modifier->images.push_back(handle);
  return handle;
}

WASM_EXPORT WasmForm* muhammara_wasm_modifier_create_image_form(
    WasmModifier* modifier, const char* path, int type, unsigned long objectId) {
  if (modifier == nullptr || modifier->finished || path == nullptr) return nullptr;
  PDFFormXObject* form = nullptr;
  if (type == 0) form = objectId == 0 ? modifier->writer.CreateFormXObjectFromJPGFile(path)
                                      : modifier->writer.CreateFormXObjectFromJPGFile(path, objectId);
#ifndef PDFHUMMUS_NO_PNG
  if (type == 1) form = objectId == 0 ? modifier->writer.CreateFormXObjectFromPNGFile(path)
                                      : modifier->writer.CreateFormXObjectFromPNGFile(path, objectId);
#endif
#ifndef PDFHUMMUS_NO_TIFF
  if (type == 2) form = objectId == 0 ? modifier->writer.CreateFormXObjectFromTIFFFile(path)
                                      : modifier->writer.CreateFormXObjectFromTIFFFile(path, objectId);
#endif
  if (form == nullptr) return nullptr;
  WasmForm* handle = new WasmForm();
  handle->form = form;
  handle->modifier = modifier;
  modifier->forms.push_back(handle);
  return handle;
}

WASM_EXPORT unsigned long* muhammara_wasm_modifier_create_forms_from_pdf(
    WasmModifier* modifier, unsigned char* bytes, unsigned long length, int pageBox,
    const unsigned long* ranges, unsigned int rangeCount, const double* cropBox,
    const double* transformationMatrix, const unsigned long* additionalObjectIds,
    unsigned int additionalObjectCount, unsigned int* outputCount) {
  if (outputCount == nullptr) return nullptr;
  *outputCount = 0;
  if (modifier == nullptr || modifier->finished || bytes == nullptr || length == 0 ||
      pageBox < ePDFPageBoxMediaBox || pageBox > ePDFPageBoxArtBox ||
      (rangeCount != 0 && ranges == nullptr) ||
      (additionalObjectCount != 0 && additionalObjectIds == nullptr)) return nullptr;
  PDFPageRange pageRange;
  if (rangeCount != 0) {
    pageRange.mType = PDFPageRange::eRangeTypeSpecific;
    for (unsigned int index = 0; index < rangeCount; ++index) {
      if (ranges[index * 2 + 1] < ranges[index * 2]) return nullptr;
      pageRange.mSpecificRanges.push_back(ULongAndULong(ranges[index * 2], ranges[index * 2 + 1]));
    }
  }
  ObjectIDTypeList additionalObjects;
  for (unsigned int index = 0; index < additionalObjectCount; ++index)
    additionalObjects.push_back(additionalObjectIds[index]);
  InputByteArrayStream stream(bytes, length);
  EStatusCodeAndObjectIDTypeList result = cropBox != nullptr
      ? modifier->writer.CreateFormXObjectsFromPDF(&stream, pageRange,
          PDFRectangle(cropBox[0], cropBox[1], cropBox[2], cropBox[3]), transformationMatrix,
          additionalObjects)
      : modifier->writer.CreateFormXObjectsFromPDF(&stream, pageRange,
          static_cast<EPDFPageBox>(pageBox), transformationMatrix, additionalObjects);
  if (result.first != PDFHummus::eSuccess || result.second.empty()) return nullptr;
  unsigned long* ids = static_cast<unsigned long*>(std::malloc(sizeof(unsigned long) * result.second.size()));
  if (ids == nullptr) return nullptr;
  unsigned int index = 0;
  for (ObjectIDType id : result.second) ids[index++] = id;
  *outputCount = index;
  return ids;
}

WASM_EXPORT unsigned long* muhammara_wasm_modifier_append_pages_from_pdf(
    WasmModifier* modifier, unsigned char* bytes, unsigned long length,
    const unsigned long* ranges, unsigned int rangeCount, int* errorCode,
    unsigned int* outputCount) {
  if (errorCode == nullptr || outputCount == nullptr) return nullptr;
  *errorCode = 1; *outputCount = 0;
  if (modifier == nullptr || modifier->finished || modifier->page != nullptr ||
      modifier->newPage != nullptr || bytes == nullptr || length == 0 ||
      (rangeCount != 0 && ranges == nullptr)) return nullptr;
  InputByteArrayStream inspection(bytes, length); PDFParser parser;
  if (parser.StartPDFParsing(&inspection) != PDFHummus::eSuccess) return nullptr;
  if (parser.IsEncrypted()) { *errorCode = 2; return nullptr; }
  PDFPageRange pageRange;
  if (rangeCount != 0) {
    pageRange.mType = PDFPageRange::eRangeTypeSpecific;
    for (unsigned int index = 0; index < rangeCount; ++index) {
      if (ranges[index * 2 + 1] < ranges[index * 2]) return nullptr;
      pageRange.mSpecificRanges.push_back(ULongAndULong(ranges[index * 2], ranges[index * 2 + 1]));
    }
  }
  InputByteArrayStream stream(bytes, length);
  EStatusCodeAndObjectIDTypeList result = modifier->writer.AppendPDFPagesFromPDF(&stream, pageRange);
  if (result.first != PDFHummus::eSuccess) return nullptr;
  *errorCode = 0; *outputCount = result.second.size();
  if (result.second.empty()) return nullptr;
  unsigned long* ids = static_cast<unsigned long*>(std::malloc(sizeof(unsigned long) * result.second.size()));
  if (ids == nullptr) { *errorCode = 1; *outputCount = 0; return nullptr; }
  unsigned int index = 0; for (ObjectIDType id : result.second) ids[index++] = id;
  return ids;
}

WASM_EXPORT int muhammara_wasm_modifier_merge_pages_to_page_from_pdf(
    WasmModifier* modifier, unsigned char* bytes, unsigned long length,
    const unsigned long* ranges, unsigned int rangeCount, int* errorCode) {
  if (errorCode == nullptr) return 0;
  *errorCode = 1;
  if (modifier == nullptr || modifier->finished || modifier->newPage == nullptr ||
      bytes == nullptr || length == 0 || (rangeCount != 0 && ranges == nullptr)) return 0;
  InputByteArrayStream inspection(bytes, length); PDFParser parser;
  if (parser.StartPDFParsing(&inspection) != PDFHummus::eSuccess) return 0;
  if (parser.IsEncrypted()) { *errorCode = 2; return 0; }
  PDFPageRange pageRange;
  if (rangeCount != 0) {
    pageRange.mType = PDFPageRange::eRangeTypeSpecific;
    for (unsigned int index = 0; index < rangeCount; ++index) {
      if (ranges[index * 2 + 1] < ranges[index * 2]) return 0;
      pageRange.mSpecificRanges.push_back(ULongAndULong(ranges[index * 2], ranges[index * 2 + 1]));
    }
  }
  InputByteArrayStream stream(bytes, length);
  if (modifier->writer.MergePDFPagesToPage(modifier->newPage, &stream, pageRange) !=
      PDFHummus::eSuccess) return 0;
  *errorCode = 0;
  return 1;
}

WASM_EXPORT int muhammara_wasm_writer_require_catalog_update(WasmRecipe* recipe) {
  if (recipe == nullptr || recipe->finished) return 0;
  recipe->catalogUpdate.required = true;
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_require_catalog_update(
    WasmModifier* modifier) {
  if (modifier == nullptr || modifier->finished) return 0;
  modifier->catalogUpdate.required = true;
  return 1;
}

// Rewrites one original page dictionary, replacing only matching direct references.
WASM_EXPORT int muhammara_wasm_modifier_replace_object(
    WasmModifier* modifier, unsigned long pageIndex, unsigned long sourceObjectId,
    unsigned long replacementObjectId) {
  if (modifier == nullptr || modifier->finished || modifier->page != nullptr ||
      modifier->newPage != nullptr || modifier->context != nullptr ||
      pageIndex > std::numeric_limits<unsigned int>::max() || sourceObjectId == 0 ||
      replacementObjectId == 0 ||
      sourceObjectId > std::numeric_limits<unsigned int>::max() ||
      replacementObjectId > std::numeric_limits<unsigned int>::max()) return 0;

  std::unique_ptr<PDFDocumentCopyingContext> copying(
      modifier->writer.CreatePDFCopyingContextForModifiedFile());
  if (copying == nullptr) return 0;
  PDFParser* parser = copying->GetSourceDocumentParser();
  if (parser == nullptr || pageIndex >= parser->GetPagesCount() ||
      sourceObjectId > parser->GetObjectsCount() ||
      replacementObjectId >
          modifier->writer.GetObjectsContext().GetInDirectObjectsRegistry().GetObjectsCount()) {
    return 0;
  }
  RefCountPtr<PDFDictionary> page(parser->ParsePage(pageIndex));
  if (!page) {
    return 0;
  }

  ObjectsContext& objects = modifier->writer.GetObjectsContext();
  if (objects.StartModifiedIndirectObject(parser->GetPageObjectID(pageIndex)) !=
      PDFHummus::eSuccess) {
    return 0;
  }
  DictionaryContext* replacement = objects.StartDictionary();
  if (replacement == nullptr) {
    objects.EndIndirectObject();
    return 0;
  }
  bool succeeded = true;
  MapIterator<PDFNameToPDFObjectMap> entries = page->GetIterator();
  while (entries.MoveNext()) {
    replacement->WriteKey(entries.GetKey()->GetValue());
    PDFObject* value = entries.GetValue();
    if (value->GetType() == PDFObject::ePDFObjectIndirectObjectReference &&
        static_cast<PDFIndirectObjectReference*>(value)->mObjectID == sourceObjectId) {
      objects.WriteIndirectObjectReference(replacementObjectId);
    } else if (copying->CopyDirectObjectAsIs(value) != PDFHummus::eSuccess) {
      succeeded = false;
      break;
    }
  }
  if (objects.EndDictionary(replacement) != PDFHummus::eSuccess) {
    succeeded = false;
  }
  objects.EndIndirectObject();
  return succeeded ? 1 : 0;
}

void muhammara_wasm_modifier_destroy(WasmModifier* modifier) {
  delete modifier;
}

int muhammara_wasm_modifier_start_page(WasmModifier* modifier,
                                       unsigned long pageIndex,
                                       int ensureContentEncapsulation) {
  if (modifier == nullptr || modifier->page != nullptr || modifier->newPage != nullptr ||
      modifier->finished) {
    return 0;
  }
  modifier->page = new PDFModifiedPage(&modifier->writer, pageIndex,
                                       ensureContentEncapsulation != 0);
  modifier->context = modifier->page->StartContentContext();
  if (modifier->context == nullptr) {
    delete modifier->page;
    modifier->page = nullptr;
    return 0;
  }
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_create_page(WasmModifier* modifier, double left,
                                        double bottom, double right, double top) {
  if (modifier == nullptr || modifier->page != nullptr || modifier->newPage != nullptr ||
      modifier->finished || right <= left || top <= bottom) {
    return 0;
  }
  modifier->newPage = new PDFPage();
  modifier->newPage->SetMediaBox(PDFRectangle(left, bottom, right, top));
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_start_page_context(WasmModifier* modifier) {
  if (modifier == nullptr || modifier->newPage == nullptr || modifier->context != nullptr ||
      modifier->finished) {
    return 0;
  }
  modifier->context = modifier->writer.StartPageContentContext(modifier->newPage);
  return modifier->context != nullptr;
}

WASM_EXPORT int muhammara_wasm_modifier_operator(WasmModifier* modifier, int operation,
                                     double a, double b, double c, double d,
                                     double e, double f) {
  return modifier != nullptr && modifier->context != nullptr &&
                 applyOperator(modifier->context, operation, a, b, c, d, e, f) ==
                     PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_structured_operator(
    WasmModifier* modifier, int operation, const char* name,
    const double* components, int length, int hasPattern) {
  return modifier != nullptr && !modifier->finished &&
         applyStructuredOperator(modifier->context, operation, name, components,
                                 length, hasPattern) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_draw_image(
    WasmModifier* modifier, double x, double y, const char* imagePath,
    unsigned int imageIndex, int transformationMethod, const double* matrix,
    double boundingBoxWidth, double boundingBoxHeight, int fitProportional,
    int fitPolicy) {
  return modifier != nullptr && !modifier->finished &&
         drawImage(modifier->context, x, y, imagePath, imageIndex,
                   transformationMethod, matrix, boundingBoxWidth,
                   boundingBoxHeight, fitProportional, fitPolicy);
}

WASM_EXPORT int muhammara_wasm_modifier_dash(WasmModifier* modifier, const double* values,
                                 int length, double phase) {
  return modifier != nullptr && modifier->context != nullptr && length >= 0 &&
                 (length == 0 || values != nullptr) &&
                 modifier->context->d(const_cast<double*>(values), length, phase) ==
                     PDFHummus::eSuccess;
}

WASM_EXPORT PDFUsedFont* muhammara_wasm_modifier_get_font_for_bytes(WasmModifier* modifier,
                                                          const char* fontPath,
                                                          const char* metricsPath,
                                                          long fontIndex) {
  if (modifier == nullptr || modifier->finished || fontPath == nullptr) return nullptr;
  return metricsPath == nullptr ? modifier->writer.GetFontForFile(fontPath, fontIndex)
                                 : modifier->writer.GetFontForFile(fontPath, metricsPath,
                                                                     fontIndex);
}

WASM_EXPORT int muhammara_wasm_modifier_font_text_dimensions(
    WasmModifier* modifier, PDFUsedFont* font, const char* text, double fontSize,
    double* values) {
  if (modifier == nullptr || modifier->finished || font == nullptr || text == nullptr ||
      values == nullptr || !std::isfinite(fontSize) || fontSize <= 0) return 0;
  PDFUsedFont::TextMeasures measures =
      font->CalculateTextDimensions(text, static_cast<long>(fontSize));
  values[0] = measures.xMin;
  values[1] = measures.yMin;
  values[2] = measures.xMax;
  values[3] = measures.yMax;
  values[4] = measures.width;
  values[5] = measures.height;
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_font_metrics(WasmModifier* modifier,
                                                      PDFUsedFont* font,
                                                      double fontSize,
                                                      double* values) {
  if (modifier == nullptr || modifier->finished || font == nullptr || values == nullptr ||
      !std::isfinite(fontSize) || fontSize <= 0) return 0;
  FT_Face face = (*font->GetFreeTypeFont()).operator->();
  FT_Size oldSize = face->size;
  FT_Size size = nullptr;
  if (FT_New_Size(face, &size) != 0 || FT_Activate_Size(size) != 0 ||
      FT_Set_Char_Size(face, 0, static_cast<FT_F26Dot6>(64 * fontSize), 72, 72) != 0) {
    if (oldSize != nullptr) FT_Activate_Size(oldSize);
    if (size != nullptr) FT_Done_Size(size);
    return 0;
  }
  values[0] = size->metrics.x_ppem;
  values[1] = size->metrics.y_ppem;
  values[2] = size->metrics.x_scale;
  values[3] = size->metrics.y_scale;
  values[4] = size->metrics.ascender;
  values[5] = size->metrics.descender;
  values[6] = size->metrics.height;
  values[7] = size->metrics.max_advance;
  FT_Activate_Size(oldSize);
  FT_Done_Size(size);
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_set_font(WasmModifier* modifier, PDFUsedFont* font,
                                     double fontSize) {
  if (modifier == nullptr || modifier->context == nullptr || font == nullptr ||
      fontSize <= 0) return 0;
  modifier->context->Tf(font, fontSize);
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_set_font_name(WasmModifier* modifier,
                                                       const char* name,
                                                       double fontSize) {
  if (modifier == nullptr || modifier->context == nullptr || modifier->finished ||
      name == nullptr || !std::isfinite(fontSize) || fontSize <= 0)
    return 0;
  return modifier->context->TfLow(name, fontSize) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_set_opacity(WasmModifier* modifier,
                                                     double opacity) {
  return modifier != nullptr && modifier->context != nullptr && !modifier->finished &&
         opacity >= 0 && opacity <= 1 &&
         modifier->context->SetOpacity(opacity) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_do_xobject_name(WasmModifier* modifier,
                                                         const char* name) {
  if (modifier == nullptr || modifier->context == nullptr || modifier->finished ||
      name == nullptr || *name == '\0')
    return 0;
  return modifier->context->Do(name) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_do_form_object_id(WasmModifier* modifier,
                                                           unsigned long objectId) {
  if (modifier == nullptr || modifier->page == nullptr || modifier->context == nullptr ||
      modifier->finished || objectId == 0)
    return 0;
  std::string name = modifier->page->GetCurrentResourcesDictionary()->AddFormXObjectMapping(
      objectId);
  return modifier->context->Do(name) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_show_text(WasmModifier* modifier, const char* text) {
  return modifier != nullptr && modifier->context != nullptr && text != nullptr &&
                 modifier->context->Tj(text) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_show_text_operator(
    WasmModifier* modifier, int operation, int encoding, double wordSpace,
    double characterSpace, const char* text) {
  return modifier != nullptr && modifier->context != nullptr &&
         showText(modifier->context, operation, encoding, wordSpace, characterSpace, text) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_show_glyphs_operator(
    WasmModifier* modifier, int operation, double wordSpace, double characterSpace,
    const unsigned int* glyphs, int length) {
  return modifier != nullptr && modifier->context != nullptr &&
         showGlyphs(modifier->context, operation, wordSpace, characterSpace, glyphs, length) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_show_tj(
    WasmModifier* modifier, int encoding, const int* types, const double* numbers,
    const int* stringOffsets, const char* strings, const int* glyphOffsets,
    const unsigned int* glyphs, int count, unsigned int stringsLength,
    unsigned int glyphOffsetsLength, unsigned int glyphCount) {
  return modifier != nullptr && modifier->context != nullptr &&
         showTJ(modifier->context, encoding, types, numbers, stringOffsets, strings,
                  glyphOffsets, glyphs, count, stringsLength, glyphOffsetsLength,
                  glyphCount) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_write_free_code(
    WasmModifier* modifier, const char* freeCode, unsigned int length) {
  if (modifier == nullptr || modifier->context == nullptr ||
      modifier->finished || (freeCode == nullptr && length != 0)) return 0;
  return modifier->context->WriteFreeCode(std::string(freeCode ? freeCode : "", length)) ==
         PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_write_current_page_stream(
    WasmModifier* modifier, const unsigned char* bytes, unsigned int length) {
  if (modifier == nullptr || modifier->context == nullptr || modifier->finished ||
      modifier->newPage == nullptr || (bytes == nullptr && length != 0)) return -1;
  PDFStream* stream = static_cast<PageContentContext*>(modifier->context)
                          ->GetCurrentPageContentStream();
  if (stream == nullptr) return -1;
  return static_cast<int>(stream->GetWriteStream()->Write(bytes, length));
}

WASM_EXPORT int muhammara_wasm_modifier_attach_url_link(
    WasmModifier* modifier, const char* url, double left, double bottom, double right,
    double top) {
  return modifier != nullptr && modifier->page != nullptr && !modifier->finished &&
         url != nullptr && right >= left && top >= bottom &&
         modifier->page->AttachURLLinktoCurrentPage(
             url, PDFRectangle(left, bottom, right, top)) == PDFHummus::eSuccess;
}

WASM_EXPORT unsigned long muhammara_wasm_modifier_create_annotation(
    WasmModifier* modifier, const char* subtype, const char* contents,
    const char* title, const char* name, double left, double bottom, double right,
    double top, const double* color, int colorLength, double borderWidth,
    const double* borderDash, int borderDashLength, const double* quadPoints,
    int quadPointsLength, unsigned long flags, int open, double opacity) {
  if (modifier == nullptr || modifier->page == nullptr || modifier->finished) return 0;
  return writeAnnotation(modifier->writer.GetObjectsContext(),
                         modifier->writer.GetDocumentContext(), subtype, contents,
                         title, name, left, bottom, right, top, color, colorLength,
                         borderWidth, borderDash, borderDashLength, quadPoints,
                         quadPointsLength, flags, open, opacity);
}

WASM_EXPORT int muhammara_wasm_modifier_end_context(WasmModifier* modifier) {
  if (modifier == nullptr || modifier->context == nullptr) return 0;
  PDFHummus::EStatusCode status = modifier->page != nullptr
                                      ? modifier->page->EndContentContext()
                                      : modifier->writer.EndPageContentContext(
                                            static_cast<PageContentContext*>(modifier->context));
  if (status != PDFHummus::eSuccess) return 0;
  modifier->context = nullptr;
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_write_page(WasmModifier* modifier) {
  if (modifier == nullptr || modifier->context != nullptr) return 0;
  if (modifier->page != nullptr) {
    if (modifier->page->WritePage() != PDFHummus::eSuccess) return 0;
    delete modifier->page;
    modifier->page = nullptr;
    return 1;
  }
  if (modifier->newPage != nullptr) {
    PDFPage* page = modifier->newPage;
    modifier->newPage = nullptr;
    if (modifier->writer.WritePageAndRelease(page) != PDFHummus::eSuccess) {
      return 0;
    }
    return 1;
  }
  return 0;
}

WASM_EXPORT WasmForm* muhammara_wasm_modifier_create_form(
    WasmModifier* modifier, double left, double bottom, double right, double top,
    unsigned long objectId) {
  if (modifier == nullptr || modifier->finished || right <= left || top <= bottom) {
    return nullptr;
  }
  PDFFormXObject* form = objectId == 0
                             ? modifier->writer.StartFormXObject(
                                   PDFRectangle(left, bottom, right, top))
                             : modifier->writer.StartFormXObject(
                                   PDFRectangle(left, bottom, right, top), objectId);
  if (form == nullptr) return nullptr;
  WasmForm* handle = new WasmForm();
  handle->form = form;
  handle->modifier = modifier;
  handle->ended = false;
  modifier->forms.push_back(handle);
  return handle;
}

WASM_EXPORT WasmForm* muhammara_wasm_modifier_create_tiff_form(
    WasmModifier* modifier, const char* path, unsigned int pageIndex,
    unsigned long objectId, int hasBWTreatment, int bwAsImageMask,
    int bwColorComponents, unsigned int bwColor0, unsigned int bwColor1,
    unsigned int bwColor2, unsigned int bwColor3, int hasGrayscaleTreatment,
    int grayscaleAsColorMap, int grayscaleOneColorComponents,
    unsigned int grayscaleOneColor0, unsigned int grayscaleOneColor1,
    unsigned int grayscaleOneColor2, unsigned int grayscaleOneColor3,
    int grayscaleZeroColorComponents, unsigned int grayscaleZeroColor0,
    unsigned int grayscaleZeroColor1, unsigned int grayscaleZeroColor2,
    unsigned int grayscaleZeroColor3) {
#ifdef PDFHUMMUS_NO_TIFF
  return nullptr;
#else
  if (modifier == nullptr || modifier->finished || path == nullptr) return nullptr;
  TIFFUsageParameters parameters = TIFFUsageParameters::DefaultTIFFUsageParameters();
  parameters.PageIndex = pageIndex;
  if (hasBWTreatment) {
    parameters.BWTreatment.AsImageMask = bwAsImageMask != 0;
    if (bwColorComponents == 3) parameters.BWTreatment.OneColor = CMYKRGBColor(bwColor0, bwColor1, bwColor2);
    if (bwColorComponents == 4) parameters.BWTreatment.OneColor = CMYKRGBColor(bwColor0, bwColor1, bwColor2, bwColor3);
  }
  if (hasGrayscaleTreatment) {
    parameters.GrayscaleTreatment.AsColorMap = grayscaleAsColorMap != 0;
    if (grayscaleOneColorComponents == 3) parameters.GrayscaleTreatment.OneColor = CMYKRGBColor(grayscaleOneColor0, grayscaleOneColor1, grayscaleOneColor2);
    if (grayscaleOneColorComponents == 4) parameters.GrayscaleTreatment.OneColor = CMYKRGBColor(grayscaleOneColor0, grayscaleOneColor1, grayscaleOneColor2, grayscaleOneColor3);
    if (grayscaleZeroColorComponents == 3) parameters.GrayscaleTreatment.ZeroColor = CMYKRGBColor(grayscaleZeroColor0, grayscaleZeroColor1, grayscaleZeroColor2);
    if (grayscaleZeroColorComponents == 4) parameters.GrayscaleTreatment.ZeroColor = CMYKRGBColor(grayscaleZeroColor0, grayscaleZeroColor1, grayscaleZeroColor2, grayscaleZeroColor3);
  }
  PDFFormXObject* form = objectId == 0
                             ? modifier->writer.CreateFormXObjectFromTIFFFile(path, parameters)
                             : modifier->writer.CreateFormXObjectFromTIFFFile(path, objectId, parameters);
  if (form == nullptr) return nullptr;
  WasmForm* handle = new WasmForm();
  handle->form = form;
  handle->modifier = modifier;
  modifier->forms.push_back(handle);
  return handle;
#endif
}

WASM_EXPORT ResourcesDictionary* muhammara_wasm_modifier_get_form_resources(
    WasmModifier* modifier, WasmForm* form) {
  return modifier == nullptr || modifier->finished || form == nullptr ||
                 form->modifier != modifier || form->form == nullptr || form->ended
             ? nullptr
             : &form->form->GetResourcesDictionary();
}

WASM_EXPORT int muhammara_wasm_modifier_form_operator(
    WasmModifier* modifier, WasmForm* form, int operation, double a, double b,
    double c, double d, double e, double f) {
  return modifier != nullptr && !modifier->finished && form != nullptr &&
                 form->modifier == modifier && form->form != nullptr && !form->ended &&
                 applyOperator(form->form->GetContentContext(), operation, a, b, c, d, e, f) ==
                      PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_form_dash(
    WasmModifier* modifier, WasmForm* form, const double* values, int length,
    double phase) {
  return modifier != nullptr && !modifier->finished && form != nullptr &&
         form->modifier == modifier && form->form != nullptr && !form->ended &&
         length >= 0 && (length == 0 || values != nullptr) && std::isfinite(phase) &&
         form->form->GetContentContext()->d(const_cast<double*>(values), length, phase) ==
             PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_form_set_opacity(
    WasmModifier* modifier, WasmForm* form, double opacity) {
  return modifier != nullptr && !modifier->finished && form != nullptr &&
         form->modifier == modifier && form->form != nullptr && !form->ended &&
         std::isfinite(opacity) && opacity >= 0 && opacity <= 1 &&
         form->form->GetContentContext()->SetOpacity(opacity) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_form_structured_operator(
    WasmModifier* modifier, WasmForm* form, int operation, const char* name,
    const double* components, int length, int hasPattern) {
  return modifier != nullptr && !modifier->finished && form != nullptr &&
         form->modifier == modifier && form->form != nullptr && !form->ended &&
         applyStructuredOperator(form->form->GetContentContext(), operation, name,
                                 components, length, hasPattern) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_form_draw_image(
    WasmModifier* modifier, WasmForm* form, double x, double y, const char* imagePath,
    unsigned int imageIndex, int transformationMethod, const double* matrix,
    double boundingBoxWidth, double boundingBoxHeight, int fitProportional,
    int fitPolicy) {
  return modifier != nullptr && !modifier->finished && form != nullptr &&
         form->modifier == modifier && form->form != nullptr && !form->ended &&
         drawImage(form->form->GetContentContext(), x, y, imagePath, imageIndex,
                   transformationMethod, matrix, boundingBoxWidth, boundingBoxHeight,
                   fitProportional, fitPolicy);
}

WASM_EXPORT int muhammara_wasm_modifier_form_set_font(
    WasmModifier* modifier, WasmForm* form, PDFUsedFont* font, double fontSize) {
  if (modifier == nullptr || modifier->finished || form == nullptr ||
      form->modifier != modifier || form->form == nullptr || form->ended ||
      font == nullptr || !std::isfinite(fontSize) || fontSize <= 0) return 0;
  form->form->GetContentContext()->Tf(font, fontSize);
  return 1;
}

WASM_EXPORT int muhammara_wasm_modifier_form_set_font_name(
    WasmModifier* modifier, WasmForm* form, const char* name, double fontSize) {
  return modifier != nullptr && !modifier->finished && form != nullptr &&
                 form->modifier == modifier && form->form != nullptr && !form->ended &&
                 name != nullptr && std::isfinite(fontSize) && fontSize > 0 &&
                 form->form->GetContentContext()->TfLow(name, fontSize) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_form_show_text(
    WasmModifier* modifier, WasmForm* form, const char* text) {
  return modifier != nullptr && !modifier->finished && form != nullptr &&
                 form->modifier == modifier && form->form != nullptr && !form->ended &&
                  text != nullptr && form->form->GetContentContext()->Tj(text) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_form_show_text_operator(
    WasmModifier* modifier, WasmForm* form, int operation, int encoding,
    double wordSpace, double characterSpace, const char* text) {
  return modifier != nullptr && !modifier->finished && form != nullptr &&
         form->modifier == modifier && form->form != nullptr && !form->ended &&
         showText(form->form->GetContentContext(), operation, encoding, wordSpace,
                  characterSpace, text) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_form_show_glyphs_operator(
    WasmModifier* modifier, WasmForm* form, int operation, double wordSpace,
    double characterSpace, const unsigned int* glyphs, int length) {
  return modifier != nullptr && !modifier->finished && form != nullptr &&
         form->modifier == modifier && form->form != nullptr && !form->ended &&
         showGlyphs(form->form->GetContentContext(), operation, wordSpace,
                    characterSpace, glyphs, length) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_form_show_tj(
    WasmModifier* modifier, WasmForm* form, int encoding, const int* types,
    const double* numbers, const int* stringOffsets, const char* strings,
    const int* glyphOffsets, const unsigned int* glyphs, int count,
    unsigned int stringsLength, unsigned int glyphOffsetsLength,
    unsigned int glyphCount) {
  return modifier != nullptr && !modifier->finished && form != nullptr &&
         form->modifier == modifier && form->form != nullptr && !form->ended &&
         showTJ(form->form->GetContentContext(), encoding, types, numbers,
                  stringOffsets, strings, glyphOffsets, glyphs, count,
                  stringsLength, glyphOffsetsLength, glyphCount) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_form_write_free_code(
    WasmModifier* modifier, WasmForm* form, const char* code, unsigned int length) {
  return modifier != nullptr && !modifier->finished && form != nullptr &&
                 form->modifier == modifier && form->form != nullptr && !form->ended &&
                 (code != nullptr || length == 0) &&
                  form->form->GetContentContext()->WriteFreeCode(
                      std::string(code ? code : "", length)) ==
                     PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_form_write_stream(
    WasmModifier* modifier, WasmForm* form, const unsigned char* bytes,
    unsigned int length) {
  if (modifier == nullptr || modifier->finished || form == nullptr ||
      form->modifier != modifier || form->form == nullptr || form->ended ||
      (bytes == nullptr && length != 0)) return -1;
  return static_cast<int>(form->form->GetContentStream()->GetWriteStream()->Write(bytes, length));
}

WASM_EXPORT int muhammara_wasm_modifier_form_do_xobject_name(
    WasmModifier* modifier, WasmForm* form, const char* name) {
  return modifier != nullptr && !modifier->finished && form != nullptr &&
         form->modifier == modifier && form->form != nullptr && !form->ended &&
         name != nullptr && *name != '\0' &&
         form->form->GetContentContext()->Do(name) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_modifier_form_do_form_object_id(
    WasmModifier* modifier, WasmForm* form, unsigned long objectId) {
  if (modifier == nullptr || modifier->finished || form == nullptr ||
      form->modifier != modifier || form->form == nullptr || form->ended || objectId == 0) {
    return 0;
  }
  std::string name = form->form->GetResourcesDictionary().AddFormXObjectMapping(objectId);
  return form->form->GetContentContext()->Do(name) == PDFHummus::eSuccess;
}

WASM_EXPORT unsigned long muhammara_wasm_modifier_form_get_object_id(WasmForm* form) {
  return form == nullptr || form->form == nullptr ? 0 : form->form->GetObjectID();
}

WASM_EXPORT int muhammara_wasm_modifier_end_form(WasmModifier* modifier,
                                                  WasmForm* form) {
  if (modifier == nullptr || modifier->finished || form == nullptr ||
      form->modifier != modifier || form->form == nullptr || form->ended ||
      modifier->writer.EndFormXObject(form->form) != PDFHummus::eSuccess) {
    return 0;
  }
  form->ended = true;
  return 1;
}

int muhammara_wasm_modifier_rectangle(WasmModifier* modifier, double x, double y,
                                      double width, double height,
                                      unsigned int color, int fill) {
  return modifier != nullptr && modifier->context != nullptr &&
         modifier->context->DrawRectangle(x, y, width, height,
                                          graphicOptions(color, fill != 0)) ==
             PDFHummus::eSuccess;
}

int muhammara_wasm_modifier_circle(WasmModifier* modifier, double x, double y,
                                   double radius, unsigned int color, int fill) {
  return modifier != nullptr && modifier->context != nullptr &&
         modifier->context->DrawCircle(x, y, radius,
                                      graphicOptions(color, fill != 0)) ==
             PDFHummus::eSuccess;
}

int muhammara_wasm_modifier_line(WasmModifier* modifier, double startX,
                                 double startY, double endX, double endY,
                                 unsigned int color, double lineWidth) {
  return modifier != nullptr && modifier->context != nullptr && lineWidth >= 0 &&
         modifier->context->m(startX, startY) == PDFHummus::eSuccess &&
         modifier->context->l(endX, endY) == PDFHummus::eSuccess &&
         setColor(modifier->context, color, false) &&
         modifier->context->w(lineWidth) == PDFHummus::eSuccess &&
         modifier->context->S() == PDFHummus::eSuccess;
}

int muhammara_wasm_modifier_text(WasmModifier* modifier, double x, double y,
                                 const char* text, const char* fontPath,
                                 double fontSize, unsigned int color) {
  if (modifier == nullptr || modifier->context == nullptr || text == nullptr ||
      fontPath == nullptr || fontSize <= 0) {
    return 0;
  }
  PDFUsedFont* font = modifier->writer.GetFontForFile(fontPath);
  if (font == nullptr) {
    return 0;
  }
  return modifier->context->WriteText(
             x, y, text,
             AbstractContentContext::TextOptions(font, fontSize,
                                                 AbstractContentContext::eRGB,
                                                 color)) == PDFHummus::eSuccess;
}

int muhammara_wasm_modifier_image(WasmModifier* modifier, const char* imagePath,
                                  double x, double y, double width, double height) {
  if (modifier == nullptr || modifier->context == nullptr || imagePath == nullptr ||
      width <= 0 || height <= 0) {
    return 0;
  }
  AbstractContentContext::ImageOptions options;
  options.transformationMethod = AbstractContentContext::eFit;
  options.boundingBoxWidth = width;
  options.boundingBoxHeight = height;
  options.fitProportional = true;
  options.fitPolicy = AbstractContentContext::eAlways;
  return modifier->context->DrawImage(x, y, imagePath, options) ==
         PDFHummus::eSuccess;
}

int muhammara_wasm_modifier_end_page(WasmModifier* modifier) {
  return muhammara_wasm_modifier_end_context(modifier) &&
         muhammara_wasm_modifier_write_page(modifier);
}

unsigned char* muhammara_wasm_modifier_end_pdf(WasmModifier* modifier,
                                               unsigned int* outputLength) {
  if (modifier == nullptr || outputLength == nullptr || modifier->page != nullptr ||
      modifier->newPage != nullptr || modifier->context != nullptr ||
      modifier->finished || modifier->writer.EndPDFForStream() != PDFHummus::eSuccess) {
    return nullptr;
  }
  modifier->finished = true;
  std::string pdf = modifier->output.ToString();
  unsigned char* result = static_cast<unsigned char*>(std::malloc(pdf.size()));
  if (result == nullptr) {
    return nullptr;
  }
  std::memcpy(result, pdf.data(), pdf.size());
  *outputLength = static_cast<unsigned int>(pdf.size());
  return result;
}

}  // extern "C"
