#!/usr/bin/env sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
image=emscripten/emsdk:3.1.74@sha256:af45409f3199d88db4b1b03af0098532c8fb33a375ac257463eeb0a622870d06
build="$root/packages/wasm/build"
dist="$root/packages/wasm/dist"
sanitize=${MUHAMMARA_WASM_SANITIZE:-OFF}

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Muhammara Wasm builds require a usable Docker daemon; see packages/wasm/docs/development.md." >&2
  exit 1
fi

mkdir -p "$build" "$dist"
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$root,dst=/src,readonly" \
  --mount "type=bind,src=$build,dst=/build" \
  --mount "type=bind,src=$dist,dst=/out" \
  -w /build \
  "$image" \
  sh -c "emcmake cmake -S /src/packages/wasm -B /build -DCMAKE_BUILD_TYPE=Release -DMUHAMMARA_WASM_SANITIZE=$sanitize &&
    cmake --build /build --target muhammara-wasm --parallel &&
    cp /build/muhammara-wasm.js /build/muhammara-wasm.wasm /out/"
