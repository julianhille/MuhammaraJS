#include <openssl/rand.h>

#include <unistd.h>

/* Emscripten's getentropy() reads crypto.getRandomValues() in browsers and
 * workers and node:crypto in Node. It fills at most 256 bytes per call. */
int RAND_bytes(unsigned char *buf, int num) {
  if (num < 0) return 0;
  while (num > 0) {
    int chunk = num < 256 ? num : 256;
    if (getentropy(buf, (size_t)chunk) != 0) return 0;
    buf += chunk;
    num -= chunk;
  }
  return 1;
}
