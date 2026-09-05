# Migrate From v6 To v7

v7 replaces the single unscoped `muhammara` package with packages published
under the `@muhammara` organization on npm:

| Package                         | Contents                                                              |
| ------------------------------- | --------------------------------------------------------------------- |
| `@muhammara/native`             | Prebuilt native addon only                                            |
| `@muhammara/native-with-source` | Native addon plus the C++ source tree for local and Electron builds   |
| `@muhammara/native-core`        | Shared JavaScript layer; a dependency of both, never installed direct |

The PDF API is unchanged between v6 and v7. For Node.js applications the
migration is a dependency rename, an import rename, and a check that a prebuilt
binary still exists for your platform.

## 1. Choose The Replacement Package

| v6 usage                                                                                  | v7 package                      |
| ----------------------------------------------------------------------------------------- | ------------------------------- |
| `npm install muhammara` on a platform with a matching prebuilt binary                     | `@muhammara/native`             |
| Installs that compiled locally, Electron rebuilds, or platforms without a prebuilt binary | `@muhammara/native-with-source` |

Both native packages expose the same API, the same TypeScript declarations, and
the same native binary metadata. They differ only in whether the C++ source is
included.

v6 shipped the prebuilt binaries and the C++ source in one package, so an
install without a matching prebuilt binary compiled from source. v7 separates
the two. `@muhammara/native` fails installation with a pointer to
`@muhammara/native-with-source` when no prebuilt binary matches; it never
compiles.

## 2. Replace The Dependency

```sh
npm uninstall muhammara
npm install @muhammara/native
```

Use the source-capable package instead when a matching prebuilt binary is
unavailable or Electron must rebuild the addon:

```sh
npm install @muhammara/native-with-source
```

To keep the scoped import name while using the source-capable package, use an
npm alias:

```sh
npm install @muhammara/native@npm:@muhammara/native-with-source@<version>
```

## 3. Update Imports

```javascript
// v6
var muhammara = require("muhammara");
var Recipe = require("muhammara").Recipe;

// v7
var muhammara = require("@muhammara/native");
var Recipe = require("@muhammara/native").Recipe;
```

`Recipe` remains bundled, so no separate `hummus-recipe` or `muhammara-recipe`
package is needed.

The shared JavaScript layer now lives in `@muhammara/native-core`, which both
native packages install as a dependency. Paths under `muhammara/lib/` were never
public API and have no direct v7 equivalent. Do not import
`@muhammara/native-core` from an application; it needs an addon supplied by an
implementation package.

### Stage The Rename

To postpone the import changes, alias the old package name. Existing
`require("muhammara")` calls keep working while the dependency is already v7:

```sh
npm install muhammara@npm:@muhammara/native@<version>
```

Treat this as a temporary step. The alias hides the package name from the
dependency tree and makes future upgrades harder to reason about.

## 4. Update TypeScript Imports

v6 shipped an ambient `declare module "muhammara"` block. v7 attaches the
declarations to each package, exports them with `export =`, and defines no
global namespace:

```typescript
import muhammara = require("@muhammara/native");

declare const writer: muhammara.PDFWriter;
declare const recipe: muhammara.Recipe;
```

Code that relied on the ambient declaration being visible without importing the
package fails to compile and needs an explicit import.

## 5. Confirm Prebuilt Coverage

Node.js version support is unchanged: `20 || 22 || 24 || >=25` in both v6 and
v7.

Check that your platform, architecture, and runtime are listed in the
[prebuilt support matrix](installation.md#prebuilt-support-matrix). Install
`@muhammara/native-with-source` for any combination that is not.

## 6. Rebuild Electron Applications

Electron applications must install the source-capable package before running
`@electron/rebuild`, because the rebuild tool runs `node-gyp` directly and needs
the bundled source tree. See the
[Electron support policy](installation.md#electron-support-policy).

## What Does Not Change

- The low-level API and the Recipe API, including their TypeScript types.
- Supported Node.js versions.
- Native binary metadata and the `node-pre-gyp` install flow.

## Version 6 Status

The unscoped `muhammara` package is deprecated and receives no further releases.
Existing v6 installations keep working; it is simply a different package from
`@muhammara/native`.

For the full list of compatibility changes, see
[Breaking Changes](../breaking-changes.md).
