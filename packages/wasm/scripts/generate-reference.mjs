import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

var packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
var declarations = fs.readFileSync(
  path.join(packageRoot, "index.d.ts"),
  "utf8",
);

fs.writeFileSync(
  path.join(packageRoot, "docs/reference.md"),
  [
    "# API Reference",
    "",
    "This generated reference is the public TypeScript contract exported by",
    "`@muhammara/wasm`. It is useful for finding signatures, overloads, and",
    "option fields. Behavioral guidance is covered by the curated API pages.",
    "",
    "```typescript",
    declarations.trim(),
    "```",
    "",
  ].join("\n"),
);
