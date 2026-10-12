#include <openssl/sha.h>

#include <stdint.h>

#include "Hacl_Hash_SHA2.h"

/* HACL* takes at most UINT32_MAX bytes per update. */
#define CHUNK_SIZE ((size_t)UINT32_MAX)

#define DEFINE_SHA(bits, ctx_type, state_type)                                \
  int SHA##bits##_Init(ctx_type *c) {                                         \
    c->state = Hacl_Hash_SHA2_malloc_##bits();                                \
    return c->state != NULL;                                                  \
  }                                                                           \
                                                                              \
  int SHA##bits##_Update(ctx_type *c, const void *data, size_t len) {         \
    const uint8_t *bytes = (const uint8_t *)data;                             \
    if (c->state == NULL) return 0;                                           \
    while (len > 0) {                                                         \
      size_t chunk = len < CHUNK_SIZE ? len : CHUNK_SIZE;                     \
      if (Hacl_Hash_SHA2_update_##bits((state_type *)c->state,                \
                                       (uint8_t *)bytes, (uint32_t)chunk) !=  \
          Hacl_Streaming_Types_Success)                                       \
        return 0;                                                             \
      bytes += chunk;                                                         \
      len -= chunk;                                                           \
    }                                                                         \
    return 1;                                                                 \
  }                                                                           \
                                                                              \
  int SHA##bits##_Final(unsigned char *md, ctx_type *c) {                     \
    if (c->state == NULL) return 0;                                           \
    Hacl_Hash_SHA2_digest_##bits((state_type *)c->state, md);                 \
    Hacl_Hash_SHA2_free_##bits((state_type *)c->state);                       \
    c->state = NULL;                                                          \
    return 1;                                                                 \
  }

DEFINE_SHA(256, SHA256_CTX, Hacl_Streaming_MD_state_32)
DEFINE_SHA(384, SHA512_CTX, Hacl_Streaming_MD_state_64)
DEFINE_SHA(512, SHA512_CTX, Hacl_Streaming_MD_state_64)
