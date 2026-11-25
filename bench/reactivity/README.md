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
Node is used only as a runtime: no npm, no npx.

Run on an idle machine. The script prints `uptime` first. Each run in the tables below *started* when
the 1-minute load average was below 4, but the machine is shared, so the load rose during some runs.
The 5-minute average was still 9–12 at the start, because the load had only just dropped:

| Run | 1-min load at start | 5-min load at start | 1-min load at end | 5-min load at end |
|---|---:|---:|---:|---:|
| Bun, run 1 | 3.91 | 11.11 | 6.06 | 9.00 |
| Bun, run 2 | 3.65 | 9.21 | 4.66 | 7.45 |
| Node v26.8.2 | 3.79 | 12.35 | 3.65 | 9.21 |

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
| `withBuild(fn)` | `Reactivity.rootFuncOfActionT`, disposer kept | `createRoot`, disposer kept |
| `cleanup()` | dispose every kept root, then `Reactivity.flush()` | dispose every kept root, then `flush()` |

- `discardValue` is one shared no-op, so creating an effect does not allocate a closure for the
  apply side.
- `withBuild` calls `rootFuncOfActionT` directly. `Reactivity.root(...)` dispatches on
  `Function.length` and throws for this callback (danfma/metano#778, audit N6).
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

## Machine and versions

| | |
|---|---|
| Machine | Apple M1 Pro, 10 cores, 16 GB, macOS 26.7.3. Shared with other test suites; see load below |
| Primary runtime | Bun 1.4.2 (JavaScriptCore) |
| Secondary runtime | Node v26.8.2 (V8) |
| Metano, Metano.Build.TypeScript, metano-runtime | 3.1.0 |
| `@solidjs/signals` | 2.0.4 (`dist/prod`) |
| alien-signals | 3.2.1 |
| Harness | milomg/js-reactivity-benchmark `56eb45e` |

## Results

Times are in ms, as the harness reports them. Lower is better. For each test the harness takes the
fastest of several repetitions, except `cellx`, which is a sum of 10 runs. "vs" is
`Metanui / other − 1`, so a negative value means Metanui is faster.

### Bun (JavaScriptCore), primary

Mean of two runs (the loads are in the table under Run). A third run started at a 1-minute load of
11.4. It is left out of the table. It leads to the same conclusions; its largest deviation is Metanui's
`cellx2500` (31.3 ms, against 22.96 and 24.37).

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

**Budget on Bun: met on every test.** Two qualifications apply.

- **Against Solid 2.0 (24–86% faster), the comparison is biased against Solid.** Solid 2.0 memos are
  eager: they compute when created and recompute on every flush, even when nothing reads them (see
  Adapters). In the `lazy80%` tests only 20% of the leaves are read, so Solid computes nodes that
  alien-signals and Metanui skip. The largest gaps (-86% and -71%) are partly that, not codegen.
- **Against alien-signals, the lead holds only for JavaScriptCore, through this harness's adapters
  and its aggregate figures.** It reverses on V8 (next table). The aggregates can also hide shapes
  where Metanui is slower. `updateSignals` sums seven sub-tests. A review measured one of them,
  `update1to1` (one write, a flush, one effect), at 11.3–11.7 ms for Metanui against 6.1–6.8 ms for
  alien-signals on Bun. That number is provisional: it was taken at a load of about 10. **No lead over
  alien-signals is claimed for `updateSignals`**, because the harness does not report the sub-tests
  separately. The other aggregate rows can hide shapes in the same way.

Metanui is slower than alien-signals in `createComputations` (+9%) and in `cellx1000` (+16%, a 7 ms
total where Metanui's two runs differ by 11%).

### Node (V8), secondary

One run (the loads are in the table under Run).

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

**Budget on V8: missed on two tests, `createSignals` (+52%) and `cellx1000` (+18%).**
`createComputations` is at +10%, inside the budget. On V8, Metanui is much further behind
alien-signals than on Bun: 2–5× on creation and `cellx`, 1.5–2× on `updateSignals`, `broad` and
`deep`. The F2 and F3 probes reproduce the gaps with each framework alone in its own process, so the
fixed run order and the shared heap do not explain them. Those probe runs are provisional (see
Probes).

## Misses and findings

### F1. Disposed effects stay in the flush queue until the next flush (new; Bun and V8)

`EffectNode.start()` runs the compute and puts the effect on `FlushLoop`'s apply queue. Disposing the
owning root does not take the effect out of the queue. Under `ManualFlushScheduler`, nothing flushes
until the next `Reactivity.flush()`, so every disposed effect is kept alive, with its whole graph,
until then. A minimal TS repro on the generated package: 20 roots of 100,000 effects each, disposed
without a flush, leave 898 MB on the heap after a full GC. With one `flush()` after each root, 2 MB
remain (`probes/retain.ts`). In the harness, `sBench`'s creation tests never flush. The V8 heap reaches its 4 GB limit in
`createComputations`, which is why `cleanup` flushes (see Adapters). Not fixed here: whether
disposal should unlink queued effects is a core decision.

### F2. Node creation is slower on V8 (new; V8 only)

`createSignals` is 100,000 `signal()` calls plus a cleanup. Measured alone. **Provisional:** the
class-shape rows (`probes/node-shape.ts`, min of 30) ran at a 1-minute load of about 9, and the
adapter rows (`probes/harness-create.ts`, min of 15) at about 4.3.

| Probe (100,000 signals) | V8 (Node v26.8.2) | JSC (Bun 1.4.2) |
|---|---:|---:|
| `Reactivity.signal(i)` | 3.27 ms | 1.22 ms |
| Hand-written class, same three-level shape, class fields | 3.59 ms | 1.01 ms |
| Hand-written class, same shape, fields assigned in constructors | 3.56 ms | 1.05 ms |
| Metanui adapter, inside a root, plus `cleanup` | 6.30 ms | — |
| Solid 2.0 adapter, inside a root, plus `cleanup` | 3.79 ms | — |
| alien-signals adapter, inside a root, plus `cleanup` | 2.48 ms | — |

The class Metano emits for `Signal` costs as much to build as a hand-written class of the same shape.
So the gap is not codegen: it is the node's layout (ten fields across `ReactiveNode` → `SignalNode` →
`Signal`, plus the comparer), which V8 builds about 3× slower than JSC. Run alone through
`probes/harness-sbench.ts` (provisional, load 5–7), Metanui's `createSignals` still takes 12.13 ms,
against 5.81 ms for Solid 2.0 and 2.59 ms for alien-signals. Why the harness measures about twice the
isolated adapter probe is not isolated yet. The likely candidate is scavenger cost on
the larger objects that the `sources` array keeps alive. No audit item covers this.

### F3. A deep graph flush is slower on V8 (new; V8 only), with the audit's `try/finally` now measured

`cellx` times 10 flushes through 1000 or 2500 layers of 4 computeds and 4 effects. On V8 Metanui
takes about 220 ns per node per flush, against 70 ns for alien-signals. On JSC it is about as fast
as alien-signals.

The audit (docs/design/0001-reactive-core-ts-audit.md, section 4) kept the defensive `try/finally`
around `DependencyGraph.propagate`/`checkDirty` because its cost was within noise on Bun, and left V8
to this task. The per-call loop of `bench/micro`, ported to Node as `probes/per-call-v8.ts`, shows a
cost on V8. Median ns per call over two process runs. **Provisional:** taken at a 1-minute load of
about 4.2:

| | A (shipped) | B (no `try/finally`) | C (inlined walk) |
|---|---:|---:|---:|
| `checkDirty` | 3.59–3.83 | 3.38–3.43 | 1.88–1.89 |
| `propagate` | 8.50–8.63 | 6.42 | 6.79–6.80 |

That is about 2 ns per call on V8, against under 0.05 ns on JSC. It is real, but far too small to
explain a 150 ns per node gap in `cellx`. A CPU profile of `cellx` alone (`probes/harness-cellx.ts`
under `node --cpu-prof`, provisional, load about 5) spreads the time over
`propagateAbove`, `disposeOwned`, `get value`, `link`, `runCompute` and the `OwnerNode` constructor,
with 31% in GC (that includes untimed graph building). There is no single hot spot, and the cause is
not isolated yet. The same pattern shows on V8 in `updateSignals`, `broadPropagation` and
`deepPropagation`, which are slower than alien-signals but still faster than Solid 2.0.

No Metano issue is implicated so far. The F2 probe shows emitted and hand-written code of the same
shape are equally fast. F3's cause is still open, so it does not rule out codegen. Optimisations are
left to a separate decision, as the task requires.

## Probes

The probes behind F1–F3 live in `probes/`. `scripts/bench-reactivity.sh probe <name> [args...]`
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
| `per-call-v8` | F3 | `A`, `B` or `C` | `bench/micro`'s per-call loop. Run `bun prepare.ts` in `bench/micro` first |

```sh
scripts/bench-reactivity.sh probe retain                     # then: probe retain flush
PROBE_RUNTIME=node NODE_BIN=/path/to/node scripts/bench-reactivity.sh probe per-call-v8 A
```

The `harness-*` probes import the adapters and benches from the prepared clone in `.cache/`. Like
the benchmark, run them on an idle machine.
