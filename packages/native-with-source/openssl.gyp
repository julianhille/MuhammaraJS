{
    'targets': [
        {
            'target_name': 'openssl',
            'type': 'none',
            'conditions': [
                ['OS=="win"', {
                    'actions': [
                        {
                            'action_name': 'build_openssl',
                            'inputs': [
                                '<(module_root_dir)/src/deps/openssl-3.5.4.tar.gz',
                                '<(module_root_dir)/scripts/build-openssl.ps1'
                            ],
                            'outputs': [
                                '<(module_root_dir)/openssl-build/<(target_arch)/libcrypto.lib',
                                '<(module_root_dir)/openssl-build/<(target_arch)/include/openssl/sha.h'
                            ],
                            'action': [
                                'powershell.exe',
                                '-NoProfile',
                                '-ExecutionPolicy',
                                'Bypass',
                                '-File',
                                '<(module_root_dir)/scripts/build-openssl.ps1',
                                '-TargetArchitecture',
                                '<(target_arch)'
                            ]
                        }
                    ]
                }, {
                    'actions': [
                        {
                            'action_name': 'build_openssl',
                            'inputs': [
                                '<(module_root_dir)/src/deps/openssl-3.5.4.tar.gz',
                                '<(module_root_dir)/scripts/build-openssl.sh'
                            ],
                            'outputs': [
                                '<(module_root_dir)/openssl-build/<(target_arch)/libcrypto.a',
                                '<(module_root_dir)/openssl-build/<(target_arch)/include/openssl/sha.h'
                            ],
                            'action': [
                                'sh',
                                '<(module_root_dir)/scripts/build-openssl.sh',
                                '<(target_arch)'
                            ]
                        }
                    ]
                }]
            ]
        }
    ]
}
