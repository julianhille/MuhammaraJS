#include "AbstractContentContextDriver.h"

#include "AbstractContentContext.h"
#include "CSSColors.h"
#include "ConstructorsHolder.h"
#include "FormXObjectDriver.h"
#include "FreeTypeFaceWrapper.h"
#include "ImageXObjectDriver.h"
#include "PDFFormXObject.h"
#include "PDFUsedFont.h"
#include "ResourcesDictionary.h"
#include "UsedFontDriver.h"

#include <ft2build.h>
#include FT_FREETYPE_H
#include FT_TRUETYPE_TABLES_H

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <cstring>
#include <map>
#include <string>
#include <vector>

using namespace muhammara::napi;

namespace {

enum class Op : intptr_t {
  b,
  B,
  bStar,
  BStar,
  s,
  S,
  f,
  F,
  fStar,
  n,
  m,
  l,
  c,
  v,
  y,
  h,
  re,
  q,
  Q,
  cm,
  w,
  J,
  j,
  M,
  ri,
  i,
  gs,
  CS,
  cs,
  G,
  g,
  RG,
  rg,
  K,
  k,
  W,
  WStar,
  Tc,
  Tw,
  Tz,
  TL,
  Tr,
  Ts,
  BT,
  ET,
  Td,
  TD,
  Tm,
  TStar,
  WriteFreeCode
};

struct Definition {
  const char *name;
  Op op;
};

constexpr Definition definitions[] = {
    {"b", Op::b},         {"B", Op::B},
    {"bStar", Op::bStar}, {"BStar", Op::BStar},
    {"s", Op::s},         {"S", Op::S},
    {"f", Op::f},         {"F", Op::F},
    {"fStar", Op::fStar}, {"n", Op::n},
    {"m", Op::m},         {"l", Op::l},
    {"c", Op::c},         {"v", Op::v},
    {"y", Op::y},         {"h", Op::h},
    {"re", Op::re},       {"q", Op::q},
    {"Q", Op::Q},         {"cm", Op::cm},
    {"w", Op::w},         {"J", Op::J},
    {"j", Op::j},         {"M", Op::M},
    {"ri", Op::ri},       {"i", Op::i},
    {"gs", Op::gs},       {"CS", Op::CS},
    {"cs", Op::cs},       {"G", Op::G},
    {"g", Op::g},         {"RG", Op::RG},
    {"rg", Op::rg},       {"K", Op::K},
    {"k", Op::k},         {"W", Op::W},
    {"WStar", Op::WStar}, {"Tc", Op::Tc},
    {"Tw", Op::Tw},       {"Tz", Op::Tz},
    {"TL", Op::TL},       {"Tr", Op::Tr},
    {"Ts", Op::Ts},       {"BT", Op::BT},
    {"ET", Op::ET},       {"Td", Op::Td},
    {"TD", Op::TD},       {"Tm", Op::Tm},
    {"TStar", Op::TStar}, {"writeFreeCode", Op::WriteFreeCode}};

enum class ColorOp : intptr_t { SC, SCN, sc, scn };

typedef std::map<std::string, unsigned long> StringToULongMap;

class ColorMap {
public:
  ColorMap() {
    for (unsigned long i = 0; std::strlen(kCSSColorsArray[i].name) != 0; ++i) {
      colorMap_.insert(StringToULongMap::value_type(
          kCSSColorsArray[i].name, kCSSColorsArray[i].rgbValue));
    }
  }

  unsigned long GetRGBForColorName(const std::string &colorName) {
    std::string key = colorName;
    std::transform(key.begin(), key.end(), key.begin(),
                   [](unsigned char value) { return std::tolower(value); });
    StringToULongMap::iterator found = colorMap_.find(key);
    return found == colorMap_.end() ? 0 : found->second;
  }

private:
  StringToULongMap colorMap_;
};

ColorMap colorMap;

AbstractContentContextDriver *Driver(const CallbackArgs &args) {
  return ObjectWrap::Unwrap<AbstractContentContextDriver>(args.Env(),
                                                          args.This());
}

bool IsNumber(const CallbackArgs &args, size_t index) {
  return IsType(args.Env(), args[index], napi_number);
}

bool IsString(const CallbackArgs &args, size_t index) {
  return IsType(args.Env(), args[index], napi_string);
}

napi_value WrongArguments(napi_env env, const char *message) {
  return ThrowError(env, message);
}

double GetUnderlineThicknessFactor(FreeTypeFaceWrapper *wrapper) {
  void *tableInfo = FT_Get_Sfnt_Table(*wrapper, ft_sfnt_post);
  if (tableInfo) {
    TT_Postscript *table = static_cast<TT_Postscript *>(tableInfo);
    return table->underlineThickness * 1.0 / (*wrapper)->units_per_EM;
  }
  return 0.05;
}

double GetUnderlinePositionFactor(FreeTypeFaceWrapper *wrapper) {
  void *tableInfo = FT_Get_Sfnt_Table(*wrapper, ft_sfnt_post);
  if (tableInfo) {
    TT_Postscript *table = static_cast<TT_Postscript *>(tableInfo);
    return table->underlinePosition * 1.0 / (*wrapper)->units_per_EM;
  }
  return -0.15;
}

} // namespace

AbstractContentContextDriver::AbstractContentContextDriver()
    : holder(nullptr), mResourcesDictionary(nullptr) {}

void AbstractContentContextDriver::SetResourcesDictionary(
    ResourcesDictionary *value) {
  mResourcesDictionary = value;
}

ResourcesDictionary *AbstractContentContextDriver::GetResourcesDictionary() {
  return mResourcesDictionary;
}

void AbstractContentContextDriver::Init(ClassBuilder &builder) {
  for (const Definition &definition : definitions) {
    builder.Method(
        definition.name, Operator,
        reinterpret_cast<void *>(static_cast<intptr_t>(definition.op)));
  }
  builder.Method("d", Dash)
      .Method("setOpacity", SetOpacity)
      .Method("SC", Color,
              reinterpret_cast<void *>(static_cast<intptr_t>(ColorOp::SC)))
      .Method("SCN", Color,
              reinterpret_cast<void *>(static_cast<intptr_t>(ColorOp::SCN)))
      .Method("sc", Color,
              reinterpret_cast<void *>(static_cast<intptr_t>(ColorOp::sc)))
      .Method("scn", Color,
              reinterpret_cast<void *>(static_cast<intptr_t>(ColorOp::scn)))
      .Method("doXObject", DoXObject)
      .Method("Tf", Tf)
      .Method("Tj", Tj)
      .Method("Quote", Quote)
      .Method("DoubleQuote", DoubleQuote)
      .Method("TJ", TJ)
      .Method("drawPath", DrawPath)
      .Method("drawCircle", DrawCircle)
      .Method("drawSquare", DrawSquare)
      .Method("drawRectangle", DrawRectangle)
      .Method("writeText", WriteText)
      .Method("drawImage", DrawImage);
}

napi_value AbstractContentContextDriver::Operator(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  Op op = static_cast<Op>(reinterpret_cast<intptr_t>(args.Data()));
  if (!driver->GetContext()) {
    const char *message = op == Op::re || op == Op::q || op == Op::Q ||
                                  op == Op::ri || op == Op::gs || op == Op::G ||
                                  op == Op::g
                              ? "Null content context. Please create a context "
                                "using pdfWriter.startPageContentContext(page)"
                              : "Null content context. Please create a context";
    return ThrowError(args.Env(), message);
  }

  AbstractContentContext *context = driver->GetContext();
  auto requireNumbers = [&](size_t count, const char *message) {
    if (args.Length() != count) {
      WrongArguments(args.Env(), message);
      return false;
    }
    for (size_t i = 0; i < count; ++i) {
      if (!IsNumber(args, i)) {
        WrongArguments(args.Env(), message);
        return false;
      }
    }
    return true;
  };
  auto number = [&](size_t index) { return ToDouble(args.Env(), args[index]); };

  switch (op) {
#define NO_ARGUMENT_OPERATOR(name)                                             \
  case Op::name:                                                               \
    context->name();                                                           \
    break
    NO_ARGUMENT_OPERATOR(b);
    NO_ARGUMENT_OPERATOR(B);
    NO_ARGUMENT_OPERATOR(bStar);
    NO_ARGUMENT_OPERATOR(BStar);
    NO_ARGUMENT_OPERATOR(s);
    NO_ARGUMENT_OPERATOR(S);
    NO_ARGUMENT_OPERATOR(f);
    NO_ARGUMENT_OPERATOR(F);
    NO_ARGUMENT_OPERATOR(fStar);
    NO_ARGUMENT_OPERATOR(n);
    NO_ARGUMENT_OPERATOR(h);
    NO_ARGUMENT_OPERATOR(q);
    NO_ARGUMENT_OPERATOR(Q);
    NO_ARGUMENT_OPERATOR(W);
    NO_ARGUMENT_OPERATOR(WStar);
    NO_ARGUMENT_OPERATOR(BT);
    NO_ARGUMENT_OPERATOR(ET);
    NO_ARGUMENT_OPERATOR(TStar);
#undef NO_ARGUMENT_OPERATOR
  case Op::m:
    if (!requireNumbers(
            2,
            "Wrong Arguments, please provide 2 parameters, movement position"))
      return nullptr;
    context->m(number(0), number(1));
    break;
  case Op::l:
    if (!requireNumbers(
            2,
            "Wrong Arguments, please provide 2 parameters, line to position"))
      return nullptr;
    context->l(number(0), number(1));
    break;
  case Op::c:
    if (!requireNumbers(
            6, "Wrong Arguments, please provide 6 parameters of the curve"))
      return nullptr;
    context->c(number(0), number(1), number(2), number(3), number(4),
               number(5));
    break;
  case Op::v:
    if (!requireNumbers(
            4, "Wrong Arguments, please provide 4 parameters of the curve"))
      return nullptr;
    context->v(number(0), number(1), number(2), number(3));
    break;
  case Op::y:
    if (!requireNumbers(
            4, "Wrong Arguments, please provide 4 parameters of the curve"))
      return nullptr;
    context->y(number(0), number(1), number(2), number(3));
    break;
  case Op::re:
    if (!requireNumbers(4,
                        "Wrong Argument, please provide 4 parameters: 2 bottom "
                        "left coordinates, and width and height measures"))
      return nullptr;
    context->re(number(0), number(1), number(2), number(3));
    break;
  case Op::cm:
    if (!requireNumbers(6, "Wrong Arguments, please provide 6 arguments "
                           "forming a 2d transformation matrix"))
      return nullptr;
    context->cm(number(0), number(1), number(2), number(3), number(4),
                number(5));
    break;
  case Op::w:
    if (!requireNumbers(
            1, "Wrong Argument, please provide 1 parameter, width measure"))
      return nullptr;
    context->w(number(0));
    break;
  case Op::J:
    if (!requireNumbers(
            1, "Wrong Argument, please provide 1 parameter, line cap style"))
      return nullptr;
    context->J(ToInt32(args.Env(), args[0]));
    break;
  case Op::j:
    if (!requireNumbers(
            1, "Wrong Argument, please provide 1 parameter, line join style"))
      return nullptr;
    context->j(ToInt32(args.Env(), args[0]));
    break;
  case Op::M:
    if (!requireNumbers(
            1, "Wrong Argument, please provide 1 parameter, miter limit"))
      return nullptr;
    context->M(number(0));
    break;
  case Op::ri:
    if (args.Length() != 1 || !IsString(args, 0))
      return WrongArguments(args.Env(),
                            "Wrong Argument, please provide 1 string argument, "
                            "the rendering intent");
    context->ri(LegacyString(args.Env(), args[0]));
    break;
  case Op::i:
    if (!requireNumbers(1,
                        "Wrong Argument, please provide 1 parameter, flatness"))
      return nullptr;
    context->i(ToInt32(args.Env(), args[0]));
    break;
  case Op::gs:
    if (args.Length() != 1 || !IsString(args, 0))
      return WrongArguments(args.Env(), "Wrong Argument, please provide 1 "
                                        "string argument, graphic state name");
    context->gs(LegacyString(args.Env(), args[0]));
    break;
  case Op::CS:
  case Op::cs:
    if (args.Length() != 1 || !IsString(args, 0))
      return WrongArguments(
          args.Env(), "Wrong Argument, please provide a color space name");
    if (op == Op::CS)
      context->CS(LegacyString(args.Env(), args[0]));
    else
      context->cs(LegacyString(args.Env(), args[0]));
    break;
  case Op::G:
  case Op::g:
    if (!requireNumbers(
            1,
            "Wrong Argument, please provide 1 parameter, gray value (0-255)"))
      return nullptr;
    if (op == Op::G)
      context->G(number(0));
    else
      context->g(number(0));
    break;
  case Op::RG:
  case Op::rg:
    if (!requireNumbers(
            3,
            "Wrong Arguments, please provide 3 arguments as rgb color values"))
      return nullptr;
    if (op == Op::RG)
      context->RG(number(0), number(1), number(2));
    else
      context->rg(number(0), number(1), number(2));
    break;
  case Op::K:
  case Op::k:
    if (!requireNumbers(4, "Wrong Argument, please provide 4 cmyk components "
                           "(values should be 0-255)"))
      return nullptr;
    if (op == Op::K)
      context->K(number(0), number(1), number(2), number(3));
    else
      context->k(number(0), number(1), number(2), number(3));
    break;
  case Op::Tc:
    if (!requireNumbers(1, "Wrong Arguments, please provide character space"))
      return nullptr;
    context->Tc(number(0));
    break;
  case Op::Tw:
    if (!requireNumbers(1, "Wrong Arguments, please provide word space"))
      return nullptr;
    context->Tw(number(0));
    break;
  case Op::Tz:
    if (!requireNumbers(1,
                        "Wrong Arguments, please provide horizontal scaling"))
      return nullptr;
    context->Tz(ToInt32(args.Env(), args[0]));
    break;
  case Op::TL:
    if (!requireNumbers(1, "Wrong Arguments, please provide text leading"))
      return nullptr;
    context->TL(number(0));
    break;
  case Op::Tr:
    if (!requireNumbers(1, "Wrong Arguments, please provide rendering mode"))
      return nullptr;
    context->Tr(ToInt32(args.Env(), args[0]));
    break;
  case Op::Ts:
    if (!requireNumbers(1, "Wrong Arguments, please provide font rise"))
      return nullptr;
    context->Ts(number(0));
    break;
  case Op::Td:
  case Op::TD:
    if (!requireNumbers(2, "Wrong Arguments, please provide 2 arguments"))
      return nullptr;
    if (op == Op::Td)
      context->Td(number(0), number(1));
    else
      context->TD(number(0), number(1));
    break;
  case Op::Tm:
    if (!requireNumbers(6, "Wrong Arguments, please provide 6 arguments "
                           "forming a 2d transformation matrix (for text)"))
      return nullptr;
    context->Tm(number(0), number(1), number(2), number(3), number(4),
                number(5));
    break;
  case Op::WriteFreeCode:
    if (args.Length() != 1 || !IsString(args, 0))
      return WrongArguments(args.Env(),
                            "Wrong Arguments, please provide string to write");
    context->WriteFreeCode(LegacyString(args.Env(), args[0]));
    break;
  }
  return args.This();
}

napi_value AbstractContentContextDriver::Dash(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");
  if (args.Length() != 2 || !IsArray(args.Env(), args[0]) || !IsNumber(args, 1))
    return WrongArguments(args.Env(),
                          "Wrong Argument, please provide 2 parameters - array "
                          "for dash pattern and dash phase number");

  uint32_t length = 0;
  if (!Length(args.Env(), args[0], &length))
    return nullptr;
  std::vector<double> dashArray(length);
  for (uint32_t i = 0; i < length; ++i) {
    napi_value value = nullptr;
    int32_t dash = 0;
    if (!Get(args.Env(), args[0], i, &value) ||
        !CoerceToInt32(args.Env(), value, &dash))
      return nullptr;
    dashArray[i] = dash;
  }
  driver->GetContext()->d(dashArray.data(), length,
                          ToInt32(args.Env(), args[1]));
  return args.This();
}

napi_value AbstractContentContextDriver::SetOpacity(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context using "
                      "pdfWriter.startPageContentContext(page)");
  double opacity = args.Length() == 1 && IsNumber(args, 0)
                       ? ToDouble(args.Env(), args[0])
                       : -1;
  if (opacity < 0 || opacity > 1 || opacity != opacity)
    return WrongArguments(
        args.Env(),
        "Wrong Argument, please provide 1 opacity value between 0 and 1");
  driver->GetContext()->SetOpacity(opacity);
  return args.This();
}

napi_value AbstractContentContextDriver::Color(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");
  ColorOp op = static_cast<ColorOp>(reinterpret_cast<intptr_t>(args.Data()));
  bool patternOperator = op == ColorOp::SCN || op == ColorOp::scn;
  if (!patternOperator && args.Length() == 0)
    return WrongArguments(
        args.Env(),
        "Wrong Arguments, please provide at least one color component");
  if (patternOperator &&
      (args.Length() == 0 ||
       (args.Length() == 1 &&
        !(IsNumber(args, 0) || IsArray(args.Env(), args[0]))) ||
       (args.Length() > 1 && !(IsNumber(args, args.Length() - 1) ||
                               IsArray(args.Env(), args[args.Length() - 1]) ||
                               IsString(args, args.Length() - 1)))))
    return WrongArguments(
        args.Env(),
        "Wrong Arguments, please provide at least one color component or a "
        "list of color components and optional a pattern name");

  bool hasPattern = patternOperator && IsString(args, args.Length() - 1);
  bool arrayForm = IsArray(args.Env(), args[0]);
  uint32_t length =
      static_cast<uint32_t>(args.Length() - (hasPattern ? 1 : 0));
  if (arrayForm && !Length(args.Env(), args[0], &length))
    return nullptr;
  std::vector<double> components(length);
  for (uint32_t i = 0; i < length; ++i) {
    napi_value value = nullptr;
    if (arrayForm) {
      if (!Get(args.Env(), args[0], i, &value))
        return nullptr;
    } else {
      value = args[i];
    }
    if (!CoerceToDouble(args.Env(), value, &components[i]))
      return nullptr;
  }

  AbstractContentContext *context = driver->GetContext();
  if (op == ColorOp::SC)
    context->SC(components.data(), length);
  else if (op == ColorOp::sc)
    context->sc(components.data(), length);
  else if (op == ColorOp::SCN && hasPattern)
    context->SCN(components.data(), length,
                 LegacyString(args.Env(), args[args.Length() - 1]));
  else if (op == ColorOp::SCN)
    context->SCN(components.data(), length);
  else if (hasPattern)
    context->scn(components.data(), length,
                 LegacyString(args.Env(), args[args.Length() - 1]));
  else
    context->scn(components.data(), length);
  return args.This();
}

napi_value AbstractContentContextDriver::DoXObject(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext() || !driver->mResourcesDictionary)
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");
  if (args.Length() != 1)
    return WrongArguments(args.Env(), "Invalid arguments. pass an xobject");

  if (IsString(args, 0)) {
    driver->GetContext()->Do(LegacyString(args.Env(), args[0]));
  } else if (driver->holder->IsFormXObjectInstance(args[0])) {
    FormXObjectDriver *form =
        ObjectWrap::Unwrap<FormXObjectDriver>(args.Env(), args[0]);
    if (!form)
      return WrongArguments(
          args.Env(),
          "Wrong arguments, provide an xobject as the single parameter or its "
          "name according to the local resource dictionary");
    driver->GetContext()->Do(
        driver->mResourcesDictionary->AddFormXObjectMapping(
            form->FormXObject->GetObjectID()));
  } else if (driver->holder->IsImageXObjectInstance(args[0])) {
    ImageXObjectDriver *image =
        ObjectWrap::Unwrap<ImageXObjectDriver>(args.Env(), args[0]);
    if (!image)
      return WrongArguments(
          args.Env(),
          "Wrong arguments, provide an xobject as the single parameter or its "
          "name according to the local resource dictionary");
    driver->GetContext()->Do(
        driver->mResourcesDictionary->AddImageXObjectMapping(
            image->ImageXObject));
  } else {
    return WrongArguments(
        args.Env(),
        "Wrong arguments, provide an xobject as the single parameter or its "
        "name according to the local resource dictionary");
  }
  return args.This();
}

napi_value AbstractContentContextDriver::Tf(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");
  if (args.Length() != 2 ||
      (!driver->holder->IsUsedFontInstance(args[0]) && !IsString(args, 0)) ||
      !IsNumber(args, 1))
    return WrongArguments(
        args.Env(),
        "Wrong Arguments, please provide a font object (create with "
        "pdfWriter.getFontForFile) or font resource name and a size measure");
  if (IsString(args, 0))
    driver->GetContext()->TfLow(LegacyString(args.Env(), args[0]),
                                ToDouble(args.Env(), args[1]));
  else
    driver->GetContext()->Tf(
        ObjectWrap::Unwrap<UsedFontDriver>(args.Env(), args[0])->UsedFont,
        ToDouble(args.Env(), args[1]));
  return args.This();
}

TextPlacingOptions
AbstractContentContextDriver::ObjectToOptions(napi_env env, napi_value object) {
  TextPlacingOptions options;
  if (Has(env, object, "encoding")) {
    std::string value = CoerceToString(env, Get(env, object, "encoding"));
    if (value == "hex")
      options.encoding = TextPlacingOptions::EEncodingHex;
    else if (value == "code")
      options.encoding = TextPlacingOptions::EEncodingCode;
  }
  return options;
}

bool AbstractContentContextDriver::ArrayToGlyphsList(
    napi_env env, napi_value array, GlyphUnicodeMappingList &out) {
  GlyphUnicodeMappingList glyphList;
  uint32_t length = 0;
  if (!Length(env, array, &length))
    return false;
  for (uint32_t i = 0; i < length; ++i) {
    napi_value item = nullptr;
    if (!Get(env, array, i, &item))
      return false;
    if (!IsArray(env, item))
      continue;
    uint32_t itemLength = 0;
    if (!Length(env, item, &itemLength))
      return false;
    if (itemLength == 0)
      continue;
    GlyphUnicodeMapping mapping;
    napi_value value = nullptr;
    uint32_t glyph = 0;
    if (!Get(env, item, uint32_t{0}, &value) ||
        !CoerceToUint32(env, value, &glyph))
      return false;
    mapping.mGlyphCode = glyph;
    for (uint32_t j = 1; j < itemLength; ++j) {
      uint32_t unicode = 0;
      if (!Get(env, item, j, &value) ||
          !CoerceToUint32(env, value, &unicode))
        return false;
      mapping.mUnicodeValues.push_back(unicode);
    }
    glyphList.push_back(mapping);
  }
  out = std::move(glyphList);
  return true;
}

napi_value AbstractContentContextDriver::Tj(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");
  if ((args.Length() != 1 && args.Length() != 2) ||
      (!IsString(args, 0) && !IsArray(args.Env(), args[0])) ||
      (args.Length() == 2 && !IsObject(args.Env(), args[1])))
    return WrongArguments(
        args.Env(),
        "Wrong Arguments, please provide 1 argument, the string that you wish "
        "to display or a glyphs IDs array, and an optional options object");
  if (IsArray(args.Env(), args[0])) {
    GlyphUnicodeMappingList glyphs;
    if (!ArrayToGlyphsList(args.Env(), args[0], glyphs))
      return nullptr;
    driver->GetContext()->Tj(glyphs);
  } else {
    TextPlacingOptions options = args.Length() == 2
                                     ? ObjectToOptions(args.Env(), args[1])
                                     : TextPlacingOptions();
    std::string text = ToString(args.Env(), args[0]);
    if (options.encoding == TextPlacingOptions::EEncodingCode)
      driver->GetContext()->TjLow(text);
    else if (options.encoding == TextPlacingOptions::EEncodingHex)
      driver->GetContext()->TjHexLow(text);
    else
      driver->GetContext()->Tj(text);
  }
  return args.This();
}

napi_value AbstractContentContextDriver::Quote(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");
  if ((args.Length() != 1 && args.Length() != 2) ||
      (!IsString(args, 0) && !IsArray(args.Env(), args[0])) ||
      (args.Length() == 2 && !IsObject(args.Env(), args[1])))
    return WrongArguments(
        args.Env(),
        "Wrong Arguments, please provide 1 argument, the string that you wish "
        "to display or a glyphs IDs array, and an optional options object");
  if (IsArray(args.Env(), args[0])) {
    GlyphUnicodeMappingList glyphs;
    if (!ArrayToGlyphsList(args.Env(), args[0], glyphs))
      return nullptr;
    driver->GetContext()->Quote(glyphs);
  } else {
    TextPlacingOptions options = args.Length() == 2
                                     ? ObjectToOptions(args.Env(), args[1])
                                     : TextPlacingOptions();
    std::string text = ToString(args.Env(), args[0]);
    if (options.encoding == TextPlacingOptions::EEncodingCode)
      driver->GetContext()->QuoteLow(text);
    else if (options.encoding == TextPlacingOptions::EEncodingHex)
      driver->GetContext()->QuoteHexLow(text);
    else
      driver->GetContext()->Quote(text);
  }
  return args.This();
}

napi_value AbstractContentContextDriver::DoubleQuote(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");
  if ((args.Length() != 3 && args.Length() != 4) || !IsNumber(args, 0) ||
      !IsNumber(args, 1) ||
      (!IsString(args, 2) && !IsArray(args.Env(), args[2])) ||
      (args.Length() == 4 && !IsObject(args.Env(), args[3])))
    return WrongArguments(
        args.Env(),
        "Wrong Arguments, please provide 3 arguments, word spacing, character "
        "spacing and text, and optionally an options object");
  double wordSpacing = ToDouble(args.Env(), args[0]);
  double characterSpacing = ToDouble(args.Env(), args[1]);
  if (IsArray(args.Env(), args[2])) {
    GlyphUnicodeMappingList glyphs;
    if (!ArrayToGlyphsList(args.Env(), args[2], glyphs))
      return nullptr;
    driver->GetContext()->DoubleQuote(wordSpacing, characterSpacing, glyphs);
  } else {
    TextPlacingOptions options = args.Length() == 4
                                     ? ObjectToOptions(args.Env(), args[3])
                                     : TextPlacingOptions();
    std::string text = ToString(args.Env(), args[2]);
    if (options.encoding == TextPlacingOptions::EEncodingCode)
      driver->GetContext()->DoubleQuoteLow(wordSpacing, characterSpacing, text);
    else if (options.encoding == TextPlacingOptions::EEncodingHex)
      driver->GetContext()->DoubleQuoteHexLow(wordSpacing, characterSpacing,
                                              text);
    else
      driver->GetContext()->DoubleQuote(wordSpacing, characterSpacing, text);
  }
  return args.This();
}

napi_value AbstractContentContextDriver::TJ(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");

  bool hasStrings = false;
  bool hasOptions = args.Length() > 0 && !IsString(args, args.Length() - 1) &&
                    !IsNumber(args, args.Length() - 1) &&
                    IsObject(args.Env(), args[args.Length() - 1]);
  for (size_t i = 0; i < args.Length() && !hasStrings; ++i)
    hasStrings = IsString(args, i);

  if (hasStrings) {
    StringOrDoubleList params;
    TextPlacingOptions options =
        hasOptions ? ObjectToOptions(args.Env(), args[args.Length() - 1])
                   : TextPlacingOptions();
    size_t length = hasOptions ? args.Length() - 1 : args.Length();
    for (size_t i = 0; i < length; ++i) {
      if (IsString(args, i))
        params.push_back(StringOrDouble(ToString(args.Env(), args[i])));
      else if (IsNumber(args, i))
        params.push_back(StringOrDouble(ToDouble(args.Env(), args[i])));
      else
        return WrongArguments(
            args.Env(), "Wrong arguments. please provide a variable number of "
                        "elements each either string/glyphs list or number, "
                        "and an optional final options object");
    }
    if (options.encoding == TextPlacingOptions::EEncodingCode)
      driver->GetContext()->TJLow(params);
    else if (options.encoding == TextPlacingOptions::EEncodingHex)
      driver->GetContext()->TJHexLow(params);
    else
      driver->GetContext()->TJ(params);
  } else {
    GlyphUnicodeMappingListOrDoubleList params;
    for (size_t i = 0; i < args.Length(); ++i) {
      if (IsArray(args.Env(), args[i])) {
        GlyphUnicodeMappingList glyphs;
        if (!ArrayToGlyphsList(args.Env(), args[i], glyphs))
          return nullptr;
        params.push_back(GlyphUnicodeMappingListOrDouble(glyphs));
      }
      else if (IsNumber(args, i))
        params.push_back(
            GlyphUnicodeMappingListOrDouble(ToDouble(args.Env(), args[i])));
      else
        return WrongArguments(
            args.Env(), "Wrong arguments. please provide a variable number of "
                        "elements each either string/glyph list or number, and "
                        "an optional final options object");
    }
    driver->GetContext()->TJ(params);
  }
  return args.This();
}

void AbstractContentContextDriver::SetupColorAndLineWidth(
    napi_env env, napi_value maybeOptions) {
  if (!IsObject(env, maybeOptions))
    return;
  bool isStroke = !Has(env, maybeOptions, "type") ||
                  LegacyString(env, Get(env, maybeOptions, "type")) == "stroke";
  SetColor(env, maybeOptions, isStroke);
  if (HasPendingException(env))
    return;
  if (isStroke && Has(env, maybeOptions, "width")) {
    napi_value value = nullptr;
    double width = 0;
    if (!Get(env, maybeOptions, "width", &value) ||
        !CoerceToDouble(env, value, &width))
      return;
    GetContext()->w(width);
  }
}

void AbstractContentContextDriver::SetColor(napi_env env,
                                            napi_value maybeOptions,
                                            bool isStroke) {
  if (!IsObject(env, maybeOptions) || !Has(env, maybeOptions, "color"))
    return;
  napi_value color = nullptr;
  if (!Get(env, maybeOptions, "color", &color))
    return;
  if (IsType(env, color, napi_string)) {
    SetRGBColor(colorMap.GetRGBForColorName(LegacyString(env, color)),
                isStroke);
    return;
  }

  int32_t numericColor = 0;
  if (!CoerceToInt32(env, color, &numericColor))
    return;
  unsigned long colorValue = static_cast<unsigned long>(numericColor);
  std::string colorSpace = "rgb";
  if (Has(env, maybeOptions, "colorspace")) {
    napi_value value = nullptr;
    if (!Get(env, maybeOptions, "colorspace", &value))
      return;
    colorSpace = LegacyString(env, value);
    if (HasPendingException(env))
      return;
  }
  if (colorSpace == "rgb") {
    SetRGBColor(colorValue, isStroke);
  } else if (colorSpace == "cmyk") {
    double c = static_cast<unsigned char>((colorValue >> 24) & 0xff);
    double m = static_cast<unsigned char>((colorValue >> 16) & 0xff);
    double y = static_cast<unsigned char>((colorValue >> 8) & 0xff);
    double k = static_cast<unsigned char>(colorValue & 0xff);
    if (isStroke)
      GetContext()->K(c / 255, m / 255, y / 255, k / 255);
    else
      GetContext()->k(c / 255, m / 255, y / 255, k / 255);
  } else if (colorSpace == "gray") {
    double gray = static_cast<unsigned char>(colorValue & 0xff);
    if (isStroke)
      GetContext()->G(gray / 255);
    else
      GetContext()->g(gray / 255);
  }
}

bool AbstractContentContextDriver::ReadPathOptions(napi_env env,
                                                   napi_value maybeOptions,
                                                   PathOptions &options) {
  if (!IsObject(env, maybeOptions))
    return true;

  bool hasType = Has(env, maybeOptions, "type");
  if (HasPendingException(env))
    return false;
  if (hasType) {
    napi_value value = nullptr;
    if (!Get(env, maybeOptions, "type", &value))
      return false;
    options.setupIsStroke = LegacyString(env, value) == "stroke";
    if (HasPendingException(env))
      return false;
  }

  options.hasColor = Has(env, maybeOptions, "color");
  if (HasPendingException(env))
    return false;
  if (options.hasColor) {
    napi_value color = nullptr;
    if (!Get(env, maybeOptions, "color", &color))
      return false;
    options.hasNamedColor = IsType(env, color, napi_string);
    if (options.hasNamedColor) {
      options.colorName = LegacyString(env, color);
      if (HasPendingException(env))
        return false;
    } else {
      int32_t numericColor = 0;
      if (!CoerceToInt32(env, color, &numericColor))
        return false;
      options.colorValue = static_cast<unsigned long>(numericColor);
      bool hasColorSpace = Has(env, maybeOptions, "colorspace");
      if (HasPendingException(env))
        return false;
      if (hasColorSpace) {
        napi_value colorSpace = nullptr;
        if (!Get(env, maybeOptions, "colorspace", &colorSpace))
          return false;
        options.colorSpace = LegacyString(env, colorSpace);
        if (HasPendingException(env))
          return false;
      }
    }
  }

  options.hasWidth = options.setupIsStroke && Has(env, maybeOptions, "width");
  if (HasPendingException(env))
    return false;
  if (options.hasWidth) {
    napi_value value = nullptr;
    if (!Get(env, maybeOptions, "width", &value) ||
        !CoerceToDouble(env, value, &options.width))
      return false;
  }

  hasType = Has(env, maybeOptions, "type");
  if (HasPendingException(env))
    return false;
  if (hasType) {
    napi_value value = nullptr;
    if (!Get(env, maybeOptions, "type", &value))
      return false;
    options.finishType = LegacyString(env, value);
    if (HasPendingException(env))
      return false;
  }
  bool hasClose = Has(env, maybeOptions, "close");
  if (HasPendingException(env))
    return false;
  if (hasClose) {
    napi_value value = nullptr;
    if (!Get(env, maybeOptions, "close", &value))
      return false;
    options.closePath = ToBoolean(env, value);
    if (HasPendingException(env))
      return false;
  }
  return true;
}

void AbstractContentContextDriver::ApplyPathOptions(
    const PathOptions &options) {
  if (options.hasColor) {
    if (options.hasNamedColor) {
      SetRGBColor(colorMap.GetRGBForColorName(options.colorName),
                  options.setupIsStroke);
    } else if (options.colorSpace == "rgb") {
      SetRGBColor(options.colorValue, options.setupIsStroke);
    } else if (options.colorSpace == "cmyk") {
      double c = static_cast<unsigned char>((options.colorValue >> 24) & 0xff);
      double m = static_cast<unsigned char>((options.colorValue >> 16) & 0xff);
      double y = static_cast<unsigned char>((options.colorValue >> 8) & 0xff);
      double k = static_cast<unsigned char>(options.colorValue & 0xff);
      if (options.setupIsStroke)
        GetContext()->K(c / 255, m / 255, y / 255, k / 255);
      else
        GetContext()->k(c / 255, m / 255, y / 255, k / 255);
    } else if (options.colorSpace == "gray") {
      double gray = static_cast<unsigned char>(options.colorValue & 0xff);
      if (options.setupIsStroke)
        GetContext()->G(gray / 255);
      else
        GetContext()->g(gray / 255);
    }
  }
  if (options.hasWidth)
    GetContext()->w(options.width);
}

void AbstractContentContextDriver::CompletePath(const PathOptions &options) {
  if (options.finishType == "stroke") {
    if (options.closePath)
      GetContext()->s();
    else
      GetContext()->S();
  } else if (options.finishType == "fill") {
    GetContext()->f();
  } else if (options.finishType.compare("clip")) {
    if (options.closePath)
      GetContext()->h();
    GetContext()->W();
  }
}

void AbstractContentContextDriver::SetRGBColor(unsigned long colorValue,
                                               bool isStroke) {
  double r = static_cast<unsigned char>((colorValue >> 16) & 0xff);
  double g = static_cast<unsigned char>((colorValue >> 8) & 0xff);
  double b = static_cast<unsigned char>(colorValue & 0xff);
  if (isStroke)
    GetContext()->RG(r / 255, g / 255, b / 255);
  else
    GetContext()->rg(r / 255, g / 255, b / 255);
}

void AbstractContentContextDriver::FinishPath(napi_env env,
                                              napi_value maybeOptions) {
  bool closePath = false;
  std::string type = "stroke";
  if (IsObject(env, maybeOptions)) {
    if (Has(env, maybeOptions, "type"))
      type = LegacyString(env, Get(env, maybeOptions, "type"));
    if (Has(env, maybeOptions, "close"))
      closePath = ToBoolean(env, Get(env, maybeOptions, "close"));
  }
  if (type == "stroke") {
    if (closePath)
      GetContext()->s();
    else
      GetContext()->S();
  } else if (type == "fill") {
    GetContext()->f();
  } else if (type.compare("clip")) {
    if (closePath)
      GetContext()->h();
    GetContext()->W();
  }
}

napi_value AbstractContentContextDriver::DrawPath(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");
  if ((args.Length() == 1 && !IsArray(args.Env(), args[0])) ||
      args.Length() < 2)
    return WrongArguments(
        args.Env(),
        "Wrong Arguments, please provide path coordinates as numbers (x1, y1, "
        "x2, y2 etc) or as list of coordinates and an optional options object");

  PathOptions options;
  if (!driver->ReadPathOptions(args.Env(), args[args.Length() - 1], options))
    return nullptr;

  if (!IsArray(args.Env(), args[0])) {
    std::vector<double> coordinates;
    double coordinate = 0;
    if (!CoerceToDouble(args.Env(), args[0], &coordinate))
      return nullptr;
    coordinates.push_back(coordinate);
    if (!CoerceToDouble(args.Env(), args[1], &coordinate))
      return nullptr;
    coordinates.push_back(coordinate);
    for (size_t i = 2; i < args.Length() - 1; i += 2) {
      if (!IsNumber(args, i))
        break;
      if (!CoerceToDouble(args.Env(), args[i], &coordinate))
        return nullptr;
      coordinates.push_back(coordinate);
      if (!CoerceToDouble(args.Env(), args[i + 1], &coordinate))
        return nullptr;
      coordinates.push_back(coordinate);
    }
    driver->ApplyPathOptions(options);
    driver->GetContext()->m(coordinates[0], coordinates[1]);
    for (size_t i = 2; i < coordinates.size(); i += 2)
      driver->GetContext()->l(coordinates[i], coordinates[i + 1]);
    driver->CompletePath(options);
  } else {
    uint32_t length = 0;
    if (!Length(args.Env(), args[0], &length))
      return nullptr;
    if (length <= 1)
      return WrongArguments(
          args.Env(),
          "Wrong arguments. Coordinate list must have at least one point");
    std::vector<double> coordinates;
    coordinates.reserve(length * 2);
    for (uint32_t i = 0; i < length; ++i) {
      napi_value point = nullptr;
      uint32_t pointLength = 0;
      if (!Get(args.Env(), args[0], i, &point) || !IsArray(args.Env(), point) ||
          !Length(args.Env(), point, &pointLength))
        return HasPendingException(args.Env())
                   ? nullptr
                   : WrongArguments(args.Env(),
                                    "Wrong arguments. Coordinate list must "
                                    "have exactly one x and one y value");
      if (pointLength != 2)
        return WrongArguments(args.Env(),
                              "Wrong arguments. Coordinate list must have "
                              "exactly one x and one y value");
      for (uint32_t j = 0; j < pointLength; ++j) {
        napi_value value = nullptr;
        double coordinate = 0;
        if (!Get(args.Env(), point, j, &value) ||
            !CoerceToDouble(args.Env(), value, &coordinate))
          return nullptr;
        coordinates.push_back(coordinate);
      }
    }
    driver->ApplyPathOptions(options);
    driver->GetContext()->m(coordinates[0], coordinates[1]);
    for (size_t i = 2; i < coordinates.size(); i += 2)
      driver->GetContext()->l(coordinates[i], coordinates[i + 1]);
    driver->CompletePath(options);
  }
  return args.This();
}

napi_value AbstractContentContextDriver::DrawCircle(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");
  if (args.Length() < 3)
    return WrongArguments(args.Env(),
                          "Wrong Arguments, please provide x and y coordinates "
                          "for center, radius and an optional options object");
  driver->SetupColorAndLineWidth(args.Env(), args[args.Length() - 1]);
  const double magic = 0.551784;
  double x = CoerceToDouble(args.Env(), args[0]);
  double y = CoerceToDouble(args.Env(), args[1]);
  double radius = CoerceToDouble(args.Env(), args[2]);
  double radiusMagic = radius * magic;
  driver->GetContext()->m(x - radius, y);
  driver->GetContext()->c(x - radius, y + radiusMagic, x - radiusMagic,
                          y + radius, x, y + radius);
  driver->GetContext()->c(x + radiusMagic, y + radius, x + radius,
                          y + radiusMagic, x + radius, y);
  driver->GetContext()->c(x + radius, y - radiusMagic, x + radiusMagic,
                          y - radius, x, y - radius);
  driver->GetContext()->c(x - radiusMagic, y - radius, x - radius,
                          y - radiusMagic, x - radius, y);
  driver->FinishPath(args.Env(), args[args.Length() - 1]);
  return args.This();
}

napi_value AbstractContentContextDriver::DrawSquare(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");
  if (args.Length() < 3)
    return WrongArguments(
        args.Env(), "Wrong Arguments, please provide bottom left coordinates, "
                    "an edge size and optional options object");
  driver->SetupColorAndLineWidth(args.Env(), args[args.Length() - 1]);
  double size = CoerceToDouble(args.Env(), args[2]);
  driver->GetContext()->re(CoerceToDouble(args.Env(), args[0]),
                           CoerceToDouble(args.Env(), args[1]), size, size);
  driver->FinishPath(args.Env(), args[args.Length() - 1]);
  return args.This();
}

napi_value
AbstractContentContextDriver::DrawRectangle(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");
  if (args.Length() < 4)
    return WrongArguments(
        args.Env(), "Wrong Arguments, please provide bottom left coordinates, "
                    "width and height and optional options object");
  driver->SetupColorAndLineWidth(args.Env(), args[args.Length() - 1]);
  driver->GetContext()->re(
      CoerceToDouble(args.Env(), args[0]), CoerceToDouble(args.Env(), args[1]),
      CoerceToDouble(args.Env(), args[2]), CoerceToDouble(args.Env(), args[3]));
  driver->FinishPath(args.Env(), args[args.Length() - 1]);
  return args.This();
}

void AbstractContentContextDriver::SetFont(napi_env env,
                                           napi_value maybeOptions) {
  if (!IsObject(env, maybeOptions) || !Has(env, maybeOptions, "font"))
    return;
  napi_value fontValue = Get(env, maybeOptions, "font");
  if (holder->IsUsedFontInstance(fontValue)) {
    double size = Has(env, maybeOptions, "size")
                      ? CoerceToDouble(env, Get(env, maybeOptions, "size"))
                      : 1;
    GetContext()->Tf(
        ObjectWrap::Unwrap<UsedFontDriver>(env, fontValue)->UsedFont, size);
  }
}

napi_value AbstractContentContextDriver::WriteText(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");
  if (args.Length() < 3)
    return WrongArguments(
        args.Env(),
        "Wrong Arguments, please provide the text and x,y coordinate for text "
        "position. optionally also add an options object");

  driver->GetContext()->BT();
  if (args.Length() >= 4) {
    driver->SetColor(args.Env(), args[3], false);
    driver->SetFont(args.Env(), args[3]);
  }
  std::string text = LegacyString(args.Env(), args[0]);
  double x = CoerceToDouble(args.Env(), args[1]);
  double y = CoerceToDouble(args.Env(), args[2]);
  driver->GetContext()->Tm(1, 0, 0, 1, x, y);
  driver->GetContext()->Tj(text);
  driver->GetContext()->ET();

  if (args.Length() >= 4 && IsObject(args.Env(), args[3]) &&
      Has(args.Env(), args[3], "underline") &&
      ToBoolean(args.Env(), Get(args.Env(), args[3], "underline"))) {
    napi_value fontValue = Get(args.Env(), args[3], "font");
    if (driver->holder->IsUsedFontInstance(fontValue)) {
      double fontSize =
          Has(args.Env(), args[3], "size")
              ? CoerceToDouble(args.Env(), Get(args.Env(), args[3], "size"))
              : 1;
      PDFUsedFont *font =
          ObjectWrap::Unwrap<UsedFontDriver>(args.Env(), fontValue)->UsedFont;
      FreeTypeFaceWrapper *wrapper = font->GetFreeTypeFont();
      driver->SetColor(args.Env(), args[3], true);
      driver->GetContext()->w(GetUnderlineThicknessFactor(wrapper) * fontSize);
      double startLine = y + GetUnderlinePositionFactor(wrapper) * fontSize;
      driver->GetContext()->m(x, startLine);
      driver->GetContext()->l(x + font->CalculateTextAdvance(text, fontSize),
                              startLine);
      driver->GetContext()->S();
    }
  }
  return args.This();
}

napi_value AbstractContentContextDriver::DrawImage(const CallbackArgs &args) {
  AbstractContentContextDriver *driver = Driver(args);
  if (!driver->GetContext())
    return ThrowError(args.Env(),
                      "Null content context. Please create a context");
  if (args.Length() < 3 || !IsNumber(args, 0) || !IsNumber(args, 1) ||
      !IsString(args, 2) ||
      (args.Length() >= 4 && !IsObject(args.Env(), args[3])))
    return WrongArguments(
        args.Env(), "Wrong Arguments, please provide bottom left coordinates, "
                    "an edge size and optional options object");

  AbstractContentContext::ImageOptions options;
  if (args.Length() >= 4) {
    napi_value optionsObject = args[3];
    if (Has(args.Env(), optionsObject, "index")) {
      napi_value index = nullptr;
      uint32_t imageIndex = 0;
      if (!Get(args.Env(), optionsObject, "index", &index) ||
          !CoerceToUint32(args.Env(), index, &imageIndex))
        return nullptr;
      options.imageIndex = imageIndex;
    }
    if (Has(args.Env(), optionsObject, "transformation")) {
      napi_value transformation =
          Get(args.Env(), optionsObject, "transformation");
      if (IsArray(args.Env(), transformation) ||
          IsObject(args.Env(), transformation)) {
        uint32_t transformationLength = 0;
        bool matrix = IsArray(args.Env(), transformation);
        if (matrix && !Length(args.Env(), transformation,
                              &transformationLength))
          return nullptr;
        if (matrix && transformationLength == 6) {
          if (HasPendingException(args.Env()))
            return nullptr;
          options.transformationMethod = AbstractContentContext::eMatrix;
          if (!ReadNumberArray(args.Env(), transformation, options.matrix))
            return nullptr;
        } else if (IsObject(args.Env(), transformation)) {
          options.transformationMethod = AbstractContentContext::eFit;
          options.boundingBoxWidth = CoerceToDouble(
              args.Env(), Get(args.Env(), transformation, "width"));
          options.boundingBoxHeight = CoerceToDouble(
              args.Env(), Get(args.Env(), transformation, "height"));
          options.fitProportional =
              Has(args.Env(), transformation, "proportional")
                  ? ToBoolean(args.Env(),
                              Get(args.Env(), transformation, "proportional"))
                  : false;
          options.fitPolicy =
              Has(args.Env(), transformation, "fit") &&
                      LegacyString(args.Env(), Get(args.Env(), transformation,
                                                   "fit")) == "always"
                  ? AbstractContentContext::eAlways
                  : AbstractContentContext::eOverflow;
        }
      }
    }
    if (Has(args.Env(), optionsObject, "password")) {
      napi_value password = Get(args.Env(), optionsObject, "password");
      if (IsType(args.Env(), password, napi_string))
        options.pdfParsingOptions.Password = LegacyString(args.Env(), password);
    }
  }
  if (HasPendingException(args.Env()))
    return nullptr;
  driver->GetContext()->DrawImage(ToDouble(args.Env(), args[0]),
                                  ToDouble(args.Env(), args[1]),
                                  LegacyString(args.Env(), args[2]), options);
  return args.This();
}
