#pragma once

#include <ctime>
#include <mutex>

namespace MuhammaraBuild {

inline bool LocalTime(const time_t& value, tm& result) {
#ifdef _WIN32
  return localtime_s(&result, &value) == 0;
#else
  return localtime_r(&value, &result) != nullptr;
#endif
}

inline bool GmTime(const time_t& value, tm& result) {
#ifdef _WIN32
  return gmtime_s(&result, &value) == 0;
#else
  return gmtime_r(&value, &result) != nullptr;
#endif
}

inline unsigned& LogDepth() {
  static thread_local unsigned depth = 0;
  return depth;
}

// One sink lock across all Log instances, including separate instances opening
// the same path. Never held during PDF parsing, encryption, or serialization.
class LogGuard {
 public:
  LogGuard() : lock(Mutex()) { ++LogDepth(); }
  ~LogGuard() { --LogDepth(); }
  bool IsOuter() const { return LogDepth() == 1; }

 private:
  static std::recursive_mutex& Mutex() {
    static std::recursive_mutex mutex;
    return mutex;
  }
  std::lock_guard<std::recursive_mutex> lock;
};

}  // namespace MuhammaraBuild
