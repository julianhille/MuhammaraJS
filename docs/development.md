# Development Commands

Run these commands from the repository root unless a section says otherwise.

## Repository Setup

Install the Node.js workspaces and build the native addon when needed:

```sh
npm ci
```

Use `npm ci --ignore-scripts` when a workflow needs JavaScript dependencies but
must not run the native installation hook.

## Native Package

```sh
# Run the complete native test suite.
npm test

# Run one native test.
npx mocha packages/native-with-source/tests/SimpleTextUsageTest.js --timeout 15000

# Check formatting.
npm run test:codestyle

# Build a native prebuild with node-pre-gyp.
npm run package

# Produce slim and source-capable native publication tarballs.
npm pack --workspace=@muhammara/native-core
npm pack --workspace=@muhammara/native-with-source
npm pack --workspace=@muhammara/native

# Execute documentation examples.
npm run test:docs
```

## Documentation

Create a Python virtual environment and install MkDocs with the repository's
pinned documentation dependencies:

```sh
python -m venv .docs-venv
source .docs-venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r docs/requirements.txt
```

On Windows PowerShell, activate the environment with:

```powershell
.docs-venv\Scripts\Activate.ps1
```

Generate references, stage package-local documentation, and work with MkDocs:

```sh
# Generate API reference pages.
npm run docs:generate

# Recreate the ignored docs/.staging source tree.
npm run docs:stage

# Build the site.
npm run docs:build

# Build strictly and fail on warnings.
npm run docs:check

# Serve with live reload at http://127.0.0.1:8000/.
npm run docs:serve
```

Never edit or commit `docs/.staging/` or `site/`; both are generated outputs.

## Release Tags

Normal package tags trigger validation and publication. The package version must
match the version in the tag. A native release builds its prebuilds once, then
publishes `@muhammara/native-core`, then `@muhammara/native-with-source`, before
the smaller prebuilt-only `@muhammara/native` package. Native packages use npm
trusted publishing through GitHub Actions OIDC and do not require an npm token.

Before the first native release, configure npm trusted publishers for all three
scoped native packages. Each publisher must trust this repository's native
release workflow and its release environment. After the first successful
replacement release, deprecate every published unscoped version without
publishing another `muhammara` package:

```sh
npm deprecate 'muhammara@*' 'Deprecated: use @muhammara/native for prebuilt binaries or @muhammara/native-with-source for local builds.'
```

```sh
# Native release example.
git tag native-v7.0.0
git push origin native-v7.0.0
```

After successful publication, the workflows automatically create matching
`native-doc-v<version>` documentation tag. A later
documentation-only correction can be tagged without rebuilding or publishing a
package:

```sh
git tag native-doc-v7.0.0.1
git push origin native-doc-v7.0.0.1
```

Documentation tags trigger only the documentation workflow.
