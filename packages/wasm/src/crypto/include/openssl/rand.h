/* The part of OpenSSL's <openssl/rand.h> that PDFWriter's RandomGenerator
 * calls, backed by getentropy() in rand.c. */
#ifndef MUHAMMARA_WASM_OPENSSL_RAND_H
#define MUHAMMARA_WASM_OPENSSL_RAND_H

#ifdef __cplusplus
extern "C" {
#endif

/* As in OpenSSL, returns 1 on success and 0 on failure. */
int RAND_bytes(unsigned char *buf, int num);

#ifdef __cplusplus
}
#endif

#endif
