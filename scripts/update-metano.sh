#!/usr/bin/env bash
# Pull the latest Metano release from NuGet: packages float (Version="*"),
# the compiler tool is pinned in dotnet-tools.json and must be updated explicitly.
# The generated packages get the matching metano-runtime from the build; the hand-written
# workspaces (tests, benchmarks) are moved to the same version here.
set -euo pipefail
cd "$(dirname "$0")/.."
dotnet tool update Metano.Compiler.TypeScript
dotnet restore --force-evaluate
grep -ohE '"Metano(\.Build\.TypeScript)?/[0-9.]+"' src/*/obj/project.assets.json | sort -u
dotnet tool list | grep -i metano

version="$(dotnet tool list | awk 'tolower($1) == "metano.compiler.typescript" { print $2 }')"

for manifest in tests/js/*/package.json bench/*/package.json; do
  sed -i.bak -E "s/\"metano-runtime\": \"\\^[0-9.]+\"/\"metano-runtime\": \"^${version}\"/" "$manifest"
  rm "$manifest.bak"
done

grep -H '"metano-runtime"' tests/js/*/package.json bench/*/package.json
