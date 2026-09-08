{
    'targets': [ {
        'target_name': 'libaesgm',
        'type': 'static_library',
        'defines': [ 'USE_BUNDLED=TRUE' ],
        'msvs_settings': {
            'VCCLCompilerTool': { 'AdditionalOptions': [ '/std:c++17' ] }
        },
        'sources': [
            '<!@("<(python)" -c "import ast, shlex; print(shlex.join(\'../deps/LibAesgm/\' + p for p in ast.literal_eval(open(\'../deps/LibAesgm/binding.gyp\', encoding=\'utf-8\').read())[\'targets\'][0][\'sources\']))")'
        ]
    } ],
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
