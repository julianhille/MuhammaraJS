# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Added

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

[Unreleased]: https://github.com/julianhille/MuhammaraJS/compare/1.7.0...HEAD
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
