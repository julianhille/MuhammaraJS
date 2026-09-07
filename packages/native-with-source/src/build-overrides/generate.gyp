{
    'targets': [ {
        'target_name': 'native_build_overrides',
        'type': 'none',
        'actions': [ {
            'action_name': 'generate_native_build_overrides',
            'msvs_cygwin_shell': 0,
            'inputs': [
                'generate.cjs',
                'ThreadSafety.h',
                'aes-thread-local.h',
                '../deps/PDFWriter/Trace.cpp',
                '../deps/PDFWriter/Log.cpp',
                '../deps/PDFWriter/PDFDate.cpp',
                '../deps/LibAesgm/aescrypt.c',
                '../deps/LibAesgm/aeskey.c',
                '../deps/LibAesgm/aes_ni.c',
                '../deps/LibAesgm/aes_modes.c',
                '../deps/LibAesgm/aestab.c',
                '../deps/LibAesgm/aesopt.h',
                '../deps/LibAesgm/brg_endian.h',
                '../deps/LibAesgm/aes.h',
                '../deps/LibAesgm/aestab.h',
                '../deps/LibAesgm/brg_types.h',
                '../deps/LibAesgm/aes_via_ace.h',
                '../deps/LibAesgm/aes_ni.h',
                '../deps/LibAesgm/aescpp.h'
            ],
            'outputs': [
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/Trace.cpp',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/Log.cpp',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/PDFDate.cpp',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aescrypt.c',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aeskey.c',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aes_ni.c',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aes_modes.c',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aestab.c',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aesopt.h',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/brg_endian.h',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aes.h',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aestab.h',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/brg_types.h',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aes_via_ace.h',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aes_ni.h',
                '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/aescpp.h'
            ],
            'action': [ 'node', 'generate.cjs', '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides' ]
        } ]
    } ]
}
