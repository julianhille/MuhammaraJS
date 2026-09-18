# Load The WebAssembly Binary From A CDN Or Your Own Bytes

By default the package loads `muhammara-wasm.wasm` from next to its own module
through `import.meta.url`. Bundlers such as Vite and webpack detect that
reference and emit the file, and under Node it is read from the installed
package, so most applications need no loading options at all.

Use the options below when the binary has to come from somewhere else. Both
`createMuhammaraWasm()` and `createRecipe()` accept them.

## Serve The Binary From A CDN Or Another Path

Return the URL from `locateFile`. In pages and Workers the package fetches it
and compiles the module while it downloads:

```javascript
import { createRecipe } from "@muhammara/wasm";

var wasmUrl =
  "https://cdn.example.com/muhammara-wasm/1.0.0-beta.3/muhammara-wasm.wasm";

var Recipe = await createRecipe({
  locateFile: (path) => (path.endsWith(".wasm") ? wasmUrl : path),
});
```

`locateFile` receives the requested file name, `muhammara-wasm.wasm`, and the
directory the package would otherwise use. Return other paths unchanged.

The package always fetches with `credentials: "same-origin"`, so cookies are not
sent to another origin. Use `wasmBinary` when the request needs cookies,
authorization headers, or other custom options.

## Supply Bytes You Retrieved Yourself

Pass the binary as a `Uint8Array` or `ArrayBuffer` in `wasmBinary`. Nothing is
fetched or read, and `locateFile`'s result for the binary is ignored:

```javascript
import { createMuhammaraWasm } from "@muhammara/wasm";

var response = await fetch(wasmUrl, {
  headers: { authorization: `Bearer ${token}` },
});
if (!response.ok) throw new Error(`Could not load ${wasmUrl}`);

var muhammara = await createMuhammaraWasm({
  wasmBinary: await response.arrayBuffer(),
});
```

To keep the binary across visits, store it with the Cache API. Put the package
version in the cache name so an upgrade never pairs new JavaScript with an old
binary:

```javascript
var cache = await caches.open("muhammara-wasm-1.0.0-beta.3");
var cached = await cache.match(wasmUrl);
if (!cached) {
  await cache.add(wasmUrl);
  cached = await cache.match(wasmUrl);
}

var muhammara = await createMuhammaraWasm({
  wasmBinary: await cached.arrayBuffer(),
});
```

A binary the user selects, such as one from `<input type="file">`, works the
same way. Read `Blob` and `File` objects with `arrayBuffer()` first:

```javascript
var muhammara = await createMuhammaraWasm({
  wasmBinary: await input.files[0].arrayBuffer(),
});
```

Other typed arrays, `DataView`, `Blob`, and `File` objects are rejected with
`TypeError: wasmBinary must be a Uint8Array or ArrayBuffer`. The byte budgets in
`limits` apply to PDF and asset inputs, not to the binary.

## Load A Remote Binary Under Node

Under Node, `locateFile` accepts file paths and `file:` URLs only. Fetch a
binary served over `https:` yourself and pass the bytes:

```javascript
import { createMuhammaraWasm } from "@muhammara/wasm";

var response = await fetch(wasmUrl);
var muhammara = await createMuhammaraWasm({
  wasmBinary: new Uint8Array(await response.arrayBuffer()),
});
```

## Serve The Binary Correctly

- **Use the same version.** The binary must come from the same
  `@muhammara/wasm` version as the JavaScript that loads it. A mismatched binary
  can fail during instantiation or misbehave later. Copy it from `dist/muhammara-wasm.wasm` in the
  installed package whenever you upgrade.
- **Allow cross-origin requests.** A binary on another origin must be served
  with `Access-Control-Allow-Origin`, whether the package or your code fetches
  it.
- **Send the WebAssembly MIME type.** Serve the file as `application/wasm`.
  Otherwise the package logs a warning and downloads the whole file before
  compiling it, which is slower but still works.
- **Update the Content Security Policy.** A strict policy must list the host
  under `connect-src` and allow compilation with `'wasm-unsafe-eval'` in
  `script-src`.

See [Browser Setup](../browser-setup.md) for installing the package and the
[API Reference](../reference.md) for the `MuhammaraWasmOptions` declaration.
