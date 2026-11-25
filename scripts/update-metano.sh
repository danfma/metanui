#!/usr/bin/env bash
# Pull the latest Metano release from NuGet: packages float (Version="*"),
# the compiler tool is pinned in dotnet-tools.json and must be updated explicitly.
set -euo pipefail
cd "$(dirname "$0")/.."
dotnet tool update Metano.Compiler.TypeScript
dotnet restore --force-evaluate
grep -ohE '"Metano(\.Build\.TypeScript)?/[0-9.]+"' src/*/obj/project.assets.json | sort -u
dotnet tool list | grep -i metano
