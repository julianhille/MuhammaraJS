"use strict";

var assert = require("assert");
var packageJson = require("../package.json");
var versioning = require("@mapbox/node-pre-gyp/lib/util/versioning");

var napiVersion = Number(process.versions.napi);
assert(
  packageJson.binary.napi_versions.includes(napiVersion),
  `Node-API ${napiVersion} is missing from binary.napi_versions`,
);

var options = versioning.evaluate(packageJson, {});
assert(
  options.package_name.startsWith(`node-v${process.versions.modules}-`),
  `Expected a Node-ABI package name, received ${options.package_name}`,
);
assert(
  !options.package_name.includes("napi-v"),
  `Expected N-API metadata to be ignored by node-pre-gyp, received ${options.package_name}`,
);

console.log(
  `Node ${process.version}: N-API ${napiVersion}, Node ABI ${process.versions.modules}`,
);
