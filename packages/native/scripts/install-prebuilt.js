"use strict";

var childProcess = require("child_process");

var result = childProcess.spawnSync(
  process.execPath,
  [require.resolve("@mapbox/node-pre-gyp/bin/node-pre-gyp"), "install"],
  { stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  console.error(
    "No compatible MuhammaraJS prebuilt binary is available. Install @muhammara/native-with-source to build locally:\n" +
      "  npm install @muhammara/native@npm:@muhammara/native-with-source@" +
      require("../package.json").version,
  );
  process.exit(result.status || 1);
}
