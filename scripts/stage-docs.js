var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var docsRoot = path.join(root, "docs");
var stagingDirectory = path.join(docsRoot, ".staging");

fs.rmSync(stagingDirectory, { recursive: true, force: true });
fs.mkdirSync(stagingDirectory, { recursive: true });
["index.md", "development.md", "security.md"].forEach((file) => {
  fs.copyFileSync(path.join(docsRoot, file), path.join(stagingDirectory, file));
});
fs.cpSync(
  path.join(root, "packages/native-core/docs"),
  path.join(stagingDirectory, "native"),
  {
    recursive: true,
  },
);
fs.cpSync(
  path.join(root, "packages/wasm/docs"),
  path.join(stagingDirectory, "wasm"),
  {
    recursive: true,
  },
);
