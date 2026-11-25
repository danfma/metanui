# 0001 — Reactive core: TypeScript output audit

Audit of the TypeScript that Metano emits for `src/Metanui.Reactive` (Phase 7 of
`plans/reactive-core.md`), checked against the hot-path rules of spec 5.3
(`docs/design/0001-reactive-core.md`).

The audit was made on Metano 3.1.0. Section 9 re-checks every issue on Metano 3.2.0, which the
code now uses; sections 1 to 8 keep the 3.1.0 findings as recorded, with the issue status updated in
section 6.

| Tool | Version |
|---|---|
| Metano, Metano.Build.TypeScript, Metano.Compiler.TypeScript, metano-runtime | 3.1.0 (audit), 3.2.0 (section 9) |
| Bun (JavaScriptCore) | 1.4.2 |
| tsc | 5.9.3 |
| tsgo (`@typescript/native-preview`) | 7.0.0-dev.20260707.2 |

Section 7 collects every new Metano finding of this audit. They are filed upstream as
danfma/metano#785 (N10), #786 (N9), #787 (N1–N5, N7, N8), and as an addition to #778 (N6).

## 1. Summary

- On the hot path, the emitted code follows spec 5.3:
  - a signal or computed read is a method call plus field accesses, with no closure, no allocation and no interface dispatch;
  - the graph has no `List`, and `new Link` is its only allocation;
  - flags are numbers combined with bitwise ops;
  - all global state lives in static fields.
- No deviation shows a cost above noise on JavaScriptCore (Bun) (section 4; V8 not measured). The ones found are emission noise (#787), plus a runtime hazard in the overload dispatcher that hand-written TS can hit (N6, #778).
- Strict typecheck:
  - `tsc --strict` is clean on both generated packages.
  - `tsgo --strict` reports one diagnostic, and it is not in generated code: the declarations of `@js-temporal/polyfill`, which metano-runtime 3.1.0 depends on, clash with tsgo's built-in `esnext` Temporal types (N9, #786).
- On 3.1.0, Metano warnings do not fail the build (N10, #785; fixed in 3.2.0, section 9). Metano has no warnings-as-errors option, and it writes its up-to-date stamp even after a run that emitted warnings. So a gate added at the MSBuild level fails only the first build.
- The defensive `try/finally` in `DependencyGraph.Propagate`/`CheckDirty` is **kept**. Its cost is within noise on JavaScriptCore (Bun), and the per-call overhead is under 0.05 ns. V8 is not measured yet (Task 8). The scenario that was named after it is renamed, because it never exercised it (section 5).
- On 3.2.0 the workarounds for #768, #772, #773, #774, #778, #779, #764/#765 and #770 are removed (section 9). On 3.1.0 the workarounds for #768, #772, #773, #774 and #775 were still needed: all five reproduce in minimal probes (section 6). They are fixed on Metano's wave-9 branch, which is not released yet, so the workarounds stay until that release. #776 and #779 were not re-probed.

## 2. Strict typecheck

There is no `tsconfig.json` in the generated packages, so the check used a scratch config per package.
Each config includes every `.ts` file under `targets/js/<package>/src`:

```json
{
  "compilerOptions": {
    "strict": true, "noEmit": true, "target": "esnext", "module": "esnext",
    "moduleResolution": "bundler", "customConditions": ["bun"], "skipLibCheck": false, "types": []
  },
  "include": ["<repo>/targets/js/<package>/src/**/*.ts"]
}
```

Commands, run from each package directory:

```sh
bun x --package typescript@5.9.3 tsc -p <scratch>/tsconfig.<package>.json
bun x --package @typescript/native-preview tsgo -p <scratch>/tsconfig.<package>.json
```

| Package | `tsc --strict` | `tsgo --strict` | `tsgo --strict --skipLibCheck` | `tsgo --strict --lib es2024` |
|---|---|---|---|---|
| metanui-reactive | 0 diagnostics | 1 diagnostic (TS2430, library) | 0 | 0 |
| metanui-reactive-scenarios | 0 diagnostics | 1 diagnostic (TS2430, library) | 0 | 0 |

The tsgo diagnostic is the same for both packages:

```
node_modules/.bun/@js-temporal+polyfill@0.5.1/node_modules/@js-temporal/polyfill/index.d.ts(1156,20):
error TS2430: Interface '...@js-temporal/polyfill/index").Intl.DateTimeFormat' incorrectly extends interface 'Intl.DateTimeFormat'.
  Types of property 'format' are incompatible.
    ...
      Type 'Instant' is not assignable to type 'string | Instant'.
```

It comes from the polyfill's declarations, which metano-runtime 3.1.0 imports in
`dist/system/{time-span,date-time-offset,temporal-helpers,argument-guards,time-span-format}.d.ts`.
These conflict with the Temporal types in TypeScript 7's `esnext` lib. The diagnostic goes away with
`--lib es2024` or `--skipLibCheck`, so the generated reactive code itself is clean under both
compilers. Filed upstream as N9 (danfma/metano#786).

Strict mode also confirms that #773, #774, #775 and #768 still reproduce on 3.1.0, in the probes of
section 6: TS2304 `_`, TS2322, TS18047, and TS2304 `ArgumentOutOfRangeException`. In the reactive
packages they are worked around, which is why those packages are clean.

## 3. Per-file audit against spec 5.3

"Hot" means the file is on the read, `link`, `propagate` or `checkDirty` path.

| C# file | Emitted TS | Hot | Verdict |
|---|---|---|---|
| `Graph/ReactiveFlags.cs` | `graph/reactive-flags.ts` | yes | Conforms. An `as const` object of numbers, with a branded `number` type. Uses are bitwise ops on `ReactiveFlags.X` property loads, not literals. On Bun this is identical to inlined literals (section 4), so there is no finding. |
| `Graph/Link.cs` | `graph/link.ts` | yes | Conforms. A plain class with fields; the constructor assigns every field, so the shape is stable. |
| `Graph/ReactiveNode.cs` | `graph/reactive-node.ts` | yes | Conforms. Field initializers, `/** @internal */` on internal members. A lazy `$runtimeType` getter, off the hot path. Empty `constructor() { }` (N4). |
| `Graph/SignalNode.cs` | `graph/signal-node.ts` | no | Conforms. |
| `Graph/LinkStack.cs` | `graph/link-stack.ts` | yes | `?? null` on every indexed read (N1). Not measurable (section 4). Empty constructor on a static class (N4). |
| `Graph/DependencyGraph.cs` | `graph/dependency-graph.ts` | yes | Conforms. `while (true)` loops, numeric flags, `new Link` as the only allocation, no closures. Both labeled-`continue` sites are restructured (#772). `else if` chains come out as nested `else { if }` (N8). Empty constructor (N4). |
| `Signal.cs` | `signal.ts` | yes | Read: `Tracking.activeObserver` test, `DependencyGraph.link`, field read. Write: one null test of `Tracking.currentOwner`. Setter helpers kept for #768. `is not null` is emitted as `!(x == null)` (N8). |
| `Computed.cs` | `computed.ts` | yes | Read: `refresh()` (flag tests), one flag test for `Errored`, `link`, field read. Recompute uses `IEqualityComparer.equals`, the interface dispatch that spec 5.3 allows off the read path. `catch` has a redundant alias (N5). |
| `Tracking.cs` | `tracking.ts` | yes | Conforms: static fields of one class. Empty constructor (N4). Exported from the public barrel although `internal` (FR, section 6). |
| `Scheduling/FlushLoop.cs` | `scheduling/flush-loop.ts` | flush | Conforms. Intrusive queues, `runFlush`/`resumeFlush` cached as static fields, no allocation per flush. The comment in the empty `catch` is dropped, and the binding `_err` is unused (N3). Empty constructor (N4). |
| `Ownership/OwnerNode.cs` | `ownership/owner-node.ts` | no | Conforms. The constant message `"…so " + "nothing…"` is concatenated at runtime instead of folded (N7). |
| `Ownership/RootNode.cs` | `ownership/root-node.ts` | no | Conforms. `throw;` becomes `throw e$` (it rethrows the original value). Redundant `catch` alias (N5). |
| `Ownership/Teardown.cs` | `ownership/teardown.ts` | no | Conforms. Redundant `catch` alias (N5). Empty constructor (N4). |
| `Ownership/CleanupEntry.cs` | `ownership/cleanup-entry.ts` | no | Conforms. |
| `Effects/EffectNode.cs` | `effects/effect-node.ts` | flush | Conforms. Redundant `catch` alias (N5). |
| `Effects/SplitEffect.cs` | `effects/split-effect.ts` | flush | Conforms. `default(T)` fields are emitted as `null!`. |
| `Reactivity.cs` | `reactivity.ts` | no | Conforms, except the `root(...)` rest-args dispatcher (#778, and N6). Empty constructor (N4). |
| `IFlushScheduler.cs` | `i-flush-scheduler.ts`, `manual-flush-scheduler.ts` | no | Conforms. `ManualFlushScheduler` emits an explicit empty constructor (N4). |
| `AssemblyInfo.cs`, `GlobalUsings.cs` | none | — | — |

### Deviations

Each row gives the C# line, the emitted TS, the expected TS, and the issue. "N" numbers point to the
repros in section 7.

| # | C# | Emitted TS | Expected TS | Issue |
|---|---|---|---|---|
| N1 | `LinkStack.cs:40` `var link = _items[Top];`, `:78` `grown[index] = _items[index];` | `link-stack.ts:22` `const link = LinkStack._items[LinkStack.top] ?? null;`, `:49` `grown[index] = LinkStack._items[index] ?? null;` | `const link = LinkStack._items[LinkStack.top];` | #787 |
| N2 | `OwnershipScenarios.cs:35-41` `var log = ""; … log += "1,";` | `ownership-scenarios.ts:15` `log = (log ?? "") + "1,"` | `log += "1,"` | #787 |
| N3 | `FlushLoop.cs:228-231` `catch { // RequestFlush already cleared _scheduled; keep the original error. }` | `flush-loop.ts:149` `} catch (_err) {\n    }` | `} catch {\n      // RequestFlush already cleared _scheduled; keep the original error.\n    }` | #787 |
| N4 | `internal static class Tracking { … }` (and `FlushLoop`, `DependencyGraph`, `LinkStack`, `Teardown`, `Reactivity`) | `export class Tracking { … constructor() { } }` | No constructor, or `private constructor() {}` so the class cannot be instantiated, as in C# | #787 |
| N5 | `Computed.cs:101` `catch (Exception error) { CacheError(error); return true; }` (and 6 more sites) | `catch (e$) { const e0 = toException(e$); const error = e0; this.cacheError(error); …` | `catch (e$) { const error = toException(e$); …` | #787 |
| N6 | `Reactivity.cs` `Root<T>(Func<Action, T>)` + `Root(Action<Action>)` | `reactivity.ts:52-64`: a rest-args dispatcher whose two branches test the same `args[0].length === 1`, plus a final `throw` | A single branch that forwards to `rootFuncOfActionT` (both overloads behave the same in JS) | #778 (dead branch, and the zero-arity runtime throw added to it) |
| N7 | `OwnerNode.cs:16-18` `private const string CreationInsideApplyMessage = "…so " + "nothing…";` | `owner-node.ts:12` `= "…so " + "nothing…";` | `= "…so nothing…";` (a constant folded by Roslyn) | #787 |
| N8 | `if (a) … else if (b) … else if (c)` chains; `x is not null` | nested `else { if … }`; `!(x == null)` | `else if`; `x !== null` (or `x != null`) | #787 (low priority) |

No deviation needs a workaround in the code: none affects correctness or measurable speed in code
transpiled from C#. N6 can break hand-written TS callers, but the only TS caller today is test code,
and it passes a one-parameter callback.

## 4. Micro-benchmark: defensive `try/finally`, LinkStack wrapper, flags, `?? null`

The harness is in `bench/micro/` (README there has the exact commands). `prepare.ts` copies the
generated `metanui-reactive/src` into `bench/micro/.work/<variant>/` and applies the variant to the
copy, so the generated sources are never edited. Each variant runs in its own Bun process.

Variants (defined in `bench/micro/variants.ts`):

- **A (shipped):** `propagate`/`checkDirty` save `LinkStack.top`, call `propagateAbove`/`checkDirtyAbove` inside `try`, and call `LinkStack.truncate(base)` in `finally`.
- **B:** same wrapper and `truncate` call, without `try/finally`.
- **C:** no wrapper. The walk bodies are inlined into `propagate`/`checkDirty`, with no `truncate` (on a normal exit the stack is already back at its base).
- **D:** A with every `ReactiveFlags.X` replaced by its literal, across the package.
- **E:** A without `?? null` in `link-stack.ts`.

Workloads (`bench/micro/ops.ts`). One op is a write followed by `Reactivity.flush()`, with N = 1000:

- **deep:** a chain of 1000 computeds and one effect. One `propagate`, then a `checkDirty` that descends 1000 levels and pushes and pops 1000 LinkStack frames.
- **wide:** one signal, 1000 computeds and 1000 effects. One `propagate` across 1000 subscribers, then 1000 short `checkDirty` calls.
- **many:** 1000 independent signal → computed → effect chains, all written. 1000 `propagate` calls and 1000 `checkDirty` calls.

Each process warms up with 2000 ops, then takes 15 samples of 500 ops. Each table cell is the median
of three process runs of the per-op median, in µs per op, with the three runs in brackets.

### Wrapper and `try/finally` (equivalent to `run.ts 3 A,B,C`)

| Workload | A (shipped) | B (no try/finally) | C (inlined) |
|---|---|---|---|
| deep | 26.21 (47.59, 25.87, 26.21) | 26.47 (26.48, 26.40, 26.47) | 26.43 (26.30, 26.43, 26.74) |
| wide | 55.17 (55.17, 55.07, 55.28) | 55.24 (54.74, 56.01, 55.24) | 56.18 (55.83, 56.18, 56.19) |
| many | 54.63 (49.94, 59.19, 54.63) | 59.21 (59.21, 59.64, 58.86) | 60.60 (60.83, 60.60, 51.80) |

**This table cannot resolve an overhead below roughly 5–15%.** Runs of the same variant swing by
that much: `many` moves about 17% within A (49.94 to 59.19) and 15% within C, and one `deep` run of A
was an 82% outlier. No variant is consistently faster, which is all the table shows.

The per-call loop (`bench/micro/per-call.ts`) is the measurement that bounds the overhead. It calls
`DependencyGraph.checkDirty`/`propagate` directly, 10^7 times per sample, on a two-node graph where the
walk stops at once (median of 7 samples; the range covers two process runs):

| | A | B | C |
|---|---|---|---|
| `checkDirty` | 1.76–1.81 ns | 1.77–1.78 ns | 1.77–1.80 ns |
| `propagate` | 1.61 ns | 1.60 ns | 1.60–1.61 ns |

**Result: within noise on JavaScriptCore (Bun); per-call overhead under 0.05 ns; V8 not measured
(Task 8).** This covers the extra call plus the `try/finally` per `Propagate`/`CheckDirty` that Task 3
introduced. Task 8's benchmark should repeat the per-call loop on Node before Phase 2 renderers rely on
it.

These numbers come from the scratch version of the harness, with the same workloads, sampling and variant patches as the committed one, run on a quiet machine. A rerun of the committed harness while two other test
suites loaded the machine (load average about 32) swung by up to 2× between runs of the same variant,
and per-call values went from 1.8 ns to 50 ns. Rerun the harness on an idle machine. A later run of
the committed harness from a clean clone (load average about 18) reproduced the per-call result:
`checkDirty` 1.89–1.92 ns and `propagate` 1.63–1.66 ns across A, B and C.

### Literal flags (equivalent to `run.ts 3 A,D`)

| Workload | A (shipped) | D (literal flags) |
|---|---|---|
| deep | 26.20 (26.05, 26.20, 26.34) | 26.09 (26.10, 25.90, 26.09) |
| wide | 54.29 (54.06, 54.29, 54.55) | 54.74 (54.74, 54.65, 55.54) |
| many | 58.80 (58.80, 57.84, 59.48) | 51.74 (51.50, 51.74, 59.58) |

### No `?? null` on LinkStack reads (equivalent to `run.ts 3 A,E`, deep and wide only)

| Workload | A (shipped) | E (no `?? null`) |
|---|---|---|
| deep | 25.40 (25.59, 25.40, 25.39) | 25.65 (25.54, 25.72, 25.65) |
| wide | 53.60 (53.85, 53.60, 53.27) | 53.78 (53.22, 53.86, 53.78) |

Both are within noise, at the same 5–15% resolution limit (the `many` cell of D is bimodal). N1 is
emission noise, not measured overhead.

**Decision: keep the `try/finally`.** Its cost is within noise on Bun, as above. No user code reaches
it, because Computed caches every error and cleanups collect theirs. An engine or host error raised in
an inner walk *may* reach it: a broken invariant, or a JS `RangeError` from a deep stack, which
`toException` turns into an `Exception` that the enclosing Computed would catch. In that case, without
the `finally`, the inner walk's frames would stay on the shared LinkStack, and the outer walk would
later pop them and resume from stale links. **This path is untested:** no scenario raises such an error
inside a nested walk, and none can through the public API. The reason is written down in a `<remarks>`
on `DependencyGraph.Propagate`.

## 5. Scenario rename

`ErrorInNestedCheckDirtyLeavesGraphUsable` became `ErrorInMultiLevelDirtyCheckReachesReader`, titled
"error raised in a multi-level dirty check reaches the reader and later walks stay correct". It covers
a computed two levels below the reader that throws while the dirty check recomputes it. The error is
cached on the way up and reaches the reader, and a later walk over a branching graph is still correct.
It never exercised the stack-restore `finally`, because Computed catches the error inside the walk. Its
XML doc now says so. No public API can reach that `finally`, so it stays uncovered on purpose.

## 6. Existing Metano issues and workarounds

These were re-probed on Metano 3.1.0 with minimal C# in a scratch copy (section 7 gives the probe
sources), except #776 and #779. The last column is the status on Metano 3.2.0 (section 9).

| Issue | What | Workaround in code (3.1.0) | 3.1.0 | 3.2.0 |
|---|---|---|---|---|
| #768 | A type referenced only in a property setter body gets no import | `Signal.cs` private `Queue()` / `RejectWriteInsideComputation()` helpers | Reproduces: `throw new ArgumentOutOfRangeException("value")` with no import, TS2304 | **Fixed.** `Queue()` is inlined into the setter. `RejectWriteInsideComputation()` stays out of line on purpose (cold path) |
| #772 | Labeled statements are dropped: MS0001 warning plus a `/* TODO: unsupported IR statement LabeledStatement */` body | `DependencyGraph` `PropagateAbove` / `CheckDirtyAbove` rewrites, `LinkStack.PopNonNull` | Reproduces. The loop and the code after it are lost, and the local becomes `const` | **Fixed.** The upstream `top: while (true) … continue top;` form is restored and emits a native TS label |
| #773 | Discard `_ = expr` is emitted verbatim | `ComputedScenarios`, `OwnershipScenarios`, `ErrorScenarios.Read` | Reproduces: `_ = read();`, TS2304 | **Fixed.** Emitted as an expression statement (`writer.value;`) |
| #774 | `T? x = nonNull;` loses `\| null` | `DependencyGraph.ShallowPropagate` | Reproduces: `let current = node;`, TS2322 | **Fixed** for an explicit `T?`. A `var` local still loses `\| null` (section 9, M1) |
| #775 | `x!.A` does not narrow `x` for later uses | none (the site went away with LinkStack in 4db8b09) | Reproduces: `node!.id; … node.next`, TS18047 | **Fixed.** Later uses are emitted as `node!.next` |
| #776 | Import of a renamed type lost | none (did not reproduce in Task 5b) | Not re-probed | Still open upstream; not re-probed, no workaround |
| #778 | Overload dispatcher with identical conditions (dead branch) | `bench/reactivity` called `rootFuncOfActionT` directly | Reproduces. See N6 for the runtime consequence | **Fixed.** One branch, no `Function.length` test; MS0063 reports the shadowed overload (section 9) |
| #779 | Tuple deconstruction unsupported (MS0001) | `OwnershipScenarios.ComputedOwnedByRootIsDisposed` | Not re-probed | **Fixed.** Emitted as an array destructuring |
| #764/#765 | Package root resolves to the workspace `package.json`; `version` not written | `MetanoPackageRoot` in the scenarios project; seeded `version` | — | **Fixed.** Both removed; Metano recreates both `package.json` files in place, with `version` |
| #770 | Internal types need `[Transpile]` | `[Transpile]` on every internal type | — | **Fixed.** Removed; the types are still emitted |
| #794 | `null!`/`default!` of a non-generic reference type loses `!` | `FlushScenarios.Missing<T>` | — | Still open: `useScheduler(null)`, TS2345 |
| FR (filed after #780) | `@internal` for C# internal members | — | Partly visible in 3.1.0: internal *members* carry `/** @internal */`. Internal *types* (`Tracking`, `FlushLoop`, `DependencyGraph`, `LinkStack`, `Link`, `Teardown`) are still exported, unmarked, from the barrels and from `package.json` `exports`, so hand-written TS can mutate `Tracking.activeObserver` | Internal types without an explicit `[Transpile]` are no longer exported from the barrels; the `effects` and `scheduling` subpath exports are gone |

## 7. New Metano findings (filed)

These are the new findings from this audit, filed as danfma/metano#785 (N10), #786 (N9), #787 (N1–N5,
N7, N8) and added to #778 (N6). Toolchain: Metano
3.1.0 (compiler, Build.TypeScript and runtime), target ES modules, checked with `tsc` 5.9.3 and `tsgo`
7.0.0-dev.20260707.2 in `--strict` mode. Every repro is a member of a `[Transpile] public static class
Probes` unless stated otherwise.

### N1 (danfma/metano#787). Indexed read of a nullable-element array emits `?? null`

```csharp
private static ProbeNode?[] _items = new ProbeNode?[4];
public static ProbeNode? At(int index) => _items[index];
```

```ts
private static _items = /* @__PURE__ */ new Array(4).fill(null) as (ProbeNode | null)[];
static at(index: number): ProbeNode | null {
  return Probes._items[index] ?? null;
}
```

On .NET, an in-range read returns the element and an out-of-range read throws
`IndexOutOfRangeException`. The array is created already filled with `null`, so `?? null` can only
turn an out-of-range `undefined` into `null`. That hides a bug the .NET side would report. The emission
should be the bare indexed read. If out-of-range reads are meant to be caught, a bounds check would
match .NET, and silent `null` does not.

In the reactive core this sits in `LinkStack.Pop` (a hot path). It measured no slower on Bun, so it is
noise rather than overhead, but it is still a semantic difference.

### N2 (danfma/metano#787). `string +=` on a non-nullable local emits `(x ?? "") + …`

```csharp
public static string Append(int n)
{
    var log = "";
    for (var i = 0; i < n; i++) { log += "x"; }
    return log;
}
```

```ts
let log = "";
for (let i = 0; i < n; i++) {
  log = (log ?? "") + "x";
}
```

On .NET, `log` is a non-nullable `string` (NRT), and `string.Concat` treats a null operand as `""`. The
`?? ""` guard is only needed when the left side's flow state is maybe-null. Expected: `log += "x";`.
The same happens inside lambdas (`() => log += "1,"` becomes `() => log = (log ?? "") + "1,"`).

### N3 (danfma/metano#787). Comment inside an empty `catch` is dropped, and the unused binding is kept

```csharp
public static void Swallow(Action action)
{
    try { action(); }
    catch
    {
        // Deliberately ignored: the caller keeps its own error.
    }
}
```

```ts
try {
  action();
} catch (_err) {
}
```

On .NET, the empty handler swallows the exception, and the comment is the only explanation of why. The
generated TS looks like an accidental swallow. Expected: keep the comment, and use the ES2019 optional
binding `catch { … }` when the C# `catch` has no variable.

### N4 (danfma/metano#787). Static classes emit a public empty constructor

```csharp
[Transpile]
internal static class Tracking
{
    public static int Cycle;
}
```

```ts
export class Tracking {
  static cycle: number = 0;

  constructor() { }
}
```

On .NET, a static class cannot be instantiated (CS0712). The TS class can be (`new Tracking()`).
Expected: `private constructor() {}`, or no constructor at all. Classes with no declared constructor
(`ManualFlushScheduler`, the abstract `ReactiveNode`) also get an explicit `constructor() { }` that
could be omitted.

### N5 (danfma/metano#787). `catch (Exception e)` is lowered through a redundant alias

```csharp
public static string? MessageOf(Action action)
{
    try { action(); return null; }
    catch (Exception error) { return error.Message; }
}
```

```ts
} catch (e$) {
  const e0 = toException(e$);
  const error = e0;

  return error.message;
}
```

The behaviour is correct. Expected: `const error = toException(e$);`. There are 7 sites in the
reactive core: `computed.ts` ×2, `teardown.ts`, `root-node.ts` ×2, `effect-node.ts` ×2.

### N6 (danfma/metano#778). Overload dispatcher by arity throws for a zero-parameter callback (extends #778)

```csharp
public static T Run<T>(Func<int, T> body) => body(1);
public static void Run(Action<int> body) => Run(x => { body(x); return true; });
```

```ts
static run<T>(body: (arg: number) => T): T;
static run(body: (obj: number) => void): void;
static run(...args: unknown[]): any {
  if (args.length === 1 && typeof args[0] === "function" && args[0].length === 1) {
    return Probes.runFuncOfInt32T(args[0] as any);
  }
  if (args.length === 1 && typeof args[0] === "function" && args[0].length === 1) {
    Probes.runActionOfInt32(args[0] as (obj: number) => void);
    return;
  }
  throw new Error("No matching overload for run");
}
```

Besides the dead second branch (#778), the dispatch tests `Function.length`. A TS caller that passes a
callback ignoring its argument, `Probes.run(() => 42)`, typechecks, because `() => number` is assignable
to `(arg: number) => number`. At runtime it throws `Error: No matching overload for run`. The C# call
`Run(_ => 42)` works on .NET.

Real hit: `Reactivity.root(() => { … })` from hand-written TS (the benchmark of this audit). Expected:
when the overloads differ only in delegate return type, which cannot be told apart at runtime, emit one
implementation that forwards to the value-returning overload, and do not dispatch on arity. More
generally, `Function.length` is not a reliable discriminator (default and rest parameters, and callbacks
that ignore their arguments, all break it).

### N7 (danfma/metano#787). Constant string concatenation is not folded

```csharp
private const string Joined = "a" + "b";
public static string Constant() => Joined;
```

```ts
private static readonly joined: string = "a" + "b";
```

On .NET, Roslyn folds the constant to `"ab"` at compile time. The emitted code concatenates at module
load. That is cheap, but it means `const` values are not emitted from `IFieldSymbol.ConstantValue`.
Expected: `private static readonly joined: string = "ab";`. The same holds for interpolated constants.

### N8 (danfma/metano#787). `else if` chains are nested, and `is not null` becomes `!(x == null)` (low priority)

```csharp
if ((flags & Dirty) != 0) { A(); }
else if ((flags & Pending) != 0) { B(); }
else if (flags == None) { C(); }

if (observer is not null) { Link(); }
```

```ts
if ((flags & ReactiveFlags.Dirty) !== 0) {
  this.recompute();
} else {
  if ((flags & ReactiveFlags.Pending) !== 0) {
    this.recomputeIfDependencyChanged(flags);
  } else {
    if (flags === ReactiveFlags.None) {
      this.runFirst();
    }
  }
}

if (!(observer == null)) { … }
```

The behaviour is identical. The output is harder to read and to diff against hand-written ports (the
`propagate` port of alien-signals nests four levels). Expected: `else if`, and `observer != null` (or
`!== null` when the type excludes `undefined`).

### N9 (danfma/metano#786). metano-runtime 3.1.0 fails `tsgo --strict` without `skipLibCheck`

Repro: any generated package that imports `metano-runtime`, checked with
`tsgo --strict --target esnext --module esnext --moduleResolution bundler` and without `skipLibCheck`.

```
node_modules/@js-temporal/polyfill/index.d.ts(1156,20): error TS2430:
Interface '…@js-temporal/polyfill…Intl.DateTimeFormat' incorrectly extends interface 'Intl.DateTimeFormat'.
```

The runtime's `.d.ts` files (`system/time-span`, `date-time-offset`, `temporal-helpers`,
`argument-guards`, `time-span-format`) import `@js-temporal/polyfill` 0.5.1. Its declarations clash with
the built-in Temporal types of TypeScript 7's `esnext` lib. `tsc` 5.9.3 is clean, and so is tsgo with
`--lib es2024` or `--skipLibCheck`. This is a .NET-independent packaging issue. Consumers on TS 7 with
`lib: esnext` and full lib checking get an error from a package they never imported directly. Possible
fixes: use the native `Temporal` types when the lib provides them, or keep the polyfill types out of
the public `.d.ts` surface.

### N10 (danfma/metano#785). Metano warnings never fail the build, and an MSBuild-level escalation does not stick

Repro: a `[Transpile]` class with a labeled statement (#772) in a project with
`<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`.

```csharp
[Metano.Annotations.Transpile]
internal static class GateProbe
{
    public static int Count(int[] items)
    {
        var n = 0;
        top:
        while (n < items.Length) { n++; continue top; }
        return n;
    }
}
```

What happens:

1. `dotnet build` prints `warning MS0001: Statement 'LabeledStatement' is not supported by the transpiler.` and `Build succeeded.` (exit 0). The emitted `count` is `const n = 0; /* TODO: unsupported IR statement LabeledStatement */; return n;`. The TS returns 0 where .NET returns `items.Length`. `TreatWarningsAsErrors` only governs `csc`, and the transpile is an `Exec` in `Metano.Build.Common.targets` (`_MetanoTranspileWorker`).
2. Neither `Metano.Build.TypeScript.targets` (the settings list of `_MetanoResolveTs`) nor the `metano-typescript` CLI (`--help`) has a warnings-as-errors switch.
3. With `-p:MSBuildTreatWarningsAsErrors=true` or `-p:MSBuildWarningsAsErrors=MS0001`, the first build fails (`error MS0001`, exit 1). But the tool has already written `<output>/.metano-stamp`, so the next build sees the transpile as up to date, prints no diagnostic, and succeeds with the broken TS in place.
4. A Metano *error* (for example MS0038 for a `union`) writes no stamp, so it fails every build. Only warnings slip through.

Expected, any of these:

- honour `TreatWarningsAsErrors`/`WarningsAsErrors` (or a `MetanoTreatWarningsAsErrors` setting passed as a CLI flag);
- do not write the stamp when the run reported warnings that the build escalated;
- replay the cached diagnostics on up-to-date builds.

This also bears on the earlier policy "dropped-code placeholders become errors instead of MS0001
warnings", which 3.1.0 does not apply yet.

**Fixed in 3.2.0** (section 9): the build passes `--warn-as-error` and the project's warning lists to
the CLI. On 3.1.0, Metanui left `Directory.Build.props` unchanged. No supported Metano property exists, and the
MSBuild-level switch only protects a clean build. The stamp is gitignored, so that does include CI.

## 8. Probe sources

The probes for N1–N8, #768, #773, #774, #775 and #778 were one file added to a scratch copy of
`src/Metanui.Reactive`, built with Metano 3.1.0. The repros above are excerpts from it. The output was
checked with `tsc --strict`:

```
probes.ts(11,5):  error TS2304: Cannot find name '_'.                         (#773)
probes.ts(19,7):  error TS2322: Type 'ProbeNode | null' is not assignable…     (#774)
probes.ts(28,19): error TS18047: 'node' is possibly 'null'.                    (#775)
setter-only-import.ts(32,17): error TS2304: Cannot find name 'ArgumentOutOfRangeException'. (#768)
```

## 9. Metano 3.2.0 re-check

Toolchain: Metano, Metano.Build.TypeScript, Metano.Compiler.TypeScript and metano-runtime 3.2.0;
`tsc` 5.9.3 and `tsgo` 7.0.0-dev.20260707.2 in `--strict` mode, with the scratch configs of section 2.

- `dotnet build`: 0 warnings, 0 errors. Warnings now fail the build (#785). The only Metano warning the
  upgrade raised is MS0063 (below), exempted with a commented `NoWarn` in `Metanui.Reactive.csproj`.
- `tsc --strict`: 0 diagnostics on both packages. `tsgo --strict` still reports the
  `@js-temporal/polyfill` TS2430 of N9 (#786, open).
- Section 6 gives the status of each issue. #787 (N1–N5, N7, N8) is unchanged: `?? null` on `LinkStack`
  reads, `(log ?? "") +`, `catch (_err)`, empty constructors, `const e0 = toException(e$)`, the
  unfolded constant and nested `else { if }` are all still emitted.
- Generated `package.json`: `metano-runtime` is `^3.2.0`; the unused `imports` (`#/*`) block of
  `metanui-reactive` is no longer emitted; `override` is now emitted on overriding members.

### MS0063: the `root` overloads

`Reactivity.Root<T>(Func<Action, T>)` and `Reactivity.Root(Action<Action>)` differ only in the delegate's
return type. 3.2.0 emits one dispatcher branch that forwards to `rootFuncOfActionT`, without the
`Function.length` test, and reports MS0063 for the void overload. That is the TS surface the audit asked
for (N6): the void overload only wraps the other one, and C# call sites bind to `rootActionOfAction`
directly. `tests/js/reactive/root-dispatch.test.ts` covers `Reactivity.root(() => 42)` and the
one-parameter form; with the 3.1.0 dispatcher the first test fails with `No matching overload for root`.

### New findings

**M1. `var` local loses `| null` when a later assignment is null (extends #774).**

```csharp
public static int Count(ProbeNode start)
{
    var current = start;
    var n = 0;
    while (current is not null) { n++; current = current.Next; }   // Next is ProbeNode?
    return n;
}
```

```ts
let current = start;          // typed ProbeNode
…
current = current.next;       // TS2322: 'ProbeNode | null' is not assignable to 'ProbeNode'
```

On .NET, a `var` local of a reference type is nullable-annotated (`ProbeNode?`), so the assignment is
valid and the loop counts the list. Expected: `let current: ProbeNode | null = start;` whenever a later
assignment can be null. `DependencyGraph.ShallowPropagate` spells out `Link?` for this, with a
`// Metano:` comment.

**M2. Deleting a C# source file does not rerun the transpile.** After a build, delete a `.cs` file
that declared a transpiled type and build again: the transpile is skipped as up to date, and the
deleted type's `.ts` file and barrel export stay in the output (seen with a temporary probe file).
Deleting `.metano-stamp` forces the rerun. Expected: track the input file list, not only timestamps.

**M3. A redundant `!` after a null test (low priority).** In `ErrorScenarios`, `last is not null &&
last.Message == …` (an `Exception?` local) and `error is not null && error.Message == …` now emit
`!(last == null) && last!.message`. The same test on an `Exception?` parameter emits no `!`. The
behaviour is correct; the `!` is noise, probably from the #775 fix.

