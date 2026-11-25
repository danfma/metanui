# Metano 3.2.0 upgrade, effect handle and retry fix

This is a follow-up to the reactive core (`plans/reactive-core.md`, PR #1). It moves Metanui to Metano 3.2.0 and removes the 3.1.0 workarounds. It also gives `Reactivity.Effect` an `IDisposable` handle, fixes the stale-sibling retry bug that the core's final review parked, and records the maintainer's 2026-11-25 design decisions for the DSL phase.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Spec:** `docs/design/0001-reactive-core.md`. Context: `docs/handoff.md`, `plans/reactive-core.md` (Final Recap) and `docs/design/0001-reactive-core-ts-audit.md`.

## For Future Agents
As work proceeds, mark checkboxes `- [x]`. When a phase is done, set its status to `Complete` and write its Phase Summary. Run each Verification Plan and record the result. When all phases are done, fill in the Final Recap and the Deployment Plan.

Branch: `chore/metano-3.2-effect-handle` in the worktree `.claude/worktrees/metano-3.2`, stacked on `feat/reactive-core` (PR #1). The PR targets `feat/reactive-core`.

## Global Constraints

- The same constraints as `plans/reactive-core.md` apply: net11.0, C# 15, TreatWarningsAsErrors, Bun only, never hand-edit `targets/js/*/src`, no AI attribution in commits, and no allocation, closures or interface dispatch on hot paths (spec 5.3).
- Metano **3.2.0**. Move the tool, the NuGet packages and `metano-runtime` together, through `scripts/update-metano.sh`. With 3.2.0 (#785), Metano warnings fail the build. Suppress a specific code with `WarningsNotAsErrors` only when it is justified in a comment.
- New Metano defects are reported to the Metano session (`metano-41`) with a minimal repro. Visible workarounds are marked `// Metano #<issue>`.
- Semantics contract: `@solidjs/signals` 2.0.4. Deviations are documented in spec §4.

---

## Task 1: Upgrade to Metano 3.2.0 and remove the workarounds (Phase 1)
Status: Complete

**Files:** `dotnet-tools.json`, `Directory.Packages.props`, `bun.lock`, generated `package.json`s, every file with a `// Metano` comment, `src/Metanui.Reactive.Scenarios/Metanui.Reactive.Scenarios.csproj` (`MetanoPackageRoot`), `targets/js/metanui-reactive/package.json` (seeded `version`), internal types carrying `[Transpile]`, `docs/design/0001-reactive-core-ts-audit.md` (status of each issue).

- [x] Run `scripts/update-metano.sh`. The tool, `Metano` and `Metano.Build.TypeScript` must all be 3.2.0, and `metano-runtime` must be ^3.2.0 in the generated packages. Then run `bun install`.
- [x] Build and record every new error that #785 turns from a warning into an error. Fix each one at its source. Use a commented `WarningsNotAsErrors` entry only when a code is an accepted false positive.
- [x] Remove the workarounds that 3.2.0 fixes, one commit per issue group, rebuilding and re-running both suites after each:
  - #768: the setter import helpers. `Signal.RejectWriteInsideComputation` stays out of line on purpose, because it keeps the cold path out of the setter; only its comment changes.
  - #772: the labeled `continue` rewrites. Restore the upstream labeled form only if the generated TS is a clean native label. Otherwise keep the rewrite and say why.
  - #773: discard workarounds.
  - #774: the nullable-local walk.
  - #775: any remaining narrowing workarounds.
  - #778: the TS `root(...)` dispatcher check. Confirm that `Reactivity.root(() => ...)` works from TS.
  - #779: tuple deconstruction.
  - #764/#765: `MetanoPackageRoot` and the seeded `version`.
  - #770: the explicit `[Transpile]` on internal types, if they are now transpiled automatically.
- [x] Keep the #794 workaround (`Missing<T>`) and the #776 note.
- [x] Update the audit document: mark each issue as fixed in 3.2.0 or still open, and re-run `tsc --strict` on both packages.

### Verification Plan
- `dotnet build`: 0 warnings, 0 errors. Run `dotnet test tests/Metanui.Reactive.Tests`, `bun test tests/js/reactive` and `scripts/bench-reactivity.sh test`: all must pass. `tsc --strict` must be clean on both generated packages.
- `grep -rn "// Metano" src tests` lists only the issues that are still open.

### Phase Summary
Done in ec928dc..a24116b. Verified with 0 warnings, 72/72 on .NET, 74/74 on Bun (two new tests cover the TS `root` dispatcher), bench-reactivity test 12/12 and a clean strict tsc. Review and re-review approved the result.
- **Tool and packages:** the tool and NuGet are on Metano 3.2.0; `metano-runtime` is at ^3.2.0 everywhere, including the bench and test consumers.
- **Workarounds removed:**
  - #768: setter imports. `RejectWriteInsideComputation` stays out of line on purpose.
  - #772: native labeled `continue`, which is leaner than the rewrite.
  - #773: discards.
  - #775
  - #778: `root` from TS with any arity.
  - #779: deconstruction.
  - #764/#765: `MetanoPackageRoot` and the seeded `version`.
  - #770: no explicit `[Transpile]`. Internal types are no longer exported from barrels.
- **Kept:** `ShallowPropagate` uses upstream's exact do/while with an explicit `Link?` (#796, a variant of #774). `Missing<T>` stays for #794.
- **#785 surfaced only MS0063** on the two `Root` overloads. Neither `[Name]` (it acts as a suffix in 3.2.0, reported upstream) nor `[Ignore]` (it breaks the C# callers) resolves it. A commented project-scoped `NoWarn` stays as a temporary measure until Metano fixes `[Name]` or the 0002 `CreateRoot` design replaces the overloads.
- **New Metano issues:** #796 (a `var` local loses `| null`), #797 (deleting a `.cs` file leaves stale `.ts`; workaround: delete `.metano-stamp`), #798 (a redundant `!`).

---

## Task 2: Give Effect an IDisposable handle (Phase 2)
Status: Blocked (Metano IDisposable support)

Maintainer decision (2026-11-25): an effect still belongs to its owner, as in Solid. `Reactivity.Effect` also returns an `IDisposable` handle for early disposal. Ignoring the return value gives exactly Solid's semantics.

**Interfaces:** `public static IDisposable Reactivity.Effect<T>(Func<T> compute, Action<T, T> apply)`. The handle is the effect node itself, so no delegate or wrapper is allocated. `Dispose()` is idempotent and equivalent to the owner disposing the effect: it runs the cleanups, purges the deps, skips queued work, and detaches the effect from its owner.

- [ ] Scenarios:
  - `EffectHandleDisposesEarly`: after `handle.Dispose()` and a write followed by a flush, there is no compute, no apply, and the cleanup has run once.
  - `EffectHandleDisposeIsIdempotent`.
  - `OwnerDisposeAfterHandleDisposeRunsNothingTwice`.
  - `EffectHandleDisposedDuringFlushSkipsQueuedApply`.
- [ ] Implement the handle. The node must not expose any other member through the public surface. In TS, check that the emitted `dispose()` does not collide with internal names, and that the handle type is usable from TS (the `Symbol.dispose` mapping is welcome if Metano 3.2.0 emits it).
- [ ] Spec §4.3: document the handle and that it is optional. Record in the deviations that Solid's `createEffect` returns `void`.
- [ ] Measure: run `createComputations` on Bun locally, before and after the change, with the load recorded. A regression above noise needs a justification.

### Verification Plan
- Both suites pass, strict tsc is clean, and the generated `effect-node.ts`/`reactivity.ts` add no allocation to effect creation.

### Phase Summary
**Blocked, 2026-11-25.** Metano 3.2.0 has no `System.IDisposable` mapping:
- the type is emitted as a bare name, so strict tsc fails;
- no `implements` is emitted;
- the explicit `IDisposable.Dispose` collides with the internal `OwnerNode.Dispose`, and Metano drops it silently;
- an interface-typed `null!` loses its annotation.

All four were reported to the Metano session. The MS0063 comment fix landed in 0ce49cb. The working implementation and its five scenarios (77/77 on .NET, 79/79 on Bun, strict tsc failing only on `IDisposable`) are saved on branch `wip/effect-handle` (2d7f3dd). Resume from there once Metano maps `IDisposable`. Note for the resume: `Root(d => Reactivity.Effect(...))` binds to `Root<IDisposable>` once Effect returns a value.

---

## Task 3: Fix the stale already-Pending sibling after an errored computed retries (Phase 3)
Status: Complete

This was parked by the core's final review. Repro shape:
- `flaky` is a computed with no deps that fails on its first run.
- `C = Computed(() => { trigger.Value; ReadOr(flaky, -1); return 0; })`.
- `E = Effect(() => { var f = ReadOr(flaky, -1); C.Value; return f; }, ...)`, where E reads `flaky` before `C`.
- Set `trigger = 1` and flush.

Once C's retry recovers `flaky`, `ShallowPropagate` sets E Dirty. But `CheckDirty(E)` returns false, and `RunIfDirty` re-arms `Watching`, which wipes Dirty. So E keeps -1.

- [x] Scenario `RetryRecoveryUpdatesAPendingSibling`, reproducing exactly the shape above. It must fail on the current code.
- [x] Fix: in `EffectNode.RunIfDirty`, re-test `(Flags & ReactiveFlags.Dirty) != 0` after `CheckDirty` returns false, before re-arming. Check whether `Computed` has the same gap (a computed sibling read through `Refresh`/`CheckDirty`). If it does, fix it the same way and add a scenario.
- [x] Hot path: this is one flag read, on the not-dirty branch only.

### Verification Plan
- The new scenario fails before the fix and passes after it. Both suites pass.

### Phase Summary
Done in 0584165, 9dec4a2 and a61517d. 80/80 pass on .NET and 82 on Bun, with strict tsc clean. The review needed one fix round, after the intermediate design caused an in-flush glitch (an apply saw `42,0`). The re-review approved the final design and argued glitch-freedom in general.
- **Final design: the F-9 retry is a deferred invalidation.** An eligible tracked re-read throws the cached error in the current pass and queues the computed on an intrusive retry chain in `FlushLoop`. At the start of the next pass, before the commit, the computed is marked Dirty and its subscribers are propagated, as a signal commit does. Every observer, the reader included, sees the recovery or the fresh error one pass later, consistently. Recovery and error→error take the same path.
- **What changed in the code:**
  - `Retry()` and the inline sibling propagation from the core's fix wave item 2 are gone.
  - The interim re-tests in `RunIfDirty`/`RecomputeIfDependencyChanged` were removed.
  - The DependencyGraph walks are untouched.
- **Flush rules:**
  - Pending retries are discarded together with pending writes at the pass limit.
  - A computed disposed while on the chain is skipped and unlinked.
  - Queuing the same computed twice is guarded. The scenario for the A,B / A,C order is deferred, see the ledger.
- **Spec:** 4.2 records the one-pass timing as a deviation from Solid's F-9, and the 4.7 flowchart shows the retry step.
- **Scenarios added:** three stale-sibling shapes, the glitch shape, error→error, disposed-on-chain and queue-once.

---

## Task 4: Record the DSL-phase decisions (Phase 4)
Status: Complete

- [ ] Update `docs/handoff.md` and start `docs/design/0002-dsl-binding.md`, as a stub listing the open questions and the decisions taken so far:
  - The **root as an object**: `Reactivity.CreateRoot()` returns an `IDisposable` scope with `Run<T>(Func<T>)` that can be re-entered. This covers owner capture (Solid `getOwner`/`runWithOwner`) for event handlers and async continuations. The callback `Root` stays as the low-level form.
  - Users rarely see roots. `Render(App, container)` creates the app root. `For` creates one root per item and `Show` one per branch. Components run under the current owner and are not roots. Roots that users create are for long-lived state outside the UI.
  - Disposal stays **synchronous** (`IDisposable`, not `IAsyncDisposable`), matching Solid 2. Async support (async computeds, `isPending`, possibly async cleanups) belongs to the async phase. Spec §5.4 reserves the bits for it.
  - Still open from the architecture review: context resolved through the owner chain, and a common read abstraction over `Signal<T>`/`Computed<T>`.
  - Binding options to compare, from spec §6.1: `Prop<T>`, per-component invalidation, and Metano lazy arguments.

### Verification Plan
- The documents exist, link to each other and to the spec, and contain each decision listed above.

### Phase Summary
Done in the docs commit. `docs/design/0002-dsl-binding.md` is a stub with the decisions and open questions above. `docs/handoff.md` was refreshed: Metano 3.2.0 state, the blocked effect handle (#800, Metano 3.3.0), the deferred F-9 retry, and the next steps.

---

## Final Recap
_(write when all phases complete)_

## Deployment Plan
_(write when all phases complete)_
