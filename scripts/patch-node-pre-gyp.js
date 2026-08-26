"use strict";

var fs = require("fs");

var versioningPath =
  require.resolve("@mapbox/node-pre-gyp/lib/util/versioning");
var source = fs.readFileSync(versioningPath, "utf8");
var replacements = [
  ["url.parse(o.host).protocol", "new URL(o.host).protocol"],
  [
    "url.resolve(opts.host, drop_double_slashes(`${opts.bucket}/${opts.remote_path}`))",
    "new URL(drop_double_slashes(`${opts.bucket}/${opts.remote_path}`), opts.host).href",
  ],
  [
    "url.resolve(opts.host, opts.remote_path)",
    "new URL(opts.remote_path, opts.host).href",
  ],
  [
    "url.resolve(opts.hosted_path, opts.package_name)",
    "new URL(opts.package_name, opts.hosted_path).href",
  ],
];
var napiPath = require.resolve("@mapbox/node-pre-gyp/lib/util/napi");
var napiSource = fs.readFileSync(napiPath, "utf8");
var napiBuildVersionsReplacement = [
  "module.exports.get_napi_build_versions = function(package_json, opts, warnings) { // opts may be undefined\n",
  'module.exports.get_napi_build_versions = function(package_json, opts, warnings) { // opts may be undefined\n  if (package_json.name === "muhammara" && package_json.binary.module_name === "muhammara") {\n    return undefined;\n  }\n',
];
var napiValidationReplacement = [
  "module.exports.validate_package_json = function(package_json, opts) { // throws Error\n",
  'module.exports.validate_package_json = function(package_json, opts) { // throws Error\n  if (package_json.name === "muhammara" && package_json.binary.module_name === "muhammara") {\n    return;\n  }\n',
];

replacements.forEach(function (replacement) {
  if (source.includes(replacement[1])) {
    return;
  }
  if (!source.includes(replacement[0])) {
    throw new Error(
      "Unsupported @mapbox/node-pre-gyp version: expected URL API usage was not found",
    );
  }
  source = source.replace(replacement[0], replacement[1]);
});

fs.writeFileSync(versioningPath, source);

// The published N-API metadata is for Turbopack's package parser. Muhammara
// remains a V8 addon, so node-pre-gyp must continue resolving Node-ABI builds.
[napiBuildVersionsReplacement, napiValidationReplacement].forEach(
  function (replacement) {
    if (napiSource.includes(replacement[1])) {
      return;
    }
    if (!napiSource.includes(replacement[0])) {
      throw new Error(
        "Unsupported @mapbox/node-pre-gyp version: expected N-API function was not found",
      );
    }
    napiSource = napiSource.replace(replacement[0], replacement[1]);
  },
);

fs.writeFileSync(napiPath, napiSource);
