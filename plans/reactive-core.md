# Reactive Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan phase by phase. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Metanui's reactive core in C# (signals, computeds, split effects, ownership, errors, flush scheduling) with one scenario suite that passes on .NET and on the Metano-transpiled TypeScript, plus a js-reactivity-benchmark comparison against `@solidjs/signals`.

**Architecture:** A port of the alien-signals 3.2.1 graph engine (intrusive doubly linked dependency lists, flag bitfield) under Solid 2.0 public semantics (writes deferred to a flush, split `compute`/`apply` effects, owner tree). Scenarios are written once in C#, transpiled with the core, and driven by a thin TUnit adapter and a thin `bun test` adapter.

**Tech Stack:** .NET 11 / C# 15, Metano 3.1.0 (`Metano`, `Metano.Build.TypeScript`, tool `Metano.Compiler.TypeScript`), `metano-runtime` ^3.1.0, TUnit 1.87.x, Bun.

**Spec:** `docs/design/0001-reactive-core.md` (read it before any task; section numbers below refer to it).

## For Future Agents

As work proceeds: mark checkboxes `- [x]` as items complete; when a phase is done, set its status to `Complete` and write its **Phase Summary** (what was done, key decisions, Metano findings with repro status, anything needed to continue with zero context); run the phase's **Verification Plan** and record the result before moving on. When all phases are done, fill in **Final Recap** and **Deployment Plan**.

Execution: subagent-driven (`superpowers:subagent-driven-development`), one implementer and one reviewer per phase. The controller session owns this file and updates it after each phase. Report Metano transpiler defects to the Metano session (`metano-41`) one message per defect: minimal C# repro, emitted TS, .NET behaviour.

## Global Constraints

- `net11.0`, `LangVersion 15`, Nullable, TreatWarningsAsErrors, Central Package Management with floating versions (`Directory.Packages.props`).
- Metano from NuGet only; never a ProjectReference or local path to Metano.
- No C# 15 `union` declarations in transpiled projects (MS0038). `closed` hierarchies are allowed.
- Bun only for JS. Never edit `targets/js/*/src` by hand.
- Semantics contract: `@solidjs/signals` **2.0.4**. Engine reference: alien-signals **3.2.1** (`stackblitz/alien-signals@8734d386d925025d0e99419bd9161c17b112c5ee`, `src/system.ts`, `src/index.ts`); record this commit in a header comment of the ported file.
- Create signals and computeds only through `Reactivity.Signal(...)` / `Reactivity.Computed(...)`; their constructors are internal (maintainer decision, Task 5b).
- No `implicit operator T`, no combining operators on `Signal<T>`/`Computed<T>` (spec 6.1).
- Hot path (reads, `link`, `propagate`, `checkDirty`): no lambda, no allocation, no interface dispatch, no `List<T>`.
- Metano emits something wrong or slow → visible workaround with `// Metano #<issue>` and an issue reported (through the maintainer or the Metano session); never silent.
- Code rules: `.claude/rules/backend.md`; hand-written TS: `.claude/rules/frontend.md`. English in all artifacts. Conventional commits, infinitive verb.
- Out of Phase 1 (spec 11, builder's calls): `OnSettled` (no renderer yet) and the .NET thread-affinity check.
- Work on branch `feat/reactive-core` (no remote yet, so no worktree). Commit only after the maintainer has authorized commits for this execution.

## Review Focus

1. An effect whose `apply` writes a signal its own `compute` reads must throw after the pass limit (100), not hang. → Phase 4, `EffectWriteLoopThrows`.
2. Disposing a root from inside an `apply` during a flush must not run any still-queued effect of that root. → Phase 5, `DisposeDuringFlushSkipsQueuedEffects`.
3. A computed whose dependencies change conditionally must stop reacting to the dependency it no longer reads. → Phase 3, `DynamicDependencyIsDropped`.
4. Writing a record that is value-equal to the current one must not re-run any effect. → Phase 4, `EqualRecordWriteDoesNotRerun`.
5. One throwing effect must not stop the other effects of the same pass. → Phase 6, `ThrowingEffectDoesNotStopOthers`.

---

## File Structure

```
src/Metanui.Reactive/                      (transpiled → targets/js/metanui-reactive)
  Signal.cs                 public Signal<T>
  Computed.cs               public Computed<T>
  Reactivity.cs             public static API: Root, Effect, OnCleanup, Untrack, Flush, ErrorBoundary, Scheduler
  IFlushScheduler.cs        public port + ManualFlushScheduler
  Graph/ReactiveFlags.cs    internal [Flags] enum
  Graph/Link.cs             internal sealed class
  Graph/ReactiveNode.cs     internal abstract class (deps/subs lists, flags, Update/Notify/Unwatched)
  Graph/DependencyGraph.cs  internal static: Link, Unlink, Propagate, CheckDirty, ShallowPropagate (alien-signals port)
  Ownership/OwnerNode.cs    internal abstract : ReactiveNode (parent, first child, next sibling, cleanup chain, error handler)
  Ownership/RootNode.cs     internal sealed : OwnerNode
  Ownership/CleanupEntry.cs internal sealed class (singly linked)
  Effects/EffectNode.cs     internal sealed : OwnerNode
  Scheduling/FlushLoop.cs   internal static: pending writes, effect queue, Flush passes, pass limit
  Tracking.cs               internal static: ActiveObserver, CurrentOwner
src/Metanui.Reactive.Scenarios/            (transpiled → targets/js/metanui-reactive-scenarios)
  IExpect.cs, Scenario.cs, ScenarioRunner.cs, ReactiveScenarios.cs
  SignalScenarios.cs, ComputedScenarios.cs, EffectScenarios.cs, OwnershipScenarios.cs, ErrorScenarios.cs
tests/Metanui.Reactive.Tests/              (.NET only, TUnit)
  ReactiveScenarioTests.cs, ThrowingExpect.cs, SynchronizationContextSchedulerTests.cs
tests/js/reactive/                         (hand-written TS, bun test; package metanui-reactive-tests)
  package.json, reactive.test.ts, microtask-scheduler.test.ts
bench/reactivity/                          (hand-written TS)
  package.json, metanui.framework.ts, solid2.framework.ts, run.ts, README.md
scripts/bench-reactivity.sh
```

---

## Task 1: Scenario pipeline on both platforms (Phase 1)
Status: Complete   <!-- Not started | In progress | Complete -->


Proves that C# scenarios transpile with the core and run under TUnit and `bun test`. Ships the smallest real behaviour: a `Signal<T>` that returns its initial value.

**Files:**
- Delete: `src/Metanui.Reactive/Placeholder.cs`
- Create: `src/Metanui.Reactive/Signal.cs`
- Create: `src/Metanui.Reactive.Scenarios/{Metanui.Reactive.Scenarios.csproj,AssemblyInfo.cs,IExpect.cs,Scenario.cs,ScenarioRunner.cs,ReactiveScenarios.cs,SignalScenarios.cs}`
- Create: `tests/Metanui.Reactive.Tests/{Metanui.Reactive.Tests.csproj,ReactiveScenarioTests.cs,ThrowingExpect.cs}`
- Create: `tests/js/reactive/{package.json,reactive.test.ts}`
- Modify: `Metanui.slnx` (add both projects), `Directory.Packages.props` (add `TUnit` `*`), `package.json` (workspaces `["targets/js/*", "tests/js/*", "bench/*"]`)

**Interfaces:**
- Produces:
  - `public sealed class Signal<T>(T initialValue)` with `public T Value { get; }` (setter arrives in Phase 2).
  - `public interface IExpect { void Equal<T>(T expected, T actual, string label); void IsTrue(bool condition, string label); }`
  - `public sealed record Scenario(string Name, Action<IExpect> Run);`
  - `public static class ScenarioRunner { public static void Run(Scenario scenario, IExpect expect); public static Exception? Catch(Action action); }`. Phase 1 makes `Run` just invoke; Phase 5 wraps it in a root.
  - `public static class ReactiveScenarios { public static Scenario[] All { get; } }`: the concatenation of each `*Scenarios.All` array; every later phase appends its class here.
  - Scenario convention: each `*Scenarios` class has `public static Scenario[] All` and one `private static void <Name>(IExpect expect)` per scenario; scenario names are sentences (`"signal reads its initial value"`).
- Scenarios project: `[assembly: TranspileAssembly]`, `[assembly: EmitPackage("metanui-reactive-scenarios")]`, `MetanoOutputDir` `../../targets/js/metanui-reactive-scenarios/src`, `MetanoClean` true, ProjectReference to `Metanui.Reactive`.

- [x] **Step 1: Write the scenario** `SignalScenarios.ReadsInitialValue`: `expect.Equal(42, new Signal<int>(42).Value, "initial value")`; also a record case: `expect.Equal(new Point(1, 2), new Signal<Point>(new Point(1, 2)).Value, "record value")` with `private sealed record Point(int X, int Y)` in the scenarios file.
- [x] **Step 2: Write the .NET adapter.** `ThrowingExpect : IExpect` throws `InvalidOperationException($"{label}: expected {expected}, got {actual}")` on mismatch, using `EqualityComparer<T>.Default`. `ReactiveScenarioTests` has `public static IEnumerable<Func<Scenario>> Cases()` over `ReactiveScenarios.All`, and `[Test, MethodDataSource(nameof(Cases)), NotInParallel] public void Runs(Scenario scenario) => ScenarioRunner.Run(scenario, new ThrowingExpect());`. Make TUnit display `scenario.Name` (override `ToString` on `Scenario` → `Name`).
- [x] **Step 3: Write the Bun adapter** `tests/js/reactive/reactive.test.ts`: `for (const scenario of ReactiveScenarios.all) test(scenario.name, () => ScenarioRunner.run(scenario, bunExpect))`, with `bunExpect` implementing the transpiled `IExpect` through `expect(actual, label).toEqual(expected)` / `toBe(true)`. `package.json` depends on `metanui-reactive-scenarios` and `metanui-reactive` via `workspace:*` and on `metano-runtime` ^3.1.0.
- [x] **Step 4: Run to see it fail.** Run `dotnet build`. Expected: a compile error, because `Signal<T>` does not exist yet.
- [x] **Step 5: Implement `Signal<T>`** (constructor and `Value` getter over a private field).
- [x] **Step 6: Run both suites.** Run `dotnet build && dotnet test tests/Metanui.Reactive.Tests && bun install && bun test tests/js/reactive`. Expected: 1 scenario passing on each side.
- [x] **Step 7: Inspect the generated TS.** Check that `targets/js/metanui-reactive-scenarios/src` imports `metanui-reactive` as a package (not a relative path into another package), that `Scenario[]` is a native array, and that `IsTrue`/`Equal` keep usable names (`isTrue`, `equal`). Any deviation is a Metano finding: note it in the task report with a repro.
- [x] **Step 8: Commit** `test: add shared scenario pipeline for the reactive core`.

**Fallback:** if Step 7 shows cross-package imports or delegates in records cannot work, stop and report. The spec's fallback (two suites in lockstep by scenario name) needs the maintainer's go-ahead.

### Verification Plan
- `dotnet build && dotnet test tests/Metanui.Reactive.Tests` → 1 scenario passes
- `bun install && bun test tests/js/reactive` → the same scenario passes

### Phase Summary
Done in 19a72d5, 372d21a. Verification on 2026-11-25: 1 scenario passes on TUnit and 1 on `bun test`, and a mutation check fails both. The task review approved it with no findings above Minor.
- The pipeline works. Scenarios live in `src/Metanui.Reactive.Scenarios`, which is transpiled to the `metanui-reactive-scenarios` package and imports `metanui-reactive` as a package. `Scenario[]` becomes a native array, and the port's members come out as `equal`/`isTrue`. The fallback (two suites) is not needed.
- The Bun adapter compares with metano-runtime's `defaultEquals`, which mirrors .NET `EqualityComparer<T>.Default`. One known divergence: arrays compare by element in TS and by reference in .NET. Scenarios should assert on scalars or records, never on arrays.
- Changes made outside the brief (ruled on in the ledger):
  - `MetanoPackageRoot` in the scenarios csproj, because Metano otherwise rewrites the workspace-root package.json;
  - a hand-seeded `"version": "1.0.0"` in `targets/js/metanui-reactive/package.json`, because Metano emits `^1.0.0` without writing a version;
  - `global.json` uses the Microsoft.Testing.Platform runner, which `dotnet test` on SDK 11 requires;
  - `MetanoSourceCondition=bun` in Directory.Build.props, so `bun test` runs the TS sources without a dist build.
- Both Metano defects were reported to the Metano session. Remove the workarounds when they are fixed.

---

## Task 2: Signal writes, flush and scheduler port (Phase 2)
Status: Complete   <!-- Not started | In progress | Complete -->


**Files:**
- Modify: `src/Metanui.Reactive/Signal.cs`
- Create: `src/Metanui.Reactive/{IFlushScheduler.cs,Reactivity.cs,Tracking.cs}`, `src/Metanui.Reactive/Scheduling/FlushLoop.cs`, `src/Metanui.Reactive/Graph/{ReactiveFlags.cs,Link.cs,ReactiveNode.cs}`
- Modify: `src/Metanui.Reactive.Scenarios/SignalScenarios.cs`

**Interfaces:**
- Produces:
  - `Signal<T>(T initialValue, IEqualityComparer<T>? comparer = null) : ReactiveNode`; `T Value { get; set; }`; `T Peek()`.
  - `public interface IFlushScheduler { void Schedule(Action flush); }`; `public sealed class ManualFlushScheduler : IFlushScheduler` (stores nothing: flushes happen only through `Reactivity.Flush()`).
  - `public static partial class Reactivity { public static IFlushScheduler Scheduler { get; set; } /* default ManualFlushScheduler */ public static void Flush(); }`
  - Internal: `[Flags] enum ReactiveFlags { None = 0, Mutable = 1, Watching = 2, RecursedCheck = 4, Recursed = 8, Dirty = 16, Pending = 32 }` (alien-signals values; bits 64+ reserved, spec 5.4); `sealed class Link` (fields `Version`, `Dep`, `Sub`, `PrevSub`, `NextSub`, `PrevDep`, `NextDep`); `abstract class ReactiveNode` (fields `Deps`, `DepsTail`, `Subs`, `SubsTail`, `Flags`; `abstract bool Update()`, `abstract void Notify()`, `virtual void Unwatched()`).
  - `internal abstract class SignalNode : ReactiveNode { internal SignalNode? NextPending; internal abstract void CommitPending(); }`, which `Signal<T>` extends. `FlushLoop.Enqueue(SignalNode)` chains the signals that have a pending value through `NextPending` (no collection, no interface). The first enqueue in an idle state calls `Reactivity.Scheduler.Schedule(Reactivity.Flush)` once.

- [x] **Step 1: Write the scenarios** in `SignalScenarios`:
  - `WriteIsInvisibleUntilFlush`: set `Value = 5` on a `Signal<int>(0)`; `Value` and `Peek()` both still return `0`; after `Reactivity.Flush()`, both return `5`.
  - `LastWriteWins`: writes 1, 2, 3 then flush → 3.
  - `FlushWithoutWritesIsNoOp`: `Flush()` twice with nothing pending does not throw.
  - `CustomComparerIsUsed`: a comparer that treats all strings case-insensitively; writing `"A"` over `"a"` and flushing keeps `"a"`.
- [x] **Step 2: Run both suites.** Expected: the new scenarios fail (setter missing).
- [x] **Step 3: Implement.** On flush, commit each pending value when `!comparer.Equals(current, pending)` (default `EqualityComparer<T>.Default`), then call `DependencyGraph` propagation. A no-op stub is fine until Phase 3; leave a `// propagated in Phase 3` only if the build needs the call site.
- [x] **Step 4: Run both suites.** Expected: all pass.
- [x] **Step 5: Inspect the TS** of `Signal`, `FlushLoop`, `ReactiveFlags` and the default comparer. Expected: `get value()` is a field read plus a tracking check, the flags are numbers, and `EqualityComparer<T>.Default` maps to something without a per-call allocation. Otherwise it is a Metano finding.
- [x] **Step 6: Commit** `feat: add signal writes deferred to a flush`.

### Verification Plan
- `dotnet build && dotnet test tests/Metanui.Reactive.Tests && bun test tests/js/reactive` → all Signal scenarios pass on both

### Phase Summary
Done in 22546b3. 5/5 scenarios pass on .NET and on Bun. The task review approved it with no findings above Minor.
- `ReactiveNode`/`SignalNode` are `public abstract` with `internal` members, because of CS0060. Outside code cannot implement them. New node types in Tasks 3–5 follow the same pattern.
- Internal types need `[Transpile]` (Metano #770; it will become automatic). The scheduler is stored in `FlushLoop.Scheduler` to avoid MS0005. The setter calls a private `Queue()` because of Metano #768. The scenario comparer uses `ToLowerInvariant` because of Metano #769.
- `FlushLoop.Run` is still a single per-node loop with a commented propagation site. Phase 3 must restructure it into phases (commit all, then propagate).
- Phase 4 inherits these review notes:
  - a write during `Run` schedules a redundant flush, since there is no `_running` guard;
  - a throwing user scheduler leaves `_scheduled`/`_hasPending` stuck at true;
  - a nested `Flush()` from inside an apply is not guarded.

---

## Task 3: Dependency graph and Computed (Phase 3)
Status: Complete   <!-- Not started | In progress | Complete -->


**Files:**
- Create: `src/Metanui.Reactive/Graph/DependencyGraph.cs`, `src/Metanui.Reactive/Computed.cs`, `src/Metanui.Reactive.Scenarios/ComputedScenarios.cs`
- Modify: `Signal.cs`, `Tracking.cs`, `Scheduling/FlushLoop.cs`, `ReactiveScenarios.cs`

**Interfaces:**
- Consumes: Phase 2 node, link and flags types.
- Produces:
  - `public sealed class Computed<T>(Func<T> compute, IEqualityComparer<T>? comparer = null)`; `T Value { get; }`; `T Peek()`.
  - `internal static class DependencyGraph { Link(ReactiveNode dep, ReactiveNode sub, int version); Link? Unlink(Link link, ReactiveNode sub); void Propagate(Link link); bool CheckDirty(Link link, ReactiveNode sub); void ShallowPropagate(Link link); }`: a line-by-line port of alien-signals `system.ts` (the `Stack<T>` helper becomes an internal sealed class; `update`/`notify`/`unwatched` callbacks become the `ReactiveNode` abstract members).
  - `Tracking.ActiveObserver` (`ReactiveNode?`), and a global `int Cycle` version counter as in alien-signals `index.ts`.

- [x] **Step 1: Write the scenarios** in `ComputedScenarios`:
  - `IsLazy`: the compute function counter stays 0 until the first `Value` read.
  - `IsCached`: two reads with no write → 1 run.
  - `RecomputesAfterFlush`: `doubled` of `count`; write 5, flush → `doubled.Value == 10`, 2 runs.
  - `DiamondIsGlitchFree`: `a`; `b = a+1`; `c = a*2`; `d = b+c` that records every value it sees; after writing `a = 2` and flushing, `d` has seen only `[1, 7]` (initial `a=0` → `b=1,c=0` → 1; then 3+4 = 7).
  - `EqualResultStopsPropagation`: `parity = count % 2`; `downstream` reads `parity`; writing `count` 0 → 2 → flush must not re-run `downstream`.
  - `DynamicDependencyIsDropped` (Review Focus 3): `flag=true`, `a`, `b`; `pick = flag ? a : b`; read; set `flag=false`, flush, read; then write `a`, flush; `pick`'s run counter must not increase.
  - `WriteInsideComputeThrows`: a computed that writes a signal throws `InvalidOperationException` on read (check with `ScenarioRunner.Catch`). First confirm the behaviour in `@solidjs/signals` 2.0.4 (its tests or source). If Solid only warns, match that instead, and write down what you found in the task report.
- [x] **Step 2: Run both suites.** Expected: the new scenarios fail.
- [x] **Step 3: Implement** the port and `Computed<T>`. Signal and computed `Value` getters call `DependencyGraph.Link` when `Tracking.ActiveObserver` is not null. Flush commit calls `Propagate` on the signal's `Subs`.
- [x] **Step 4: Run both suites.** Expected: all pass.
- [x] **Step 5: Hot-path audit** of the generated `dependency-graph.ts`, `computed.ts` and `signal.ts`: no closures, no `new` outside `Link`, no `List`, no interface calls. Record the findings.
- [x] **Step 6: Commit** `feat: add dependency graph and computed`.

### Verification Plan
- Both suites green, Computed scenarios included
- Hot-path audit notes recorded in the Phase Summary

### Phase Summary
Done in dc11212 and 4db8b09. 13/13 scenarios pass on .NET and Bun, and `tsc --strict` passes on the generated package. The task review (opus) compared the port line by line with alien-signals @8734d38 and approved it, with no finding above Minor.
- **Port deviations, all behaviour-equivalent:**
  - no `innerWrite` parameter;
  - the labeled `continue top` loops are restructured, because Metano drops labeled statements (#772);
  - the upstream per-branch `Stack` nodes became `LinkStack`, a static `Link?[]` with a top index. Each `Propagate` and `CheckDirty` saves its base on entry and restores it in a `finally`, so re-entrant walks are safe (scenario `NestedDirtyCheck`).
- **Flush:** it commits every pending write first, then propagates each signal that changed using alien-signals' `trigger` idiom (`Propagate` + `ShallowPropagate`). Signals are never left `Dirty`. The seam for the effect phases is in `FlushLoop`.
- **Hot-path audit:**
  - the only `new` in `dependency-graph.ts` is `new Link`;
  - there are no closures, and the flags are numeric;
  - `Propagate`/`CheckDirty` each cost one extra call plus a `try/finally` (measure it in Phase 7);
  - `link-stack.ts` emits `?? null` on every indexed read (record it in Phase 7).
- **Solid 2.0.4:** writing a signal inside an owned scope throws in dev and test builds. We match that with `InvalidOperationException`, but the check is observer-based until Phase 5 makes it owner-based.
- **Metano issues behind the workarounds:**
  - #768: setter-only import, which also hits exception types;
  - #772: labeled statements;
  - #773: discard assignment;
  - #774: nullable local annotation;
  - #775: no narrowing after `!`.
- **Follow-ups:**
  - Phase 4: `Notify` must clear `Watching`; the flush must still propagate or unchain already-committed signals when a comparer or `Notify` throws.
  - Phase 5: owner-based write check. Spec 4.2 says an unowned computed lives "until unreachable", but it stays linked from its sources' `Subs` until it is unwatched. Settle this.
  - Phase 6: a computed that throws before capturing any dependency is stuck forever; also cover the exception path of the stack restore.

---

## Task 4: Split effects and the flush loop (Phase 4)
Status: Complete   <!-- Not started | In progress | Complete -->


**Files:**
- Create: `src/Metanui.Reactive/Effects/EffectNode.cs`, `src/Metanui.Reactive.Scenarios/EffectScenarios.cs`
- Modify: `Reactivity.cs`, `Scheduling/FlushLoop.cs`, `ReactiveScenarios.cs`

**Interfaces:**
- Consumes: Phases 2–3.
- Produces:
  - `public static void Reactivity.Effect<T>(Func<T> compute, Action<T, T?> apply)`. Cleanups registered with `Reactivity.OnCleanup` while `apply` runs belong to that apply, and run before the next apply and on disposal. This replaces Solid's "apply returns a cleanup" (same semantics, C# shape; write it down in the XML doc).
  - `FlushLoop` passes, per spec 4.7: commit writes → propagate → run queued effect computes in queue order → run collected applies → repeat while new writes exist. `const int MaxPasses = 100`; exceeding it throws `InvalidOperationException("Reactive flush exceeded 100 passes; an effect is probably writing a signal it depends on.")`.
- Note: until Phase 5, effects live under no owner. Phase 5 attaches them.

- [x] **Step 1: Write the scenarios** in `EffectScenarios` (all drive the graph with `Reactivity.Flush()`):
  - `ComputeRunsOnCreationApplyOnFlush`: after `Effect` the compute count is 1 and the apply count is 0; after `Flush()` the apply runs once with `(value, default)`.
  - `ApplyReceivesPrevious`: the apply after a write gets `(new, old)`.
  - `AppliesRunAfterAllComputes`: two effects log `"c1","c2","a1","a2"` in that order for one write both read.
  - `ApplyIsUntracked`: a signal read only inside `apply` does not re-trigger the effect.
  - `ApplyCleanupRunsBeforeNextApply`: the `OnCleanup` registered in apply #1 runs before apply #2.
  - `WriteInApplySchedulesAnotherPass`: apply of effect A writes `s`; effect B reads `s`; one `Flush()` call runs B's apply.
  - `EffectWriteLoopThrows` (Review Focus 1): an apply that increments the signal its compute reads makes `Flush()` throw the pass-limit exception.
  - `EqualRecordWriteDoesNotRerun` (Review Focus 4): writing `new Point(1, 2)` over an equal `Point` does not re-run compute or apply.
- [x] **Step 2: Run both suites.** Expected: the new scenarios fail.
- [x] **Step 3: Implement** `EffectNode` (`Notify` enqueues it on the effect queue, chained through a `NextQueued` field) and the pass loop.
- [x] **Step 4: Run both suites.** Expected: all pass.
- [x] **Step 5: Commit** `feat: add split effects and the flush loop`.

### Verification Plan
- Both suites green, Effect scenarios included (pass-limit scenario throws, does not hang)

### Phase Summary
Done in 9782894 and e221a20. 26/26 scenarios pass on .NET and Bun, and strict tsc is clean on both packages. The review needed one fix round: `OnCleanup` from a computation nested inside an apply was attaching to the outer apply. That is fixed, and the re-review approved it.
- **Effect node shape:** `EffectNode` is internal abstract and non-generic, which the flush queues need. `SplitEffect<T>` is internal sealed and holds the typed compute/apply. `Notify` clears `Watching`.
- **Flush guards:**
  - `_running`: a write during a flush is drained by the running loop, with no extra schedule;
  - `Reactivity.Flush()` during a flush is a documented no-op;
  - a throwing scheduler resets `_scheduled` and rethrows; the write stays queued, and the next write requests a flush again;
  - the commit runs propagation in a `finally`, and the remaining pending signals are unchained.
- **Pass limit:** `MaxPasses = 100` throws the exact message and **discards pending writes**, which differs from Solid. This keeps the global graph usable.
- **`OnCleanup`:** for now it attaches to the running apply only when `ActiveObserver is null`. Phase 5 must replace this with owner-based attachment and must not add `Untrack` before that (Untrack nulls the observer and would reopen the leak).
- **The `RunFlush` delegate is cached**, so scheduling allocates nothing on .NET.
- **Open maintainer decision:** for a value type, the first apply's `previous` is `default(T)`: 0 on .NET, null in TS. It is documented in the XML doc, and the scenario uses `string`.
- Metano: no new defects. The `string +=` emission noise is deferred to the Phase 7 batch.

---

## Task 5: Ownership, cleanup and untrack (Phase 5)
Status: Complete   <!-- Not started | In progress | Complete -->


**Files:**
- Create: `src/Metanui.Reactive/Ownership/{OwnerNode.cs,RootNode.cs,CleanupEntry.cs}`, `src/Metanui.Reactive.Scenarios/OwnershipScenarios.cs`
- Modify: `Computed.cs`, `Effects/EffectNode.cs` (both derive from `OwnerNode`), `Reactivity.cs`, `Tracking.cs`, `ScenarioRunner.cs`, `ReactiveScenarios.cs`

**Interfaces:**
- Produces:
  - `public static T Reactivity.Root<T>(Func<Action, T> body)`, `public static void Reactivity.Root(Action<Action> body)`; the `Action` is the disposer.
  - `public static void Reactivity.OnCleanup(Action cleanup)`: registers on `Tracking.CurrentOwner`; with no owner it is a no-op (Solid behaviour: confirm against 2.0.4).
  - `public static T Reactivity.Untrack<T>(Func<T> body)`.
  - `OwnerNode`: `Parent`, `FirstChild`, `NextSibling`, `CleanupEntry? Cleanups` (prepend, so iterating runs them in reverse registration order), `void Dispose()` (depth-first over the children, then its own cleanups, then unlink deps, and mark disposed so queued work is skipped).
  - `ScenarioRunner.Run` now sets `Reactivity.Scheduler = new ManualFlushScheduler()`, runs the scenario inside `Reactivity.Root`, flushes, and disposes, so every scenario starts from a clean graph.

- [x] **Step 1: Write the scenarios** in `OwnershipScenarios`:
  - `RootDisposeRunsCleanupsInReverse`: cleanups 1, 2, 3 → log `3,2,1`.
  - `ChildrenDisposedOnRerun`: an effect whose compute creates an inner effect; after a re-run, the first inner effect's cleanup has run and only one inner effect is still alive.
  - `ComputedOwnedByRootIsDisposed`: after the root disposes, writing its dependency and flushing does not re-run the computed.
  - `UntrackDoesNotSubscribe`: a compute that reads `a` inside `Untrack` does not re-run when `a` changes.
  - `DisposeDuringFlushSkipsQueuedEffects` (Review Focus 2): effect A's apply disposes root R; effect B in R is queued by the same write; B's apply never runs.
- [x] **Step 2: Run both suites.** Expected: the new scenarios fail.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run both suites.** Expected: all pass, including every earlier scenario under the new `ScenarioRunner`.
- [x] **Step 5: Commit** `feat: add ownership, cleanup and untrack`.

### Verification Plan
- Both suites green; every earlier scenario still passes under the root-wrapping `ScenarioRunner`

### Phase Summary
Done in f8e6dcd and 3813613. 35/35 scenarios pass on .NET and Bun, and strict tsc is clean. The review needed one fix round: a Root nested in a computation could bypass the write check, and every write paid for a hot-path call. Both are fixed, and the re-review approved them.
- **Owner tree:** `OwnerNode` (parent, first child, siblings, a LIFO cleanup chain) sits under `Computed`, `EffectNode` and `RootNode`. Disposal is depth-first and newest child first, then the node's own cleanups in reverse order. A disposed node is skipped by the flush queues. Re-runs dispose what the previous run created, for both Computed and Effect compute.
- **Option B (Solid 2.0.4):** an apply runs with no owner. Creating a Computed, Effect or Root inside an apply throws. Apply cleanups are a chain on `EffectNode`. `OnCleanup` goes to the current owner, otherwise to the running apply, otherwise nowhere.
- **Write check, owner-based:** a write throws inside a computation, inside Untrack within a computation, and inside a Root created under a computation. `RootNode.UnderComputation` is computed once. A write directly in a top-level Root, or in a Root nested only in Roots, is allowed; this is a documented deviation from Solid. On the hot path, a write with no owner costs one null test.
- **Spec edits:** 4.2 now describes the real lifetime of an unowned computed. 4.5 states that a root created under an owner is owned by it.
- **Deferred to Phase 6:**
  - a throwing cleanup aborts the walk (Solid continues and rethrows the first error);
  - a write from a cleanup during disposal throws (Solid exempts disposal);
  - an unowned effect produces no warning;
  - disposed siblings keep their sibling pointers;
  - a computation that disposes itself mid-run re-links its dependencies;
  - `ScenarioRunner` can mask the scenario's own error.
- **Deferred to the final review:** a disposed computed that was never read returns `default` forever; spec wording; missing scenarios (multi-level disposal order, a disposed grandchild's queued apply, a root under an effect compute, a root under a root under a computed).
- **Metano:** #778 (dead branch in the overload dispatcher), #779 (deconstruction; the workaround is commented), #776 (renamed type import).

---

## Task 5b: Unify the factories on Reactivity (Phase 5b)
Status: Complete   <!-- Not started | In progress | Complete -->

Maintainer decision (2026-11-25): one entry point, mirroring Solid's flat API. Signals and computeds are created through `Reactivity`, with the constructors internal. The first apply receives `previous = value`.

**Files:**
- Modify: `src/Metanui.Reactive/{Reactivity.cs,Signal.cs,Computed.cs}`, every `src/Metanui.Reactive.Scenarios/*.cs` that constructs a signal or computed, `docs/design/0001-reactive-core.md` (section 6 example and 4.3 first-apply text), `.gitignore` (add `.idea/`)
- Delete: the maintainer's `public static class Signal { Create<T> }` in `Signal.cs` (uncommitted working-tree hunk; it is replaced by this task)

**Interfaces:**
- Produces:
  - `public static Signal<T> Reactivity.Signal<T>(T initialValue, IEqualityComparer<T>? comparer = null)`
  - `public static Computed<T> Reactivity.Computed<T>(Func<T> compute, IEqualityComparer<T>? comparer = null)`
  - `Signal<T>` and `Computed<T>` constructors become `internal`.
  - `Reactivity.Effect`: the first apply receives `(value, value)` (previous equals the current value) instead of `(value, default)`.

- [x] **Step 1: Update the scenarios.** Every `new Signal<...>(...)` / `new Computed<...>(...)` becomes `Reactivity.Signal(...)` / `Reactivity.Computed(...)`. Change `ComputeRunsOnCreationApplyOnFlush` to expect `(value, value)` on the first apply, and add a value-type case (`int`) that asserts `previous == value` on both platforms.
- [x] **Step 2: Run both suites.** Expected: a compile error (the factories are missing) on .NET.
- [x] **Step 3: Implement** the factories, make the constructors internal, apply the first-apply change, and remove the static `Signal` class. Update the XML docs and spec sections 4.3 and 6.
- [x] **Step 4: Run both suites and strict tsc.** Expected: all pass. In the generated TS, check that `Reactivity.signal`/`Reactivity.computed` import `Signal`/`Computed` correctly. A method named like the type is a known risk area: the maintainer's earlier static `Signal` class lost its import. Any defect gets a repro in the report.
- [x] **Step 5: Commit** `refactor: create signals and computeds through Reactivity`.

### Verification Plan
- Both suites are green. A grep for `new Signal<` / `new Computed<` outside `src/Metanui.Reactive` finds nothing. The int first-apply scenario passes on .NET and on Bun.

### Phase Summary
Done in f81025c, 36e51d5 and a9a7847. 36/36 scenarios pass on .NET and Bun, and strict tsc is clean. The review needed one fix round, for the wrong output in the spec 6 example; it was fixed and the re-review approved it.
- The factories are `Reactivity.Signal(...)` and `Reactivity.Computed(...)`. The `Signal<T>` and `Computed<T>` constructors are internal, and the maintainer's static `Signal.Create` class was removed. Metano #776 did not reproduce: `reactivity.ts` imports and constructs both types correctly, and calls them through plain static methods.
- The apply delegate is `Action<T, T>`. The first apply receives `previous = value` (the `_hasApplied` flag on `SplitEffect`); later applies receive the last applied value. This behaves the same on .NET and TS, and a value-type scenario covers it.
- Spec 4.3 now describes the apply cleanups registered with `OnCleanup`, and the spec 6 example shows `0 -> 0` and then `0 -> 10`. `.idea/` is gitignored.
- The TS constructors stay public, because Metano emits no visibility for `internal`. A feature request for `@internal` is filed for a later Metano wave.

---

## Task 6: Errors (Phase 6)
Status: Complete   <!-- Not started | In progress | Complete -->


**Files:**
- Create: `src/Metanui.Reactive.Scenarios/ErrorScenarios.cs`
- Modify: `Computed.cs`, `Ownership/OwnerNode.cs`, `Scheduling/FlushLoop.cs`, `Reactivity.cs`, `ReactiveScenarios.cs`

**Interfaces:**
- Produces: `public static void Reactivity.ErrorBoundary(Action body, Action<Exception> onError)` creates an owner with an error handler; errors from computations under it go to the nearest handler up the chain (spec 4.4). A computed stores a thrown exception in its value slot (flag bit 64 `Errored`, spec 5.4) and rethrows it on every read until a dependency changes.

- [x] **Step 1: Confirm the error ordering in `@solidjs/signals` 2.0.4** (unhandled effect error: are the remaining effects of the pass still run before the throw?). Write the answer in the task report. The scenarios below assume yes. If 2.0.4 differs, follow 2.0.4 and update spec 4.4.
- [x] **Step 2: Write the scenarios** in `ErrorScenarios`:
  - `ComputedRethrowsUntilDependencyChanges`: reading twice throws the same exception instance with 1 compute run; after fixing the dependency and flushing, it returns a value.
  - `BoundaryReceivesEffectError`: an exception in `apply` under `ErrorBoundary` reaches `onError`, and `Flush()` does not throw.
  - `UnhandledEffectErrorEscapesFlush`: with no boundary, `Flush()` throws the original exception.
  - `ThrowingEffectDoesNotStopOthers` (Review Focus 5): effect A throws in apply and effect B in the same pass still applies; then `Flush()` throws.
- [x] **Step 3: Run both suites.** Expected: the new scenarios fail.
- [x] **Step 4: Implement.**
- [x] **Step 5: Run both suites.** Expected: all pass.
- [x] **Step 6: Commit** `feat: add error propagation and error boundaries`.

### Verification Plan
- Both suites green, Error scenarios included; Solid 2.0.4 error-ordering finding recorded

### Phase Summary
Done in 4ccb775, 06c790b and de64c09. 54/54 scenarios pass on .NET and Bun, and strict tsc is clean. The review took two fix rounds: an unbounded failed-flush re-request loop, apply cleanups that aborted on a throw, and then a pass budget that leaked into unrelated flushes. All three are fixed, and the re-review approved.
- **Solid 2.0.4 findings** (from the tarball):
  - An unhandled effect error halts reactivity (`haltReactivity`).
  - Effect compute errors go to the effect's own handler or to console.error.
  - Cleanup errors: the walk continues, and the first error is rethrown.
  - Disposal is exempt from the write check.
  - `NO_OWNER_EFFECT` is a warning.
- **Rulings and deviations** (recorded in spec 4.4):
  - **No halt.** An unhandled error throws at once, the remaining work stays queued, and one flush is re-requested.
  - **Effect compute and apply errors** go to the nearest `ErrorBoundary`, or escape `Flush()`.
  - **Throwing cleanups follow Solid:** the walk continues, and the first error is rethrown by the disposer or at the end of the flush. Cleanup errors never reach a boundary. An apply-cleanup error becomes the apply's error, and that apply is skipped.
- **Errors in computeds:**
  - `Errored = 64`. A computed caches the error and rethrows it.
  - The normal read path costs one flag test.
  - Solid's retry rule applies: a no-deps errored computed retries when a tracked observer re-reads it in a later pass, at most once per pass.
- **Pass budget:** only the flush re-requested after a failure (`ResumeFlush`) carries the pass budget. Every other flush starts fresh. At the limit, pending writes are discarded and the pass-limit error is thrown.
- **Disposal hygiene:**
  - Writes are allowed during disposal (`Teardown.Depth`).
  - Disposed nodes clear their sibling pointers.
  - A self-disposing run keeps no dependencies.
  - `ScenarioRunner` keeps the scenario's own error and drains leftovers, with no reset API.
- **Phase 7:** decide whether to keep the defensive `try/finally` in `Propagate`/`CheckDirty` (no longer reachable from user code), and rename or drop `ErrorInNestedCheckDirtyLeavesGraphUsable` with it.
- **Deferred to the final review** (ledger):
  - a stale resume uses a stale budget;
  - a write during a pending resume;
  - a stranded queue at the limit;
  - `throw _error` loses the .NET stack;
  - TS `toException` identity;
  - the ErrorBoundary disposer;
  - a boundary handler writing inside a nested computation;
  - `Teardown.Depth` without try/finally;
  - the nested runner scheduler;
  - a cleanup registered after self-disposal.

---

## Task 7: Real schedulers and the TS output audit (Phase 7)
Status: Complete   <!-- Not started | In progress | Complete -->


**Files:**
- Create: `tests/js/reactive/microtask-scheduler.test.ts`, `tests/Metanui.Reactive.Tests/SynchronizationContextSchedulerTests.cs`
- Create: `docs/design/0001-reactive-core-ts-audit.md`

- [x] **Step 1: Write the Bun test.** A test-local `IFlushScheduler` using `queueMicrotask`. Write a signal and check that an effect's apply has not run synchronously, then `await Promise.resolve()` and expect it to have run once.
- [x] **Step 2: Write the TUnit test.** A test-local scheduler that posts to a single-threaded `SynchronizationContext`. Write, check that nothing has applied, pump the context, and expect one apply.
- [x] **Step 3: Run both.** Expected: pass with no core changes. If the core needs a change, the port is wrong: fix it in `Reactivity`/`FlushLoop` and rerun everything.
- [x] **Step 4: Write the audit.** Go through the generated TS for every file in `src/Metanui.Reactive` against spec 5.3 and list every deviation with the C# line, the emitted TS and the expected TS. Each deviation gets a Metano issue (opened with the maintainer's approval or through the Metano session) and, if one is in place, its `// Metano #<issue>` workaround.
- [x] **Step 5: Commit** `test: add real scheduler tests and the TS output audit`.

### Verification Plan
- `bun test tests/js/reactive` and `dotnet test tests/Metanui.Reactive.Tests` green, scheduler tests included
- `docs/design/0001-reactive-core-ts-audit.md` exists; every deviation has an issue reference

### Phase Summary
Done in 84dda82 and 4905632. 55/55 pass on .NET and Bun. Review approved, after one docs fix round on the strength of the benchmark claim, preserving the harness and the issue references.
- **Real schedulers, in test code only.** A Bun microtask test and a TUnit pumped SynchronizationContext test both prove asynchrony. A synchronous scheduler fails them (mutation-checked). No core change was needed.
- **Audit:** `docs/design/0001-reactive-core-ts-audit.md`.
  - `tsc --strict` (5.9.3) is clean.
  - `tsgo --strict` reports only TS2430, from metano-runtime's Temporal polyfill (#786).
  - Emission noise is filed as #787.
  - The `root(...)` arity dispatcher throws for zero-parameter TS callbacks (#778).
  - Metano warnings never fail the build, and the up-to-date stamp is written even after a failed build (#785). MSBuildTreatWarningsAsErrors stays off (ruling).
- **Defensive try/finally in Propagate/CheckDirty is kept.** It is within noise on JavaScriptCore (Bun), with per-call overhead under 0.05 ns. V8 was not measured. The path it protects is untested. The harness is in `bench/micro/`.
- **Metano wave-9 branch:** #768, #772, #773, #774 and #775 are fixed there. The workarounds stay until the release.
- **Machine load** reached about 32 during this phase, from parallel Metano test suites. Benchmarks must record the load average and run on a quiet machine.

---

## Task 8: Reactivity benchmark (Phase 8)
Status: Complete   <!-- Not started | In progress | Complete -->


**Files:**
- Create: `bench/reactivity/{package.json,metanui.framework.ts,solid2.framework.ts,README.md}`, `scripts/bench-reactivity.sh`

**Interfaces:**
- Consumes: the `ReactiveFramework` interface of `milomg/js-reactivity-benchmark@56eb45e84b3f6fcfa867840725e66b59a9b7467a` (`packages/core/src/util/reactiveFramework.ts`): `signal`, `computed`, `effect(fn)`, `withBatch(fn)`, `withBuild(fn)`, `cleanup()`.
- Adapter mapping, the same for both frameworks:
  - `effect(fn)` → `Reactivity.effect(() => { fn(); return 0; }, () => {})` (and `createEffect(() => { fn(); return 0; }, () => {})` for Solid 2.0);
  - `withBatch(fn)` → `fn()` then `flush()`;
  - `withBuild` → `Root`, keeping the disposer for `cleanup`;
  - `signal.write` → set `.value`;
  - reads after a write in the harness happen only after `withBatch`, which flushes. Verify this assumption by running the harness's own correctness tests (`frameworks.test.ts`) on both adapters.

- [x] **Step 1: Write `scripts/bench-reactivity.sh`.** It clones the harness at the pinned commit into `.cache/js-reactivity-benchmark` (gitignored), copies both adapters into its `frameworks/`, registers them next to `alienSignals`, and runs it with Bun.
- [x] **Step 2: Run the harness correctness tests** for both adapters. Expected: pass.
- [x] **Step 3: Run the benchmark.** Write `bench/reactivity/README.md` with the machine, versions (Metano, `@solidjs/signals` 2.0.4, alien-signals 3.2.1), a results table, and the overhead vs Solid 2.0 per test against the 10–15% budget. Explain every miss with a Phase 7 audit item or a new one.
- [x] **Step 4: Commit** `perf: add js-reactivity-benchmark comparison`.

### Verification Plan
- `scripts/bench-reactivity.sh` runs the harness correctness tests (pass) and the benchmark
- `bench/reactivity/README.md` has the results table and the overhead vs Solid 2.0

### Phase Summary
Done in 0be6d15, 8aeb211, 9511d35 and 694b96d. A fairness review verified identical work counts across alien-signals 3.2.1, Solid 2.0.4 and Metanui through the real adapters: batching is symmetric, and the cleanup flush applies to both. Re-reviews then confirmed the tables against the committed raw outputs.
- **Primary results** come from the idle host criptomaster: Fedora 45 x86_64, 12 cores. Every run started at a 1-minute load below 1.0. Each figure is the median of 3. Raw outputs are in `bench/reactivity/results/criptomaster-2026-11-25/`.
  - **Bun 1.4.5:** budget met on every test. Metanui is 25–89% faster than Solid 2.0, though Solid's eager memos bias the lazy80% tests. Against alien-signals it ranges from −29% to +15%. No overall lead on updateSignals is claimed.
  - **Node v26.8.2:** budget missed on createSignals (+17%; Solid's own times are noisy) and cellx1000 (+21%). Metanui is 1.2–2.7× behind alien-signals, but faster than Solid on every updateSignals sub-test.
- **Adapters:** both `cleanup()` methods flush after disposing, because of F1 (controller ruling).
- **Findings:**
  - **F1:** disposed effects stay in the flush queue → fixed in Phase 8b (release references).
  - **F2:** V8 node creation is slow because of node layout, not codegen.
  - **F3:** V8 deep flush is slow, cause open.
  - **The defensive try/finally costs about 1.5–3 ns per call on V8.** F2, F3 and that try/finally go to a **separate V8 optimisation phase** after this plan (maintainer decision).
- **Mac runs** are kept as a secondary section and labelled as taken under load. The probes are in `bench/reactivity/probes/`, and `scripts/bench-reactivity.sh` has `prepare`/`test`/`probe` modes.

---

## Task 8b: Release disposed effects from the flush queue (Phase 8b)
Status: Not started   <!-- Not started | In progress | Complete -->

Benchmark finding F1 (bench/reactivity/README.md): disposing an effect does not take it out of `FlushLoop`'s queues. Under `ManualFlushScheduler`, 20 roots of 100,000 effects disposed without a flush retain about 900 MB until the next flush; with a flush, about 2 MB remain. Maintainer decision (2026-11-25): **release references on disposal**. The disposed node may stay in the queue, where it is already skipped, but it must no longer retain its graph or user closures.

**Files:**
- Modify: `src/Metanui.Reactive/Effects/{EffectNode.cs,SplitEffect.cs}` and, if needed, `src/Metanui.Reactive/Computed.cs` for the same retention pattern
- Test: `src/Metanui.Reactive.Scenarios/OwnershipScenarios.cs` (behaviour); `bench/reactivity/probes/retain.ts` (memory evidence)

**Interfaces:** no public API change.

- [ ] **Step 1: Write the scenario** `DisposedQueuedEffectReleasesItsClosures`. An effect whose compute and apply close over a marker object is disposed while its apply is still queued. Then `Flush()` runs. Assert that no apply and no cleanup ran after disposal, and that the effect no longer appears as a subscriber of its source (write the source, flush, and check that nothing re-runs). Memory itself is checked by the probe.
- [ ] **Step 2: Run both suites.** Expected: the scenario passes or fails according to current behaviour. Capture which one, and say so in the report.
- [ ] **Step 3: Implement.** In `EffectNode`/`SplitEffect` disposal (`OnDisposed`), drop the references to the compute and apply delegates, the cached value and the applied value, after running the cleanups and purging the deps. The delegate fields need nullability for this, and the generated TS must keep `tsc --strict` clean. Apply the same release to a disposed `Computed` (its compute delegate and cached value/error) if the code shows the same retention.
- [ ] **Step 4: Measure.** Run `scripts/bench-reactivity.sh probe retain` locally on Bun, with and without a flush. Expected: the no-flush heap is close to the with-flush heap (order of MB, not hundreds of MB). Record both numbers and the load.
- [ ] **Step 5: Run both suites and strict tsc.** Expected: all pass.
- [ ] **Step 6: Commit** `fix: release disposed effects from the flush queue`.

### Verification Plan
- Both suites green. The `retain` probe without a flush stays within a small multiple of the with-flush number. Strict tsc is clean.

### Phase Summary
_(write when phase completes)_

---

## Task 9: Review gate and docs (Phase 9)
Status: Not started   <!-- Not started | In progress | Complete -->


- [ ] **Step 1:** Run `dotnet csharpier format .`, `dotnet build`, both test suites and the benchmark correctness tests. Expected: all green.
- [ ] **Step 2:** Run the reviewers in parallel: `compiler-man`, `bob`, `backend-reviewer` (all `.cs`), `frontend-reviewer` (hand-written `.ts` under `tests/js` and `bench`), `architecture-reviewer`. A `REPROVADO` verdict blocks: fix and rerun. Report `APROVADO COM RESSALVAS` items to the maintainer.
- [ ] **Step 3:** Update `docs/handoff.md`: Phase 1 core done, benchmark summary, open Metano issues, next design `0002-dsl-binding.md`. Update the spec's status line if the implementation changed any decision.
- [ ] **Step 4: Commit** `docs: record reactive core results`.

### Verification Plan
- format, build, both suites and the benchmark correctness tests green
- no `REPROVADO` verdict left

### Phase Summary
_(write when phase completes)_

## Final Recap
_(write when all phases complete: summary of the entire piece of work)_

## Deployment Plan
_(write when all phases complete. Expected: nothing is published in Phase 1; record how to build, test and benchmark from a clean clone, and which Metano version was used)_
