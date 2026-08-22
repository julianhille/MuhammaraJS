# Update PDF Writer CI Integration

## 1. Preserve a recovery point

- [x] Create a backup branch from the current `feature/update-pdf-writer` HEAD before rewriting history.
- [x] Rebase and squash the retained changes onto `feature/update-pdf-writer` so GitHub Actions runs the consolidated CI workflow.
- [ ] Keep the backup branch until the workflow passes on GitHub Actions.

## 2. Keep the minimal OpenSSL packaging changes

- [x] Document in the README that source builds require OpenSSL headers and libraries to be reachable on every supported system and architecture.
- [x] Keep the removal of all Win32 (`ia32`) builds.
- [x] Retain the README Version 7.x breaking-change notice that Win32 (`ia32`) prebuilds and build tooling are removed and only x64/arm64 builds remain.
- [x] Add a Windows x64 packaging step to copy the matching `libcrypto-3*.dll` and `libssl-3*.dll` files from `OPENSSL_DIR/bin` to `binding/` after the native addon builds.
- [x] Fail the Windows build when either required DLL is missing.
- [x] Run the Windows Node test suite after copying the DLLs and before packaging the prebuild.
- [x] Retain the existing Electron install/build ordering unless a reproducible failure requires changing it.
- [x] Ensure a Windows source build copies the matching OpenSSL DLLs from `OPENSSL_DIR/bin` into `binding/` after compilation, so users do not need OpenSSL installed at runtime.
- [x] Update the README to distinguish the Windows source-build OpenSSL prerequisite from prebuilt runtime use, which must not require a system OpenSSL installation.

## 3. Exclude experimental remote changes

- [x] Do not restore the `ia32` build matrix or add a Win32 OpenSSL download/cache.
- [x] Do not retain architecture-inspection output or Win32-only addon-load diagnostics.
- [x] Do not retain experimental Electron installation/build reordering.

## 4. Verify OpenSSL licensing and artifacts

- [x] Record the exact bundled OpenSSL version in each Windows prebuilt archive and document the Apache-2.0 license.
- [x] Verify all required Apache-2.0 copyright and attribution notices.
- [x] Ensure every released prebuilt archive containing OpenSSL DLLs includes the applicable notice text.
- [x] Confirm that OpenSSL source distribution is not required for the shipped binaries under the applicable license.
- [ ] Inspect a generated Windows prebuilt archive to confirm it contains `muhammara.node`, the matching OpenSSL DLLs, `THIRD_PARTY_NOTICES.md`, and `OPENSSL_VERSION.txt`.

## 5. Validate

- [x] Run `npm run test:codestyle`.
- [x] Run the relevant local test suite where supported.
- [ ] Confirm GitHub Actions completes the Windows x64 Node and Electron build matrices successfully.
