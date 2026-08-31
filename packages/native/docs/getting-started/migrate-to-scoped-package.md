# Migrate To `@muhammara/native`

MuhammaraJS is moving its maintained packages under the `@muhammara`
organization. The scoped native package and the compatibility package contain
the same API, version, source, TypeScript declarations, and native binaries.

Replace the dependency:

```sh
npm uninstall muhammara
npm install @muhammara/native
```

Then change the module name in imports:

```javascript
var muhammara = require("@muhammara/native");
```

No PDF API changes are required. Lockfiles will change because npm treats the
two names as distinct packages. Do not install both names in one application;
that can install and initialize two copies of the same native addon.

The unscoped `muhammara` package continues to receive matching releases during
the transition so existing applications are not forced to migrate immediately.
New applications and documentation examples use `@muhammara/native`.
