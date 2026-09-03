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
                            'msvs_cygwin_shell': 0,
                            'inputs': [
                                '<(module_root_dir)/src/deps/openssl-3.5.4.tar.gz',
                                '<(module_root_dir)/scripts/build-openssl-win.js'
                            ],
                            'outputs': [
                                '<(module_root_dir)/openssl-build/<(target_arch)/.build-stamp'
                            ],
                            'action': [
                                'node',
                                '<(module_root_dir)/scripts/build-openssl-win.js',
                                '--target-architecture=<(target_arch)'
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
                                '<(module_root_dir)/openssl-build/<(target_arch)/.build-stamp'
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
