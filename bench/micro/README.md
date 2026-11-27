# Micro-benchmark: graph walk overhead

This is the harness behind section 4 of `docs/design/0001-reactive-core-ts-audit.md`. It measures,
on the generated TypeScript:

- the cost of the defensive `try/finally` and the wrapper call that `DependencyGraph.propagate`/`checkDirty` add around the walk;
- the cost of `ReactiveFlags` property loads against literals;
- the cost of `?? null` on `LinkStack` reads;
- the cost of a keyed `Reactivity.map` reconcile (`map.ts`, section 14 of the audit).

The generated sources under `targets/js` are only read. `prepare.ts` copies
`targets/js/metanui-reactive/src` into `.work/<variant>/` (gitignored) and applies each variant to the
copy. A variant whose patch no longer matches the generated code fails loudly.

| Variant | Change |
|---|---|
| A | shipped code |
| B | wrapper call and `truncate`, without `try/finally` |
| C | walk bodies inlined: no wrapper, no `try/finally`, no `truncate` |
| D | every `ReactiveFlags.X` replaced by its literal |
| E | no `?? null` on `LinkStack` indexed reads |

## Run

From a clean clone, at the repository root:

```sh
dotnet tool restore
dotnet build            # generates targets/js/metanui-reactive/src
bun install
cd bench/micro
bun prepare.ts          # (re)creates .work/A … .work/E; rerun after every dotnet build
bun run.ts 3 A,B,C      # wrapper and try/finally: 3 interleaved rounds, one process per run
bun run.ts 3 A,D        # literal flags
bun run.ts 3 A,E        # no `?? null`
for v in A B C; do bun per-call.ts $v; done   # per-call overhead, in ns
bun map.ts A            # keyed Reactivity.map: append 1 000, swap two, remove one (audit section 14)
```

Single measurements:

```sh
bun ops.ts <variant> <deep|wide|many>   # median µs per op (one write + flush)
bun per-call.ts <variant>               # median ns per checkDirty/propagate call
```

`run.ts` prints a Markdown table. Each cell is the median of the rounds, with every round in brackets,
so the spread stays visible. Run on an idle machine. The `deep`/`wide`/`many` workloads cannot resolve
differences below roughly 5–15%, and a loaded machine swings by much more. The per-call loop is the
measurement that bounds a call overhead.
