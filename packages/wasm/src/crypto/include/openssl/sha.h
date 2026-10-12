/* The part of OpenSSL's <openssl/sha.h> that PDFWriter's PDF 2.0 key
 * derivation (XCryptionCommon2_0.cpp) calls, backed by HACL* in sha.c. It
 * declares nothing else, so a PDFWriter update that needs more fails to
 * build instead of silently using something missing. */
#ifndef MUHAMMARA_WASM_OPENSSL_SHA_H
#define MUHAMMARA_WASM_OPENSSL_SHA_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define SHA256_DIGEST_LENGTH 32
#define SHA384_DIGEST_LENGTH 48
#define SHA512_DIGEST_LENGTH 64

/* Each context owns a HACL* streaming state from Init until Final. */
typedef struct {
  void *state;
} SHA256_CTX;
typedef struct {
  void *state;
} SHA512_CTX;

/* As in OpenSSL, each returns 1 on success and 0 on failure. */
int SHA256_Init(SHA256_CTX *c);
int SHA256_Update(SHA256_CTX *c, const void *data, size_t len);
int SHA256_Final(unsigned char *md, SHA256_CTX *c);
int SHA384_Init(SHA512_CTX *c);
int SHA384_Update(SHA512_CTX *c, const void *data, size_t len);
int SHA384_Final(unsigned char *md, SHA512_CTX *c);
int SHA512_Init(SHA512_CTX *c);
int SHA512_Update(SHA512_CTX *c, const void *data, size_t len);
int SHA512_Final(unsigned char *md, SHA512_CTX *c);

#ifdef __cplusplus
}
#endif

#endif
