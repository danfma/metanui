# Reactivity benchmark: Metanui vs Solid 2.0 vs alien-signals

Runs [milomg/js-reactivity-benchmark](https://github.com/milomg/js-reactivity-benchmark) at commit
`56eb45e84b3f6fcfa867840725e66b59a9b7467a` against the TypeScript that Metano generates for
`src/Metanui.Reactive` (spec section 8). The budget is an overhead of at most 10–15% against
`@solidjs/signals` 2.0.4.

## Run

From the repository root:

```sh
dotnet tool restore
dotnet build                           # generates targets/js/metanui-reactive/src
bun install
scripts/bench-reactivity.sh            # correctness tests, then the benchmark under Bun
scripts/bench-reactivity.sh test       # correctness tests only (frameworks.test.ts, under bun test)
scripts/bench-reactivity.sh bench      # benchmark only, Bun (JavaScriptCore)
NODE_BIN=/path/to/node scripts/bench-reactivity.sh node   # benchmark on Node (V8)
```

The script clones the harness into `.cache/js-reactivity-benchmark` (gitignored) and resets it to the
pinned commit on every run. Then it:

- copies `metanui.framework.ts` and `solid2.framework.ts` into `packages/core/src/frameworks/`;
- replaces `frameworksList.ts` with three entries: alien-signals, Solid 2.0 and Metanui. The other
  frameworks of the harness are left out, because their packages are not installed;
- links the harness's `node_modules` to this package's, so the harness resolves the three packages
  pinned here. Bun installs each workspace package on its own and does not hoist, so the harness
  cannot find them from the repository root;
- patches the harness's alien-signals adapter, which targets alien-signals 3.1.2. alien-signals 3.2
  keeps an effect's return value as its cleanup and calls it on dispose, so the unpatched
  `effect(fn)` throws `cleanup is not a function` when a harness effect returns a number. The patch
  wraps `fn` so the effect returns nothing;
- runs the harness's own Node runner (`packages/node/src/index.ts`), pointed at the core sources.

The `node` mode bundles the runner with `bun build`. It uses the `bun` condition, because
metanui-reactive exports TS sources only, and `NODE_ENV=production`, because otherwise `bun build`
picks the dev build of `@solidjs/signals`. The script fails if the bundle contains that dev build.

## Method

The primary results come from a dedicated host. The Mac results are kept as a secondary section,
because they were taken under load.

On the primary host:

- The committed tree was copied with `git archive` into a fresh directory, with no `node_modules`,
  `bin`/`obj` or `.cache`. Then `dotnet tool restore && dotnet build` ran there. That build is also
  the clean-clone build check on Linux: 0 warnings, 0 errors, and the generated TypeScript is
  byte-identical to the committed one.
- `bun install`, both scenario suites (55 .NET tests and 55 Bun tests) and the harness correctness
  tests (12 of 12) passed before any measurement.
- The build leaves the MSBuild worker nodes and the VBCSCompiler server alive, at about 1.6% CPU.
  They were stopped with `dotnet build-server shutdown`, and `ps -C dotnet` then showed no
  `dotnet` process. The shutdown happened during Bun run 2, so Bun runs 1–2 and Node run 1 ran with
  those idle processes alive. Bun run 3 and Node runs 2–3 ran without them.
- Every step, benchmark run and probe alike, started only when the 1-minute load average was below
  1.0 (read from `/proc/loadavg`). A benchmark keeps one of the 12 cores busy, so the 1-minute load
  rose to about 1.0–1.3 during the runs.
- Bun and Node runs alternate: Bun 1, Node 1, Bun 2, Node 2, Bun 3, Node 3. Each table cell is the
  median of the three runs.
- The raw outputs of every run and probe are committed in
  [`results/criptomaster-2026-11-25/`](results/criptomaster-2026-11-25/). The folder holds:
  - `bun1`–`bun3` and `node1`–`node3`;
  - the `update-*` sub-test runs;
  - the probe outputs;
  - `profile.txt` and the raw `prof/*.cpuprofile` behind the F3 profile table;
  - `log`, the 1/5/15-minute load at the start and end of each step;
  - `measure-host.sh`, the script that ran it all, and `summarize.mjs`, which turns the CPU profile
    into `profile.txt`.

| Run | 1/5/15-min load at start | 1/5/15-min load at end |
|---|---|---|
| Bun 1 | 0.69 / 0.62 / 0.56 | 1.04 / 0.91 / 0.70 |
| Node 1 | 0.95 / 0.90 / 0.70 | 1.05 / 1.08 / 0.85 |
| Bun 2 | 0.97 / 1.07 / 0.85 | 1.21 / 1.33 / 1.02 |
| Node 2 | 0.94 / 1.26 / 1.00 | 1.24 / 1.31 / 1.08 |
| Bun 3 | 0.97 / 1.24 / 1.07 | 1.07 / 1.23 / 1.10 |
| Node 3 | 0.98 / 1.21 / 1.09 | 1.14 / 1.28 / 1.17 |

The harness runs the frameworks in a fixed order: alien-signals, then Solid 2.0, then Metanui. Metanui
runs last, on the heap the other two leave behind. That order is probably not in Metanui's favour.

## Adapters

Both adapters make the same calls, so both pay the same adapter cost:

| Harness | Metanui | Solid 2.0 |
|---|---|---|
| `signal(v)` | `Reactivity.signal(v)`, `.value` get/set | `createSignal(v)` |
| `computed(fn)` | `Reactivity.computed(fn)`, `.value` | `createMemo(fn)` |
| `effect(fn)` | `Reactivity.effect(() => { fn(); return 0; }, discardValue)` | `createEffect(() => { fn(); return 0; }, discardValue)` |
| `withBatch(fn)` | `fn()`, then `Reactivity.flush()` | `fn()`, then `flush()` |
| `withBuild(fn)` | `Reactivity.root`, disposer kept | `createRoot`, disposer kept |
| `cleanup()` | dispose every kept root, then `Reactivity.flush()` | dispose every kept root, then `flush()` |

- `discardValue` is one shared no-op, so creating an effect does not allocate a closure for the
  apply side.
- The harness may call `withBuild` several times before one `cleanup`, so the adapters keep every
  disposer, not only the last one.
- **`cleanup` flushes after disposing.** The task brief's mapping has no flush there. Without it, the
  Node run dies with an out-of-memory error during `createComputations`, because disposed Metanui
  effects stay in the flush queue (finding F1 below). Solid 2.0 does not need the flush, because it
  flushes on its own microtask before the harness's next `await nextTick()`. Metanui's default
  `ManualFlushScheduler` never flushes on its own. The Solid adapter flushes too, to keep the two
  adapters alike. In `sBench` the flush is inside the timed region, so Metanui pays for draining its
  queue.
- The harness checks pull counts (`testPullCounts`) for alien-signals and Metanui. It does not check
  them for Solid 2.0: Solid 2.0 memos compute when they are created and recompute on flush even when
  nothing reads them. Its count for `static graph, read 2/3 of leaves` is 51, not 41.

The harness's correctness tests (`frameworks.test.ts`) pass for all three adapters (12 of 12). They
show that the adapters compute the expected values. That the harness reads values only after
`withBatch`, which flushes, comes from reading the harness code: every bench writes inside
`withBatch` and reads after it. The benchmark's own `console.assert` checks agree. The criterion for
every measured run was that its output held only the `load:` line, the `node:` version line, the
header and result rows, with no other line. A bare comparison is not enough, because Bun prints a
failed `console.assert` that has a message as the message alone, without `Assertion failed`.

## Machines and versions

| | Primary host | Secondary (Mac) |
|---|---|---|
| Machine | Intel Core i9-8950HK (6 cores / 12 threads), 31 GB, Fedora 45 x86_64, kernel 7.3.4. Dedicated, idle load about 0.5 | Apple M1 Pro, 10 cores, 16 GB, macOS 26.7.3. Shared with other test suites |
| Bun (JavaScriptCore) | 1.4.5 | 1.4.2 |
| Node (V8) | v26.8.2 | v26.8.2 |
| .NET SDK | 11.0.100 | 11.0.100 |
| Metano, Metano.Build.TypeScript, metano-runtime | 3.1.0 | 3.1.0 |
| `@solidjs/signals` | 2.0.4 (`dist/prod`) | 2.0.4 (`dist/prod`) |
| alien-signals | 3.2.1 | 3.2.1 |
| Harness | milomg/js-reactivity-benchmark `56eb45e` | the same |

## Results (primary host)

Times are in ms, as the harness reports them. Lower is better. For each test the harness takes the
fastest of several repetitions, except `cellx`, which is a sum of 10 runs. "vs" is
`Metanui / other − 1`, so a negative value means Metanui is faster. Each cell is the median of three
runs.

### Bun 1.4.5 (JavaScriptCore)

| Test | alien-signals 3.2.1 | Solid 2.0.4 | Metanui | Metanui vs Solid 2.0 | Metanui vs alien |
|---|---:|---:|---:|---:|---:|
| createSignals | 8.49 | 16.75 | 6.02 | -64% | -29% |
| createComputations | 165.22 | 271.87 | 179.97 | -34% | +9% |
| updateSignals | 597.84 | 2503.82 | 662.32 | -74% | +11% |
| avoidablePropagation | 134.75 | 506.57 | 112.95 | -78% | -16% |
| broadPropagation | 217.52 | 891.31 | 207.22 | -77% | -5% |
| deepPropagation | 74.45 | 317.64 | 68.13 | -79% | -8% |
| diamond | 132.86 | 626.06 | 141.58 | -77% | +7% |
| mux | 120.04 | 299.69 | 105.93 | -65% | -12% |
| repeatedObservers | 24.25 | 117.20 | 25.73 | -78% | +6% |
| triangle | 47.51 | 246.63 | 53.03 | -78% | +12% |
| unstable | 47.97 | 206.82 | 46.53 | -78% | -3% |
| molBench | 21.21 | 28.26 | 21.11 | -25% | -0% |
| cellx1000 | 10.92 | 32.19 | 12.60 | -61% | +15% |
| cellx2500 | 46.85 | 92.00 | 36.24 | -61% | -23% |
| 2-10x5 - lazy80% | 409.74 | 3208.91 | 354.03 | -89% | -14% |
| 6-10x10 - dyn25% - lazy80% | 261.84 | 945.67 | 214.96 | -77% | -18% |
| 4-1000x12 - dyn5% | 598.07 | 1506.01 | 437.12 | -71% | -27% |
| 25-1000x5 | 741.36 | 1916.88 | 605.31 | -68% | -18% |
| 3-5x500 | 172.84 | 574.51 | 142.36 | -75% | -18% |
| 6-100x15 - dyn50% | 334.54 | 850.11 | 273.48 | -68% | -18% |

**Budget on Bun: met on every test.** Metanui is 25–89% faster than Solid 2.0. Two qualifications
apply.

- **The comparison with Solid 2.0 is biased against Solid.** Solid 2.0 memos are eager: they compute
  when created and recompute on every flush, even when nothing reads them (see Adapters). In the
  `lazy80%` tests only 20% of the leaves are read, so Solid computes nodes that alien-signals and
  Metanui skip. The largest gaps (-89% and -77%) are partly that, not codegen.
- **The comparison with alien-signals holds only for JavaScriptCore, through this harness's adapters
  and its aggregate figures.** It reverses on V8 (next table). Against alien-signals, Metanui ranges
  from 29% faster (`createSignals`) to 15% slower (`cellx1000`). It is slower in `createComputations`
  (+9%), `updateSignals` (+11%), `diamond` (+7%), `repeatedObservers` (+6%), `triangle` (+12%) and
  `cellx1000` (+15%).
- **The `cellx` tests are noisy even on this host.** Metanui's `cellx1000` took 9.63, 12.60 and
  32.16 ms in the three runs. The other `cellx` cells moved by up to 37% across the three runs. Every
  non-`cellx` cell moved by 18% or less.

### Node v26.8.2 (V8)

| Test | alien-signals 3.2.1 | Solid 2.0.4 | Metanui | Metanui vs Solid 2.0 | Metanui vs alien |
|---|---:|---:|---:|---:|---:|
| createSignals | 5.56 | 15.34 | 17.89 | +17% | +222% |
| createComputations | 247.75 | 427.71 | 397.83 | -7% | +61% |
| updateSignals | 590.11 | 2569.80 | 1205.44 | -53% | +104% |
| avoidablePropagation | 186.42 | 581.53 | 277.27 | -52% | +49% |
| broadPropagation | 226.36 | 1159.27 | 407.75 | -65% | +80% |
| deepPropagation | 75.18 | 386.74 | 122.99 | -68% | +64% |
| diamond | 183.64 | 765.30 | 255.83 | -67% | +39% |
| mux | 197.09 | 376.20 | 225.98 | -40% | +15% |
| repeatedObservers | 39.90 | 111.15 | 42.67 | -62% | +7% |
| triangle | 52.06 | 254.08 | 81.74 | -68% | +57% |
| unstable | 48.37 | 209.12 | 59.38 | -72% | +23% |
| molBench | 28.81 | 37.06 | 29.50 | -20% | +2% |
| cellx1000 | 10.95 | 44.39 | 53.65 | +21% | +390% |
| cellx2500 | 37.58 | 100.63 | 90.76 | -10% | +142% |
| 2-10x5 - lazy80% | 387.00 | 3734.79 | 564.70 | -85% | +46% |
| 6-10x10 - dyn25% - lazy80% | 265.53 | 1045.37 | 270.76 | -74% | +2% |
| 4-1000x12 - dyn5% | 532.03 | 1846.07 | 576.15 | -69% | +8% |
| 25-1000x5 | 707.78 | 1948.82 | 742.96 | -62% | +5% |
| 3-5x500 | 190.15 | 622.77 | 220.16 | -65% | +16% |
| 6-100x15 - dyn50% | 292.79 | 915.72 | 344.43 | -62% | +18% |

**Budget on V8: missed on two tests, `createSignals` (+17%) and `cellx1000` (+21%).**
`createComputations` is at -7% and `cellx2500` at -10%. Solid's `createSignals` is noisy on V8:
10.16, 15.34 and 15.36 ms in the three runs, and 19.56 ms when run alone (F2). Against Solid's fastest
run, Metanui (17.3–18.3 ms) is 70% slower. Against Solid's run alone, it is 7% faster. So the
`createSignals` miss is real but its size is uncertain.

On V8, Metanui is well behind alien-signals. It is about 3× slower on `createSignals`, 1.6× on
`createComputations`, 1.8–2× on `updateSignals` and `broad`, and 2.4–4.9× on `cellx`. It is still faster than Solid 2.0 everywhere except `createSignals` and
`cellx1000`.

### `updateSignals` per sub-test

The harness reports `updateSignals` as one sum of seven sub-tests, so `probes/harness-update.ts`
reruns each sub-test on its own. It times them exactly as sBench does: three warm-ups, the fastest of
ten rounds, and `cleanup` inside the timed region. It runs in a separate process per framework.
Median of three runs per runtime, on the primary host.

Bun 1.4.5:

| Sub-test | alien-signals 3.2.1 | Solid 2.0.4 | Metanui | Metanui vs Solid 2.0 | Metanui vs alien |
|---|---:|---:|---:|---:|---:|
| update1to1 | 41.81 | 327.63 | 38.74 | -88% | -7% |
| update2to1 | 25.35 | 160.39 | 22.98 | -86% | -9% |
| update4to1 | 17.54 | 80.47 | 12.40 | -85% | -29% |
| update1000to1 | 9.79 | 11.56 | 4.08 | -65% | -58% |
| update1to2 | 16.34 | 90.06 | 16.13 | -82% | -1% |
| update1to4 | 29.37 | 108.52 | 27.21 | -75% | -7% |
| update1to1000 | 568.01 | 1636.18 | 555.74 | -66% | -2% |
| updateSignals (sum) | 706.75 | 2414.90 | 674.30 | -72% | -5% |

Node v26.8.2:

| Sub-test | alien-signals 3.2.1 | Solid 2.0.4 | Metanui | Metanui vs Solid 2.0 | Metanui vs alien |
|---|---:|---:|---:|---:|---:|
| update1to1 | 30.43 | 219.87 | 67.85 | -69% | +123% |
| update2to1 | 20.08 | 108.26 | 41.04 | -62% | +104% |
| update4to1 | 13.65 | 55.92 | 28.71 | -49% | +110% |
| update1000to1 | 6.07 | 12.62 | 7.40 | -41% | +22% |
| update1to2 | 12.88 | 69.72 | 34.27 | -51% | +166% |
| update1to4 | 22.59 | 112.47 | 50.30 | -55% | +123% |
| update1to1000 | 529.12 | 1888.58 | 1006.82 | -47% | +90% |
| updateSignals (sum) | 635.75 | 2469.45 | 1236.82 | -50% | +95% |

- **The `update1to1` question.** The reviewer measured `update1to1` on the Mac at a load of about 10,
  and found Metanui at about twice alien-signals' time on Bun (11.3–11.7 ms against 6.1–6.8 ms). That
  **does not reproduce on the idle host**: on Bun, Metanui is 7% faster than alien-signals on
  `update1to1` and within ±10% of it on five of the seven sub-tests. Metanui is clearly faster only when
  one effect reads many signals (`update4to1`, `update1000to1`).
- **No overall lead over alien-signals is claimed for `updateSignals` on Bun.** The isolated sum is
  -5% and the in-harness aggregate is +11%. That is a tie within this harness's noise.
- **On V8, Metanui is 1.2–2.7× slower than alien-signals on every sub-test.** It is still faster than
  Solid 2.0 on all of them.

## Results (secondary: Mac, under load)

These runs were taken on the Mac before the primary host was available. The machine was shared with
other test suites. Each run started when the 1-minute load average was below 4, but the 5-minute
average was still 9–12, and the load rose during some runs:

| Run | 1-min load at start | 5-min load at start | 1-min load at end | 5-min load at end |
|---|---:|---:|---:|---:|
| Bun 1.4.2, run 1 | 3.91 | 11.11 | 6.06 | 9.00 |
| Bun 1.4.2, run 2 | 3.65 | 9.21 | 4.66 | 7.45 |
| Node v26.8.2 | 3.79 | 12.35 | 3.65 | 9.21 |

A third Bun run started at a load of 11.4 and is left out.

### Bun 1.4.2, mean of two runs

| Test | alien-signals 3.2.1 | Solid 2.0.4 | Metanui | Metanui vs Solid 2.0 | Metanui vs alien |
|---|---:|---:|---:|---:|---:|
| createSignals | 5.75 | 6.00 | 2.02 | -66% | -65% |
| createComputations | 81.60 | 147.64 | 88.98 | -40% | +9% |
| updateSignals | 447.87 | 1413.21 | 372.55 | -74% | -17% |
| avoidablePropagation | 83.78 | 284.95 | 68.63 | -76% | -18% |
| broadPropagation | 142.67 | 478.99 | 118.07 | -75% | -17% |
| deepPropagation | 46.11 | 163.32 | 41.52 | -75% | -10% |
| diamond | 100.06 | 337.61 | 89.12 | -74% | -11% |
| mux | 79.06 | 166.25 | 66.27 | -60% | -16% |
| repeatedObservers | 19.45 | 62.34 | 16.58 | -73% | -15% |
| triangle | 32.03 | 136.02 | 32.33 | -76% | +1% |
| unstable | 32.07 | 109.70 | 30.88 | -72% | -4% |
| molBench | 12.94 | 17.08 | 12.91 | -24% | -0% |
| cellx1000 | 6.55 | 18.52 | 7.61 | -59% | +16% |
| cellx2500 | 28.05 | 48.25 | 23.66 | -51% | -16% |
| 2-10x5 - lazy80% | 256.81 | 1745.43 | 240.67 | -86% | -6% |
| 6-10x10 - dyn25% - lazy80% | 174.87 | 498.75 | 144.32 | -71% | -17% |
| 4-1000x12 - dyn5% | 450.50 | 804.46 | 330.65 | -59% | -27% |
| 25-1000x5 | 555.99 | 1036.32 | 441.56 | -57% | -21% |
| 3-5x500 | 113.42 | 305.48 | 98.62 | -68% | -13% |
| 6-100x15 - dyn50% | 238.61 | 466.00 | 217.18 | -53% | -9% |

### Node v26.8.2, one run

| Test | alien-signals 3.2.1 | Solid 2.0.4 | Metanui | Metanui vs Solid 2.0 | Metanui vs alien |
|---|---:|---:|---:|---:|---:|
| createSignals | 3.02 | 8.07 | 12.27 | **+52%** | +306% |
| createComputations | 147.89 | 253.43 | 279.98 | +10% | +89% |
| updateSignals | 441.41 | 1503.09 | 864.53 | -42% | +96% |
| avoidablePropagation | 131.07 | 318.48 | 166.96 | -48% | +27% |
| broadPropagation | 140.45 | 564.79 | 214.02 | -62% | +52% |
| deepPropagation | 48.36 | 186.26 | 70.28 | -62% | +45% |
| diamond | 121.60 | 394.61 | 142.22 | -64% | +17% |
| mux | 120.05 | 209.83 | 138.56 | -34% | +15% |
| repeatedObservers | 31.54 | 68.39 | 27.62 | -60% | -12% |
| triangle | 34.90 | 124.53 | 46.14 | -63% | +32% |
| unstable | 35.76 | 113.96 | 32.20 | -72% | -10% |
| molBench | 23.91 | 29.83 | 24.21 | -19% | +1% |
| cellx1000 | 5.16 | 20.95 | 24.79 | **+18%** | +380% |
| cellx2500 | 13.99 | 44.93 | 44.75 | -0% | +220% |
| 2-10x5 - lazy80% | 254.25 | 1988.10 | 315.39 | -84% | +24% |
| 6-10x10 - dyn25% - lazy80% | 184.07 | 599.20 | 184.38 | -69% | +0% |
| 4-1000x12 - dyn5% | 432.91 | 1105.63 | 452.69 | -59% | +5% |
| 25-1000x5 | 551.86 | 1220.47 | 555.27 | -55% | +1% |
| 3-5x500 | 127.18 | 333.89 | 146.80 | -56% | +15% |
| 6-100x15 - dyn50% | 238.61 | 539.95 | 264.63 | -51% | +11% |

The Mac and the primary host agree on the budget verdicts:

- the budget is met on Bun;
- on V8, `createSignals` and `cellx1000` miss the budget, and Metanui is well behind alien-signals.

They diverge in two places, and the size of the V8 `createSignals` miss also differs (+52% on the
Mac, +17% on the host):

| Comparison | Mac | Primary host |
|---|---|---|
| Bun `updateSignals` vs alien-signals | Metanui 17% faster | a tie: +11% in the harness aggregate, -5% in the per-sub-test sum |
| Node `createComputations` vs Solid 2.0 | Metanui 10% slower | Metanui 7% faster |

## Misses and findings

The probe numbers below come from the primary host, with every probe started below a 1-minute load
of 1.0, so they are no longer provisional.

### F1. Disposed effects stay in the flush queue until the next flush (new; Bun and V8)

`EffectNode.start()` runs the compute and puts the effect on `FlushLoop`'s apply queue. Disposing the
owning root does not take the effect out of the queue. Under `ManualFlushScheduler`, nothing flushes
until the next `Reactivity.flush()`, so every disposed effect is kept alive, with its whole graph,
until then.

`probes/retain.ts` shows it: 20 roots of 100,000 effects each, disposed without a flush, leave 834 MB
on the heap after a full GC. With one `flush()` after each root, 2 MB remain. The Mac gave 898 MB and
2 MB.

In the harness, `sBench`'s creation tests never flush, and the V8 heap reaches its 4 GB limit in
`createComputations`. That is why `cleanup` flushes (see Adapters). Not fixed here: whether disposal
should unlink queued effects is a core decision.

### F2. Node creation is slower on V8 than on JSC; not codegen (new; V8 only)

`createSignals` is 100,000 `signal()` calls plus a cleanup. Measured alone:

| Probe (100,000 signals, min of 30 or 15) | V8 (Node v26.8.2) | JSC (Bun 1.4.5) |
|---|---:|---:|
| `Reactivity.signal(i)` (`node-shape`) | 4.05 ms | 1.97 ms |
| Hand-written class, same three-level shape, class fields | 4.19 ms | 1.86 ms |
| Hand-written class, same shape, fields assigned in constructors | 4.23 ms | 1.83 ms |
| Metanui adapter, inside a root, plus `cleanup` (`harness-create`) | 7.49 ms | 3.70 ms |
| Solid 2.0 adapter, inside a root, plus `cleanup` | 6.06 ms | 7.75 ms |
| alien-signals adapter, inside a root, plus `cleanup` | 3.77 ms | 4.45 ms |

The class Metano emits for `Signal` costs as much to build as a hand-written class of the same shape,
on both engines. So codegen is not the cause. The node's layout is: ten fields across `ReactiveNode`
→ `SignalNode` → `Signal`, plus the comparer, which V8 builds about 2× slower than JSC.

Through the adapter, V8 puts Metanui 24% behind Solid 2.0 and 2× behind alien-signals. On JSC,
Metanui is the fastest of the three. Run alone through `probes/harness-sbench.ts` on V8, the harness
`createSignals` gives:

| Framework | V8, alone (ms) |
|---|---:|
| Metanui | 18.10 |
| Solid 2.0 | 19.56 |
| alien-signals | 6.54 |

For every framework, the harness measures 1.7–3.2× the adapter probe. That points at the
harness's own costs (the `sources` array and `gc()` between rounds), which no adapter avoids. No
audit item covers F2.

### F3. A deep graph flush is slower on V8 (new; V8 only), with the audit's `try/finally` measured

`cellx` times 10 flushes through 1000 or 2500 layers of 4 computeds and 4 effects. On V8, Metanui's
`cellx1000` is about 5× alien-signals. Run alone in five rounds (`probes/harness-cellx.ts`), Metanui
took 37.6–56.4 ms against alien's 10.9 ms median in the harness. On JSC the two are close.

The audit (docs/design/0001-reactive-core-ts-audit.md, section 4) kept the defensive `try/finally`
around `DependencyGraph.propagate`/`checkDirty`, because its cost was within noise on Bun on the Mac.
It left V8 to this task. `probes/per-call-v8.ts` gives the median ns per call over two process runs,
on the primary host:

| | A (shipped) | B (no `try/finally`) | C (inlined walk) |
|---|---:|---:|---:|
| V8 `checkDirty` | 8.01–8.05 | 7.85–8.20 | 5.08 |
| V8 `propagate` | 13.60–14.66 | 11.90–12.54 | 11.65–11.77 |
| JSC `checkDirty` | 1.78–1.83 | 1.79–1.80 | 1.35 |
| JSC `propagate` | 3.16–3.20 | 3.06 | 3.13–3.18 |

- On V8, the `try/finally` costs about 1.5–2 ns per `propagate`. The wrapper call plus `truncate`
  costs about 3 ns per `checkDirty`.
- On JSC on this x86 host, the wrapper costs about 0.45 ns per `checkDirty`, and the `try/finally`
  nothing measurable.

These costs are real, but they are far too small to explain a gap of tens of ms in `cellx`.

A V8 CPU profile of `cellx` alone (`node --cpu-prof`, 50 µs sampling) spreads the time with no single
hot spot. The numbers come from `results/criptomaster-2026-11-25/profile.txt`:

| Entry | Share of profile |
|---|---:|
| GC (untimed graph building included) | 34% |
| `propagateAbove` | 4.4% |
| `disposeOwned` | 3.1% |
| `tryRunCompute`, `dispose`, `get value`, the `OwnerNode` constructor, `unlink`, `runCompute`, `link`, `shallowPropagate` | about 2–3% each |

The share in GC and in owner bookkeeping (`disposeOwned`, `dispose`, the `OwnerNode` constructor)
suggests that per-recompute ownership work and allocation weigh more on V8. This is not isolated. The
same pattern shows on V8 in `updateSignals`, `broadPropagation` and `deepPropagation`: slower than
alien-signals, still faster than Solid 2.0.

No Metano issue is implicated so far. The F2 probe shows that emitted and hand-written code of the
same shape are equally fast. F3's cause is still open, so it does not rule out codegen. Optimisations
are left to a separate decision, as the task requires.

## Probes

The probes behind F1–F3 and the `updateSignals` breakdown live in `probes/`. `scripts/bench-reactivity.sh probe <name> [args...]`
prepares the harness and runs `probes/<name>.ts` under Bun with `--expose-gc`. With
`PROBE_RUNTIME=node` (and optionally `NODE_BIN`), it bundles the probe the same way as the `node` mode
and runs it on Node.

| Probe | Finding | Arguments | Notes |
|---|---|---|---|
| `retain` | F1 | `[flush]` | heap after 20 roots of 100,000 disposed effects |
| `node-shape` | F2 | — | `Reactivity.signal` against hand-written classes of the same shape |
| `harness-create` | F2 | `metanui`, `solid2` or `alien` | 100,000 signals through one harness adapter |
| `harness-sbench` | F2, F3 | `"Alien Signals"`, `"Solid 2.0"` or `Metanui` | harness `sBench` and `cellx` for one framework alone |
| `harness-cellx` | F3 | the same names | five rounds of `cellx`, for `node --cpu-prof` |
| `harness-update` | `updateSignals` | the same names | each `updateSignals` sub-test, timed as sBench does |
| `per-call-v8` | F3 | `A`, `B` or `C` | `bench/micro`'s per-call loop. Run `bun prepare.ts` in `bench/micro` first |

```sh
scripts/bench-reactivity.sh probe retain                     # then: probe retain flush
PROBE_RUNTIME=node NODE_BIN=/path/to/node scripts/bench-reactivity.sh probe per-call-v8 A
```

The `harness-*` probes import the adapters and benches from the prepared clone in `.cache/`. Like
the benchmark, run them on an idle machine.
