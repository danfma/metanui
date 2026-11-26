#!/usr/bin/env bash
# Pull the latest Metano release from NuGet: packages float (Version="*"),
# the compiler tool is pinned in dotnet-tools.json and must be updated explicitly.
# The generated packages get the matching metano-runtime from the build; the hand-written
# workspaces (tests, benchmarks, spike hosts) are moved to the same version here.
# Afterwards run `dotnet build` (it rewrites the generated package.json files), then `bun install`.
set -euo pipefail
shopt -s nullglob
cd "$(dirname "$0")/.."

solution=Metanui.slnx
tool_manifest=dotnet-tools.json
runtime_manifests=(tests/js/*/package.json bench/*/package.json spikes/*/package.json)

fail() {
  echo "$1" >&2
  exit 1
}

# The tool update rewrites the manifest first; any failure before the version guard passes puts it back.
tool_manifest_backup="$(mktemp)"
cp "$tool_manifest" "$tool_manifest_backup"
keep_tool_manifest=false

restore_tool_manifest() {
  [[ "$keep_tool_manifest" == true ]] || cp "$tool_manifest_backup" "$tool_manifest"
  rm -f "$tool_manifest_backup"
}

trap restore_tool_manifest EXIT

dotnet tool update Metano.Compiler.TypeScript --no-http-cache
dotnet restore "$solution" --force-evaluate --no-http-cache

tool_version="$(dotnet tool list | awk 'tolower($1) == "metano.compiler.typescript" { print $2 }')"
[[ -n "$tool_version" ]] || fail "Metano.Compiler.TypeScript is not in the tool manifest"

# Only the projects of the solution: a leftover obj/ of a removed project would report a stale version.
assets_files=()
while IFS= read -r project; do
  assets_files+=("$(dirname "$project")/obj/project.assets.json")
done < <(dotnet sln "$solution" list | grep -E '\.csproj$')
(( ${#assets_files[@]} )) || fail "No project in ${solution}"

resolved_package_versions="$(grep -ohE '"Metano(\.Build\.TypeScript)?/[^"]+"' "${assets_files[@]}" | sort -u || true)"
[[ -n "$resolved_package_versions" ]] || fail "No Metano package found in the restore output"

echo "$resolved_package_versions"
echo "Metano.Compiler.TypeScript ${tool_version}"

# While NuGet indexes a new release, the tool and the floating packages can resolve different versions.
if grep -qvF "/${tool_version}\"" <<<"$resolved_package_versions"; then
  fail "The Metano packages and the tool ${tool_version} resolve different versions; NuGet may still be indexing the release. ${tool_manifest} was restored; re-run the script in a few minutes."
fi

keep_tool_manifest=true

(( ${#runtime_manifests[@]} )) || fail "No hand-written package.json to sync"

for manifest in "${runtime_manifests[@]}"; do
  sed -i.bak -E "s/\"metano-runtime\": \"\\^[^\"]+\"/\"metano-runtime\": \"^${tool_version}\"/" "$manifest"
  rm "$manifest.bak"
done

grep -H '"metano-runtime"' "${runtime_manifests[@]}"
