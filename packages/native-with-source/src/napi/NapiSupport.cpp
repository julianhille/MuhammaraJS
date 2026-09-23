#include "napi/NapiSupport.h"

#include <utility>

namespace muhammara {
namespace napi {

struct ModuleState::CallbackBinding {
  Callback callback;
  Callback setter;
  void* data;
  napi_type_tag typeTag;
  std::vector<napi_property_descriptor> instanceProperties;
  bool tagsThis;
  bool checksThis;
};

bool Check(napi_env env, napi_status status) {
  if (status == napi_ok) {
    return true;
  }

  bool pending = false;
  napi_is_exception_pending(env, &pending);
  if (!pending) {
    const napi_extended_error_info* info = nullptr;
    napi_get_last_error_info(env, &info);
    napi_throw_error(env, nullptr,
                     info && info->error_message ? info->error_message
                                                : "Node-API call failed");
  }
  return false;
}

napi_value Undefined(napi_env env) {
  napi_value result = nullptr;
  Check(env, napi_get_undefined(env, &result));
  return result;
}

napi_value String(napi_env env, const char* value) {
  napi_value result = nullptr;
  Check(env, napi_create_string_utf8(env, value, NAPI_AUTO_LENGTH, &result));
  return result;
}

napi_value String(napi_env env, const std::string& value) {
  napi_value result = nullptr;
  Check(env,
        napi_create_string_utf8(env, value.data(), value.size(), &result));
  return result;
}

napi_value Number(napi_env env, double value) {
  napi_value result = nullptr;
  Check(env, napi_create_double(env, value, &result));
  return result;
}

napi_value Int32(napi_env env, int32_t value) {
  napi_value result = nullptr;
  Check(env, napi_create_int32(env, value, &result));
  return result;
}

napi_value Uint32(napi_env env, uint32_t value) {
  napi_value result = nullptr;
  Check(env, napi_create_uint32(env, value, &result));
  return result;
}

napi_value Boolean(napi_env env, bool value) {
  napi_value result = nullptr;
  Check(env, napi_get_boolean(env, value, &result));
  return result;
}

napi_value Array(napi_env env, size_t length) {
  napi_value result = nullptr;
  Check(env, napi_create_array_with_length(env, length, &result));
  return result;
}

napi_value Object(napi_env env) {
  napi_value result = nullptr;
  Check(env, napi_create_object(env, &result));
  return result;
}

bool IsArray(napi_env env, napi_value value) {
  bool result = false;
  return Check(env, napi_is_array(env, value, &result)) && result;
}

bool IsDate(napi_env env, napi_value value) {
  bool result = false;
  return Check(env, napi_is_date(env, value, &result)) && result;
}

bool IsObject(napi_env env, napi_value value) {
  napi_valuetype type = napi_undefined;
  return Check(env, napi_typeof(env, value, &type)) && type == napi_object;
}

bool IsType(napi_env env, napi_value value, napi_valuetype type) {
  napi_valuetype actual = napi_undefined;
  return Check(env, napi_typeof(env, value, &actual)) && actual == type;
}

bool HasPendingException(napi_env env) {
  bool pending = false;
  return !Check(env, napi_is_exception_pending(env, &pending)) || pending;
}

bool Has(napi_env env, napi_value object, const char* name) {
  bool result = false;
  return Check(env, napi_has_named_property(env, object, name, &result)) &&
         result;
}

napi_value Get(napi_env env, napi_value object, const char* name) {
  napi_value result = nullptr;
  Check(env, napi_get_named_property(env, object, name, &result));
  return result;
}

napi_value Get(napi_env env, napi_value object, uint32_t index) {
  napi_value result = nullptr;
  Check(env, napi_get_element(env, object, index, &result));
  return result;
}

bool Get(napi_env env, napi_value object, const char* name,
         napi_value* result) {
  *result = nullptr;
  return Check(env, napi_get_named_property(env, object, name, result));
}

bool Get(napi_env env, napi_value object, uint32_t index, napi_value* result) {
  *result = nullptr;
  return Check(env, napi_get_element(env, object, index, result));
}

bool Set(napi_env env, napi_value object, const char* name, napi_value value) {
  return Check(env, napi_set_named_property(env, object, name, value));
}

bool Set(napi_env env, napi_value object, uint32_t index, napi_value value) {
  return Check(env, napi_set_element(env, object, index, value));
}

std::string ToString(napi_env env, napi_value value) {
  size_t length = 0;
  if (!Check(env,
             napi_get_value_string_utf8(env, value, nullptr, 0, &length))) {
    return {};
  }
  std::string result(length + 1, '\0');
  size_t copied = 0;
  if (!Check(env, napi_get_value_string_utf8(env, value, result.data(),
                                              result.size(), &copied))) {
    return {};
  }
  result.resize(copied);
  return result;
}

std::string LegacyString(napi_env env, napi_value value) {
  std::string result = CoerceToString(env, value);
  size_t nullPosition = result.find('\0');
  if (nullPosition != std::string::npos)
    result.resize(nullPosition);
  return result;
}

std::string CoerceToString(napi_env env, napi_value value) {
  napi_value coerced = nullptr;
  if (!Check(env, napi_coerce_to_string(env, value, &coerced))) {
    return {};
  }
  return ToString(env, coerced);
}

double ToDouble(napi_env env, napi_value value) {
  double result = 0;
  Check(env, napi_get_value_double(env, value, &result));
  return result;
}

double CoerceToDouble(napi_env env, napi_value value) {
  napi_value coerced = nullptr;
  if (!Check(env, napi_coerce_to_number(env, value, &coerced))) {
    return 0;
  }
  return ToDouble(env, coerced);
}

bool CoerceToDouble(napi_env env, napi_value value, double* result) {
  napi_value coerced = nullptr;
  *result = 0;
  return Check(env, napi_coerce_to_number(env, value, &coerced)) &&
         Check(env, napi_get_value_double(env, coerced, result));
}

int32_t ToInt32(napi_env env, napi_value value) {
  int32_t result = 0;
  Check(env, napi_get_value_int32(env, value, &result));
  return result;
}

int32_t CoerceToInt32(napi_env env, napi_value value) {
  napi_value coerced = nullptr;
  if (!Check(env, napi_coerce_to_number(env, value, &coerced))) {
    return 0;
  }
  return ToInt32(env, coerced);
}

bool CoerceToInt32(napi_env env, napi_value value, int32_t* result) {
  napi_value coerced = nullptr;
  *result = 0;
  return Check(env, napi_coerce_to_number(env, value, &coerced)) &&
         Check(env, napi_get_value_int32(env, coerced, result));
}

uint32_t ToUint32(napi_env env, napi_value value) {
  uint32_t result = 0;
  Check(env, napi_get_value_uint32(env, value, &result));
  return result;
}

uint32_t CoerceToUint32(napi_env env, napi_value value) {
  napi_value coerced = nullptr;
  if (!Check(env, napi_coerce_to_number(env, value, &coerced))) {
    return 0;
  }
  return ToUint32(env, coerced);
}

bool CoerceToUint32(napi_env env, napi_value value, uint32_t* result) {
  napi_value coerced = nullptr;
  *result = 0;
  return Check(env, napi_coerce_to_number(env, value, &coerced)) &&
         Check(env, napi_get_value_uint32(env, coerced, result));
}

bool ToBoolean(napi_env env, napi_value value) {
  napi_value coerced = nullptr;
  bool result = false;
  return Check(env, napi_coerce_to_bool(env, value, &coerced)) &&
         Check(env, napi_get_value_bool(env, coerced, &result)) && result;
}

uint32_t Length(napi_env env, napi_value value) {
  uint32_t result = 0;
  Check(env, napi_get_array_length(env, value, &result));
  return result;
}

bool StringOrBytes(napi_env env, napi_value value, std::string &out) {
  if (!IsArray(env, value)) {
    out = LegacyString(env, value);
    return !HasPendingException(env);
  }
  uint32_t length = 0;
  if (!Length(env, value, &length))
    return false;
  std::string bytes;
  bytes.reserve(length);
  for (uint32_t i = 0; i < length; ++i) {
    napi_value element = nullptr;
    double byte = 0;
    if (!Get(env, value, i, &element) || !CoerceToDouble(env, element, &byte))
      return false;
    bytes.push_back(static_cast<unsigned char>(byte));
  }
  out = std::move(bytes);
  return true;
}

napi_value BytesToArray(napi_env env, const unsigned char *bytes, size_t length) {
  napi_value array = Array(env, length);
  if (!array)
    return nullptr;
  for (size_t i = 0; i < length; ++i) {
    napi_value byte = Uint32(env, bytes[i]);
    if (!byte || !Set(env, array, static_cast<uint32_t>(i), byte))
      return nullptr;
  }
  return array;
}

napi_value CallMethod(napi_env env, napi_value receiver, const char *name,
                      const std::vector<napi_value> &arguments) {
  napi_value function = Get(env, receiver, name);
  if (!function || IsType(env, function, napi_undefined))
    return nullptr;
  return Call(env, receiver, function, arguments);
}

bool Length(napi_env env, napi_value value, uint32_t* result) {
  *result = 0;
  return Check(env, napi_get_array_length(env, value, result));
}

napi_value ThrowError(napi_env env, const char* message) {
  napi_throw_error(env, nullptr, message);
  return nullptr;
}

napi_value ThrowTypeError(napi_env env, const char* message) {
  napi_throw_type_error(env, nullptr, message);
  return nullptr;
}

napi_value ThrowRangeError(napi_env env, const char* message) {
  napi_throw_range_error(env, nullptr, message);
  return nullptr;
}

napi_value Call(napi_env env, napi_value receiver, napi_value function,
                const std::vector<napi_value>& arguments) {
  napi_value result = nullptr;
  Check(env, napi_call_function(env, receiver, function, arguments.size(),
                                arguments.data(), &result));
  return result;
}

CallbackArgs::CallbackArgs(napi_env env, napi_callback_info info,
                           size_t argumentCount, napi_value thisValue,
                           void* callbackData)
    : env_(env), thisValue_(thisValue), data_(callbackData), valid_(true) {
  arguments_.resize(argumentCount);
  if (argumentCount != 0) {
    valid_ = Check(env_, napi_get_cb_info(env_, info, &argumentCount,
                                          arguments_.data(), nullptr, nullptr));
    arguments_.resize(argumentCount);
  }
}

napi_env CallbackArgs::Env() const { return env_; }

bool CallbackArgs::IsValid() const { return valid_; }

size_t CallbackArgs::Length() const { return arguments_.size(); }

napi_value CallbackArgs::operator[](size_t index) const {
  return index < arguments_.size() ? arguments_[index] : Undefined(env_);
}

napi_value CallbackArgs::This() const { return thisValue_; }

void* CallbackArgs::Data() const { return data_; }

Reference::Reference() : env_(nullptr), reference_(nullptr) {}

Reference::Reference(napi_env env, napi_value value, uint32_t initialRefCount)
    : Reference() {
  Reset(env, value, initialRefCount);
}

Reference::Reference(Reference&& other) noexcept
    : env_(other.env_), reference_(other.reference_) {
  other.env_ = nullptr;
  other.reference_ = nullptr;
}

Reference& Reference::operator=(Reference&& other) noexcept {
  if (this != &other) {
    Reset();
    env_ = other.env_;
    reference_ = other.reference_;
    other.env_ = nullptr;
    other.reference_ = nullptr;
  }
  return *this;
}

Reference::~Reference() { Reset(); }

bool Reference::Reset(napi_env env, napi_value value,
                      uint32_t initialRefCount) {
  Reset();
  env_ = env;
  if (!Check(env_,
             napi_create_reference(env_, value, initialRefCount, &reference_))) {
    env_ = nullptr;
    reference_ = nullptr;
    return false;
  }
  return true;
}

void Reference::Reset() {
  if (env_ && reference_) {
    napi_delete_reference(env_, reference_);
  }
  env_ = nullptr;
  reference_ = nullptr;
}

bool Reference::IsEmpty() const { return reference_ == nullptr; }

napi_value Reference::Get() const {
  napi_value result = nullptr;
  if (env_ && reference_) {
    Check(env_, napi_get_reference_value(env_, reference_, &result));
  }
  return result;
}

napi_env Reference::Env() const { return env_; }

bool ObjectWrap::Wrap(napi_env env, napi_value object) {
  return Check(env, napi_wrap(env, object, this, Finalize, nullptr, nullptr));
}

void ObjectWrap::Finalize(napi_env, void* data, void*) {
  delete static_cast<ObjectWrap*>(data);
}

ConstructorRegistry::ConstructorRegistry(napi_env env) : env_(env) {}

bool ConstructorRegistry::Set(const std::string& name, napi_value constructor,
                              const napi_type_tag& typeTag) {
  typeTags_.insert_or_assign(name, typeTag);
  return !constructors_.insert_or_assign(name, Reference(env_, constructor))
              .first->second.IsEmpty();
}

napi_value ConstructorRegistry::Get(const std::string& name) const {
  auto found = constructors_.find(name);
  return found == constructors_.end() ? nullptr : found->second.Get();
}

napi_value ConstructorRegistry::New(
    const std::string& name,
    const std::vector<napi_value>& arguments) const {
  napi_value result = nullptr;
  napi_value constructor = Get(name);
  if (!constructor ||
      !Check(env_, napi_new_instance(env_, constructor, arguments.size(),
                                     arguments.data(), &result))) {
    return nullptr;
  }
  return result;
}

bool ConstructorRegistry::IsInstance(const std::string& name,
                                     napi_value value) const {
  auto found = typeTags_.find(name);
  if (found == typeTags_.end() || !IsObject(env_, value)) {
    return false;
  }
  bool result = false;
  return Check(env_, napi_check_object_type_tag(env_, value, &found->second,
                                                &result)) &&
         result;
}

napi_env ConstructorRegistry::Env() const { return env_; }

ClassBuilder::ClassBuilder(ModuleState& state, const char* name,
                           Callback constructor, void* data)
    : state_(state),
      name_(name),
      constructor_(constructor),
      data_(data),
      typeTag_(state.NextTypeTag()) {}

ClassBuilder& ClassBuilder::Method(const char* name, Callback callback) {
  return Method(name, callback, data_);
}

ClassBuilder& ClassBuilder::Method(const char* name, Callback callback,
                                   void* data) {
  properties_.push_back({name, nullptr, Dispatch, nullptr, nullptr, nullptr,
                         static_cast<napi_property_attributes>(
                             napi_writable | napi_enumerable |
                             napi_configurable),
                         state_.AddMethod(callback, data, typeTag_)});
  return *this;
}

ClassBuilder& ClassBuilder::Accessor(const char* name, Callback getter,
                                     Callback setter) {
  return Accessor(name, getter, setter, data_);
}

ClassBuilder& ClassBuilder::Accessor(const char* name, Callback getter,
                                     Callback setter, void* data) {
  instanceProperties_.insert(
      instanceProperties_.begin(),
       {name, nullptr, nullptr, getter ? DispatchGetter : nullptr,
         setter ? DispatchSetter : nullptr, nullptr,
         static_cast<napi_property_attributes>(napi_enumerable |
                                               napi_configurable),
          state_.AddAccessor(getter, setter, data, typeTag_)});
  return *this;
}

napi_value ClassBuilder::Define(napi_value exports, bool exportConstructor) {
  napi_value constructor = nullptr;
  void* binding = state_.AddConstructor(constructor_, data_, typeTag_,
                                        instanceProperties_);
  if (!Check(state_.Env(),
             napi_define_class(state_.Env(), name_.c_str(), name_.size(),
                               Dispatch, binding, properties_.size(),
                               properties_.data(), &constructor))) {
    return nullptr;
  }
  if (!state_.Constructors().Set(name_, constructor, typeTag_)) {
    return nullptr;
  }
  if (exportConstructor &&
      !Set(state_.Env(), exports, name_.c_str(), constructor)) {
    return nullptr;
  }
  return constructor;
}

ModuleState::ModuleState(napi_env env)
    : env_(env), constructors_(env), nextTypeTag_(1) {}

napi_env ModuleState::Env() const { return env_; }

::ConstructorsHolder& ModuleState::Constructors() { return constructors_; }

void* ModuleState::AddCallback(Callback callback, void* data) {
  callbacks_.push_back(std::make_unique<CallbackBinding>(
      CallbackBinding{callback, nullptr, data, {}, {}, false, false}));
  return callbacks_.back().get();
}

void* ModuleState::AddConstructor(Callback callback, void* data,
                                  const napi_type_tag& typeTag,
                                  const std::vector<napi_property_descriptor>&
                                      instanceProperties) {
  callbacks_.push_back(std::make_unique<CallbackBinding>(
      CallbackBinding{callback, nullptr, data, typeTag, instanceProperties,
                      true, false}));
  return callbacks_.back().get();
}

void* ModuleState::AddMethod(Callback callback, void* data,
                             const napi_type_tag& typeTag) {
  callbacks_.push_back(std::make_unique<CallbackBinding>(
      CallbackBinding{callback, nullptr, data, typeTag, {}, false, true}));
  return callbacks_.back().get();
}

void* ModuleState::AddAccessor(Callback getter, Callback setter, void* data) {
  callbacks_.push_back(std::make_unique<CallbackBinding>(
      CallbackBinding{getter, setter, data, {}, {}, false, false}));
  return callbacks_.back().get();
}

void* ModuleState::AddAccessor(Callback getter, Callback setter, void* data,
                               const napi_type_tag& typeTag) {
  callbacks_.push_back(std::make_unique<CallbackBinding>(
      CallbackBinding{getter, setter, data, typeTag, {}, false, true}));
  return callbacks_.back().get();
}

napi_type_tag ModuleState::NextTypeTag() {
  return {0x4d7568616d6d6172ULL, nextTypeTag_++};
}

ModuleState* ModuleState::Create(napi_env env) {
  auto* state = new ModuleState(env);
  if (!Check(env, napi_set_instance_data(env, state, Finalize, nullptr))) {
    delete state;
    return nullptr;
  }
  return state;
}

ModuleState* ModuleState::Get(napi_env env) {
  ModuleState* state = nullptr;
  Check(env, napi_get_instance_data(env, reinterpret_cast<void**>(&state)));
  return state;
}

void ModuleState::Finalize(napi_env, void* data, void*) {
  delete static_cast<ModuleState*>(data);
}

napi_value Dispatch(napi_env env, napi_callback_info info) {
  size_t count = 0;
  napi_value thisValue = nullptr;
  void* data = nullptr;
  if (!Check(env,
             napi_get_cb_info(env, info, &count, nullptr, &thisValue, &data))) {
    return nullptr;
  }
  auto* binding = static_cast<ModuleState::CallbackBinding*>(data);
  if (!binding || !binding->callback) {
    napi_throw_error(env, nullptr, "Invalid native callback binding");
    return nullptr;
  }

  if (binding->tagsThis) {
    napi_value newTarget = nullptr;
    if (!Check(env, napi_get_new_target(env, info, &newTarget))) {
      return nullptr;
    }
    if (!newTarget) {
      return ThrowTypeError(env, "Native constructors must be called with new");
    }
  }

  CallbackArgs args(env, info, count, thisValue, binding->data);
  if (!args.IsValid()) {
    return nullptr;
  }
  if (binding->checksThis) {
    bool matches = false;
    if (!Check(env, napi_check_object_type_tag(env, args.This(),
                                               &binding->typeTag, &matches))) {
      return nullptr;
    }
    if (!matches) {
      return ThrowTypeError(env, "Invalid native method receiver");
    }
  }
  napi_value result = binding->callback(args);
  if (result && binding->tagsThis) {
    if (!binding->instanceProperties.empty() &&
        !Check(env, napi_define_properties(
                        env, args.This(), binding->instanceProperties.size(),
                        binding->instanceProperties.data()))) {
      return nullptr;
    }
    if (!Check(env,
               napi_type_tag_object(env, args.This(), &binding->typeTag))) {
      return nullptr;
    }
  }
  return result;
}

napi_value DispatchGetter(napi_env env, napi_callback_info info) {
  return Dispatch(env, info);
}

napi_value DispatchSetter(napi_env env, napi_callback_info info) {
  size_t count = 0;
  napi_value thisValue = nullptr;
  void* data = nullptr;
  if (!Check(env,
             napi_get_cb_info(env, info, &count, nullptr, &thisValue, &data))) {
    return nullptr;
  }
  auto* binding = static_cast<ModuleState::CallbackBinding*>(data);
  if (!binding || !binding->setter) {
    napi_throw_error(env, nullptr, "Invalid native setter binding");
    return nullptr;
  }
  CallbackArgs args(env, info, count, thisValue, binding->data);
  if (!args.IsValid()) {
    return nullptr;
  }
  if (binding->checksThis) {
    bool matches = false;
    if (!Check(env, napi_check_object_type_tag(env, args.This(),
                                               &binding->typeTag, &matches))) {
      return nullptr;
    }
    if (!matches) {
      return ThrowTypeError(env, "Invalid native accessor receiver");
    }
  }
  return binding->setter(args);
}

napi_value InitializeModule(napi_env env, napi_value exports,
                            ModuleInitializer initializer) {
  ModuleState* state = ModuleState::Create(env);
  if (!state || !initializer(*state, exports)) {
    return nullptr;
  }
  return exports;
}

}  // namespace napi
}  // namespace muhammara
