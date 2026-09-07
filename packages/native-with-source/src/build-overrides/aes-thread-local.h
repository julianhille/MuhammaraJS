#ifndef MUHAMMARA_AES_THREAD_LOCAL_H
#define MUHAMMARA_AES_THREAD_LOCAL_H

#if defined(_MSC_VER)
#define MUHAMMARA_THREAD_LOCAL __declspec(thread)
#elif defined(__GNUC__) || defined(__clang__)
#define MUHAMMARA_THREAD_LOCAL __thread
#else
#define MUHAMMARA_THREAD_LOCAL _Thread_local
#endif

#endif
