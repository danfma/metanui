#!/usr/bin/env bash
# Runs milomg/js-reactivity-benchmark against Metanui (generated TS), Solid 2.0 and alien-signals.
#
# Usage: scripts/bench-reactivity.sh [test|bench|node|all|prepare|probe <name> [args...]]
#   test     harness correctness tests (frameworks.test.ts) under `bun test`
#   bench    the benchmark under Bun (JavaScriptCore)
#   node     the benchmark bundled by `bun build` and run by Node (V8), with --expose-gc;
#            NODE_BIN selects the Node binary (default: `node` on PATH). Node is only a runtime here.
#   all      test, then bench (the default)
#   prepare  only clone, reset and patch the harness
#   probe    run bench/reactivity/probes/<name>.ts under Bun, or on Node with PROBE_RUNTIME=node
#
# Prerequisites at the repository root: `dotnet build` (generates targets/js/metanui-reactive/src) and `bun install`.
set -euo pipefail

readonly HARNESS_REPO="https://github.com/milomg/js-reactivity-benchmark.git"
readonly HARNESS_COMMIT="56eb45e84b3f6fcfa867840725e66b59a9b7467a"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly repo_root
readonly adapters="$repo_root/bench/reactivity"
readonly harness="$repo_root/.cache/js-reactivity-benchmark"
readonly core="$harness/packages/core/src"
readonly mode="${1:-all}"

prepare_harness() {
  if [[ ! -d "$harness/.git" ]]; then
    mkdir -p "$(dirname "$harness")"
    git clone --quiet "$HARNESS_REPO" "$harness"
  fi

  git -C "$harness" fetch --quiet origin "$HARNESS_COMMIT" 2>/dev/null || true
  git -C "$harness" checkout --quiet --force "$HARNESS_COMMIT"
  git -C "$harness" clean --quiet --force -d -x

  # alien-signals 3.2 stores an effect's return value as its cleanup and calls it on dispose;
  # the pinned harness targets 3.1.2 and passes `fn` through, so a numeric return throws.
  local alien_effect='  effect: (fn) => effect(fn),'

  grep -qxF "$alien_effect" "$core/frameworks/alienSignals.ts" || {
    echo "alienSignals.ts changed: review the alien-signals 3.2 effect patch" >&2
    exit 1
  }

  perl -pi -e 's/^  effect: \(fn\) => effect\(fn\),$/  effect: (fn) => effect(() => { fn(); }),/' \
    "$core/frameworks/alienSignals.ts"

  cp "$adapters/metanui.framework.ts" "$core/frameworks/metanui.ts"
  cp "$adapters/solid2.framework.ts" "$core/frameworks/solid2.ts"

  # Only these three frameworks are installed: their packages come from bench/reactivity
  # (Bun installs per package, not hoisted), so the harness resolves them through this link.
  ln -sfn "$adapters/node_modules" "$harness/node_modules"

  cat >"$core/frameworksList.ts" <<'EOF'
import type { FrameworkInfo } from "./util/frameworkTypes";
import { alienFramework } from "./frameworks/alienSignals";
import { metanuiFramework } from "./frameworks/metanui";
import { solid2Framework } from "./frameworks/solid2";

export const frameworkInfo: FrameworkInfo[] = [
  { framework: alienFramework, testPullCounts: true },
  // Solid 2.0 memos are eager: unread leaves still run, so the harness cannot check its pull counts.
  { framework: solid2Framework },
  { framework: metanuiFramework, testPullCounts: true },
];

export const allFrameworks: FrameworkInfo[] = frameworkInfo;
EOF

  # The harness's own Node runner, pointed at the core sources instead of the pnpm workspace package.
  sed 's#"js-reactivity-benchmark/src/index"#"./index"#' \
    "$harness/packages/node/src/index.ts" >"$core/run.ts"
}

run_tests() {
  (cd "$harness/packages/core" && bun test ./src/frameworks.test.ts)
}

run_bench_bun() {
  (cd "$harness/packages/core" && bun --expose-gc ./src/run.ts)
}

# Bundles a TS entry for Node and runs it. `bun` condition: metanui-reactive exports TS sources only
# under it (no dist is built). NODE_ENV=production: otherwise `bun build` resolves @solidjs/signals to
# its dev build.
run_on_node() {
  local entry="$1"
  local entry_name="${entry##*/}"
  local bundle="$harness/packages/core/dist/${entry_name%.ts}.js"
  local node_bin="${NODE_BIN:-node}"

  shift
  NODE_ENV=production bun build "$entry" --target=node --conditions=bun --outfile="$bundle" >/dev/null

  if grep -q "@solidjs/signals/dist/dev" "$bundle"; then
    echo "the Node bundle picked the @solidjs/signals dev build" >&2
    exit 1
  fi

  echo "node: $("$node_bin" --version)"
  "$node_bin" --expose-gc "$bundle" "$@"
}

run_bench_node() {
  run_on_node "$core/run.ts"
}

run_probe() {
  local probe="$adapters/probes/${1:?usage: probe <name> [args...]}.ts"

  shift

  if [[ "${PROBE_RUNTIME:-bun}" == "node" ]]; then
    run_on_node "$probe" "$@"
  else
    bun --expose-gc "$probe" "$@"
  fi
}

echo "load: $(uptime)"
prepare_harness

case "$mode" in
  test) run_tests ;;
  bench) run_bench_bun ;;
  node) run_bench_node ;;
  prepare) ;;
  probe)
    shift
    run_probe "$@"
    ;;
  all)
    run_tests
    run_bench_bun
    ;;
  *)
    echo "unknown mode: $mode (expected test, bench, node, all, prepare or probe)" >&2
    exit 2
    ;;
esac
