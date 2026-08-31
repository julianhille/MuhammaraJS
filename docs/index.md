# MuhammaraJS Documentation

MuhammaraJS is available as two deliberately different packages:

- [Native Node.js](native/index.md), published as `@muhammara/native` with
  `muhammara` retained as a compatibility package, provides the Node/V8 binding
  and its filesystem and stream APIs.
- [WebAssembly](wasm/index.md), published as `@muhammara/wasm`, provides an
  asynchronous, browser-safe API that reads and writes in-memory bytes.

Choose the package that matches the runtime rather than mixing their examples.
The navigation keeps their guides and references separate.

## Documentation Versions

`latest` tracks the `develop` branch and can include unreleased behavior. Each
normal release tag has its own documentation version. After a release, its tag
is made the default Read the Docs version while `latest` continues to track
development.

For current release history, read the
[Changelog on GitHub](https://github.com/julianhille/MuhammaraJS/blob/develop/CHANGELOG.md).

## Documentation Sources

Package documentation is maintained beside its implementation in
`packages/native/docs/` and `packages/wasm/docs/`. The site stages those sources
into an ignored `docs/.staging/` directory before MkDocs builds it; do not edit
the staged files.
