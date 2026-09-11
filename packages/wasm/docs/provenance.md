# Documentation Sources

| Source                         | Status                         | Use                                                                          |
| ------------------------------ | ------------------------------ | ---------------------------------------------------------------------------- |
| `packages/wasm/README.md`      | Primary package source         | Installation, browser setup, and compatibility source material.              |
| `packages/wasm/CHANGELOG.md`   | Canonical for the Wasm package | Current WebAssembly release history.                                         |
| `packages/wasm/lib/`           | Primary implementation source  | Public byte-first and Recipe behavior.                                       |
| `packages/wasm/index.d.ts`     | Secondary source               | Public TypeScript surface to reconcile with implementation.                  |
| `packages/wasm/tests/`         | Primary verification source    | Executable behavior and browser-example candidates.                          |
| Native documentation and tests | Parity reference               | Equivalent behavior, where it does not depend on paths, streams, or OpenSSL. |
| GitHub issues and discussions  | Reviewed backlog source        | Identify documentation needs; independently author and verify guides.        |

Wasm documentation is authored from this repository's implementation and tests.
Native documentation is a useful parity source, but the Wasm site documents its
own byte-first API and its documented platform restrictions.
