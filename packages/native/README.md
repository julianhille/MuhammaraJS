# MuhammaraJS

`@muhammara/native` and `@muhammara/native-with-source` are Node.js native
addons for creating, reading, and modifying PDF files and streams.

```sh
npm install @muhammara/native
```

Use `@muhammara/native-with-source` when a local source build or Electron
rebuild is required:

```sh
npm install @muhammara/native-with-source
```

Both packages expose the same API. The source-capable package downloads a
matching prebuilt binary when available and otherwise compiles its bundled
`src/` tree with the local Node.js build toolchain. It is cached normally by
npm; the small package does not download or cache source files.

After a successful source build, remove the source tree before packaging an
application with:

```sh
muhammara-clean-source
```

The compiled addon remains usable. Rebuilds, including `@electron/rebuild`,
require the source tree, so reinstall `@muhammara/native-with-source` before
rebuilding. `npm ci` restores it from npm's normal package cache.

To keep an existing `require("@muhammara/native")` import while selecting the
source-capable package, install it as an npm alias:

```sh
npm install @muhammara/native@npm:@muhammara/native-with-source@<version>
```
