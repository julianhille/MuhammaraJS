# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.2.0] - 2024-10-20

### Added

- Add electron 33.0, 32.1, 32.2, 31.5, 31.6, 30.5

## [5.1.0] - 2024-10-17

### Added

- Add node v23.0.0

### Updated

- Downgrade to gcc11 to lower needed glibc version

## [5.0.2] - 2024-10-10

### Added

- Update PDRWriter to 4.6.7 (#410)

### Update

- Build linux on docker -> downgrade glibc for linux builds (#423)

## [5.0.1] - 2024-09-28

### Added

- Tests for bold, italic, underline, strikethrough, and highlights in textboxes
- Add missing node v21 and v22 to the build matrix (#417)

## [5.0.0] - 2024-09-08

### Added

- Add electron 24.7 and 24.8
- Add electron 25.4, 25.5, 25.6, 25.7, 25.8 and 25.9
- Add electron 26.0, 26.1, 26.2, 26.3, 26.4, 26.5, 26.6
- Add electron 27.0, 27.1, 27.2 and 27.3
- Add electron 28.0, 28.1, 28.2 and 28.3
- Add electron 29.0, 29.1, 29.2, 29.3 and 29.4
- Add electron 30.0, 30.1, 30.2, 30.3 and 30.4
- Add electron 31.0, 31.1, 31.2, 31.3 and 31.4
- Add electron 32.0
- Add node v22.0.0

### Remove

- Outdated electron 23.x versions
- Node version <= 16

### Update

- Update dependencies
  - Including tar which removes a security vulnerability
- new Buffer to Buffer.from

## [4.1.0] - 2023-12-13

### Fixed

- definitions: appendPage optionnal parameter
- Build musl/musl-arm with node 20
- Support negative rotation in recipe page changes
- registerFont now returns recipe as stated in typescript definition

### Added

- Add nodejs v21.0.0

## [4.0.0] - 2023-07-14

### Fixed

- Recipe type / arg documentation
- Add missing type `userPassword` to `EncryptOptions`
- Underline in text object

### Added

- Add electron 23.2., 23.3
- Recipe infos to readme
- Strikethrough implementation in text object
- Electron v24.1, 24.2, 24.3, 24.4, 24.5, 24.6
- Add node 20.x
- Add electron v25.0, 25.1, 25.2, 25.3
- Option to add annotation replies to annotations
- Textboxes now show title and date as annotations in pdfs

### Removed

- Dependency to static-eval and static-module as they are not used directly
- Node versions: 11.x - 14.x
- Electron versions: 11.x - 14.2

### Changed

- Updated node-gyp version to 1.0.10
- Older node ubuntu 18.04 builds are now building on docker, as github actions removed 18.04
- CI linux builds use ubuntu 20.04 instead of 18.04 -> glibc Update, see readme for breaking changes in v4

## [3.8.0] - 2023-03-01

### Added

- Electron 22.3, 23.0.0, 23.1.1

### Fixed

- Correctly includes types file in package

## [3.7.0] - 2023-02-09

### Added

- Electron 21.4, 22.1 and 22.2

### Fixed

- Update xmldom to new 0.8.6 and fix security issues
- Fix arm64 on mac builds

### Removed

- Pre-builts for macos on arm for node < 15 (eg 14, 12, 10 etc)

## [3.6.0] - 2023-01-24

### Added

- Pre builts for arm64 / musl architecture (M1 using alpine)
- Hummus-recipe / Muhammara-recipe as part of this lib

### Fixed

- Memory leak in ByteReaderWithPositionDriver when reading PDF files

## [3.5.0] - 2022-12-07

### Added

- Electron 22.0.x

## [3.4.0] - 2022-11-24

### Added

- Electron 21.3.x

### Fixed

- Several cases of NPE under different circumstances

## [3.3.0] - 2022-11-05

### Fixed

- Typescript definition of member buffer of PDFWStreamForBuffer fixed

### Changed

- Updated github actions to get rid of some deprecation warnings in gha ci
- Pin python 3 version for builds

### Added

- Electron 21.0.0, 21.1.0 and 21.2.0

## [3.2.0] - 2022-10-26

### Added

- Add electron 20.3.3
- Ignore extra data above the header and below the footer in PDF Parser
- Add node 19.0.0

## [3.1.1] - 2022-10-23

### Fixed

- NPE in parser when file ends before it really starts

## [3.1.0] - 2022-09-30

### Changed

- Update TypeScript declaration for `PDFStreamForResponse` to accept any writable stream as an argument, not just `PDFRStreamForFile`

### Added

- Electron 21.0
- Node 18
- Electron 20.0, 20.1, 20.2
- Prettier as dev dependency and basics
- Electron 19.1

## [3.0.0] - 2022-07-19

### Fixed

- Links in docs

### Added

- drawPath can now be used differently and this new way can be described with ts.
  The old style is `drawPath(x1, y1, x2, y2..., options)` we now allow `drawPath([[x1, y1], [x2, y2]...], options)` too
- scn and SCN can now be used differently and this new way can be described with ts.
  The old style is `scn(c1, c2, c3, c4, ..., 'patternName')` we now allow `scn([[c1, c2, c3, c4, ...], 'patternName')` too

### Changed

- Bump dev dependency versions s

### Breaking

- Node < 11 and Electron < 11 removed
- Renamed typo exported value from eTokenSeprator to eTokenSeparator

## [2.6.2] - 2022-11-23

### Fixed

- Several cases of NPE under different circumstances

## [2.6.1] - 2022-10-23

### Fixed

- Backport: NPE in parser when file ends before it really starts

## [2.6.0] - 2022-06-30

### Changed

- Fixes hard crash to exception when creating a stream with null object and calling createWriter with it
- Fixes missing buffer information for recrypt typescript definition
- Fixes missing options for append pdf pages
- Fixes NPE when stream is not readable in write stream object (PDFDocumentHandler)

## [2.5.0] - 2022-06-23

### Added

- Electron 17.2.0, 17.3, 17.4
- Typescript definitions
- Add test for recrypt with streams

## [2.4.0] - 2022-06-08

### Added

- Electron 18.1, 18.2, 18.3
- Electron 19.0

### Changed

- Update npm dist url to the new url for electron builds

## [2.3.0] - 2022-05-04

### Added

- Builds for node and electron with arm64 on darwin (Apple M1)
- Add electron 18

## [2.2.0] - 2022-03-05

### Changed

- Update PDFWriter dependency to the newest available versoin

### Added

- Electron version: 17.0, 17.1
- NodeJs 17.6.0

## [2.1.0] - 2021-12-03

### Added

- Electron versions: 16.0, 15.3, 15.2, 14.2, 13.6, 13.3

## [2.0.0] - 2021-10-22

### Removed

- Electron 2.0.7
- Node 6.14.1 and 7.10.1

### Added

- Add Electron 13.3.0
- Documentation (copy of the wiki)
- Add Electron 13.2.3
- Add Electron 13.5.0
- Add Electron 14.0.1
- Add Electron 14.1.0
- Add Electron 15.0.0
- Add Electron 15.1.2
- Add Node 16.11.1

### Fixed

- Dependency to node-pre-gyp moved from deprecated to scoped package

## [1.10.0] - 2021-07-12

### Added

- Add Electron 13.1
- Disable NEON on arm builds

## [1.9.0] - 2021-06-30

### Fixed

- Yarn v2 incompatibiliy
- Build issues on mac OS big sur

## [1.8.0] - 2021-05-28

### Added

- Add Electron 13.0
- Add missing typescript declaration of the PDFWStreamForBuffer
- Add Electron 11.4
- Add electron 10.4

## [1.7.0] - 2021-03-08

### Added

- More electron 11.x releases
- Add electron 12.0.0
- Add electron 10.2, 10.3
- Add electron 9.4, 9.3

## [1.6.0] - 2021-02-17

### Fixed

- Update the g++ compiler from 4.8 to 5.4 (default on xenial) for linux builds
- Changed builds from travis and app veyor to github

### Added

- Electron 11
- Added Node 15

## [1.5.1] - 2020-10-10

### Added

- Added manual workflow to reduce release errors

### Fixed

- Huge package size as npm publish does not use .gitignore or .npmignore locally

## [1.5.0] - 2020-10-10

### Added

- Electron 7.3, 8.3, 8.4, 8.5 and 9.3

## [1.4.3] - 2020-10-09

### Fixed

- Return code fixed for builds on app veyor.
- Winwdows builds successfully with electron 10.x
- NPM version on app veyor fixed to build electron 2.x again

### Added

- Add electron 10.1.3

## [1.4.2] - 2020-08-27

### Added

- Add electron 10.0

## [1.4.1] - 2020-08-13

This is a special release no code has been changed.
The packaged module included (in version muhammara@1.4.0) a bundled dependency with a
debug output.

### Fixed

- Removed debug output from packaged dependency `node-pre-gyp`

## [1.4.0] - 2020-08-10

### Added

- Add electron 9.2

## [1.3.0] - 2020-08-06

### Added

- Add electron-9.1 pre built

### Fixed

- Add missing typescript declaration files to published packages

## [1.2.0] - 2020-06-01

### Fixed

- Updated freetype to 2.10.0
- Updated libpng dependency to 1.6.37
- Updated libaesgm dependency
- Update libjpeg dependency to 9d
- Updated libtiff dependency to 3.9.7

## [1.1.0] - 2020-05-27

### Added

- Added infos about being hummusjs drop in replacement
- Added electron v9.0.0

### Fixed

- Updated dependencies and dev dependencies

## [1.0.1] - 2020-05-08

### Fixed

- Fixed readme to include infos about muhammaraJS and hummus
- Fixed node-pre-gyp binary download links

### Removed

- Unecessary dependency on aws-sdk

## [1.0.0] - 2020-05-07

Basically this is [HummusJS v1.0.108](https://github.com/galkahana/HummusJS/commit/772bd561f02433bf1a602135f53c7c17f8072450)
with the following changes.

### Added

- Store releases @github
- Listen for tags instead of a commit message
- Added node v13, v14, electron 6.1, 7.1, 7.2, 8.0, 8.1, 8.2

### Fixed

- Updated v8:GET / v8:SET calls which are incompatible with newer node version (>13)

### Removed

- Dropped support for electron 1.8

- Initial release

:[unreleased]: https://github.com/julianhille/MuhammaraJS/compare/5.2.0...HEAD
[5.2.0]: https://github.com/julianhille/MuhammaraJS/compare/5.1.0...5.2.0
[5.1.0]: https://github.com/julianhille/MuhammaraJS/compare/5.0.2...5.1.0
[5.0.2]: https://github.com/julianhille/MuhammaraJS/compare/5.0.1...5.0.2
[5.0.1]: https://github.com/julianhille/MuhammaraJS/compare/5.0.0...5.0.1
[5.0.0]: https://github.com/julianhille/MuhammaraJS/compare/4.1.0...5.0.0
[4.1.0]: https://github.com/julianhille/MuhammaraJS/compare/4.0.0...4.1.0
[4.0.0]: https://github.com/julianhille/MuhammaraJS/compare/3.8.0...4.0.0
[3.8.0]: https://github.com/julianhille/MuhammaraJS/compare/3.7.0...3.8.0
[3.7.0]: https://github.com/julianhille/MuhammaraJS/compare/3.6.0...3.7.0
[3.6.0]: https://github.com/julianhille/MuhammaraJS/compare/3.5.0...3.6.0
[3.5.0]: https://github.com/julianhille/MuhammaraJS/compare/3.4.0...3.5.0
[3.4.0]: https://github.com/julianhille/MuhammaraJS/compare/3.3.0...3.4.0
[3.3.0]: https://github.com/julianhille/MuhammaraJS/compare/3.2.0...3.3.0
[3.2.0]: https://github.com/julianhille/MuhammaraJS/compare/3.1.1...3.2.0
[3.1.1]: https://github.com/julianhille/MuhammaraJS/compare/3.1.0...3.1.1
[3.1.0]: https://github.com/julianhille/MuhammaraJS/compare/3.0.0...3.1.0
[3.0.0]: https://github.com/julianhille/MuhammaraJS/compare/2.6.2...3.0.0
[2.6.2]: https://github.com/julianhille/MuhammaraJS/compare/2.6.1...2.6.2
[2.6.1]: https://github.com/julianhille/MuhammaraJS/compare/2.6.0...2.6.1
[2.6.0]: https://github.com/julianhille/MuhammaraJS/compare/2.5.0...2.6.0
[2.5.0]: https://github.com/julianhille/MuhammaraJS/compare/2.4.0...2.5.0
[2.4.0]: https://github.com/julianhille/MuhammaraJS/compare/2.3.0...2.4.0
[2.3.0]: https://github.com/julianhille/MuhammaraJS/compare/2.2.0...2.3.0
[2.2.0]: https://github.com/julianhille/MuhammaraJS/compare/2.1.0...2.2.0
[2.1.0]: https://github.com/julianhille/MuhammaraJS/compare/2.0.0...2.1.0
[2.0.0]: https://github.com/julianhille/MuhammaraJS/compare/1.10.0...2.0.0
[1.10.0]: https://github.com/julianhille/MuhammaraJS/compare/1.9.0...1.10.0
[1.9.0]: https://github.com/julianhille/MuhammaraJS/compare/1.8.0...1.9.0
[1.8.0]: https://github.com/julianhille/MuhammaraJS/compare/1.7.0...1.8.0
[1.7.0]: https://github.com/julianhille/MuhammaraJS/compare/1.6.0...1.7.0
[1.6.0]: https://github.com/julianhille/MuhammaraJS/compare/1.5.1...1.6.0
[1.5.1]: https://github.com/julianhille/MuhammaraJS/compare/1.5.0...1.5.1
[1.5.0]: https://github.com/julianhille/MuhammaraJS/compare/1.4.3...1.5.0
[1.4.3]: https://github.com/julianhille/MuhammaraJS/compare/1.4.2...1.4.3
[1.4.3]: https://github.com/julianhille/MuhammaraJS/compare/1.4.2...1.4.3
[1.4.3]: https://github.com/julianhille/MuhammaraJS/compare/1.4.2...1.4.3
[1.4.2]: https://github.com/julianhille/MuhammaraJS/compare/1.4.1...1.4.2
[1.4.1]: https://github.com/julianhille/MuhammaraJS/compare/1.4.0...1.4.1
[1.4.0]: https://github.com/julianhille/MuhammaraJS/compare/1.3.0...1.4.0
[1.3.0]: https://github.com/julianhille/MuhammaraJS/compare/1.2.0...1.3.0
[1.2.0]: https://github.com/julianhille/MuhammaraJS/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/julianhille/MuhammaraJS/compare/1.0.1...1.1.0
[1.0.1]: https://github.com/julianhille/MuhammaraJS/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/julianhille/MuhammaraJS/tree/1.0.0
