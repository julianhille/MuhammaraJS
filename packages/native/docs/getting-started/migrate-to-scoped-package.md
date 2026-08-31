# Migrate To `@muhammara/native`

MuhammaraJS maintains two scoped native packages with the same API, TypeScript
declarations, and native binary metadata. `@muhammara/native` is prebuilt-only;
`@muhammara/native-with-source` also contains the C++ source tree for local
builds.

Replace the dependency:

```sh
npm uninstall muhammara
npm install @muhammara/native
```

Then change the module name in imports:

```javascript
var muhammara = require("@muhammara/native");
```

No PDF API changes are required. Use the source-capable package instead when a
matching prebuild is unavailable or Electron must rebuild the addon:

```sh
npm install @muhammara/native-with-source
```

To keep the scoped import name while using the source-capable package, use an
npm alias:

```sh
npm install @muhammara/native@npm:@muhammara/native-with-source@<version>
```

The unscoped package is deprecated and receives no further releases. Existing
applications can temporarily preserve `require("muhammara")` with an alias:

```sh
npm install muhammara@npm:@muhammara/native@<version>
```
