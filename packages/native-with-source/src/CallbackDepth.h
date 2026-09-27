#pragma once

#include <memory>

// Counts the calls a writer or reader is making into JavaScript through its
// streams or events. Such a callback must not end its caller: ending releases
// state the interrupted native operation still uses.
typedef std::shared_ptr<int> CallbackDepth;

class CallbackScope {
public:
  explicit CallbackScope(const CallbackDepth &depth) : depth_(depth) {
    if (depth_)
      ++*depth_;
  }
  ~CallbackScope() {
    if (depth_)
      --*depth_;
  }
  CallbackScope(const CallbackScope &) = delete;
  CallbackScope &operator=(const CallbackScope &) = delete;

private:
  CallbackDepth depth_;
};

inline bool IsInCallback(const CallbackDepth &depth) {
  return depth && *depth > 0;
}
