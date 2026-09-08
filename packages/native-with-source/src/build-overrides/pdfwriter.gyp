{
    # Do not include a .gyp as a .gypi: MSVS emits a solution for every loaded .gyp.
    'targets': [ {
        'target_name': 'pdfwriter',
        'type': 'static_library',
        'cflags!': [ '-fno-exceptions' ],
        'cflags_cc!': [ '-fno-exceptions' ],
        'defines': [ 'USE_BUNDLED=TRUE' ],
        'conditions': [
            ['OS=="mac"', {
                'xcode_settings': { 'GCC_ENABLE_CPP_EXCEPTIONS': 'YES' }
            }]
        ],
        'msvs_settings': {
            'VCCLCompilerTool': { 'AdditionalOptions': [ '/std:c++20' ] }
        },
        'dependencies': [
            '<(module_root_dir)/openssl.gyp:openssl',
            '<(module_root_dir)/src/deps/FreeType/binding.gyp:freetype',
            '<(module_root_dir)/src/deps/LibJpeg/binding.gyp:libjpeg',
            '<(module_root_dir)/src/deps/Zlib/binding.gyp:zlib',
            '<(module_root_dir)/src/deps/LibTiff/binding.gyp:libtiff',
            '<(module_root_dir)/src/deps/LibPng/binding.gyp:libpng'
        ],
        'include_dirs': [
            '<(module_root_dir)/openssl-build/<(target_arch)/include',
            '<(module_root_dir)/src/deps/LibAesgm',
            '<(module_root_dir)/src/deps/FreeType/include',
            '<(module_root_dir)/src/deps/LibTiff',
            '<(module_root_dir)/src/deps/Zlib',
            '<(module_root_dir)/src/deps/LibJpeg',
            '<(module_root_dir)/src/deps/LibPng'
        ],
        'sources': [
            '<!@("<(python)" -c "import ast, shlex; print(shlex.join(\'../deps/PDFWriter/\' + p for p in ast.literal_eval(open(\'../deps/PDFWriter/binding.gyp\', encoding=\'utf-8\').read())[\'targets\'][0][\'sources\']))")'
        ]
    } ],
    'target_defaults': {
        'defines!': [ '_HAS_EXCEPTIONS=0' ],
        'msvs_settings': { 'VCCLCompilerTool': { 'ExceptionHandling': 1 } },
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
