# MuhammaraJS

`@muhammara/native` is the Node.js native addon for creating, reading, and
modifying PDF files and streams.

```sh
npm install @muhammara/native
```

The project is transitioning from the unscoped `muhammara` package to the
`@muhammara` organization. `muhammara` remains available as a compatibility
package during the transition and receives the same code, versions, and native
binaries. New applications should use `@muhammara/native`.

Installation downloads a matching prebuilt binary when available. Otherwise,
`node-pre-gyp` compiles the bundled `src/` tree with the local Node.js build
toolchain. See the repository for supported platforms and build requirements:
<https://github.com/julianhille/MuhammaraJS>.
