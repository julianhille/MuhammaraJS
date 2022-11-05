{
  "name": "muhammara",
  "version": "3.3.0",
  "description": "Create, read and modify PDF files and streams. A drop in replacement for hummusjs PDF library",
  "homepage": "https://github.com/julianhille/Muhammarajs",
  "license": "Apache-2.0",
  "author": "Julian <j.hille484@gmail.com>",
  "main": "./muhammara.js",
  "types": "./muhammara.d.ts",
  "engines": {
    "node": ">=11"
  },
  "scripts": {
    "install": "node-pre-gyp install --fallback-to-build ${EXTRA_NODE_PRE_GYP_FLAGS:-\"\"}",
    "test": "mocha -R tap ./tests/*.js --timeout 15000",
    "test:codestyle": "npx prettier -c ./",
    "test:electron": "electron-mocha -R tap ./tests/*.js --timeout 15000",
    "package": "node-pre-gyp package"
  },
  "repository": {
    "type": "git",
    "url": "git://github.com/julianhille/Muhammarajs.git"
  },
  "keywords": [
    "pdf",
    "pdfhummus",
    "muhammarajs",
    "hummusjs",
    "hummus"
  ],
  "files": [
    "src",
    "muhammara.js",
    "muhammara.d.ts",
    "binding.gyp",
    "PDFRStreamForFile.js",
    "PDFStreamForResponse.js",
    "PDFWStreamForFile.js",
    "PDFRStreamForBuffer.js",
    "PDFWStreamForBuffer.js"
  ],
  "dependencies": {
    "@mapbox/node-pre-gyp": "^1.0.5"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "chai": "^4.3.6",
    "mocha": "^8.4.0",
    "npm": "^6.14.5",
    "prettier": "^2.7.1"
  },
  "binary": {
    "module_name": "muhammara",
    "module_path": "./binding",
    "remote_path": "julianhille/MuhammaraJS/releases/download/{version}",
    "host": "https://github.com",
    "package_name": "{node_abi}-{platform}-{arch}-{libc}.tar.gz"
  },
  "publishConfig": {
    "registry": "https://registry.npmjs.org/"
  },
  "bundleDependencies": [
    "@mapbox/node-pre-gyp"
  ]
}
