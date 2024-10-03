{
    'targets': [
    {
            'target_name': 'muhammara',
            'type': 'loadable_module',
			'product_extension': 'node',
            'dependencies': [
               './src/deps/PDFWriter/binding.gyp:pdfwriter'
            ],
            "defines": [
            'USE_BUNDLED=TRUE'
            ],
            "cflags_cc": [ "-std=c++20" ],
            "cflags": [ "-std=c++20" ],
            'include_dirs': [
                './src',
                './src/deps/PDFWriter',
                './src/deps/FreeType/include'
            ],
            'msvs_settings':
			{
				'VCCLCompilerTool':
				{
					'AdditionalOptions':
						[
						'/std:c++20',
						]
				}
			},
            'conditions': [
['OS=="mac"', {
          'xcode_settings': {
            'CLANG_CXX_LIBRARY': 'libc++',
             "OTHER_CFLAGS": [ "-std=c++20"]
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
                './src/ConstructorsHolder.cpp',
                './src/PDFStreamDriver.cpp',
                './src/DictionaryContextDriver.cpp',
                './src/PDFTextStringDriver.cpp',
                './src/PDFDateDriver.cpp',
                './src/PDFArrayDriver.cpp',
                './src/PDFDictionaryDriver.cpp',
                './src/PDFStreamInputDriver.cpp',
                './src/PDFIndirectObjectReferenceDriver.cpp',
                './src/PDFBooleanDriver.cpp',
                './src/PDFLiteralStringDriver.cpp',
                './src/PDFHexStringDriver.cpp',
                './src/PDFNullDriver.cpp',
                './src/PDFNameDriver.cpp',
                './src/PDFIntegerDriver.cpp',
                './src/PDFRealDriver.cpp',
                './src/PDFSymbolDriver.cpp',
                './src/PDFObjectDriver.cpp',
                './src/PDFReaderDriver.cpp',
                './src/DocumentCopyingContextDriver.cpp',
                './src/ObjectsContextDriver.cpp',
                './src/DocumentContextDriver.cpp',
                './src/ImageXObjectDriver.cpp',
                './src/UsedFontDriver.cpp',
                './src/ResourcesDictionaryDriver.cpp',
                './src/XObjectContentContextDriver.cpp',
                './src/FormXObjectDriver.cpp',
                './src/AbstractContentContextDriver.cpp',
                './src/PageContentContextDriver.cpp',
                './src/PDFPageDriver.cpp',
                './src/PDFPageModifierDriver.cpp',
                './src/PDFWriterDriver.cpp',
                './src/PDFPageInputDriver.cpp',
                './src/InputFileDriver.cpp',
                './src/OutputFileDriver.cpp',
                './src/InfoDictionaryDriver.cpp',
                './src/ByteReaderDriver.cpp',
                './src/ByteReaderWithPositionDriver.cpp',
                './src/ByteWriterDriver.cpp',
                './src/ByteWriterWithPositionDriver.cpp',
                './src/ObjectByteReader.cpp',
                './src/ObjectByteReaderWithPosition.cpp',
                './src/ObjectByteWriter.cpp',
                './src/ObjectByteWriterWithPosition.cpp',
                './src/PDFObjectParserDriver.cpp',
                './src/muhammara.cpp'
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
