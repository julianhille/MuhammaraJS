#!/usr/bin/env sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
image=emscripten/emsdk:3.1.74@sha256:af45409f3199d88db4b1b03af0098532c8fb33a375ac257463eeb0a622870d06
sanitize=${MUHAMMARA_WASM_SANITIZE:-OFF}
buildType=${MUHAMMARA_WASM_BUILD_TYPE:-Release}
# Sanitizer and normal builds use incompatible objects, so they never share a
# CMake tree or a compiler cache.
configuration=$(printf '%s' "$buildType-sanitize-$sanitize" | tr 'A-Z' 'a-z')
build="$root/packages/wasm/build/$configuration"
dist="$root/packages/wasm/dist"
ccache="${MUHAMMARA_WASM_CCACHE_DIR:-$root/packages/wasm/.ccache}/$configuration"

# CI restores the compiler cache before Docker is involved, so the directories
# are reported by the script that owns their layout instead of being repeated
# in the workflow.
if [ $# -gt 0 ]; then
  case $1 in
  --print-build-directory)
    printf '%s\n' "$build"
    exit 0
    ;;
  --print-cache-directory)
    printf '%s\n' "$ccache"
    exit 0
    ;;
  *)
    echo "usage: build.sh [--print-build-directory|--print-cache-directory]" >&2
    exit 2
    ;;
  esac
fi

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Muhammara Wasm builds require a usable Docker daemon; see packages/wasm/docs/development.md." >&2
  exit 1
fi

# The pinned Emscripten image ships no ccache, so compiler caching runs in a
# thin layer on top of it. The tag follows the pinned digest: bumping the image
# builds a new toolchain instead of reusing the previous one.
toolchain=$image
if [ "${MUHAMMARA_WASM_CCACHE:-ON}" != "OFF" ]; then
  digest=${image##*@sha256:}
  toolchainTag="muhammara-wasm-emsdk-ccache:$(printf '%s' "$digest" | cut -c1-12)"
  if docker image inspect "$toolchainTag" >/dev/null 2>&1; then
    toolchain=$toolchainTag
  elif printf '%s\n' \
    "FROM $image" \
    "RUN apt-get update && apt-get install -y --no-install-recommends ccache && rm -rf /var/lib/apt/lists/*" |
    docker build -t "$toolchainTag" - >&2; then
    toolchain=$toolchainTag
  else
    echo "Could not build the ccache toolchain image; continuing without a compiler cache." >&2
  fi
fi

mkdir -p "$build" "$dist"
if [ "$toolchain" = "$image" ]; then
  set --
else
  mkdir -p "$ccache"
  set -- \
    --mount "type=bind,src=$ccache,dst=/ccache" \
    -e CCACHE_DIR=/ccache \
    -e CCACHE_MAXSIZE="${MUHAMMARA_WASM_CCACHE_MAXSIZE:-1G}" \
    -e EM_COMPILER_WRAPPER=ccache
fi

docker run --rm \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$root,dst=/src,readonly" \
  --mount "type=bind,src=$build,dst=/build" \
  --mount "type=bind,src=$dist,dst=/out" \
  -e MUHAMMARA_WASM_BUILD_TYPE="$buildType" \
  -e MUHAMMARA_WASM_SANITIZE="$sanitize" \
  "$@" \
  -w /build \
  "$toolchain" \
  sh -c 'set -eu
emcmake cmake -S /src/packages/wasm -B /build -DCMAKE_BUILD_TYPE="$MUHAMMARA_WASM_BUILD_TYPE" -DMUHAMMARA_WASM_SANITIZE="$MUHAMMARA_WASM_SANITIZE" -DPDFHUMMUS_NO_OPENSSL=ON
cmake --build /build --target muhammara-wasm --parallel
cp /build/muhammara-wasm.js /build/muhammara-wasm.wasm /out/
if command -v ccache >/dev/null 2>&1; then ccache --show-stats; fi'
