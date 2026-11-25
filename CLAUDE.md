# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

**Metanui** is a cross-platform UI toolkit written in C# 15 on .NET 11 with a C# DSL (in the spirit of Microsoft.UI.Reactor) on top of a **fine-grained reactive core** (signals, computed, effects, ownership/cleanup, batching — SolidJS-style, no virtual DOM).

- The **reactive core and the DSL are plain C#**. On .NET they run natively; for the web they are **transpiled to TypeScript by Metano** (consumed from NuGet, never from source).
- **Renderers are per platform** and are the only non-shared part: DOM (TypeScript target) first, Avalonia (.NET) later.
- Metanui is also a **test case for Metano**: anything Metano emits badly (closures in hot paths, extra allocations, broken imports) is reported upstream as a Metano issue (`danfma/metano`), not worked around silently here.

Start every session by reading `docs/handoff.md`.

## Stack and rules

- .NET SDK 11 (`global.json`), `net11.0`, **C# 15** (`LangVersion 15`), Nullable, TreatWarningsAsErrors, Central Package Management.
- **Metano always at its latest NuGet release**: `Metano` and `Metano.Build.TypeScript` (formerly `Metano.Build`) float (`Version="*"`), the `Metano.Compiler.TypeScript` tool is pinned in `dotnet-tools.json`. Upgrade with `scripts/update-metano.sh`. Never reference Metano by ProjectReference or a local path.
- Use C# 15 features where they fit (closed hierarchies, unions, collection-expression arguments, extension members) — see the `csharp-15` skill. Check what the current Metano release can transpile before relying on a feature in code that targets the web (Metano 3.1 transpiles `closed` hierarchies; C# 15 `union` declarations are still unsupported, MS0038).
- JS tooling: **Bun only** (never npm/yarn/pnpm/npx). Generated TS lives under `targets/js/<package>/src` and is never hand-edited.
- Coding rules: `.claude/rules/backend.md` (C#) and `.claude/rules/frontend.md` (hand-written TS).
- English for all repository artifacts; conversation with the maintainer in Portuguese.
- Conventional commits with an infinitive verb (`feat: add ...`); issue titles in prose.
- Diagrams in Mermaid only.
- Avoidable runtime overhead in generated or hand-written hot paths is a defect.

## Commands

```sh
dotnet tool restore
dotnet build                     # also transpiles via Metano.Build.TypeScript into targets/js/*
dotnet csharpier format .
scripts/update-metano.sh         # move to the latest Metano release
bun install                      # JS workspace (targets/js/*)
```

## Review

Before declaring work done, run `compiler-man` (global agent; semantics and Metano interplay) and `bob` (design/clean code) in parallel, plus `backend-reviewer` for `.cs` changes and `frontend-reviewer` for hand-written `.ts` changes.
