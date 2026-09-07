{
    'includes': [ '../deps/PDFWriter/binding.gyp' ],
    'target_defaults': {
        'defines!': [ '_HAS_EXCEPTIONS=0' ],
        'msvs_settings': { 'VCCLCompilerTool': { 'ExceptionHandling': 1 } },
        'dependencies!': [ '<(module_root_dir)/src/deps/LibAesgm/binding.gyp:libaesgm' ],
        'dependencies': [ 'aes.gyp:libaesgm', 'generate.gyp:native_build_overrides' ],
        'include_dirs': [ '../deps/PDFWriter', '.' ],
        'sources!': [
            '../deps/PDFWriter/Trace.cpp',
            '../deps/PDFWriter/Log.cpp',
            '../deps/PDFWriter/PDFDate.cpp'
        ],
        'sources': [
            '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/Trace.cpp',
            '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/Log.cpp',
            '<(SHARED_INTERMEDIATE_DIR)/native-build-overrides/PDFDate.cpp'
        ]
    }
}
