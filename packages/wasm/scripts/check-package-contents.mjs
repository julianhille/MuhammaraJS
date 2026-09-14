import { readFile } from "node:fs/promises";

var required = [
  "dist/muhammara-wasm.js",
  "dist/muhammara-wasm.wasm",
  "fonts/Roboto-Regular.js",
  "index.d.ts",
  "index.js",
  "lib/recipe.js",
];
var chunks = [];
for await (var chunk of process.stdin) chunks.push(chunk);
var input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
var files = new Set(input[0].files.map((file) => file.path));
var missing = required.filter((filename) => !files.has(filename));
var packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
var readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
var exampleUrl = `wasm/browser-example/${packageJson.version}/index.html`;
var forbidden = [...files].filter((filename) => {
  return (
    filename === "CMakeLists.txt" ||
    filename === "build.sh" ||
    filename.startsWith("examples/") ||
    filename.startsWith("scripts/") ||
    filename.startsWith("src/") ||
    filename.startsWith("vendor/") ||
    /\.(?:c|cc|cpp|cxx|h|hh|hpp)$/.test(filename)
  );
});
if (missing.length || forbidden.length || !readme.includes(exampleUrl)) {
  throw new Error(
    [
      missing.length ? `Missing package files: ${missing.join(", ")}` : "",
      forbidden.length
        ? `Development package files: ${forbidden.join(", ")}`
        : "",
      readme.includes(exampleUrl)
        ? ""
        : `README browser example does not match package version: ${exampleUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}
