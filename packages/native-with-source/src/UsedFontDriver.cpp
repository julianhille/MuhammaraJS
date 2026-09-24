#include "UsedFontDriver.h"

#include "PDFUsedFont.h"
#include "UnicodeString.h"

#include <list>

#include FT_GLYPH_H
#include FT_SIZES_H

using namespace muhammara::napi;

UsedFontDriver::UsedFontDriver() : UsedFont(nullptr), holder(nullptr) {}

bool UsedFontDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFUsedFont", New);
  builder.Method("calculateTextDimensions", CalculateTextDimensions)
      .Method("getFontMetrics", GetFontMetrics);
  return builder.Define(exports, false) != nullptr;
}

napi_value UsedFontDriver::New(const CallbackArgs &args) {
  auto *driver = new UsedFontDriver();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

napi_value UsedFontDriver::GetFontMetrics(const CallbackArgs &args) {
  if (args.Length() > 1 ||
      (args.Length() && !IsType(args.Env(), args[0], napi_number)))
    return ThrowTypeError(args.Env(),
                          "Wrong arguments, optionally provide a font size");
  long fontSize = args.Length() ? ToUint32(args.Env(), args[0]) : 1;
  auto *driver = ObjectWrap::Unwrap<UsedFontDriver>(args.Env(), args.This());
  FT_Face face = *driver->UsedFont->GetFreeTypeFont();
  FT_Size oldSize = face->size;
  FT_Size newSize = nullptr;
  if (FT_New_Size(face, &newSize) || FT_Activate_Size(newSize) ||
      FT_Set_Char_Size(face, 0, 64 * fontSize, 72, 72)) {
    FT_Activate_Size(oldSize);
    return ThrowTypeError(args.Env(), "Unknown font error");
  }
  napi_value result = Object(args.Env());
  napi_value pixels = Object(args.Env());
  Set(args.Env(), pixels, "x", Number(args.Env(), newSize->metrics.x_ppem));
  Set(args.Env(), pixels, "y", Number(args.Env(), newSize->metrics.y_ppem));
  Set(args.Env(), pixels, "xScale",
      Number(args.Env(), newSize->metrics.x_scale));
  Set(args.Env(), pixels, "yScale",
      Number(args.Env(), newSize->metrics.y_scale));
  Set(args.Env(), result, "pixelsPerEm", pixels);
  Set(args.Env(), result, "ascender",
      Number(args.Env(), newSize->metrics.ascender));
  Set(args.Env(), result, "descender",
      Number(args.Env(), newSize->metrics.descender));
  Set(args.Env(), result, "height",
      Number(args.Env(), newSize->metrics.height));
  Set(args.Env(), result, "max_advance",
      Number(args.Env(), newSize->metrics.max_advance));
  if (FT_Activate_Size(oldSize) || FT_Done_Size(newSize))
    return ThrowTypeError(args.Env(), "Unknown font error");
  return result;
}

napi_value UsedFontDriver::CalculateTextDimensions(const CallbackArgs &args) {
  if (args.Length() < 1 || args.Length() > 2 ||
      (!IsType(args.Env(), args[0], napi_string) &&
       !IsArray(args.Env(), args[0])) ||
      (args.Length() == 2 && !IsType(args.Env(), args[1], napi_number)))
    return ThrowTypeError(args.Env(),
                          "Wrong arguments, provide a string or array of glyph "
                          "indexes, and optionally also a font size");
  long fontSize = args.Length() == 2 ? ToUint32(args.Env(), args[1]) : 1;
  auto *driver = ObjectWrap::Unwrap<UsedFontDriver>(args.Env(), args.This());
  FreeTypeFaceWrapper *wrapper = driver->UsedFont->GetFreeTypeFont();
  FT_Face face = *wrapper;
  UIntList glyphs;
  if (IsType(args.Env(), args[0], napi_string)) {
    UnicodeString unicode;
    unicode.FromUTF8(LegacyString(args.Env(), args[0]));
    wrapper->GetGlyphsForUnicodeText(unicode.GetUnicodeList(), glyphs);
  } else {
    uint32_t length = 0;
    if (!Length(args.Env(), args[0], &length))
      return nullptr;
    for (uint32_t i = 0; i < length; ++i) {
      napi_value value = nullptr;
      uint32_t glyph = 0;
      if (!Get(args.Env(), args[0], i, &value) ||
          !CoerceToUint32(args.Env(), value, &glyph))
        return nullptr;
      glyphs.push_back(glyph);
    }
  }
  int penX = 0;
  std::list<FT_Vector> positions;
  for (auto glyph : glyphs) {
    positions.push_back({penX, 0});
    penX += wrapper->GetGlyphWidth(glyph);
  }
  FT_BBox box{32000, 32000, -32000, -32000};
  auto position = positions.begin();
  for (auto glyph : glyphs) {
    FT_Load_Glyph(face, wrapper->GetGlyphIndexInFreeTypeIndexes(glyph),
                  FT_LOAD_NO_SCALE);
    FT_Glyph loaded;
    FT_Get_Glyph(face->glyph, &loaded);
    FT_BBox glyphBox;
    FT_Glyph_Get_CBox(loaded, FT_GLYPH_BBOX_UNSCALED, &glyphBox);
    FT_Done_Glyph(loaded);
    glyphBox.xMin = wrapper->GetInPDFMeasurements(glyphBox.xMin) + position->x;
    glyphBox.xMax = wrapper->GetInPDFMeasurements(glyphBox.xMax) + position->x;
    glyphBox.yMin = wrapper->GetInPDFMeasurements(glyphBox.yMin) + position->y;
    glyphBox.yMax = wrapper->GetInPDFMeasurements(glyphBox.yMax) + position->y;
    box.xMin = std::min(box.xMin, glyphBox.xMin);
    box.yMin = std::min(box.yMin, glyphBox.yMin);
    box.xMax = std::max(box.xMax, glyphBox.xMax);
    box.yMax = std::max(box.yMax, glyphBox.yMax);
    ++position;
  }
  if (box.xMin > box.xMax)
    box = {0, 0, 0, 0};
  napi_value result = Object(args.Env());
  Set(args.Env(), result, "xMin",
      Number(args.Env(), double(box.xMin * fontSize) / 1000));
  Set(args.Env(), result, "yMin",
      Number(args.Env(), double(box.yMin * fontSize) / 1000));
  Set(args.Env(), result, "xMax",
      Number(args.Env(), double(box.xMax * fontSize) / 1000));
  Set(args.Env(), result, "yMax",
      Number(args.Env(), double(box.yMax * fontSize) / 1000));
  Set(args.Env(), result, "width",
      Number(args.Env(), double(box.xMax - box.xMin) * fontSize / 1000));
  Set(args.Env(), result, "height",
      Number(args.Env(), double(box.yMax - box.yMin) * fontSize / 1000));
  return result;
}
