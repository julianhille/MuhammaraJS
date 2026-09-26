#pragma once

#include <node_api.h>

#include <cstdint>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

class PDFObject;

namespace muhammara {
namespace napi {

class CallbackArgs;
class ModuleState;

using Callback = napi_value (*)(const CallbackArgs &args);
using ModuleInitializer = bool (*)(ModuleState &state, napi_value exports);

bool Check(napi_env env, napi_status status);
napi_value Undefined(napi_env env);
napi_value String(napi_env env, const char *value);
napi_value String(napi_env env, const std::string &value);
napi_value Number(napi_env env, double value);
napi_value Int32(napi_env env, int32_t value);
napi_value Uint32(napi_env env, uint32_t value);
napi_value Boolean(napi_env env, bool value);
napi_value Array(napi_env env, size_t length = 0);
napi_value Object(napi_env env);
bool IsArray(napi_env env, napi_value value);
bool IsDate(napi_env env, napi_value value);
bool IsObject(napi_env env, napi_value value);
bool IsType(napi_env env, napi_value value, napi_valuetype type);
bool HasPendingException(napi_env env);
bool Has(napi_env env, napi_value object, const char *name);
napi_value Get(napi_env env, napi_value object, const char *name);
napi_value Get(napi_env env, napi_value object, uint32_t index);
bool Get(napi_env env, napi_value object, const char *name, napi_value *result);
bool Get(napi_env env, napi_value object, uint32_t index, napi_value *result);
bool Set(napi_env env, napi_value object, const char *name, napi_value value);
bool Set(napi_env env, napi_value object, uint32_t index, napi_value value);
std::string ToString(napi_env env, napi_value value);
std::string LegacyString(napi_env env, napi_value value);
std::string CoerceToString(napi_env env, napi_value value);
double ToDouble(napi_env env, napi_value value);
double CoerceToDouble(napi_env env, napi_value value);
bool CoerceToDouble(napi_env env, napi_value value, double *result);
// Coerces with JavaScript ToNumber semantics, then rejects results a 64-bit
// file offset cannot represent; callers retain API-specific messages.
bool CoerceToFilePosition(napi_env env, napi_value value, const char *error,
                          double *result);
int32_t ToInt32(napi_env env, napi_value value);
int32_t CoerceToInt32(napi_env env, napi_value value);
bool CoerceToInt32(napi_env env, napi_value value, int32_t *result);
uint32_t ToUint32(napi_env env, napi_value value);
uint32_t CoerceToUint32(napi_env env, napi_value value);
bool CoerceToUint32(napi_env env, napi_value value, uint32_t *result);
bool ToBoolean(napi_env env, napi_value value);
uint32_t Length(napi_env env, napi_value value);
bool Length(napi_env env, napi_value value, uint32_t *result);
napi_value ThrowError(napi_env env, const char *message);
napi_value ThrowTypeError(napi_env env, const char *message);
napi_value ThrowRangeError(napi_env env, const char *message);
napi_value Call(napi_env env, napi_value receiver, napi_value function,
                const std::vector<napi_value> &arguments = {});
// Shared binding conversions; callers retain API-specific validation messages.
bool StringOrBytes(napi_env env, napi_value value, std::string &out);
napi_value BytesToArray(napi_env env, const unsigned char *bytes, size_t length);
// Copies the bytes, so JavaScript may keep the Buffer after the call returns.
napi_value BytesToBuffer(napi_env env, const unsigned char *bytes,
                         size_t length);
// Length of a Uint8Array (Buffer included) or array of numbers used as bytes.
// False for any other value.
bool ByteSourceLength(napi_env env, napi_value value, size_t *length);
// Copies at most capacity bytes from a Uint8Array (Buffer included) or an array
// of numbers returned by a JavaScript read stream. False for any other value.
bool ReadStreamChunk(napi_env env, napi_value value, unsigned char *out,
                     size_t capacity, size_t *written);
napi_value CallMethod(napi_env env, napi_value receiver, const char *name,
                      const std::vector<napi_value> &arguments = {});
// A null error means the caller already validated the array length.
// Leave out unchanged if any element lookup or coercion fails.
template <size_t N>
bool ReadNumberArray(napi_env env, napi_value value, double (&out)[N],
                     const char *error = nullptr) {
  if (error) {
    uint32_t length = 0;
    if (!Length(env, value, &length))
      return false;
    if (length != N) {
      ThrowTypeError(env, error);
      return false;
    }
  }
  double values[N];
  for (uint32_t i = 0; i < N; ++i) {
    napi_value element = nullptr;
    if (!Get(env, value, i, &element) ||
        !CoerceToDouble(env, element, &values[i]))
      return false;
  }
  for (size_t i = 0; i < N; ++i)
    out[i] = values[i];
  return true;
}

class CallbackArgs {
public:
  CallbackArgs(napi_env env, napi_callback_info info, size_t argumentCount,
               napi_value thisValue, void *callbackData = nullptr);

  napi_env Env() const;
  bool IsValid() const;
  size_t Length() const;
  napi_value operator[](size_t index) const;
  napi_value This() const;
  void *Data() const;

private:
  napi_env env_;
  std::vector<napi_value> arguments_;
  napi_value thisValue_;
  void *data_;
  bool valid_;
};

// Releases the handles created while it is alive. Native code that calls into
// JavaScript repeatedly within one outer call (stream bridges) would otherwise
// keep every intermediate value reachable until that outer call returns.
class HandleScope {
public:
  explicit HandleScope(napi_env env) : env_(env), scope_(nullptr) {
    napi_open_handle_scope(env_, &scope_);
  }
  HandleScope(const HandleScope &) = delete;
  HandleScope &operator=(const HandleScope &) = delete;
  ~HandleScope() {
    if (scope_)
      napi_close_handle_scope(env_, scope_);
  }

private:
  napi_env env_;
  napi_handle_scope scope_;
};

class Reference {
public:
  Reference();
  Reference(napi_env env, napi_value value, uint32_t initialRefCount = 1);
  Reference(const Reference &) = delete;
  Reference &operator=(const Reference &) = delete;
  Reference(Reference &&other) noexcept;
  Reference &operator=(Reference &&other) noexcept;
  ~Reference();

  bool Reset(napi_env env, napi_value value, uint32_t initialRefCount = 1);
  void Reset();
  bool IsEmpty() const;
  napi_value Get() const;
  napi_env Env() const;

private:
  napi_env env_;
  napi_ref reference_;
};

class ObjectWrap {
public:
  virtual ~ObjectWrap() = default;

  bool Wrap(napi_env env, napi_value object);

  template <typename T> static T *Unwrap(napi_env env, napi_value object) {
    T *result = nullptr;
    if (!Check(env,
               napi_unwrap(env, object, reinterpret_cast<void **>(&result)))) {
      return nullptr;
    }
    return result;
  }

  template <typename T>
  static napi_value UnwrapNew(napi_env env, napi_value object, T **result) {
    *result = object ? Unwrap<T>(env, object) : nullptr;
    if (*result) {
      return object;
    }
    if (!HasPendingException(env)) {
      ThrowError(env, "Unable to construct native object wrapper");
    }
    return nullptr;
  }

private:
  static void Finalize(napi_env env, void *data, void *hint);
};

class ConstructorRegistry {
public:
  explicit ConstructorRegistry(napi_env env);

  bool Set(const std::string &name, napi_value constructor,
           const napi_type_tag &typeTag);
  napi_value Get(const std::string &name) const;
  napi_value New(const std::string &name,
                 const std::vector<napi_value> &arguments = {}) const;
  bool IsInstance(const std::string &name, napi_value value) const;
  napi_env Env() const;

private:
  napi_env env_;
  std::unordered_map<std::string, Reference> constructors_;
  std::unordered_map<std::string, napi_type_tag> typeTags_;
};

} // namespace napi
} // namespace muhammara

class ConstructorsHolder : public muhammara::napi::ConstructorRegistry {
public:
  using ConstructorRegistry::ConstructorRegistry;

  napi_value GetNewPDFNull() const;
  napi_value GetNewPDFBoolean() const;
  napi_value GetNewPDFInteger() const;
  napi_value GetNewPDFReal() const;
  napi_value GetNewPDFName() const;
  napi_value GetNewPDFSymbol() const;
  napi_value GetNewPDFLiteralString() const;
  napi_value GetNewPDFHexString() const;
  napi_value GetNewPDFIndirectObjectReference() const;
  napi_value GetNewPDFArray() const;
  napi_value GetNewPDFDictionary() const;
  napi_value GetNewPDFStreamInput() const;
  napi_value GetNewPDFObjectParser() const;
  napi_value GetNewPDFReader() const;
  napi_value GetNewPDFPageInput() const;
  napi_value GetNewDictionaryContext() const;
  napi_value GetNewObjectsContext() const;
  napi_value GetNewDocumentCopyingContext() const;
  napi_value GetNewDocumentContext() const;
  napi_value GetNewImageXObject() const;
  napi_value GetNewUsedFont() const;
  napi_value GetNewResourcesDictionary() const;
  napi_value GetNewFormXObject() const;
  napi_value GetNewXObjectContentContext() const;
  napi_value GetNewPageContentContext() const;
  napi_value GetNewPDFPage() const;
  napi_value
  GetNewPDFPageModifier(const std::vector<napi_value> &arguments = {}) const;
  napi_value GetNewByteReader() const;
  napi_value GetNewByteReaderWithPosition() const;
  napi_value GetNewByteWriter() const;
  napi_value GetNewByteWriterWithPosition() const;
  napi_value GetNewInputFile() const;
  napi_value GetNewOutputFile() const;
  napi_value GetNewInfoDictionary() const;
  napi_value GetNewPDFWriter() const;
  napi_value GetNewPDFStream() const;
  napi_value
  GetNewPDFTextString(const std::vector<napi_value> &arguments = {}) const;
  napi_value GetNewPDFDate(const std::vector<napi_value> &arguments = {},
                           bool allowNoArguments = false) const;
  napi_value GetInstanceFor(PDFObject *object) const;

  bool IsPDFNullInstance(napi_value value) const;
  bool IsPDFBooleanInstance(napi_value value) const;
  bool IsPDFIntegerInstance(napi_value value) const;
  bool IsPDFRealInstance(napi_value value) const;
  bool IsPDFNameInstance(napi_value value) const;
  bool IsPDFSymbolInstance(napi_value value) const;
  bool IsPDFLiteralStringInstance(napi_value value) const;
  bool IsPDFHexStringInstance(napi_value value) const;
  bool IsPDFIndirectObjectReferenceInstance(napi_value value) const;
  bool IsPDFArrayInstance(napi_value value) const;
  bool IsPDFDictionaryInstance(napi_value value) const;
  bool IsPDFStreamInputInstance(napi_value value) const;
  bool IsDictionaryContextInstance(napi_value value) const;
  bool IsPDFStreamInstance(napi_value value) const;
  bool IsPDFPageInstance(napi_value value) const;
  bool IsFormXObjectInstance(napi_value value) const;
  bool IsImageXObjectInstance(napi_value value) const;
  bool IsUsedFontInstance(napi_value value) const;
  bool IsPDFReaderInstance(napi_value value) const;
  bool IsPageContentContextInstance(napi_value value) const;
  bool IsPDFWriterInstance(napi_value value) const;
  bool IsPDFObjectInstance(napi_value value) const;
};

namespace muhammara {
namespace napi {

class ClassBuilder {
public:
  ClassBuilder(ModuleState &state, const char *name, Callback constructor,
               void *data = nullptr);

  ClassBuilder &Method(const char *name, Callback callback);
  ClassBuilder &Method(const char *name, Callback callback, void *data);
  ClassBuilder &Accessor(const char *name, Callback getter,
                         Callback setter = nullptr);
  ClassBuilder &Accessor(const char *name, Callback getter, Callback setter,
                         void *data);
  napi_value Define(napi_value exports, bool exportConstructor = true);

private:
  ModuleState &state_;
  std::string name_;
  Callback constructor_;
  void *data_;
  napi_type_tag typeTag_;
  std::vector<napi_property_descriptor> properties_;
  std::vector<napi_property_descriptor> instanceProperties_;
};

class ModuleState {
public:
  explicit ModuleState(napi_env env);
  ModuleState(const ModuleState &) = delete;
  ModuleState &operator=(const ModuleState &) = delete;

  napi_env Env() const;
  ::ConstructorsHolder &Constructors();
  void *AddCallback(Callback callback, void *data);
  void *AddConstructor(Callback callback, void *data,
                       const napi_type_tag &typeTag,
                       const std::vector<napi_property_descriptor>
                           &instanceProperties);
  void *AddMethod(Callback callback, void *data, const napi_type_tag &typeTag);
  void *AddAccessor(Callback getter, Callback setter, void *data);
  void *AddAccessor(Callback getter, Callback setter, void *data,
                    const napi_type_tag &typeTag);
  napi_type_tag NextTypeTag();

  static ModuleState *Create(napi_env env);
  static ModuleState *Get(napi_env env);

private:
  struct CallbackBinding;

  friend napi_value Dispatch(napi_env env, napi_callback_info info);
  friend napi_value DispatchGetter(napi_env env, napi_callback_info info);
  friend napi_value DispatchSetter(napi_env env, napi_callback_info info);

  static void Finalize(napi_env env, void *data, void *hint);

  napi_env env_;
  ::ConstructorsHolder constructors_;
  std::vector<std::unique_ptr<CallbackBinding>> callbacks_;
  uint64_t nextTypeTag_;
};

napi_value Dispatch(napi_env env, napi_callback_info info);
napi_value DispatchGetter(napi_env env, napi_callback_info info);
napi_value DispatchSetter(napi_env env, napi_callback_info info);
napi_value InitializeModule(napi_env env, napi_value exports,
                            ModuleInitializer initializer);

} // namespace napi
} // namespace muhammara
