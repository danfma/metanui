# DSL v1: keyed Map, platform elements and effect bindings

Ship the first usable Metanui UI layer, chosen in `docs/design/0002-dsl-binding.md` as option H. Builder lambdas give the platform element itself; a binding is an effect that writes a plain property; component props are backed by signals. The keyed `Map` primitive comes first in the reactive core, because `For` cannot be built without it (spike finding). The web adapter ships; Avalonia comes later. A `Counter` and a `CounterList` sample show it working.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Design:** `docs/design/0002-dsl-binding.md` (spike findings, options A–H). **Core spec:** `docs/design/0001-reactive-core.md`. **Context:** `docs/handoff.md`. **Spike reference:** branch `spike/dsl-shapes`, `spikes/Metanui.Spike.Dsl/Variants/Direct` and `spikes/dsl-web/counter-list.smoke.test.ts`.

## For Future Agents
As work proceeds, mark checkboxes `- [x]`. When a phase is done, set its status to `Complete` and write its Phase Summary: what was done, key decisions, and anything needed to continue with zero context. Run the phase's Verification Plan and record the result before moving on. When all phases are done, fill in the Final Recap and the Deployment Plan.

Branch: `feat/dsl-v1`, from `main` after the maintainer merges `chore/metano-4.0.3` (which carries 4.0.2 too). Direct pushes to `main` are blocked: integration goes through a PR or the maintainer's merge.

## Global Constraints

- net11.0, C# 15, TreatWarningsAsErrors, Central Package Management, Bun only, never hand-edit `targets/js/*/src`.
- Metano always at its latest release, moved with `scripts/update-metano.sh` (then `dotnet build`, then `bun install`). New Metano defects go to the Metano Claude session (`ListAgents`, currently `metano-56`) with a minimal repro, never worked around silently; a visible workaround is marked `// Metano #<issue>`.
- Use C# semantics, not JS ones: collections are `IReadOnlyList<T>`, equality is `EqualityComparer<T>.Default` unless a key selector is given.
- Hot paths (spec 0001 §5.3) allocate nothing avoidable: no closures, boxing or interface dispatch per update.
- Reactive semantics stay Solid 2.0.4 (`@solidjs/signals`): reads return the committed value until the flush, writes inside a computation throw, roots and effects cannot be created in an apply.
- Reviews at every phase end, in parallel: `compiler-man`, `bob`, `backend-reviewer` (.cs), `frontend-reviewer` (hand-written .ts), `architecture-reviewer`. A `REPROVADO` blocks the phase; `APROVADO COM RESSALVAS` items are reported to the maintainer.
- Commits: conventional, infinitive verb, ending with the `Co-Authored-By` line.

## Layering

```mermaid
flowchart LR
  Reactive["Metanui.Reactive<br/>signals, effects, Map, Update"]
  Ui["Metanui.Ui<br/>INodePort, builder scope, Bind,<br/>Component&lt;TSelf&gt;, For, Show, Render"]
  Web["Metanui.Ui.Web<br/>[External] DOM types, Div/P/…,<br/>DOM port adapter, microtask scheduler"]
  Sample["samples/counter-web<br/>Counter, CounterList"]
  Ui --> Reactive
  Web --> Ui
  Sample --> Web
```

`Metanui.Ui` never names a DOM type. Its port works on `object` node handles, so users never see a node type parameter. `Metanui.Ui.Web` is the only place that knows the DOM.

---

## Phase 0: Prerequisites and design record
Status: Complete

- [x] Confirm `main` contains `chore/metano-4.0.3` (`git log main --oneline | grep "upgrade Metano to 4.0.3"`); if not, stop and ask the maintainer to merge it.
- [x] Create `feat/dsl-v1` from `main`. Bring `docs/design/0002-dsl-binding.md` and this plan from `spike/dsl-shapes` (`git checkout spike/dsl-shapes -- docs/design/0002-dsl-binding.md plans/dsl-v1.md`); do not bring `spikes/Metanui.Spike.Dsl` or `spikes/dsl-web`.
- [x] Rewrite the "Proposed design (v1)" section of 0002 for option H: platform elements, fused `Bind(Action)` and split `Bind(compute, apply)`, signal-backed component props, plain props documented as init-only, `For` over `Map`, `Show`, the `INodePort`, `Metanui.Ui` / `Metanui.Ui.Web`, and the out-of-v1 list (Avalonia, WebIDL generation, context, analyzers, `[Prop]` source generator, `ReactiveList<T>`, interpolated-template binding until Metano #828, js-framework-benchmark). Set the status to "Accepted, 2026-11-27".
- [x] Update `docs/handoff.md`: status line and next steps point to this plan.

### Verification Plan
- `git diff main --stat` shows only `docs/` and `plans/` changes.
- `grep -n "Accepted, 2026-11-27" docs/design/0002-dsl-binding.md` finds the status line.

### Phase Summary
Done 2026-11-27. `main` holds Metano 4.0.3 (pushed by the agent; the maintainer allows the agent to merge and rebase). `feat/dsl-v1` branches from it with only `docs/` and `plans/` changes. 0002's v1 section now describes option H (it was renamed "Design (v1)", status "Accepted, 2026-11-27"); the rest of 0002 keeps the stub and the spike record. Verification: `git diff main --stat` lists `docs/design/0002-dsl-binding.md`, `docs/handoff.md`, `plans/dsl-v1.md` only; the grep finds the status line.

## Phase 1: Keyed `Map` in the reactive core
Status: Not started

**Files:** `docs/design/0001-reactive-core.md` (new section), `src/Metanui.Reactive/Reactivity.cs` (public entry), a new internal node under `src/Metanui.Reactive/` (e.g. `Mapping/KeyedMap.cs`), `src/Metanui.Reactive.Scenarios/MapScenarios.cs`, `tests/Metanui.Reactive.Tests`, `tests/js/reactive`.

- [ ] Spec it first in 0001 (new section after effects), against Solid 2.0.4 `mapArray`:
  - `public static Func<IReadOnlyList<TResult>> Map<T, TResult>(Func<IReadOnlyList<T>> source, Func<T, TResult> map)` keys by `EqualityComparer<T>.Default` (class: reference, record: value).
  - Overload with `Func<T, TKey> key` (keys by `EqualityComparer<TKey>.Default`).
  - Each mapped item runs `map` once, untracked, under its own owner that survives the source's reruns; an item whose key leaves the list has its owner disposed (cleanups run); a kept item keeps its result and state; the result list follows the new order.
  - Duplicate keys pair in order (the n-th occurrence of a key in the new list reuses the n-th one of the old list), as Solid pairs repeated references; no exception.
  - Disposal of the owner that created the `Map` disposes every item owner.
  - The source read is tracked; `map` reads are not tracked by the `Map` node.
  - Equality of the result list: a new `IReadOnlyList<TResult>` only when the mapping changed (order, insertions, removals); an unchanged source rerun keeps the previous list instance so observers do not rerun.
- [ ] Implement the node: reconcile old and new keys in O(n) with a `Dictionary<TKey, …>` plus an in-order duplicate queue; no per-item closure on the update path beyond `map` itself. Item owners are created by the node, not in an effect apply or compute that would dispose them.
- [ ] Scenarios (run on .NET and Bun through the scenarios package): add/append, remove first/middle/last, reorder, replace all, clear, duplicate records, key selector with mutable items, owner disposal disposes items, cleanups run once per removed item, unchanged rerun keeps the list instance, item state (a signal created in `map`) survives unrelated additions.
- [ ] Reproduce the spike failure as a scenario first (items created in a compute die on rerun), then show `Map` passes it.
- [ ] Bench: add a `Map` case to `bench/micro` (append 1 000 items, swap two, remove one) and record the numbers in the audit doc.

### Verification Plan
- `dotnet build` → 0 warnings, 0 errors; `dotnet test` → all pass (121 + the new Map scenarios).
- `bun install && bun test` → all pass, same scenario count as .NET for the Map group.
- Strict tsc over `targets/js/metanui-reactive/src` and the scenarios (customConditions `bun`, lib ES2022 + ESNext.Disposable) → 0 diagnostics.
- `scripts/bench-reactivity.sh test` → 12/12 pass (no regression in the core).
- Reviewers run, none `REPROVADO`.

### Phase Summary
_(write when phase completes)_

## Phase 2: `Signal<T>.Update`
Status: Not started

- [ ] Spec in 0001: `public void Update(Func<T, T> update)` applies `update` to the latest value including a pending write of the same flush, queues the result as the pending write, and keeps every other write rule (throws inside a computation, equality skips the commit). Matches Solid 2.0's function setter.
- [ ] Implement in `Signal.cs` without allocating when there is no pending write.
- [ ] Scenarios: two `Update(c => c + 1)` in one tick give +2; `Update` after a plain write builds on it; `Update` inside a computation throws; equality skip.

### Verification Plan
- Same build, test and strict-tsc checks as Phase 1, all green.
- Reviewers run, none `REPROVADO`.

### Phase Summary
_(write when phase completes)_

## Phase 3: `Metanui.Ui` (platform-neutral layer)
Status: Not started

**Files:** `src/Metanui.Ui/` (new project, `[EmitPackage]` → `targets/js/metanui-ui`), `src/Metanui.Ui.Scenarios/` (scenarios with a fake port, transpiled like `Metanui.Reactive.Scenarios`), `tests/Metanui.Ui.Tests`, `tests/js/ui`, `Metanui.slnx`, root `package.json` workspaces.

- [ ] `INodePort`: `object CreateText(string text)`, `void SetText(object text, string value)`, `void Insert(object parent, object node, object? anchor)`, `void Remove(object parent, object node)`, `object CreateAnchor()` (comment node on the web). Elements are created by the platform factories, not by the port.
- [ ] Builder scope: the ambient current parent and the port, used by platform factories through a small `Builder.Create(object node, Action build)`-style API, restored in `finally`. `Add(...)` outside a builder throws with a clear message.
- [ ] Bindings: `Bind(Action write)` (fused: write in the tracked compute, for platform properties) and `Bind<T>(Func<T> compute, Action<T> apply)` (split: write in the apply, equality skips unchanged values, required for signal-backed props). XML docs state which one to use and why (a signal write in a fused bind throws).
- [ ] `Component<TSelf>`: props are plain properties; reactive props are signal-backed (`get => _x.Value; set => _x.Value = value`), documented; plain props are init-only. Children are collected into a fragment and placed with the port (no wrapper element). Each component exposes a one-line static factory until Metano #832 lands (`// Metano #832`).
- [ ] `For<T>(Func<IReadOnlyList<T>> items, Func<T, …> render)` and the keyed overload, on `Reactivity.Map`, placed between two anchors with `Insert`/`Remove` and minimal moves.
- [ ] `Show(Func<bool> when, Action then, Action? otherwise = null)`, each branch under its own root, swapped between anchors.
- [ ] `Ui.Render(Action build, object container, INodePort port)` returns `IDisposable` that disposes the whole tree and removes its nodes.
- [ ] Scenarios with a fake C# port that records the node tree as text: static tree, fused and split binds, signal-backed props, init-only prop documented behaviour, `For` add/remove/reorder keeps item state and disposes removed items, `Show` toggling disposes the hidden branch, `Render` dispose removes everything, `Add` outside a builder throws.

### Verification Plan
- `dotnet build` / `dotnet test` green; `bun test` runs the same Ui scenarios green.
- Strict tsc over `targets/js/metanui-ui/src` and its scenarios → 0 diagnostics (except open Metano issues, each listed with its number).
- Reviewers run, none `REPROVADO`; `architecture-reviewer` confirms `Metanui.Ui` has no DOM reference.

### Phase Summary
_(write when phase completes)_

## Phase 4: `Metanui.Ui.Web`
Status: Not started

**Files:** `src/Metanui.Ui.Web/` (new project → `targets/js/metanui-ui-web`), `tests/js/ui-web` (fake-DOM tests).

- [ ] `[External]` DOM types, hand-written: `Node`, `Text`, `Comment`, `HTMLElement` (`TextContent`, `ClassName`, `Disabled` where it applies), `HTMLInputElement` (`Value`, `Checked`), `Document` (`CreateElement`, `CreateTextNode`, `CreateComment`), and a `[NoContainer]` `Browser` static (`Document`, `QueueMicrotask`). Only what the factories and samples use.
- [ ] Factories: `Div`, `Span`, `P`, `H1`, `H2`, `H3`, `Section`, `Button`, `Input`, `Ul`, `Li`, each `(Action<TElement> build)` with the typed element.
- [ ] Event extensions: `OnClick(this HTMLElement, Action)`, `OnInput(this HTMLInputElement, Action<string>)`.
- [ ] `DomNodePort : INodePort` and `MicrotaskScheduler : IFlushScheduler`; `Web.Mount(Action build, HTMLElement container)` wires both and returns `IDisposable`.
- [ ] Fake-DOM tests under Bun (port the spike's `FakeNode`): factories, events, port operations, anchors.
- [ ] Check bundle tree-shaking: a sample that uses only `Div` and `OnClick` does not pull the other factories' code (`bun build --minify` size recorded).

### Verification Plan
- Build and tests green; strict tsc over `targets/js/metanui-ui-web/src` → 0 diagnostics (open Metano issues excepted, listed).
- Reviewers run, none `REPROVADO`.

### Phase Summary
_(write when phase completes)_

## Phase 5: `samples/counter-web`
Status: Not started

**Files:** `samples/Metanui.Samples.Counter/` (C#), `samples/counter-web/` (host: `index.html`, `main.ts`, `package.json` with `bun build --conditions=bun`), a smoke test.

- [ ] `Counter : Component<Counter>`: signal-backed `Label`, `OnRemove` callback, own count with −1/+1 (`count.Update(c => c + 1)`), remove button.
- [ ] `CounterList : Component<CounterList>`: "Add counter" appends a `CounterEntry`; `For` over the entries renders `Counter`s; remove takes an entry out; a summary binds the count.
- [ ] Smoke test on the fake DOM (from the spike, no `test.failing`): add three, change two, remove the first, add one; each counter keeps its state, removed counters are disposed (cleanup count), no extra wrapper elements.
- [ ] Check in Chrome through the browser extension (or record that it was unavailable): add, increment, remove, add again; no console errors.

### Verification Plan
- `bun test` in `samples/counter-web` → all pass.
- `bun run build` in `samples/counter-web` → bundle built; size recorded in 0002.
- Browser check recorded (screenshot or console log), or noted as not run with the reason.
- Final review round with all five reviewers over the whole branch, none `REPROVADO`.

### Phase Summary
_(write when phase completes)_

## Final Recap
_(write when all phases complete: summary of the entire piece of work)_

## Deployment Plan
_(write when all phases complete: step-by-step deployment instructions)_
