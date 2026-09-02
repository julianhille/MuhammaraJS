# Read the Docs Versioning

## Decision

Read the Docs, not GitHub Actions, publishes the documentation site. Its GitHub
integration automatically builds `latest` from the `develop` branch after each
merge. GitHub Actions only validates the documentation before it merges.

Neither a documentation-only change nor a documentation deployment changes the
`muhammara` or `@muhammara/wasm` npm package version, creates an npm release, or
requires a manual documentation-publish workflow.

## Required Read the Docs Configuration

The `muhammarajs` project must keep `develop` as the branch tracked by its
`latest` documentation version. Add Read the Docs automation rules that activate
new tag versions matching these repository release tag prefixes:

```text
^native-v
^wasm-v
```

Each rule applies to the `Tag` version type and uses the `Activate version`
action. Read the Docs then clones and builds the pushed tag itself using
`.readthedocs.yaml` and `mkdocs.yml`.

## Repository Responsibilities

- `.github/workflows/docs.yml` validates documentation only; it must not invoke
  the Read the Docs API or any npm publish command.
- `.readthedocs.yaml` stages the package-owned native and Wasm documentation
  before MkDocs builds the combined site.
- `npm run docs:check` remains the pre-merge verification command.
- `native-v*` and `wasm-v*` documentation versions are independent snapshots.
  Their custom tag prefixes do not automatically select Read the Docs `stable`;
  `latest` remains the `develop` documentation build.

## Follow-Up Tasks

- [ ] Create a separate `muhammara-wasm` Read the Docs project at
      `https://muhammara-wasm.readthedocs.io/`. Add Wasm-specific Read the Docs
      and MkDocs configuration that builds only `packages/wasm/docs`, update the
      Wasm package metadata and documentation links to the new site, and
      configure the external Read the Docs project to use that config and
      activate `wasm-doc-v*` tags. Keep native documentation on its own project
      and verify the new URL before publishing links; it currently returns 404.
- [ ] Add a native Development documentation page and place it in the native
      Project navigation. Document the repository-local `.docs-venv`, pinned
      MkDocs installation from `docs/requirements.txt`, strict build and local
      server commands, native build/test/package commands, and the
      `native-v*`/`native-doc-v*` release and documentation-tag behavior. Keep
      this guidance aligned with the corresponding Wasm development and shared
      Development Commands pages.
