#include "wasm_api_internal.h"

extern "C" {

void muhammara_wasm_recipe_destroy(WasmRecipe* recipe) {
  delete recipe;
}

int muhammara_wasm_recipe_add_page(WasmRecipe* recipe, double width,
                                    double height) {
  if (recipe == nullptr || recipe->page != nullptr || recipe->finished ||
      width <= 0 || height <= 0) {
    return 0;
  }

  recipe->page = new PDFPage();
  recipe->page->SetMediaBox(PDFRectangle(0, 0, width, height));
  recipe->context = recipe->writer.StartPageContentContext(recipe->page);
  if (recipe->context != nullptr) return 1;
  delete recipe->page;
  recipe->page = nullptr;
  return 0;
}

int muhammara_wasm_recipe_add_page_with_box(WasmRecipe* recipe, double left,
                                             double bottom, double right,
                                             double top) {
  if (recipe == nullptr || recipe->page != nullptr || recipe->finished ||
      right <= left || top <= bottom) {
    return 0;
  }

  recipe->page = new PDFPage();
  recipe->page->SetMediaBox(PDFRectangle(left, bottom, right, top));
  recipe->context = recipe->writer.StartPageContentContext(recipe->page);
  if (recipe->context != nullptr) return 1;
  delete recipe->page;
  recipe->page = nullptr;
  return 0;
}

int muhammara_wasm_recipe_end_page(WasmRecipe* recipe) {
  if (recipe == nullptr || recipe->page == nullptr || recipe->context == nullptr) {
    return 0;
  }
  if (recipe->writer.EndPageContentContext(recipe->context) != PDFHummus::eSuccess) {
    return 0;
  }
  invalidateContentStreams(recipe, nullptr);
  // WritePageAndRelease deletes the transient page even when writing fails.
  EStatusCodeAndObjectIDType result =
      recipe->writer.WritePageReleaseAndReturnPageID(recipe->page);
  recipe->page = nullptr;
  recipe->context = nullptr;
  return result.first == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_recipe_end_page_and_return_id(
    WasmRecipe* recipe, unsigned int* objectId) {
  if (objectId == nullptr) return 0;
  *objectId = 0;
  if (recipe == nullptr || recipe->page == nullptr || recipe->context == nullptr) {
    return 0;
  }
  if (recipe->writer.EndPageContentContext(recipe->context) != PDFHummus::eSuccess) {
    return 0;
  }
  invalidateContentStreams(recipe, nullptr);
  // The release variant transfers ownership to the core for this transient page.
  EStatusCodeAndObjectIDType result =
      recipe->writer.WritePageReleaseAndReturnPageID(recipe->page);
  recipe->page = nullptr;
  recipe->context = nullptr;
  if (result.first != PDFHummus::eSuccess) return 0;
  *objectId = static_cast<unsigned int>(result.second);
  return 1;
}

int muhammara_wasm_recipe_pause_page(WasmRecipe* recipe) {
  if (recipe == nullptr || recipe->context == nullptr ||
      recipe->writer.PausePageContentContext(recipe->context) != PDFHummus::eSuccess) {
    return 0;
  }
  invalidateContentStreams(recipe, nullptr);
  return 1;
}

int muhammara_wasm_recipe_set_page_box(WasmRecipe* recipe, int box, double left,
                                       double bottom, double right, double top) {
  if (recipe == nullptr || recipe->page == nullptr || recipe->finished ||
      right <= left || top <= bottom) {
    return 0;
  }
  PDFRectangle rectangle(left, bottom, right, top);
  switch (box) {
    case 0:
      recipe->page->SetMediaBox(rectangle);
      break;
    case 1:
      recipe->page->SetCropBox(rectangle);
      break;
    case 2:
      recipe->page->SetBleedBox(rectangle);
      break;
    case 3:
      recipe->page->SetTrimBox(rectangle);
      break;
    case 4:
      recipe->page->SetArtBox(rectangle);
      break;
    default:
      return 0;
  }
  return 1;
}

int muhammara_wasm_recipe_set_page_rotation(WasmRecipe* recipe, int rotation) {
  if (recipe == nullptr || recipe->page == nullptr || recipe->finished ||
      rotation % 90 != 0) {
    return 0;
  }
  recipe->page->SetRotate(rotation);
  return 1;
}

WASM_EXPORT int muhammara_wasm_recipe_operator(WasmRecipe* recipe, int operation,
                                                double a, double b, double c,
                                                double d, double e, double f) {
  if (recipe == nullptr || recipe->context == nullptr) {
    return 0;
  }

  return applyOperator(recipe->context, operation, a, b, c, d, e, f) ==
         PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_draw_image(
    WasmRecipe* recipe, double x, double y, const char* imagePath,
    unsigned int imageIndex, int transformationMethod, const double* matrix,
    double boundingBoxWidth, double boundingBoxHeight, int fitProportional,
    int fitPolicy) {
  return recipe != nullptr && !recipe->finished &&
         drawImage(recipe->context, x, y, imagePath, imageIndex,
                   transformationMethod, matrix, boundingBoxWidth,
                   boundingBoxHeight, fitProportional, fitPolicy);
}

WASM_EXPORT WasmImage* muhammara_wasm_writer_create_jpg_image(WasmRecipe* recipe,
                                                                 const char* path,
                                                                 unsigned long objectId) {
  if (recipe == nullptr || path == nullptr || recipe->finished) return nullptr;
  PDFImageXObject* image = objectId == 0
                                ? recipe->writer.CreateImageXObjectFromJPGFile(path)
                                : recipe->writer.CreateImageXObjectFromJPGFile(path, objectId);
  if (image == nullptr) return nullptr;
  WasmImage* handle = new WasmImage();
  handle->image = image;
  recipe->images.push_back(handle);
  return handle;
}

WASM_EXPORT unsigned long muhammara_wasm_image_get_object_id(WasmImage* image) {
  return image == nullptr || image->image == nullptr
             ? 0
             : image->image->GetImageObjectID();
}

WASM_EXPORT WasmForm* muhammara_wasm_writer_create_image_form(
    WasmRecipe* recipe, const char* path, int type, unsigned long objectId) {
  if (recipe == nullptr || path == nullptr || recipe->finished) return nullptr;
  PDFFormXObject* form = nullptr;
  if (type == 0)
    form = objectId == 0 ? recipe->writer.CreateFormXObjectFromJPGFile(path)
                         : recipe->writer.CreateFormXObjectFromJPGFile(path, objectId);
#ifndef PDFHUMMUS_NO_PNG
  if (type == 1)
    form = objectId == 0 ? recipe->writer.CreateFormXObjectFromPNGFile(path)
                         : recipe->writer.CreateFormXObjectFromPNGFile(path, objectId);
#endif
#ifndef PDFHUMMUS_NO_TIFF
  if (type == 2)
    form = objectId == 0 ? recipe->writer.CreateFormXObjectFromTIFFFile(path)
                         : recipe->writer.CreateFormXObjectFromTIFFFile(path, objectId);
#endif
  if (form == nullptr) return nullptr;
  WasmForm* handle = new WasmForm();
  handle->form = form;
  handle->recipe = recipe;
  recipe->forms.push_back(handle);
  return handle;
}

WASM_EXPORT WasmForm* muhammara_wasm_writer_create_tiff_form(
    WasmRecipe* recipe, const char* path, unsigned int pageIndex,
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
  if (recipe == nullptr || path == nullptr || recipe->finished) return nullptr;
  TIFFUsageParameters parameters = TIFFUsageParameters::DefaultTIFFUsageParameters();
  parameters.PageIndex = pageIndex;
  if (hasBWTreatment) {
    parameters.BWTreatment.AsImageMask = bwAsImageMask != 0;
    if (bwColorComponents == 3)
      parameters.BWTreatment.OneColor =
          CMYKRGBColor(bwColor0, bwColor1, bwColor2);
    else if (bwColorComponents == 4)
      parameters.BWTreatment.OneColor =
          CMYKRGBColor(bwColor0, bwColor1, bwColor2, bwColor3);
  }
  if (hasGrayscaleTreatment) {
    parameters.GrayscaleTreatment.AsColorMap = grayscaleAsColorMap != 0;
    if (grayscaleOneColorComponents == 3)
      parameters.GrayscaleTreatment.OneColor = CMYKRGBColor(
          grayscaleOneColor0, grayscaleOneColor1, grayscaleOneColor2);
    else if (grayscaleOneColorComponents == 4)
      parameters.GrayscaleTreatment.OneColor =
          CMYKRGBColor(grayscaleOneColor0, grayscaleOneColor1,
                       grayscaleOneColor2, grayscaleOneColor3);
    if (grayscaleZeroColorComponents == 3)
      parameters.GrayscaleTreatment.ZeroColor = CMYKRGBColor(
          grayscaleZeroColor0, grayscaleZeroColor1, grayscaleZeroColor2);
    else if (grayscaleZeroColorComponents == 4)
      parameters.GrayscaleTreatment.ZeroColor =
          CMYKRGBColor(grayscaleZeroColor0, grayscaleZeroColor1,
                       grayscaleZeroColor2, grayscaleZeroColor3);
  }
  PDFFormXObject* form = objectId == 0
                             ? recipe->writer.CreateFormXObjectFromTIFFFile(path, parameters)
                             : recipe->writer.CreateFormXObjectFromTIFFFile(
                                   path, objectId, parameters);
  if (form == nullptr) return nullptr;
  WasmForm* handle = new WasmForm();
  handle->form = form;
  handle->recipe = recipe;
  recipe->forms.push_back(handle);
  return handle;
#endif
}

WASM_EXPORT WasmForm* muhammara_wasm_writer_create_form(WasmRecipe* recipe,
                                                          double left, double bottom,
                                                          double right, double top,
                                                          unsigned long objectId) {
  if (recipe == nullptr || recipe->finished || right <= left || top <= bottom) {
    return nullptr;
  }
  PDFFormXObject* form = objectId == 0
                             ? recipe->writer.StartFormXObject(
                                   PDFRectangle(left, bottom, right, top))
                             : recipe->writer.StartFormXObject(
                                   PDFRectangle(left, bottom, right, top), objectId);
  if (form == nullptr) return nullptr;
  WasmForm* handle = new WasmForm();
  handle->form = form;
  handle->recipe = recipe;
  handle->ended = false;
  recipe->forms.push_back(handle);
  return handle;
}

WASM_EXPORT unsigned long muhammara_wasm_form_get_object_id(WasmForm* form) {
  return form == nullptr || form->form == nullptr ? 0 : form->form->GetObjectID();
}

WASM_EXPORT int muhammara_wasm_writer_form_operator(
    WasmRecipe* recipe, WasmForm* form, int operation, double a, double b,
    double c, double d, double e, double f) {
  if (recipe == nullptr || form == nullptr || form->recipe != recipe ||
      form->form == nullptr || form->ended ||
      recipe->finished) return 0;
  return applyOperator(form->form->GetContentContext(), operation, a, b, c, d, e, f) ==
         PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_form_dash(
    WasmRecipe* recipe, WasmForm* form, const double* values, int length,
    double phase) {
  if (recipe == nullptr || form == nullptr || form->recipe != recipe ||
      form->form == nullptr || form->ended ||
      recipe->finished || length < 0 || (length > 0 && values == nullptr))
    return 0;
  return form->form->GetContentContext()->d(const_cast<double*>(values), length, phase) ==
         PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_form_set_opacity(WasmRecipe* recipe,
                                                        WasmForm* form,
                                                        double opacity) {
  return recipe != nullptr && form != nullptr && form->recipe == recipe &&
         form->form != nullptr && !form->ended &&
         !recipe->finished && opacity >= 0 && opacity <= 1 &&
         form->form->GetContentContext()->SetOpacity(opacity) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_form_structured_operator(
    WasmRecipe* recipe, WasmForm* form, int operation, const char* name,
    const double* components, int length, int hasPattern) {
  return recipe != nullptr && form != nullptr && form->recipe == recipe && form->form != nullptr &&
         !form->ended && !recipe->finished &&
         applyStructuredOperator(form->form->GetContentContext(), operation, name,
                                 components, length, hasPattern) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_form_draw_image(
    WasmRecipe* recipe, WasmForm* form, double x, double y, const char* imagePath,
    unsigned int imageIndex, int transformationMethod, const double* matrix,
    double boundingBoxWidth, double boundingBoxHeight, int fitProportional,
    int fitPolicy) {
  return recipe != nullptr && form != nullptr && form->recipe == recipe && form->form != nullptr &&
         !form->ended && !recipe->finished &&
         drawImage(form->form->GetContentContext(), x, y, imagePath, imageIndex,
                   transformationMethod, matrix, boundingBoxWidth,
                   boundingBoxHeight, fitProportional, fitPolicy);
}

WASM_EXPORT int muhammara_wasm_writer_form_show_text_operator(
    WasmRecipe* recipe, WasmForm* form, int operation, int encoding,
    double wordSpace, double characterSpace, const char* text) {
  return recipe != nullptr && form != nullptr && form->recipe == recipe &&
         form->form != nullptr && !form->ended &&
         !recipe->finished && showText(form->form->GetContentContext(), operation, encoding,
                                       wordSpace, characterSpace, text) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_form_show_glyphs_operator(
    WasmRecipe* recipe, WasmForm* form, int operation, double wordSpace,
    double characterSpace, const unsigned int* glyphs, int length) {
  return recipe != nullptr && form != nullptr && form->recipe == recipe &&
         form->form != nullptr && !form->ended &&
         !recipe->finished && showGlyphs(form->form->GetContentContext(), operation,
                                         wordSpace, characterSpace, glyphs, length) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_form_show_tj(
    WasmRecipe* recipe, WasmForm* form, int encoding, const int* types,
    const double* numbers, const int* stringOffsets, const char* strings,
    const int* glyphOffsets, const unsigned int* glyphs, int count,
    unsigned int stringsLength, unsigned int glyphOffsetsLength,
    unsigned int glyphCount) {
  return recipe != nullptr && form != nullptr && form->recipe == recipe &&
         form->form != nullptr && !form->ended &&
         !recipe->finished && showTJ(form->form->GetContentContext(), encoding, types, numbers,
                                       stringOffsets, strings, glyphOffsets, glyphs, count,
                                       stringsLength, glyphOffsetsLength,
                                       glyphCount) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_form_write_free_code(
    WasmRecipe* recipe, WasmForm* form, const char* freeCode,
    unsigned int length) {
  if (recipe == nullptr || form == nullptr || form->recipe != recipe || form->form == nullptr ||
      form->ended || recipe->finished || (freeCode == nullptr && length != 0)) {
    return 0;
  }
  return form->form->GetContentContext()->WriteFreeCode(
              std::string(freeCode ? freeCode : "", length)) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_form_set_font(WasmRecipe* recipe,
                                                     WasmForm* form,
                                                     PDFUsedFont* font,
                                                     double fontSize) {
  if (!hasFont(recipe, font) || form == nullptr || form->form == nullptr || form->ended ||
      recipe->finished || !std::isfinite(fontSize) || fontSize <= 0) return 0;
  form->form->GetContentContext()->Tf(font, fontSize);
  return 1;
}

WASM_EXPORT int muhammara_wasm_writer_form_set_font_name(WasmRecipe* recipe,
                                                          WasmForm* form,
                                                          const char* name,
                                                          double fontSize) {
  if (recipe == nullptr || form == nullptr || form->recipe != recipe ||
      form->form == nullptr || form->ended ||
      recipe->finished || name == nullptr || !std::isfinite(fontSize) || fontSize <= 0)
    return 0;
  return form->form->GetContentContext()->TfLow(name, fontSize) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_end_form(WasmRecipe* recipe,
                                                WasmForm* form) {
  if (recipe == nullptr || form == nullptr || form->recipe != recipe ||
      form->form == nullptr || form->ended ||
      recipe->finished) return 0;
  if (recipe->writer.EndFormXObject(form->form) != PDFHummus::eSuccess) return 0;
  form->ended = true;
  invalidateContentStreams(recipe, form);
  return 1;
}

WASM_EXPORT int muhammara_wasm_writer_form_do_xobject(WasmRecipe* recipe,
                                                        WasmForm* form,
                                                        void* object,
                                                        int isForm) {
  if (recipe == nullptr || form == nullptr || form->recipe != recipe ||
      form->form == nullptr || form->ended ||
      recipe->finished || object == nullptr)
    return 0;
  ResourcesDictionary& resources = form->form->GetResourcesDictionary();
  std::string name;
  if (isForm) {
    WasmForm* xobject = static_cast<WasmForm*>(object);
    if (xobject->form == nullptr || !xobject->ended) return 0;
    name = resources.AddFormXObjectMapping(xobject->form->GetObjectID());
  } else {
    WasmImage* xobject = static_cast<WasmImage*>(object);
    if (xobject->image == nullptr) return 0;
    name = resources.AddImageXObjectMapping(xobject->image);
  }
  return form->form->GetContentContext()->Do(name) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_form_do_form_object_id(
    WasmRecipe* recipe, WasmForm* form, unsigned long objectId) {
  if (recipe == nullptr || form == nullptr || form->recipe != recipe ||
      form->form == nullptr || form->ended ||
      recipe->finished || objectId == 0)
    return 0;
  std::string name = form->form->GetResourcesDictionary().AddFormXObjectMapping(objectId);
  return form->form->GetContentContext()->Do(name) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_form_do_xobject_name(WasmRecipe* recipe,
                                                             WasmForm* form,
                                                             const char* name) {
  if (recipe == nullptr || form == nullptr || form->recipe != recipe ||
      form->form == nullptr || form->ended ||
      recipe->finished || name == nullptr || *name == '\0')
    return 0;
  return form->form->GetContentContext()->Do(name) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_do_xobject(WasmRecipe* recipe,
                                                  void* object, int isForm) {
  if (recipe == nullptr || recipe->context == nullptr || object == nullptr ||
      recipe->finished) return 0;
  ResourcesDictionary& resources = recipe->page->GetResourcesDictionary();
  std::string name;
  if (isForm) {
    WasmForm* form = static_cast<WasmForm*>(object);
    if (form->form == nullptr || !form->ended) return 0;
    name = resources.AddFormXObjectMapping(form->form->GetObjectID());
  } else {
    WasmImage* image = static_cast<WasmImage*>(object);
    if (image->image == nullptr) return 0;
    name = resources.AddImageXObjectMapping(image->image);
  }
  return recipe->context->Do(name) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_do_form_object_id(WasmRecipe* recipe,
                                                          unsigned long objectId) {
  if (recipe == nullptr || recipe->context == nullptr || objectId == 0 ||
      recipe->finished) return 0;
  std::string name = recipe->page->GetResourcesDictionary().AddFormXObjectMapping(objectId);
  return recipe->context->Do(name) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_do_xobject_name(WasmRecipe* recipe,
                                                        const char* name) {
  if (recipe == nullptr || recipe->context == nullptr || name == nullptr ||
      *name == '\0' || recipe->finished) return 0;
  return recipe->context->Do(name) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_set_font_name(WasmRecipe* recipe,
                                                     const char* name,
                                                     double fontSize) {
  if (recipe == nullptr || recipe->context == nullptr || recipe->finished ||
      name == nullptr || !std::isfinite(fontSize) || fontSize <= 0)
    return 0;
  return recipe->context->TfLow(name, fontSize) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_image_dimensions(WasmRecipe* recipe,
                                                          unsigned char* bytes,
                                                          unsigned long length,
                                                          unsigned long imageIndex,
                                                          double* values) {
  if (recipe == nullptr || bytes == nullptr || length == 0 || values == nullptr ||
      recipe->finished) {
    return 0;
  }
  InputByteArrayStream stream(bytes, length);
  DoubleAndDoublePair dimensions =
      recipe->writer.GetImageDimensions(&stream, imageIndex);
  if (dimensions.first <= 0 || dimensions.second <= 0) return 0;
  values[0] = dimensions.first;
  values[1] = dimensions.second;
  return 1;
}

WASM_EXPORT int muhammara_wasm_writer_get_image_type(WasmRecipe* recipe,
                                                      const char* path) {
  if (recipe == nullptr || path == nullptr || recipe->finished) return 0;
  return static_cast<int>(recipe->writer.GetImageType(path, 0));
}

WASM_EXPORT unsigned long muhammara_wasm_writer_get_image_pages_count(
    WasmRecipe* recipe, const char* path) {
  if (recipe == nullptr || path == nullptr || recipe->finished) return 0;
  return recipe->writer.GetImagePagesCount(path);
}

WASM_EXPORT int muhammara_wasm_writer_retrieve_jpg_image_information(
    WasmRecipe* recipe, unsigned char* bytes, unsigned long length,
    double* values) {
  if (recipe == nullptr || bytes == nullptr || length == 0 || values == nullptr ||
      recipe->finished) {
    return 0;
  }
  InputByteArrayStream stream(bytes, length);
  BoolAndJPEGImageInformation result =
      recipe->writer.GetDocumentContext().GetJPEGImageHandler().RetrieveImageInformation(
          &stream);
  if (!result.first) return 0;

  const JPEGImageInformation& info = result.second;
  values[0] = info.SamplesWidth;
  values[1] = info.SamplesHeight;
  values[2] = info.ColorComponentsCount;
  values[3] = info.JFIFInformationExists;
  values[4] = info.JFIFUnit;
  values[5] = info.JFIFXDensity;
  values[6] = info.JFIFYDensity;
  values[7] = info.ExifInformationExists;
  values[8] = info.ExifUnit;
  values[9] = info.ExifXDensity;
  values[10] = info.ExifYDensity;
  values[11] = info.PhotoshopInformationExists;
  values[12] = info.PhotoshopXDensity;
  values[13] = info.PhotoshopYDensity;
  return 1;
}

WASM_EXPORT PDFUsedFont* muhammara_wasm_writer_get_font_for_bytes(
    WasmRecipe* recipe, const char* fontPath, const char* metricsPath, long fontIndex) {
  if (recipe == nullptr || recipe->finished || fontPath == nullptr) {
    return nullptr;
  }
  PDFUsedFont* font = metricsPath == nullptr
                           ? recipe->writer.GetFontForFile(fontPath, fontIndex)
                           : recipe->writer.GetFontForFile(fontPath, metricsPath, fontIndex);
  if (font != nullptr &&
      std::find(recipe->fonts.begin(), recipe->fonts.end(), font) == recipe->fonts.end()) {
    recipe->fonts.push_back(font);
  }
  return font;
}

WASM_EXPORT int muhammara_wasm_writer_font_text_dimensions(
    WasmRecipe* recipe, PDFUsedFont* font, const char* text, double fontSize,
    double* values) {
  if (!hasFont(recipe, font) || text == nullptr || values == nullptr || fontSize <= 0) {
    return 0;
  }
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

WASM_EXPORT int muhammara_wasm_writer_font_metrics(WasmRecipe* recipe,
                                                    PDFUsedFont* font,
                                                    double fontSize,
                                                    double* values) {
  if (!hasFont(recipe, font) || values == nullptr || fontSize <= 0) {
    return 0;
  }
  FT_Face face = (*font->GetFreeTypeFont()).operator->();
  FT_Size oldSize = face->size;
  FT_Size size = nullptr;
  if (FT_New_Size(face, &size) != 0 || FT_Activate_Size(size) != 0 ||
      FT_Set_Char_Size(face, 0, static_cast<FT_F26Dot6>(64 * fontSize), 72, 72) != 0) {
    if (oldSize != nullptr) {
      FT_Activate_Size(oldSize);
    }
    if (size != nullptr) {
      FT_Done_Size(size);
    }
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

WASM_EXPORT int muhammara_wasm_writer_set_font(WasmRecipe* recipe,
                                                PDFUsedFont* font,
                                                double fontSize) {
  if (!hasFont(recipe, font) || recipe->context == nullptr || fontSize <= 0) {
    return 0;
  }
  recipe->context->Tf(font, fontSize);
  return 1;
}

WASM_EXPORT int muhammara_wasm_writer_show_text(WasmRecipe* recipe,
                                                const char* text) {
  return recipe != nullptr && recipe->context != nullptr && text != nullptr &&
         recipe->context->Tj(text) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_show_glyphs(
    WasmRecipe* recipe, const unsigned int* glyphsAndUnicode, int length) {
  if (recipe == nullptr || recipe->context == nullptr || length < 0 ||
      (length > 0 && glyphsAndUnicode == nullptr)) {
    return 0;
  }
  GlyphUnicodeMappingList glyphs;
  for (int index = 0; index < length; ++index) {
    GlyphUnicodeMapping mapping;
    mapping.mGlyphCode = glyphsAndUnicode[index * 2];
    mapping.mUnicodeValues.push_back(glyphsAndUnicode[index * 2 + 1]);
    glyphs.push_back(mapping);
  }
  return recipe->context->Tj(glyphs) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_show_text_operator(
    WasmRecipe* recipe, int operation, int encoding, double wordSpace,
    double characterSpace, const char* text) {
  return recipe != nullptr && recipe->context != nullptr &&
         showText(recipe->context, operation, encoding, wordSpace, characterSpace, text) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_show_glyphs_operator(
    WasmRecipe* recipe, int operation, double wordSpace, double characterSpace,
    const unsigned int* glyphs, int length) {
  return recipe != nullptr && recipe->context != nullptr &&
         showGlyphs(recipe->context, operation, wordSpace, characterSpace, glyphs, length) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_show_tj(
    WasmRecipe* recipe, int encoding, const int* types, const double* numbers,
    const int* stringOffsets, const char* strings, const int* glyphOffsets,
    const unsigned int* glyphs, int count, unsigned int stringsLength,
    unsigned int glyphOffsetsLength, unsigned int glyphCount) {
  return recipe != nullptr && recipe->context != nullptr &&
          showTJ(recipe->context, encoding, types, numbers, stringOffsets, strings,
                  glyphOffsets, glyphs, count, stringsLength, glyphOffsetsLength,
                  glyphCount) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_write_free_code(
    WasmRecipe* recipe, const char* freeCode, unsigned int length) {
  if (recipe == nullptr || recipe->context == nullptr || recipe->finished ||
      (freeCode == nullptr && length != 0)) return 0;
  return recipe->context->WriteFreeCode(
             std::string(freeCode ? freeCode : "", length)) ==
         PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_recipe_structured_operator(
    WasmRecipe* recipe, int operation, const char* name,
    const double* components, int length, int hasPattern) {
  return recipe != nullptr && recipe->context != nullptr && !recipe->finished &&
         applyStructuredOperator(recipe->context, operation, name, components,
                                 length, hasPattern) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_recipe_dash(WasmRecipe* recipe,
                                           const double* values, int length,
                                           double phase) {
  if (recipe == nullptr || recipe->context == nullptr || length < 0 ||
      (length > 0 && values == nullptr)) {
    return 0;
  }
  return recipe->context->d(const_cast<double*>(values), length, phase) ==
         PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_rectangle(WasmRecipe* recipe, double x, double y,
                                    double width, double height,
                                    unsigned int color, int fill) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->DrawRectangle(x, y, width, height,
                                        graphicOptions(color, fill != 0)) ==
             PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_circle(WasmRecipe* recipe, double x, double y,
                                 double radius, unsigned int color, int fill) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->DrawCircle(x, y, radius, graphicOptions(color, fill != 0)) ==
             PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_line(WasmRecipe* recipe, double startX, double startY,
                               double endX, double endY, unsigned int color) {
  if (recipe == nullptr || recipe->context == nullptr) {
    return 0;
  }
  return recipe->context->m(startX, startY) == PDFHummus::eSuccess &&
         recipe->context->l(endX, endY) == PDFHummus::eSuccess &&
         setColor(recipe->context, color, false) &&
         recipe->context->S() == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_move_to(WasmRecipe* recipe, double x, double y) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->m(x, y) == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_line_to(WasmRecipe* recipe, double x, double y) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->l(x, y) == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_curve_to(WasmRecipe* recipe, double x1, double y1,
                                   double x2, double y2, double x3, double y3) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->c(x1, y1, x2, y2, x3, y3) == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_close_path(WasmRecipe* recipe) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->h() == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_paint_path(WasmRecipe* recipe, unsigned int color,
                                     double lineWidth, int fill) {
  if (recipe == nullptr || recipe->context == nullptr || lineWidth < 0 ||
      !setColor(recipe->context, color, fill != 0)) {
    return 0;
  }
  if (fill == 1) {
    return recipe->context->f() == PDFHummus::eSuccess;
  }
  if (fill == 2) {
    return setColor(recipe->context, color, false) &&
           recipe->context->w(lineWidth) == PDFHummus::eSuccess &&
           recipe->context->B() == PDFHummus::eSuccess;
  }
  return recipe->context->w(lineWidth) == PDFHummus::eSuccess &&
         recipe->context->S() == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_save(WasmRecipe* recipe) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->q() == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_restore(WasmRecipe* recipe) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->Q() == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_recipe_clip_rectangle(
    WasmRecipe* recipe, double x, double y, double width, double height) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->re(x, y, width, height) == PDFHummus::eSuccess &&
         recipe->context->W() == PDFHummus::eSuccess &&
         recipe->context->n() == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_cmyk_fill(WasmRecipe* recipe, double cyan,
                                    double magenta, double yellow,
                                    double black) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->k(cyan, magenta, yellow, black) == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_gray_stroke(WasmRecipe* recipe, double gray) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->G(gray) == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_line_width(WasmRecipe* recipe, double width) {
  return recipe != nullptr && recipe->context != nullptr && width >= 0 &&
         recipe->context->w(width) == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_rectangle_path(WasmRecipe* recipe, double x, double y,
                                         double width, double height) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->re(x, y, width, height) == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_fill_path(WasmRecipe* recipe) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->f() == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_stroke_path(WasmRecipe* recipe) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->S() == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_transform(WasmRecipe* recipe, double a, double b,
                                    double c, double d, double e, double f) {
  return recipe != nullptr && recipe->context != nullptr &&
         recipe->context->cm(a, b, c, d, e, f) == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_set_line_style(WasmRecipe* recipe, double width,
                                         int cap, int join, double miterLimit,
                                         const double* dash, int dashLength,
                                         double dashPhase) {
  if (recipe == nullptr || recipe->context == nullptr || width < 0 || cap < 0 ||
      cap > 2 || join < 0 || join > 2 || miterLimit < 1 || dashLength < 0 ||
      (dashLength > 0 && dash == nullptr)) {
    return 0;
  }
  return recipe->context->w(width) == PDFHummus::eSuccess &&
         recipe->context->J(cap) == PDFHummus::eSuccess &&
         recipe->context->j(join) == PDFHummus::eSuccess &&
         recipe->context->M(miterLimit) == PDFHummus::eSuccess &&
         recipe->context->d(const_cast<double*>(dash), dashLength, dashPhase) ==
             PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_set_opacity(WasmRecipe* recipe, double opacity) {
  return recipe != nullptr && recipe->context != nullptr && opacity >= 0 &&
         opacity <= 1 && recipe->context->SetOpacity(opacity) == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_text(WasmRecipe* recipe, double x, double y,
                               const char* text, const char* fontPath,
                               double fontSize, unsigned int color) {
  if (recipe == nullptr || recipe->context == nullptr || text == nullptr ||
      fontPath == nullptr || fontSize <= 0) {
    return 0;
  }
  PDFUsedFont* font = recipe->writer.GetFontForFile(fontPath);
  if (font == nullptr) {
    return 0;
  }
  return recipe->context->WriteText(
             x, y, text,
             AbstractContentContext::TextOptions(font, fontSize,
                                                 AbstractContentContext::eRGB,
                                                  color)) == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_text_dimensions(WasmRecipe* recipe, const char* text,
                                          const char* fontPath, double fontSize,
                                          double* values) {
  if (recipe == nullptr || text == nullptr || fontPath == nullptr || values == nullptr ||
      fontSize <= 0) {
    return 0;
  }
  PDFUsedFont* font = recipe->writer.GetFontForFile(fontPath);
  if (font == nullptr) {
    return 0;
  }
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

int muhammara_wasm_recipe_image(WasmRecipe* recipe, const char* imagePath,
                                double x, double y, double width, double height) {
  if (recipe == nullptr || recipe->context == nullptr || imagePath == nullptr ||
      width <= 0 || height <= 0) {
    return 0;
  }
  AbstractContentContext::ImageOptions options;
  options.transformationMethod = AbstractContentContext::eFit;
  options.boundingBoxWidth = width;
  options.boundingBoxHeight = height;
  options.fitProportional = true;
  options.fitPolicy = AbstractContentContext::eAlways;
  return recipe->context->DrawImage(x, y, imagePath, options) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_recipe_image_page(WasmRecipe* recipe,
                                                 const char* imagePath,
                                                 double x, double y,
                                                 double width, double height,
                                                 unsigned long pageIndex) {
  if (recipe == nullptr || recipe->context == nullptr || imagePath == nullptr ||
      width <= 0 || height <= 0) return 0;
  AbstractContentContext::ImageOptions options;
  options.imageIndex = pageIndex;
  options.transformationMethod = AbstractContentContext::eFit;
  options.boundingBoxWidth = width;
  options.boundingBoxHeight = height;
  options.fitProportional = false;
  options.fitPolicy = AbstractContentContext::eAlways;
  return recipe->context->DrawImage(x, y, imagePath, options) == PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_image_dimensions(WasmRecipe* recipe,
                                           const char* imagePath, double* width,
                                           double* height) {
  if (recipe == nullptr || imagePath == nullptr || width == nullptr ||
      height == nullptr) {
    return 0;
  }
  DoubleAndDoublePair dimensions = recipe->writer.GetImageDimensions(imagePath);
  if (dimensions.first <= 0 || dimensions.second <= 0) {
    return 0;
  }
  *width = dimensions.first;
  *height = dimensions.second;
  return 1;
}

int muhammara_wasm_recipe_set_info(WasmRecipe* recipe, const char* key,
                                    const char* value) {
  if (recipe == nullptr || key == nullptr || value == nullptr || recipe->finished) {
    return 0;
  }
  InfoDictionary& info = recipe->writer.GetDocumentContext()
                             .GetTrailerInformation()
                             .GetInfo();
  std::string property(key);
  if (property == "title") {
    info.Title.FromUTF8(value);
  } else if (property == "author") {
    info.Author.FromUTF8(value);
  } else if (property == "subject") {
    info.Subject.FromUTF8(value);
  } else if (property == "keywords") {
    info.Keywords.FromUTF8(value);
  } else if (property == "creator") {
    info.Creator.FromUTF8(value);
  } else if (property == "producer") {
    info.Producer.FromUTF8(value);
  } else {
    info.AddAdditionalInfoEntry(property, PDFTextString().FromUTF8(value));
  }
  return 1;
}

WASM_EXPORT int muhammara_wasm_recipe_remove_info(WasmRecipe* recipe,
                                                  const char* key) {
  if (recipe == nullptr || key == nullptr || recipe->finished) {
    return 0;
  }
  recipe->writer.GetDocumentContext().GetTrailerInformation().GetInfo()
      .RemoveAdditionalInfoEntry(key);
  return 1;
}

WASM_EXPORT int muhammara_wasm_recipe_clear_info(WasmRecipe* recipe) {
  if (recipe == nullptr || recipe->finished) {
    return 0;
  }
  recipe->writer.GetDocumentContext().GetTrailerInformation().GetInfo()
      .ClearAdditionalInfoEntries();
  return 1;
}

WASM_EXPORT int muhammara_wasm_recipe_set_info_date(WasmRecipe* recipe,
                                                     int modificationDate,
                                                     const char* value) {
  if (recipe == nullptr || value == nullptr || recipe->finished) {
    return 0;
  }
  PDFDate date;
  date.ParseString(value);
  InfoDictionary& info = recipe->writer.GetDocumentContext()
                             .GetTrailerInformation()
                             .GetInfo();
  if (modificationDate) {
    info.ModDate = date;
  } else {
    info.CreationDate = date;
  }
  return 1;
}

WASM_EXPORT int muhammara_wasm_recipe_set_info_trapped(WasmRecipe* recipe,
                                                        int trapped) {
  if (recipe == nullptr || recipe->finished || trapped < EInfoTrappedTrue ||
      trapped > EInfoTrappedUnknown) {
    return 0;
  }
  recipe->writer.GetDocumentContext().GetTrailerInformation().GetInfo().Trapped =
      static_cast<EInfoTrapped>(trapped);
  return 1;
}

WASM_EXPORT unsigned char* muhammara_wasm_pdf_text_string_from_utf8(
    const char* value, unsigned int length, unsigned int* outputLength) {
  if (value == nullptr || outputLength == nullptr) {
    return nullptr;
  }
  PDFTextString text;
  text.FromUTF8(std::string(value, length));
  std::string bytes = text.ToString();
  unsigned char* result =
      static_cast<unsigned char*>(std::malloc(bytes.empty() ? 1 : bytes.size()));
  if (result == nullptr) {
    return nullptr;
  }
  if (!bytes.empty()) {
    std::memcpy(result, bytes.data(), bytes.size());
  }
  *outputLength = static_cast<unsigned int>(bytes.size());
  return result;
}

WASM_EXPORT unsigned char* muhammara_wasm_pdf_text_string_to_utf8(
    const unsigned char* value, unsigned int length, unsigned int* outputLength) {
  if ((value == nullptr && length != 0) || outputLength == nullptr) {
    return nullptr;
  }
  PDFTextString text(std::string(value ? reinterpret_cast<const char*>(value) : "", length));
  std::string utf8 = text.ToUTF8String();
  unsigned char* result =
      static_cast<unsigned char*>(std::malloc(utf8.empty() ? 1 : utf8.size()));
  if (result == nullptr) {
    return nullptr;
  }
  if (!utf8.empty()) {
    std::memcpy(result, utf8.data(), utf8.size());
  }
  *outputLength = static_cast<unsigned int>(utf8.size());
  return result;
}

WASM_EXPORT unsigned char* muhammara_wasm_pdf_date_normalize(
    const char* value, unsigned int* outputLength) {
  if (value == nullptr || outputLength == nullptr) {
    return nullptr;
  }
  PDFDate date;
  date.ParseString(value);
  std::string normalized = date.ToString();
  unsigned char* result = static_cast<unsigned char*>(
      std::malloc(normalized.empty() ? 1 : normalized.size()));
  if (result == nullptr) {
    return nullptr;
  }
  if (!normalized.empty()) {
    std::memcpy(result, normalized.data(), normalized.size());
  }
  *outputLength = static_cast<unsigned int>(normalized.size());
  return result;
}

int muhammara_wasm_recipe_link(WasmRecipe* recipe, const char* url, double x,
                               double y, double width, double height) {
  return recipe != nullptr && url != nullptr && recipe->context != nullptr &&
         recipe->writer.AttachURLLinktoCurrentPage(
             url, PDFRectangle(x, y, x + width, y + height)) == PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_attach_url_link(
    WasmRecipe* recipe, const char* url, double left, double bottom, double right,
    double top) {
  return recipe != nullptr && recipe->page != nullptr && !recipe->finished &&
         url != nullptr && right >= left && top >= bottom &&
         recipe->writer.AttachURLLinktoCurrentPage(url,
                                                   PDFRectangle(left, bottom, right, top)) ==
             PDFHummus::eSuccess;
}

WASM_EXPORT int muhammara_wasm_writer_register_annotation(
    WasmRecipe* recipe, unsigned long objectId) {
  if (recipe == nullptr || recipe->page == nullptr || recipe->finished || objectId == 0) {
    return 0;
  }
  recipe->writer.GetDocumentContext().RegisterAnnotationReferenceForNextPageWrite(objectId);
  return 1;
}

WASM_EXPORT unsigned long muhammara_wasm_writer_create_annotation(
    WasmRecipe* recipe, const char* subtype, const char* contents, const char* title,
    const char* name, double left, double bottom, double right, double top,
    const double* color, int colorLength, double borderWidth,
    const double* borderDash, int borderDashLength, const double* quadPoints,
    int quadPointsLength, unsigned long flags, int open, double opacity) {
  if (recipe == nullptr || recipe->page == nullptr || recipe->finished) return 0;
  return writeAnnotation(recipe->writer.GetObjectsContext(),
                         recipe->writer.GetDocumentContext(), subtype, contents, title,
                         name, left, bottom, right, top, color, colorLength, borderWidth,
                         borderDash, borderDashLength, quadPoints, quadPointsLength,
                         flags, open, opacity);
}

int muhammara_wasm_recipe_annotation(WasmRecipe* recipe, const char* subtype,
                                      const char* text, const char* title, double x,
                                      double y, double width, double height,
                                      unsigned int color, int hasColor) {
  if (recipe == nullptr || recipe->context == nullptr || subtype == nullptr ||
      text == nullptr || title == nullptr) {
    return 0;
  }
  ObjectsContext& objects = recipe->writer.GetObjectsContext();
  ObjectIDType id = objects.StartNewIndirectObject();
  if (id == 0) {
    return 0;
  }
  DictionaryContext* dictionary = objects.StartDictionary();
  if (dictionary == nullptr) {
    objects.EndIndirectObject();
    return 0;
  }
  dictionary->WriteKey("Type");
  dictionary->WriteNameValue("Annot");
  dictionary->WriteKey("Subtype");
  dictionary->WriteNameValue(subtype);
  dictionary->WriteKey("Rect");
  dictionary->WriteRectangleValue(PDFRectangle(x, y, x + width, y + height));
  bool isTextMarkup = std::strcmp(subtype, "Highlight") == 0 ||
                      std::strcmp(subtype, "Underline") == 0 ||
                      std::strcmp(subtype, "StrikeOut") == 0 ||
                      std::strcmp(subtype, "Squiggly") == 0;
  if (isTextMarkup) {
    dictionary->WriteKey("QuadPoints");
    objects.StartArray();
    objects.WriteDouble(x);
    objects.WriteDouble(y + height);
    objects.WriteDouble(x + width);
    objects.WriteDouble(y + height);
    objects.WriteDouble(x);
    objects.WriteDouble(y);
    objects.WriteDouble(x + width);
    objects.WriteDouble(y);
    objects.EndArray();
  }
  if (hasColor) {
    dictionary->WriteKey("C");
    objects.StartArray();
    objects.WriteDouble((color >> 16) / 255.0);
    objects.WriteDouble(((color >> 8) & 0xff) / 255.0);
    objects.WriteDouble((color & 0xff) / 255.0);
    objects.EndArray();
  }
  if (*text != '\0') {
    dictionary->WriteKey("Contents");
    dictionary->WriteLiteralStringValue(text);
  }
  if (*title != '\0') {
    dictionary->WriteKey("T");
    dictionary->WriteLiteralStringValue(title);
  }
  PDFHummus::EStatusCode status = objects.EndDictionary(dictionary);
  objects.EndIndirectObject();
  if (status != PDFHummus::eSuccess) return 0;
  recipe->writer.GetDocumentContext().RegisterAnnotationReferenceForNextPageWrite(id);
  return 1;
}

// Recipe annotations need a few dictionary entries beyond the compact legacy
// bridge above. Keep this byte-only so browser Recipe can retain Node fields.
WASM_EXPORT unsigned long muhammara_wasm_recipe_annotation_full(
    WasmRecipe* recipe, const char* subtype, const char* text, const char* title,
    const char* subject, const char* date, const char* name, double left,
    double bottom, double right, double top, const double* color, int colorLength,
    double borderWidth, const double* borderDash, int borderDashLength,
    const double* quadPoints, int quadPointsLength, unsigned long flags, int open,
    double opacity, int richText, int isReply, unsigned long replyTo,
    unsigned long* outputId) {
  if (recipe == nullptr || recipe->context == nullptr || subtype == nullptr ||
      text == nullptr || title == nullptr || subject == nullptr || date == nullptr ||
      name == nullptr || outputId == nullptr || right < left || top < bottom || colorLength < 0 ||
       borderDashLength < 0 || quadPointsLength < 0 ||
       (colorLength != 0 && color == nullptr) ||
       (borderDashLength != 0 && borderDash == nullptr) ||
       (quadPointsLength != 0 && quadPoints == nullptr) || opacity < 0 || opacity > 1)
    return 0;
  ObjectsContext& objects = recipe->writer.GetObjectsContext();
  ObjectIDType id = objects.StartNewIndirectObject();
  if (id == 0) return 0;
  DictionaryContext* dictionary = objects.StartDictionary();
  if (dictionary == nullptr) {
    objects.EndIndirectObject();
    return 0;
  }
  dictionary->WriteKey("Type"); dictionary->WriteNameValue("Annot");
  dictionary->WriteKey("Subtype"); dictionary->WriteNameValue(subtype);
  dictionary->WriteKey("Rect");
  dictionary->WriteRectangleValue(PDFRectangle(left, bottom, right, top));
  if (*subject) { dictionary->WriteKey("Subj"); dictionary->WriteLiteralStringValue(subject); }
  if (*title) { dictionary->WriteKey("T"); dictionary->WriteLiteralStringValue(title); }
  if (*date) { dictionary->WriteKey("M"); dictionary->WriteLiteralStringValue(date); }
  dictionary->WriteKey("Open"); dictionary->WriteBooleanValue(open != 0);
  dictionary->WriteKey("F"); dictionary->WriteIntegerValue(flags);
  if (*text) {
    dictionary->WriteKey(richText ? "RC" : "Contents");
    dictionary->WriteLiteralStringValue(text);
  }
  if (isReply && (replyTo || recipe->lastAnnotationId)) {
    dictionary->WriteKey("IRT"); dictionary->WriteObjectReferenceValue(
        replyTo ? replyTo : recipe->lastAnnotationId, 0);
    dictionary->WriteKey("RT"); dictionary->WriteNameValue("R");
  }
  if (*name) { dictionary->WriteKey("Name"); dictionary->WriteNameValue(name); }
  if (borderWidth >= 0) {
    dictionary->WriteKey("Border"); objects.StartArray();
    objects.WriteDouble(0); objects.WriteDouble(0); objects.WriteDouble(borderWidth);
    for (int i = 0; i < borderDashLength; ++i) objects.WriteDouble(borderDash[i]);
    objects.EndArray();
  }
  if (colorLength) {
    dictionary->WriteKey("C"); objects.StartArray();
    for (int i = 0; i < colorLength; ++i) objects.WriteDouble(color[i]);
    objects.EndArray();
  }
  if (quadPointsLength) {
    dictionary->WriteKey("QuadPoints"); objects.StartArray();
    for (int i = 0; i < quadPointsLength; ++i) objects.WriteDouble(quadPoints[i]);
    objects.EndArray();
  }
  if (opacity != 1) { dictionary->WriteKey("CA"); dictionary->WriteDoubleValue(opacity); }
  PDFHummus::EStatusCode status = objects.EndDictionary(dictionary);
  objects.EndIndirectObject();
  if (status != PDFHummus::eSuccess) return 0;
  recipe->writer.GetDocumentContext().RegisterAnnotationReferenceForNextPageWrite(id);
  if (!isReply) recipe->lastAnnotationId = id;
  *outputId = id;
  return id;
}

int muhammara_wasm_recipe_append_pdf(WasmRecipe* recipe, const char* path) {
  if (recipe == nullptr || path == nullptr || recipe->page != nullptr ||
      recipe->finished) {
    return 0;
  }
  PDFPageRange range;
  return recipe->writer.AppendPDFPagesFromPDF(path, range).first ==
         PDFHummus::eSuccess;
}

int muhammara_wasm_recipe_append_pdf_range(WasmRecipe* recipe, const char* path,
                                           unsigned long start, unsigned long end) {
  if (recipe == nullptr || path == nullptr || recipe->page != nullptr ||
      recipe->finished || end < start) {
    return 0;
  }
  PDFPageRange range;
  range.mType = PDFPageRange::eRangeTypeSpecific;
  range.mSpecificRanges.push_back(ULongAndULong(start, end));
  return recipe->writer.AppendPDFPagesFromPDF(path, range).first ==
         PDFHummus::eSuccess;
}

}  // extern "C"
