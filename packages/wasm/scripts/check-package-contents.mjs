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
if (missing.length || forbidden.length) {
  throw new Error(
    [
      missing.length ? `Missing package files: ${missing.join(", ")}` : "",
      forbidden.length
        ? `Development package files: ${forbidden.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}
