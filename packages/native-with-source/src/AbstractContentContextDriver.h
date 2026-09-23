#pragma once

#include "napi/NapiSupport.h"

#include "GlyphUnicodeMapping.h"
#include "ObjectsBasicTypes.h"

class AbstractContentContext;
class ResourcesDictionary;
class ConstructorsHolder;

struct TextPlacingOptions {
  enum EEncoding { EEncodingText, EEncodingCode, EEncodingHex };

  TextPlacingOptions() : encoding(EEncodingText) {}

  EEncoding encoding;
};

class AbstractContentContextDriver : public muhammara::napi::ObjectWrap {
public:
  static void Init(muhammara::napi::ClassBuilder &builder);
  void SetResourcesDictionary(ResourcesDictionary *dictionary);
  ConstructorsHolder *holder;

protected:
  AbstractContentContextDriver();
  virtual AbstractContentContext *GetContext() = 0;
  ResourcesDictionary *GetResourcesDictionary();

private:
  struct PathOptions {
    bool setupIsStroke = true;
    bool hasWidth = false;
    double width = 0;
    bool hasColor = false;
    bool hasNamedColor = false;
    std::string colorName;
    unsigned long colorValue = 0;
    std::string colorSpace = "rgb";
    std::string finishType = "stroke";
    bool closePath = false;
  };

  ResourcesDictionary *mResourcesDictionary;
  static napi_value Operator(const muhammara::napi::CallbackArgs &args);
  static napi_value Dash(const muhammara::napi::CallbackArgs &args);
  static napi_value SetOpacity(const muhammara::napi::CallbackArgs &args);
  static napi_value Color(const muhammara::napi::CallbackArgs &args);
  static napi_value DoXObject(const muhammara::napi::CallbackArgs &args);
  static napi_value Tf(const muhammara::napi::CallbackArgs &args);
  static napi_value Tj(const muhammara::napi::CallbackArgs &args);
  static napi_value Quote(const muhammara::napi::CallbackArgs &args);
  static napi_value DoubleQuote(const muhammara::napi::CallbackArgs &args);
  static napi_value TJ(const muhammara::napi::CallbackArgs &args);
  static napi_value DrawPath(const muhammara::napi::CallbackArgs &args);
  static napi_value DrawCircle(const muhammara::napi::CallbackArgs &args);
  static napi_value DrawSquare(const muhammara::napi::CallbackArgs &args);
  static napi_value DrawRectangle(const muhammara::napi::CallbackArgs &args);
  static napi_value WriteText(const muhammara::napi::CallbackArgs &args);
  static napi_value DrawImage(const muhammara::napi::CallbackArgs &args);

  static TextPlacingOptions ObjectToOptions(napi_env env, napi_value object);
  static bool ArrayToGlyphsList(napi_env env, napi_value array,
                                GlyphUnicodeMappingList &glyphs);
  bool ReadPathOptions(napi_env env, napi_value maybeOptions,
                       PathOptions &options);
  void ApplyPathOptions(const PathOptions &options);
  void CompletePath(const PathOptions &options);
  void SetupColorAndLineWidth(napi_env env, napi_value maybeOptions);
  void SetColor(napi_env env, napi_value maybeOptions, bool isStroke);
  void FinishPath(napi_env env, napi_value maybeOptions);
  void SetFont(napi_env env, napi_value maybeOptions);
  void SetRGBColor(unsigned long colorValue, bool isStroke);
};
