#!/usr/bin/env bash
# Runs on criptomaster inside ~/metanui. Gated on the 1-minute load < 1.0 (max 10 min wait per step).
set -u
cd ~/metanui
export PATH=$HOME/.bun/bin:$PATH
OUT=~/metanui/.bench-runs
NODE=$HOME/.local/node-v26.8.2/bin/node
B=scripts/bench-reactivity.sh
mkdir -p "$OUT"

load1() { cut -d' ' -f1 /proc/loadavg; }
gate() {
  local start; start=$(date +%s)
  while awk "BEGIN{exit !($(load1) >= 1.0)}"; do
    if [ $(( $(date +%s) - start )) -ge 600 ]; then echo "GATE-TIMEOUT $1 load=$(load1)" >>"$OUT/log"; return; fi
    sleep 5
  done
}
step() { # name, command...
  local name=$1; shift
  gate "$name"
  echo "$name start $(cat /proc/loadavg)" >>"$OUT/log"
  "$@" >"$OUT/$name.txt" 2>&1
  echo "$name end   $(cat /proc/loadavg) exit=$?" >>"$OUT/log"
}

for i in 1 2 3; do
  step "bun$i" $B bench
  step "node$i" env NODE_BIN=$NODE $B node
done

for i in 1 2 3; do
  for fw in "Alien Signals" "Solid 2.0" "Metanui"; do
    tag=${fw// /_}
    step "update-bun-$tag-$i" $B probe harness-update "$fw"
    step "update-node-$tag-$i" env PROBE_RUNTIME=node NODE_BIN=$NODE $B probe harness-update "$fw"
  done
done

step retain-noflush $B probe retain
step retain-flush $B probe retain flush
step shape-bun $B probe node-shape
step shape-node env PROBE_RUNTIME=node NODE_BIN=$NODE $B probe node-shape
for fw in metanui solid2 alien; do
  step "create-bun-$fw" $B probe harness-create $fw
  step "create-node-$fw" env PROBE_RUNTIME=node NODE_BIN=$NODE $B probe harness-create $fw
done
for fw in "Alien Signals" "Solid 2.0" "Metanui"; do
  step "sbench-node-${fw// /_}" env PROBE_RUNTIME=node NODE_BIN=$NODE $B probe harness-sbench "$fw"
done
(cd bench/micro && bun prepare.ts >"$OUT/micro-prepare.txt" 2>&1)
for r in 1 2; do
  for v in A B C; do
    step "percall-node-$v-$r" env PROBE_RUNTIME=node NODE_BIN=$NODE $B probe per-call-v8 $v
    step "percall-bun-$v-$r" $B probe per-call-v8 $v
  done
done
step cellx-node env PROBE_RUNTIME=node NODE_BIN=$NODE $B probe harness-cellx Metanui
rm -rf "$OUT/prof" && mkdir -p "$OUT/prof"
gate profile
echo "profile start $(cat /proc/loadavg)" >>"$OUT/log"
(cd "$OUT/prof" && $NODE --expose-gc --cpu-prof --cpu-prof-interval 50 ~/metanui/.cache/js-reactivity-benchmark/packages/core/dist/harness-cellx.js Metanui >/dev/null 2>&1)
$NODE "$OUT/summarize.mjs" "$OUT/prof" >"$OUT/profile.txt" 2>&1
echo "profile end $(cat /proc/loadavg)" >>"$OUT/log"
echo ALL-DONE >>"$OUT/log"
