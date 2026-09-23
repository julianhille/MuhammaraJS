# Deploy To AWS Lambda

`@muhammara/native` resolves its prebuilt binary while it installs, and it
resolves the one that matches the machine running the install. Installing on
Windows or macOS and uploading that `node_modules` directory to AWS Lambda
therefore ships a binary the runtime cannot load, and the deployment fails at
`require()` rather than at install time.

No extra package or manual binary copying is needed to fix this. Every binary
the runtime needs is already published; the install just has to be told which
one to fetch.

## Install The Target Platform's Prebuilt

The install script delegates to `@mapbox/node-pre-gyp`, which selects the
Node-API 8 download from three target settings: `target_platform`,
`target_arch`, and `target_libc`. Set them as environment variables and install
normally. The same archive supports every Node.js version in the package's
supported range:

```sh
npm_config_target_platform=linux \
npm_config_target_arch=x64 \
npm_config_target_libc=glibc \
npm install @muhammara/native
```

On Windows PowerShell:

```powershell
$env:npm_config_target_platform = "linux"
$env:npm_config_target_arch = "x64"
$env:npm_config_target_libc = "glibc"
npm install @muhammara/native
```

The bundle that install produces is ready to zip and upload. Nothing is copied
or replaced afterwards.

### Node.js Versions Share One Binary

MuhammaraJS targets Node-API 8 rather than a runtime-specific Node.js ABI.
`npm_config_target` is therefore unnecessary for selecting its prebuild: Node.js
20, 22, 24, and later supported releases use the same archive for a given
platform, architecture, and libc. For example, every supported Linux x64 Lambda
runtime uses `napi-v8-linux-x64-glibc.tar.gz`.

### The Installed Tree Is A Deployment Artifact

The overridden install writes a binary for the target platform, so the tree it
produces will not load on the machine that produced it. Install again without
the overrides to get a working local checkout back, and keep the two installs
apart in any workflow that also runs tests locally.

### A Note On npm Deprecation Warnings

npm 11 does not recognize these three settings as its own configuration and
warns about each one, whether it receives them from the environment, from
command-line flags such as `--target_arch=x64`, or from an `.npmrc` file:

```
npm warn Unknown env config "target-arch". This will stop working in the next major version of npm.
```

All three forms work today. Prefer the environment variables, because they are
the form that does not depend on npm: node-pre-gyp scans the process
environment for `npm_config_*` names itself rather than receiving them through
npm's configuration system.

## Match The Runtime

| Lambda runtime | Node.js major | Node-API prebuild            |
| -------------- | ------------- | ---------------------------- |
| `nodejs20.x`   | 20            | `napi-v8-linux-{arch}-glibc` |
| `nodejs22.x`   | 22            | `napi-v8-linux-{arch}-glibc` |

The function's architecture setting maps directly to `target_arch`: `x86_64` is
`x64`, and `arm64` is `arm64`.

Both runtimes are Amazon Linux 2023 images and use glibc, so `glibc` is the
correct `target_libc`. The published Linux binaries are built against an older
glibc than Amazon Linux 2023 provides, so they load on these runtimes without a
build inside the Lambda image. The
[Prebuilt Support Matrix](../getting-started/installation.md#prebuilt-support-matrix)
lists every combination the release workflow publishes, including `arm64` for
Graviton functions.

## Container Image Deployments

Lambda container images can be based on any Linux distribution. For an
Alpine-based image, request the musl binary:

```sh
npm_config_target_platform=linux \
npm_config_target_arch=x64 \
npm_config_target_libc=musl \
npm install @muhammara/native
```

A `RUN npm ci` step inside the Dockerfile installs on the target platform
already and needs no overrides at all.

## Installing On Linux Instead

The overrides above cover MuhammaraJS. They do not cover any other native
dependency in the same bundle, and each such package has its own opinion about
cross-platform installs. When a project has several, installing everything on
the target platform is the simpler guarantee:

```sh
docker run --rm --platform linux/amd64 -v "$PWD":/var/task \
  --entrypoint npm public.ecr.aws/lambda/nodejs:22 install --omit=dev
```

Use `--platform linux/arm64` for `arm64` functions. WSL, a Linux CI job, and
the container bundling in AWS SAM or the AWS CDK `NodejsFunction` construct
achieve the same result.

## Avoiding The Platform Question Entirely

[`@muhammara/wasm`](https://muhammarajs-wasm.readthedocs.io/) contains no native
binary. One installed copy runs on every runtime, architecture, and libc, so a
bundle built on Windows deploys to Lambda unchanged.

It is a separate package rather than a drop-in replacement. It is byte-first:
filesystem paths, Node.js streams, and OpenSSL-backed encryption are
unavailable, and its performance profile differs from the native addon. Weigh
those differences against the deployment simplification it provides.

## The `lambda-muhammara` Package

Some projects reached Lambda through
[`lambda-muhammara`](https://www.npmjs.com/package/lambda-muhammara), a
third-party package that carries a single Linux x64 binary to copy over the one
npm installed. It predates the current prebuilt coverage and is not needed for
`@muhammara/native`: its published versions pin an exact `muhammara` version and
therefore lag releases, it offers x64 only, and its copy instructions target the
unscoped `node_modules/muhammara/binding/` path that the scoped package no
longer uses. Use the overrides above instead.

## Binary Resolution Examples

The overrides on this page were verified on Linux x64. For example,
`target_platform=win32` selects a Windows PE32+ binary from
`napi-v8-win32-x64-unknown.tar.gz`, while `target_platform=linux` with
`target_arch=arm64` selects `napi-v8-linux-arm64-glibc.tar.gz` and produces an
ELF aarch64 binary. The Node.js version running npm does not change either
filename.

AWS runtime details are current as of this page's last revision and are
maintained by AWS, not by this project.
