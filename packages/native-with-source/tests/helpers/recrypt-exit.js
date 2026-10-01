"use strict";

// Child process for the Xcryption test that calls process.exit() while
// recryptAsync() jobs still run on the libuv pool. Usage:
// node recrypt-exit.js <source.pdf> <output prefix>

var muhammara = require("@muhammara/native-with-source");

var source = process.argv[2];
var outputPrefix = process.argv[3];

for (var i = 0; i < 4; i++) {
  muhammara.recryptAsync(source, outputPrefix + i + ".pdf", {
    userPassword: "exit",
    version: muhammara.ePDFVersion20,
  });
}

setTimeout(function () {
  process.exit(0);
}, 20);
