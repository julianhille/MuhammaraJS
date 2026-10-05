// Sanitizer hooks for the fuzzer (tests/fuzz). Built only into the
// AddressSanitizer configuration; Emscripten does not export the sanitizer
// runtime's own functions, so these wrap them.
#include <emscripten.h>
#include <sanitizer/allocator_interface.h>
#include <sanitizer/lsan_interface.h>

#include <cstddef>

// Heap bytes allocated and not yet freed.
extern "C" EMSCRIPTEN_KEEPALIVE size_t muhammara_fuzz_allocated_bytes() {
  return __sanitizer_get_current_allocated_bytes();
}

// Prints a LeakSanitizer report of unreachable allocations; returns nonzero
// when it found any.
extern "C" EMSCRIPTEN_KEEPALIVE int muhammara_fuzz_leak_check() {
  return __lsan_do_recoverable_leak_check();
}
