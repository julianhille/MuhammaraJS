"use strict";

var path = require("path");
var pregyp = require("@mapbox/node-pre-gyp");
var bindingPath = pregyp.find(path.join(__dirname, "package.json"));

module.exports = require("@muhammara/native-core").createMuhammara(
  require(bindingPath),
);
