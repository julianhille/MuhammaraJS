# Documentation Sources

| Source                                | Status                           | Use                                                                              |
| ------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| `packages/native/README.md`           | Primary package source           | Installation, package selection, and compatibility source material.              |
| `CHANGELOG.md`                        | Canonical for the native package | Current native release history.                                                  |
| `packages/native-core/lib/`           | Primary implementation source    | Public Recipe and low-level API behavior.                                        |
| `packages/native-core/muhammara.d.ts` | Secondary source                 | Public TypeScript surface to reconcile with implementation.                      |
| `packages/native-with-source/tests/`  | Primary verification source      | Executable behavior and documentation examples.                                  |
| Wasm documentation and tests          | Parity reference                 | Equivalent behavior, where it does not depend on the filesystem or Node.js APIs. |
| GitHub issues and discussions         | Reviewed backlog source          | Identify documentation needs; independently author and verify guides.            |

Native documentation is authored from this repository's implementation and
tests. Wasm documentation is a useful parity source, but the native site
documents its own path- and stream-based API and its documented platform
support.
