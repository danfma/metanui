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
Status: Not started   <!-- Not started | In progress | Complete -->


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

- [ ] **Step 1: Write the scenario** `SignalScenarios.ReadsInitialValue`: `expect.Equal(42, new Signal<int>(42).Value, "initial value")`; also a record case: `expect.Equal(new Point(1, 2), new Signal<Point>(new Point(1, 2)).Value, "record value")` with `private sealed record Point(int X, int Y)` in the scenarios file.
- [ ] **Step 2: Write the .NET adapter.** `ThrowingExpect : IExpect` throws `InvalidOperationException($"{label}: expected {expected}, got {actual}")` on mismatch, using `EqualityComparer<T>.Default`. `ReactiveScenarioTests` has `public static IEnumerable<Func<Scenario>> Cases()` over `ReactiveScenarios.All`, and `[Test, MethodDataSource(nameof(Cases)), NotInParallel] public void Runs(Scenario scenario) => ScenarioRunner.Run(scenario, new ThrowingExpect());`. Make TUnit display `scenario.Name` (override `ToString` on `Scenario` → `Name`).
- [ ] **Step 3: Write the Bun adapter** `tests/js/reactive/reactive.test.ts`: `for (const scenario of ReactiveScenarios.all) test(scenario.name, () => ScenarioRunner.run(scenario, bunExpect))`, with `bunExpect` implementing the transpiled `IExpect` through `expect(actual, label).toEqual(expected)` / `toBe(true)`. `package.json` depends on `metanui-reactive-scenarios` and `metanui-reactive` via `workspace:*` and on `metano-runtime` ^3.1.0.
- [ ] **Step 4: Run to see it fail.** Run `dotnet build`. Expected: a compile error, because `Signal<T>` does not exist yet.
- [ ] **Step 5: Implement `Signal<T>`** (constructor and `Value` getter over a private field).
- [ ] **Step 6: Run both suites.** Run `dotnet build && dotnet test tests/Metanui.Reactive.Tests && bun install && bun test tests/js/reactive`. Expected: 1 scenario passing on each side.
- [ ] **Step 7: Inspect the generated TS.** Check that `targets/js/metanui-reactive-scenarios/src` imports `metanui-reactive` as a package (not a relative path into another package), that `Scenario[]` is a native array, and that `IsTrue`/`Equal` keep usable names (`isTrue`, `equal`). Any deviation is a Metano finding: note it in the task report with a repro.
- [ ] **Step 8: Commit** `test: add shared scenario pipeline for the reactive core`.

**Fallback:** if Step 7 shows cross-package imports or delegates in records cannot work, stop and report. The spec's fallback (two suites in lockstep by scenario name) needs the maintainer's go-ahead.

### Verification Plan
- `dotnet build && dotnet test tests/Metanui.Reactive.Tests` → 1 scenario passes
- `bun install && bun test tests/js/reactive` → the same scenario passes

### Phase Summary
_(write when phase completes)_

---

## Task 2: Signal writes, flush and scheduler port (Phase 2)
Status: Not started   <!-- Not started | In progress | Complete -->


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

- [ ] **Step 1: Write the scenarios** in `SignalScenarios`:
  - `WriteIsInvisibleUntilFlush`: set `Value = 5` on a `Signal<int>(0)`; `Value` and `Peek()` both still return `0`; after `Reactivity.Flush()`, both return `5`.
  - `LastWriteWins`: writes 1, 2, 3 then flush → 3.
  - `FlushWithoutWritesIsNoOp`: `Flush()` twice with nothing pending does not throw.
  - `CustomComparerIsUsed`: a comparer that treats all strings case-insensitively; writing `"A"` over `"a"` and flushing keeps `"a"`.
- [ ] **Step 2: Run both suites.** Expected: the new scenarios fail (setter missing).
- [ ] **Step 3: Implement.** On flush, commit each pending value when `!comparer.Equals(current, pending)` (default `EqualityComparer<T>.Default`), then call `DependencyGraph` propagation. A no-op stub is fine until Phase 3; leave a `// propagated in Phase 3` only if the build needs the call site.
- [ ] **Step 4: Run both suites.** Expected: all pass.
- [ ] **Step 5: Inspect the TS** of `Signal`, `FlushLoop`, `ReactiveFlags` and the default comparer. Expected: `get value()` is a field read plus a tracking check, the flags are numbers, and `EqualityComparer<T>.Default` maps to something without a per-call allocation. Otherwise it is a Metano finding.
- [ ] **Step 6: Commit** `feat: add signal writes deferred to a flush`.

### Verification Plan
- `dotnet build && dotnet test tests/Metanui.Reactive.Tests && bun test tests/js/reactive` → all Signal scenarios pass on both

### Phase Summary
_(write when phase completes)_

---

## Task 3: Dependency graph and Computed (Phase 3)
Status: Not started   <!-- Not started | In progress | Complete -->


**Files:**
- Create: `src/Metanui.Reactive/Graph/DependencyGraph.cs`, `src/Metanui.Reactive/Computed.cs`, `src/Metanui.Reactive.Scenarios/ComputedScenarios.cs`
- Modify: `Signal.cs`, `Tracking.cs`, `Scheduling/FlushLoop.cs`, `ReactiveScenarios.cs`

**Interfaces:**
- Consumes: Phase 2 node, link and flags types.
- Produces:
  - `public sealed class Computed<T>(Func<T> compute, IEqualityComparer<T>? comparer = null)`; `T Value { get; }`; `T Peek()`.
  - `internal static class DependencyGraph { Link(ReactiveNode dep, ReactiveNode sub, int version); Link? Unlink(Link link, ReactiveNode sub); void Propagate(Link link); bool CheckDirty(Link link, ReactiveNode sub); void ShallowPropagate(Link link); }`: a line-by-line port of alien-signals `system.ts` (the `Stack<T>` helper becomes an internal sealed class; `update`/`notify`/`unwatched` callbacks become the `ReactiveNode` abstract members).
  - `Tracking.ActiveObserver` (`ReactiveNode?`), and a global `int Cycle` version counter as in alien-signals `index.ts`.

- [ ] **Step 1: Write the scenarios** in `ComputedScenarios`:
  - `IsLazy`: the compute function counter stays 0 until the first `Value` read.
  - `IsCached`: two reads with no write → 1 run.
  - `RecomputesAfterFlush`: `doubled` of `count`; write 5, flush → `doubled.Value == 10`, 2 runs.
  - `DiamondIsGlitchFree`: `a`; `b = a+1`; `c = a*2`; `d = b+c` that records every value it sees; after writing `a = 2` and flushing, `d` has seen only `[1, 7]` (initial `a=0` → `b=1,c=0` → 1; then 3+4 = 7).
  - `EqualResultStopsPropagation`: `parity = count % 2`; `downstream` reads `parity`; writing `count` 0 → 2 → flush must not re-run `downstream`.
  - `DynamicDependencyIsDropped` (Review Focus 3): `flag=true`, `a`, `b`; `pick = flag ? a : b`; read; set `flag=false`, flush, read; then write `a`, flush; `pick`'s run counter must not increase.
  - `WriteInsideComputeThrows`: a computed that writes a signal throws `InvalidOperationException` on read (check with `ScenarioRunner.Catch`). First confirm the behaviour in `@solidjs/signals` 2.0.4 (its tests or source). If Solid only warns, match that instead, and write down what you found in the task report.
- [ ] **Step 2: Run both suites.** Expected: the new scenarios fail.
- [ ] **Step 3: Implement** the port and `Computed<T>`. Signal and computed `Value` getters call `DependencyGraph.Link` when `Tracking.ActiveObserver` is not null. Flush commit calls `Propagate` on the signal's `Subs`.
- [ ] **Step 4: Run both suites.** Expected: all pass.
- [ ] **Step 5: Hot-path audit** of the generated `dependency-graph.ts`, `computed.ts` and `signal.ts`: no closures, no `new` outside `Link`, no `List`, no interface calls. Record the findings.
- [ ] **Step 6: Commit** `feat: add dependency graph and computed`.

### Verification Plan
- Both suites green, Computed scenarios included
- Hot-path audit notes recorded in the Phase Summary

### Phase Summary
_(write when phase completes)_

---

## Task 4: Split effects and the flush loop (Phase 4)
Status: Not started   <!-- Not started | In progress | Complete -->


**Files:**
- Create: `src/Metanui.Reactive/Effects/EffectNode.cs`, `src/Metanui.Reactive.Scenarios/EffectScenarios.cs`
- Modify: `Reactivity.cs`, `Scheduling/FlushLoop.cs`, `ReactiveScenarios.cs`

**Interfaces:**
- Consumes: Phases 2–3.
- Produces:
  - `public static void Reactivity.Effect<T>(Func<T> compute, Action<T, T?> apply)`. Cleanups registered with `Reactivity.OnCleanup` while `apply` runs belong to that apply, and run before the next apply and on disposal. This replaces Solid's "apply returns a cleanup" (same semantics, C# shape; write it down in the XML doc).
  - `FlushLoop` passes, per spec 4.7: commit writes → propagate → run queued effect computes in queue order → run collected applies → repeat while new writes exist. `const int MaxPasses = 100`; exceeding it throws `InvalidOperationException("Reactive flush exceeded 100 passes; an effect is probably writing a signal it depends on.")`.
- Note: until Phase 5, effects live under no owner. Phase 5 attaches them.

- [ ] **Step 1: Write the scenarios** in `EffectScenarios` (all drive the graph with `Reactivity.Flush()`):
  - `ComputeRunsOnCreationApplyOnFlush`: after `Effect` the compute count is 1 and the apply count is 0; after `Flush()` the apply runs once with `(value, default)`.
  - `ApplyReceivesPrevious`: the apply after a write gets `(new, old)`.
  - `AppliesRunAfterAllComputes`: two effects log `"c1","c2","a1","a2"` in that order for one write both read.
  - `ApplyIsUntracked`: a signal read only inside `apply` does not re-trigger the effect.
  - `ApplyCleanupRunsBeforeNextApply`: the `OnCleanup` registered in apply #1 runs before apply #2.
  - `WriteInApplySchedulesAnotherPass`: apply of effect A writes `s`; effect B reads `s`; one `Flush()` call runs B's apply.
  - `EffectWriteLoopThrows` (Review Focus 1): an apply that increments the signal its compute reads makes `Flush()` throw the pass-limit exception.
  - `EqualRecordWriteDoesNotRerun` (Review Focus 4): writing `new Point(1, 2)` over an equal `Point` does not re-run compute or apply.
- [ ] **Step 2: Run both suites.** Expected: the new scenarios fail.
- [ ] **Step 3: Implement** `EffectNode` (`Notify` enqueues it on the effect queue, chained through a `NextQueued` field) and the pass loop.
- [ ] **Step 4: Run both suites.** Expected: all pass.
- [ ] **Step 5: Commit** `feat: add split effects and the flush loop`.

### Verification Plan
- Both suites green, Effect scenarios included (pass-limit scenario throws, does not hang)

### Phase Summary
_(write when phase completes)_

---

## Task 5: Ownership, cleanup and untrack (Phase 5)
Status: Not started   <!-- Not started | In progress | Complete -->


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

- [ ] **Step 1: Write the scenarios** in `OwnershipScenarios`:
  - `RootDisposeRunsCleanupsInReverse`: cleanups 1, 2, 3 → log `3,2,1`.
  - `ChildrenDisposedOnRerun`: an effect whose compute creates an inner effect; after a re-run, the first inner effect's cleanup has run and only one inner effect is still alive.
  - `ComputedOwnedByRootIsDisposed`: after the root disposes, writing its dependency and flushing does not re-run the computed.
  - `UntrackDoesNotSubscribe`: a compute that reads `a` inside `Untrack` does not re-run when `a` changes.
  - `DisposeDuringFlushSkipsQueuedEffects` (Review Focus 2): effect A's apply disposes root R; effect B in R is queued by the same write; B's apply never runs.
- [ ] **Step 2: Run both suites.** Expected: the new scenarios fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run both suites.** Expected: all pass, including every earlier scenario under the new `ScenarioRunner`.
- [ ] **Step 5: Commit** `feat: add ownership, cleanup and untrack`.

### Verification Plan
- Both suites green; every earlier scenario still passes under the root-wrapping `ScenarioRunner`

### Phase Summary
_(write when phase completes)_

---

## Task 6: Errors (Phase 6)
Status: Not started   <!-- Not started | In progress | Complete -->


**Files:**
- Create: `src/Metanui.Reactive.Scenarios/ErrorScenarios.cs`
- Modify: `Computed.cs`, `Ownership/OwnerNode.cs`, `Scheduling/FlushLoop.cs`, `Reactivity.cs`, `ReactiveScenarios.cs`

**Interfaces:**
- Produces: `public static void Reactivity.ErrorBoundary(Action body, Action<Exception> onError)` creates an owner with an error handler; errors from computations under it go to the nearest handler up the chain (spec 4.4). A computed stores a thrown exception in its value slot (flag bit 64 `Errored`, spec 5.4) and rethrows it on every read until a dependency changes.

- [ ] **Step 1: Confirm the error ordering in `@solidjs/signals` 2.0.4** (unhandled effect error: are the remaining effects of the pass still run before the throw?). Write the answer in the task report. The scenarios below assume yes. If 2.0.4 differs, follow 2.0.4 and update spec 4.4.
- [ ] **Step 2: Write the scenarios** in `ErrorScenarios`:
  - `ComputedRethrowsUntilDependencyChanges`: reading twice throws the same exception instance with 1 compute run; after fixing the dependency and flushing, it returns a value.
  - `BoundaryReceivesEffectError`: an exception in `apply` under `ErrorBoundary` reaches `onError`, and `Flush()` does not throw.
  - `UnhandledEffectErrorEscapesFlush`: with no boundary, `Flush()` throws the original exception.
  - `ThrowingEffectDoesNotStopOthers` (Review Focus 5): effect A throws in apply and effect B in the same pass still applies; then `Flush()` throws.
- [ ] **Step 3: Run both suites.** Expected: the new scenarios fail.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run both suites.** Expected: all pass.
- [ ] **Step 6: Commit** `feat: add error propagation and error boundaries`.

### Verification Plan
- Both suites green, Error scenarios included; Solid 2.0.4 error-ordering finding recorded

### Phase Summary
_(write when phase completes)_

---

## Task 7: Real schedulers and the TS output audit (Phase 7)
Status: Not started   <!-- Not started | In progress | Complete -->


**Files:**
- Create: `tests/js/reactive/microtask-scheduler.test.ts`, `tests/Metanui.Reactive.Tests/SynchronizationContextSchedulerTests.cs`
- Create: `docs/design/0001-reactive-core-ts-audit.md`

- [ ] **Step 1: Write the Bun test.** A test-local `IFlushScheduler` using `queueMicrotask`. Write a signal and check that an effect's apply has not run synchronously, then `await Promise.resolve()` and expect it to have run once.
- [ ] **Step 2: Write the TUnit test.** A test-local scheduler that posts to a single-threaded `SynchronizationContext`. Write, check that nothing has applied, pump the context, and expect one apply.
- [ ] **Step 3: Run both.** Expected: pass with no core changes. If the core needs a change, the port is wrong: fix it in `Reactivity`/`FlushLoop` and rerun everything.
- [ ] **Step 4: Write the audit.** Go through the generated TS for every file in `src/Metanui.Reactive` against spec 5.3 and list every deviation with the C# line, the emitted TS and the expected TS. Each deviation gets a Metano issue (opened with the maintainer's approval or through the Metano session) and, if one is in place, its `// Metano #<issue>` workaround.
- [ ] **Step 5: Commit** `test: add real scheduler tests and the TS output audit`.

### Verification Plan
- `bun test tests/js/reactive` and `dotnet test tests/Metanui.Reactive.Tests` green, scheduler tests included
- `docs/design/0001-reactive-core-ts-audit.md` exists; every deviation has an issue reference

### Phase Summary
_(write when phase completes)_

---

## Task 8: Reactivity benchmark (Phase 8)
Status: Not started   <!-- Not started | In progress | Complete -->


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

- [ ] **Step 1: Write `scripts/bench-reactivity.sh`.** It clones the harness at the pinned commit into `.cache/js-reactivity-benchmark` (gitignored), copies both adapters into its `frameworks/`, registers them next to `alienSignals`, and runs it with Bun.
- [ ] **Step 2: Run the harness correctness tests** for both adapters. Expected: pass.
- [ ] **Step 3: Run the benchmark.** Write `bench/reactivity/README.md` with the machine, versions (Metano, `@solidjs/signals` 2.0.4, alien-signals 3.2.1), a results table, and the overhead vs Solid 2.0 per test against the 10–15% budget. Explain every miss with a Phase 7 audit item or a new one.
- [ ] **Step 4: Commit** `perf: add js-reactivity-benchmark comparison`.

### Verification Plan
- `scripts/bench-reactivity.sh` runs the harness correctness tests (pass) and the benchmark
- `bench/reactivity/README.md` has the results table and the overhead vs Solid 2.0

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
