{
    'variables': {
        'muhammara_source_root%': 'src'
    },
    'targets': [
    {
            'target_name': 'muhammara',
            'type': 'loadable_module',
			'product_extension': 'node',
            'dependencies': [
               '<(muhammara_source_root)/deps/PDFWriter/binding.gyp:pdfwriter'
            ],
            "defines": [
            'USE_BUNDLED=TRUE'
            ],
            "cflags_cc": [ "-std=c++20" ],
            "cflags": [ "-std=c++20" ],
            'include_dirs': [
                '<(muhammara_source_root)',
                '<(muhammara_source_root)/deps/PDFWriter',
                '<(muhammara_source_root)/deps/FreeType/include'
            ],
            'msvs_settings':
			{
				'VCCLCompilerTool':
				{
					'AdditionalIncludeDirectories': [
						'<!(echo %OPENSSL_LIB_DIR%)/include/'
					],
					'AdditionalOptions': [
						'/std:c++20'
					]
				}
			},
            'conditions': [
                ['OS=="linux"', {
                    'libraries': [
                        '<!(echo $OPENSSL_LIB_DIR)/libcrypto.a',
                        '-ldl',
                        '-pthread'
                    ]
                }],
                ['OS=="mac"', {
                    'libraries': [
                        '<!(echo $OPENSSL_LIB_DIR)/libcrypto.a'
                    ],
                    'xcode_settings': {
                        'CLANG_CXX_LIBRARY': 'libc++',
                        "OTHER_CFLAGS": [ "-std=c++20" ]
                    }
                }],
                ['OS=="win" and target_arch=="x64"', {
                    'msvs_settings': {
                        'VCLinkerTool': {
                            'AdditionalLibraryDirectories': [
                                '<!(echo %OPENSSL_LIB_DIR%)/'
                            ],
                            'AdditionalDependencies': [
                                '<!(echo %OPENSSL_LIB_DIR%)/libcrypto.lib',
                                'advapi32.lib',
                                'crypt32.lib',
                                'gdi32.lib',
                                'user32.lib',
                                'ws2_32.lib'
                            ]
                        }
                    }
                }],
                ['OS=="win" and target_arch=="ia32"', {
                    'msvs_settings': {
                        'VCLinkerTool': {
                            'AdditionalLibraryDirectories': [
                                '<!(echo %OPENSSL_LIB_DIR%)/'
                            ],
                            'AdditionalDependencies': [
                                '<!(echo %OPENSSL_LIB_DIR%)/libcrypto.lib',
                                'advapi32.lib',
                                'crypt32.lib',
                                'gdi32.lib',
                                'user32.lib',
                                'ws2_32.lib'
                            ]
                        }
                    }
                }],
                 ['OS=="win"', {
                    'defines!': [
                    'V8_DEPRECATION_WARNINGS=1',
                    'V8_DEPRECATION_WARNINGS',
                    'V8_IMMINENT_DEPRECATION_WARNINGS',
                    'V8_IMMINENT_DEPRECATION_WARNINGS=1'
                    ],
                }, { # OS != "win",
                    'defines': [
                    ],
                }]
            ],
           'sources': [
                 '<(muhammara_source_root)/ConstructorsHolder.cpp',
                 '<(muhammara_source_root)/PDFStreamDriver.cpp',
                 '<(muhammara_source_root)/DictionaryContextDriver.cpp',
                 '<(muhammara_source_root)/PDFTextStringDriver.cpp',
                 '<(muhammara_source_root)/PDFDateDriver.cpp',
                 '<(muhammara_source_root)/PDFArrayDriver.cpp',
                 '<(muhammara_source_root)/PDFDictionaryDriver.cpp',
                 '<(muhammara_source_root)/PDFStreamInputDriver.cpp',
                 '<(muhammara_source_root)/PDFIndirectObjectReferenceDriver.cpp',
                 '<(muhammara_source_root)/PDFBooleanDriver.cpp',
                 '<(muhammara_source_root)/PDFLiteralStringDriver.cpp',
                 '<(muhammara_source_root)/PDFHexStringDriver.cpp',
                 '<(muhammara_source_root)/PDFNullDriver.cpp',
                 '<(muhammara_source_root)/PDFNameDriver.cpp',
                 '<(muhammara_source_root)/PDFIntegerDriver.cpp',
                 '<(muhammara_source_root)/PDFRealDriver.cpp',
                 '<(muhammara_source_root)/PDFSymbolDriver.cpp',
                 '<(muhammara_source_root)/PDFObjectDriver.cpp',
                 '<(muhammara_source_root)/PDFReaderDriver.cpp',
                 '<(muhammara_source_root)/DocumentCopyingContextDriver.cpp',
                 '<(muhammara_source_root)/ObjectsContextDriver.cpp',
                 '<(muhammara_source_root)/DocumentContextDriver.cpp',
                 '<(muhammara_source_root)/ImageXObjectDriver.cpp',
                 '<(muhammara_source_root)/UsedFontDriver.cpp',
                 '<(muhammara_source_root)/ResourcesDictionaryDriver.cpp',
                 '<(muhammara_source_root)/XObjectContentContextDriver.cpp',
                 '<(muhammara_source_root)/FormXObjectDriver.cpp',
                 '<(muhammara_source_root)/AbstractContentContextDriver.cpp',
                 '<(muhammara_source_root)/PageContentContextDriver.cpp',
                 '<(muhammara_source_root)/PDFPageDriver.cpp',
                 '<(muhammara_source_root)/PDFPageModifierDriver.cpp',
                 '<(muhammara_source_root)/PDFWriterDriver.cpp',
                 '<(muhammara_source_root)/PDFPageInputDriver.cpp',
                 '<(muhammara_source_root)/InputFileDriver.cpp',
                 '<(muhammara_source_root)/OutputFileDriver.cpp',
                 '<(muhammara_source_root)/InfoDictionaryDriver.cpp',
                 '<(muhammara_source_root)/ByteReaderDriver.cpp',
                 '<(muhammara_source_root)/ByteReaderWithPositionDriver.cpp',
                 '<(muhammara_source_root)/ByteWriterDriver.cpp',
                 '<(muhammara_source_root)/ByteWriterWithPositionDriver.cpp',
                 '<(muhammara_source_root)/ObjectByteReader.cpp',
                 '<(muhammara_source_root)/ObjectByteReaderWithPosition.cpp',
                 '<(muhammara_source_root)/ObjectByteWriter.cpp',
                 '<(muhammara_source_root)/ObjectByteWriterWithPosition.cpp',
                 '<(muhammara_source_root)/PDFObjectParserDriver.cpp',
                 '<(muhammara_source_root)/text-extraction/PDFTextExtractor.cpp',
                 '<(muhammara_source_root)/muhammara.cpp'
            ]

	   },
		{
			'target_name': 'action_after_build',
			'type': 'none',
			'dependencies': [ '<(module_name)' ],
			'copies': [
				{
					'files': [
						'<(PRODUCT_DIR)/muhammara.node'
					],
					'destination': '<(module_path)'
				}
			]
		}

    ]
}
