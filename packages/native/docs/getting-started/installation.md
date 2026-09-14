# Installation

Install MuhammaraJS from npm:

```sh
npm install @muhammara/native
```

This small package requires a matching prebuilt binary. For a local source
build, install the source-capable package instead:

```sh
npm install @muhammara/native-with-source
```

Both packages contain the same API and native prebuild metadata.
`@muhammara/native-with-source` also contains the C++ source tree and is cached
normally by npm. `@muhammara/native` intentionally does not fetch or cache a
source fallback.

## Install As An Npm Alias

Keep an existing `require("@muhammara/native")` import while selecting the
source-capable package with an npm alias:

```sh
npm install @muhammara/native@npm:@muhammara/native-with-source@<version>
```

## pnpm 10 And Later

pnpm 10 and later do not run dependency lifecycle scripts by default. MuhammaraJS
needs its install script to acquire or build its native addon. Add the selected
native package to `pnpm.onlyBuiltDependencies`, or run `pnpm approve-builds` and
approve it.

## Building From Source

Official prebuilds statically link OpenSSL `libcrypto` and do not require a
system OpenSSL installation at runtime.

`@muhammara/native-with-source` builds its bundled OpenSSL 3 source automatically
as part of the GYP build when a local native build is needed. Building requires the platform C/C++ toolchain,
Perl and `make` on Unix-like systems or Perl, NMake, and Visual Studio Build
Tools on Windows; no `OPENSSL_LIB_DIR`, `CPPFLAGS`, or separate OpenSSL
installation is required.

### Perl Packages On RPM Distributions

RPM-based distributions such as Fedora, RHEL, and openSUSE split the Perl core
library into separate packages. OpenSSL's `./Configure` and the generated
makefile need several of them, and `scripts/build-openssl.sh` needs one more.
Install them alongside `perl`:

```sh
dnf install perl-FindBin perl-lib perl-IPC-Cmd perl-File-Compare \
  perl-File-Copy perl-Time-Piece perl-Digest-SHA
```

| Package             | Needed by                                                |
| ------------------- | -------------------------------------------------------- |
| `perl-FindBin`      | OpenSSL `./Configure`                                    |
| `perl-lib`          | OpenSSL `./Configure`                                    |
| `perl-IPC-Cmd`      | OpenSSL `./Configure`                                    |
| `perl-File-Compare` | OpenSSL configuration and build file generation          |
| `perl-File-Copy`    | OpenSSL configuration and build file generation          |
| `perl-Time-Piece`   | OpenSSL's generated `Makefile`                           |
| `perl-Digest-SHA`   | `shasum`, used by `build-openssl.sh` for its build stamp |

Every package in this list was verified as blocking on a clean Fedora 44
container with only `perl-interpreter` installed: each was added in turn as the
build reported it missing, and with all of them installed the bundled OpenSSL
3.5.4 configures and builds `libcrypto.a` to completion.

Install the whole list at once. OpenSSL's `./Configure` reports only the first
module it cannot find, so a single error message is not the whole requirement
and fixing one error simply reveals the next:

```
Can't locate FindBin.pm in @INC (you may need to install the FindBin module) at ./Configure line 15.
```

```
Can't locate Time/Piece.pm in @INC (you may need to install the Time::Piece module) at Makefile.in line 37.
```

Missing `perl-Digest-SHA` fails differently, in `build-openssl.sh` rather than
in OpenSSL, because the script calls `shasum` before it configures anything.

Debian and Ubuntu ship these modules with `perl` itself, so no extra packages
are needed there.

On Unix-like systems, optionally set `CC="ccache cc"` and `CXX="ccache c++"` to
speed up repeated source builds when `ccache` is installed.

After a successful source build, source-capable package users can remove the C++
source tree before packaging their application:

```sh
muhammara-clean-source
```

The compiled addon remains usable. Reinstall `@muhammara/native-with-source`
before any later Node.js or Electron rebuild; `npm ci` restores the package from
npm's normal cache.

## Prebuilt Support Matrix

Prebuilt binaries are published with release tags for the combinations built by
the release workflow. Install normally with npm when your runtime is listed. For
any other platform, architecture, runtime, or libc combination, install
`@muhammara/native-with-source` to build locally.

| Runtime  | Versions built        | Operating system and architecture | Prebuilt binary    |
| -------- | --------------------- | --------------------------------- | ------------------ |
| Node.js  | 20, 22, 24, 25, 26    | Linux glibc x64 and arm64         | Yes                |
| Node.js  | 20, 22, 24, 25, 26    | Linux musl x64 and arm64          | Yes                |
| Node.js  | 20, 22, 24, 25, 26    | macOS x64 and arm64               | Yes                |
| Node.js  | 20, 22, 24, 25, 26    | Windows x64                       | Yes                |
| Node.js  | Any other combination | Any                               | Use source package |
| Electron | 36.0 through 44.0     | Linux x64                         | Yes                |
| Electron | 36.0 through 44.0     | macOS arm64                       | Yes                |
| Electron | 36.0 through 38.1     | macOS x64                         | Yes                |
| Electron | 36.0 through 44.0     | Windows x64                       | Yes                |
| Electron | Any other combination | Any                               | Use source package |

Windows arm64 and Linux arm64 Electron builds are not part of the current
prebuilt matrix, and macOS x64 Electron builds cover only 36.0 through 38.1.
The package `engines` field is the authoritative
Node.js version policy; this table describes the release workflow's binary
coverage.

The binary is selected for the machine running the install, not for the machine
that will run the application. Installing on Windows or macOS and deploying that
`node_modules` directory to a Linux target such as AWS Lambda ships an
unloadable binary. Set `npm_config_target`, `npm_config_target_platform`,
`npm_config_target_arch`, and `npm_config_target_libc` to install a different
Node.js version's or platform's published binary instead; see
[Deploy To AWS Lambda](../how-to/deploy-to-aws-lambda.md) for the runtime
mapping and the constraints that apply.

## Electron Support Policy

Use the source-capable package before running `@electron/rebuild`, because the
rebuild tool runs `node-gyp` directly and needs the bundled source tree:

```sh
npm install @muhammara/native@npm:@muhammara/native-with-source@<version>
CC="ccache cc" CXX="ccache c++" npx electron-rebuild -f -w @muhammara/native
```

The `CC` and `CXX` wrappers are optional; omit them when `ccache` is unavailable
or a different compiler/cache wrapper is required.

MuhammaraJS follows Electron's release cycle. Prebuilt Electron support is
limited to current Electron versions in the release matrix. Each new MuhammaraJS
major release removes Electron versions that are no longer supported by Electron
and adds current versions after their build coverage is verified.

Electron 36.x through 41.x builds are deprecated. They remain in this release's
matrix for compatibility and will be removed in the next MuhammaraJS major
release.
