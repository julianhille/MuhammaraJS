{
    'includes': [ '../deps/LibAesgm/binding.gyp' ],
    'target_defaults': {
        'product_name': 'muhammara_aesgm',
        'dependencies': [ 'generate.gyp:native_build_overrides' ],
        'include_dirs': [ '.' ],
        'sources!': [
            '../deps/LibAesgm/aescrypt.c',
            '../deps/LibAesgm/aeskey.c',
            '../deps/LibAesgm/aes_ni.c',
            '../deps/LibAesgm/aes_modes.c',
            '../deps/LibAesgm/aestab.c'
        ],
        'sources': [
            '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aescrypt.c',
            '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aeskey.c',
            '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aes_ni.c',
            '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aes_modes.c',
            '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aestab.c'
        ]
    }
}
