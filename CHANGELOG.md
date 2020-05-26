# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

* Added infos about being hummusjs drop in replacement

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

[Unreleased]: https://github.com/julianhille/MuhammaraJS/compare/1.0.1...HEAD
[1.0.1]: https://github.com/julianhille/MuhammaraJS/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/julianhille/MuhammaraJS/tree/1.0.0
