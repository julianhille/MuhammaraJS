# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Fixes missing buffer information for recrypt typescript definition

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
- Documentation (copy of  the wiki)
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

* Yarn v2 incompatibiliy
* Build issues on mac OS big sur

## [1.8.0] - 2021-05-28

### Added

- Add Electron 13.0
- Add missing typescript declaration of the PDFWStreamForBuffer
- Add Electron 11.4
- Add electron 10.4

## [1.7.0] - 2021-03-08

### Added

* More electron 11.x releases
* Add electron 12.0.0
* Add electron 10.2, 10.3
* Add electron 9.4, 9.3

## [1.6.0] - 2021-02-17

### Fixed

* Update the g++ compiler from 4.8 to 5.4 (default on xenial) for linux builds
* Changed builds from travis and app veyor to github

### Added

* Electron 11
* Added Node 15

## [1.5.1] - 2020-10-10

### Added

* Added manual workflow to reduce release errors

### Fixed

* Huge package size as npm publish does not use .gitignore or .npmignore locally

## [1.5.0] - 2020-10-10

### Added

* Electron 7.3, 8.3, 8.4, 8.5 and 9.3

## [1.4.3] - 2020-10-09

### Fixed

* Return code fixed for builds on app veyor.
* Winwdows builds successfully with electron 10.x
* NPM version on app veyor fixed to build electron 2.x again

### Added

* Add electron 10.1.3

## [1.4.2] - 2020-08-27

### Added

* Add electron 10.0

## [1.4.1] - 2020-08-13

This is a special release no code has been changed.
The packaged module included (in version muhammara@1.4.0) a bundled dependency with a
debug output.

### Fixed

* Removed debug output from packaged dependency `node-pre-gyp`


## [1.4.0] - 2020-08-10

### Added

* Add electron 9.2

## [1.3.0] - 2020-08-06

### Added

* Add electron-9.1 pre built

### Fixed

* Add missing typescript declaration files to published packages

## [1.2.0] - 2020-06-01

### Fixed

* Updated freetype to 2.10.0
* Updated libpng dependency to 1.6.37
* Updated libaesgm dependency
* Update libjpeg dependency to 9d
* Updated libtiff dependency to 3.9.7

## [1.1.0] - 2020-05-27

### Added

* Added infos about being hummusjs drop in replacement
* Added electron v9.0.0

### Fixed

* Updated dependencies and dev dependencies

## [1.0.1] - 2020-05-08

### Fixed

* Fixed readme to include infos about muhammaraJS and hummus
* Fixed node-pre-gyp binary download links

### Removed

* Unecessary dependency on aws-sdk

## [1.0.0] - 2020-05-07

Basically this is [HummusJS v1.0.108](https://github.com/galkahana/HummusJS/commit/772bd561f02433bf1a602135f53c7c17f8072450)
with the following changes.

### Added

* Store releases @github
* Listen for tags instead of a commit message
* Added node v13, v14, electron 6.1, 7.1, 7.2, 8.0, 8.1, 8.2

### Fixed

* Updated v8:GET / v8:SET calls which are incompatible with newer node version (>13)

### Removed

* Dropped support for electron 1.8


* Initial release

[Unreleased]: https://github.com/julianhille/MuhammaraJS/compare/2.5.0...HEAD
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
