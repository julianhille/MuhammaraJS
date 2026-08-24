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
