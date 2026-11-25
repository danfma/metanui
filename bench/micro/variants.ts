import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A variant rewrites a scratch copy of the generated `metanui-reactive/src`, never the repository. */
export interface Variant {
  readonly description: string;
  apply(root: string): void;
}

const graphFile = "metanui/reactive/graph/dependency-graph.ts";
const linkStackFile = "metanui/reactive/graph/link-stack.ts";
const flagsFile = "metanui/reactive/graph/reactive-flags.ts";

const shippedPropagate = `  static propagate(link: Link): void {
    const stackBase = LinkStack.top;
    try {
      DependencyGraph.propagateAbove(link, stackBase);
    } finally {
      LinkStack.truncate(stackBase);
    }
  }`;

const shippedCheckDirty = `  static checkDirty(link: Link, sub: ReactiveNode): boolean {
    const stackBase = LinkStack.top;
    try {
      return DependencyGraph.checkDirtyAbove(link, sub);
    } finally {
      LinkStack.truncate(stackBase);
    }
  }`;

const flagValues: Readonly<Record<string, number>> = {
  None: 0,
  Mutable: 1,
  Watching: 2,
  RecursedCheck: 4,
  Recursed: 8,
  Dirty: 16,
  Pending: 32,
  Errored: 64,
};

/** Replaces `search` once, and fails loudly when the generated code no longer contains it. */
function replaceExact(root: string, file: string, search: string, replacement: string): void {
  const path = join(root, file);
  const source = readFileSync(path, "utf8");

  if (!source.includes(search)) {
    throw new Error(`Variant patch is stale: ${file} no longer contains the expected code.`);
  }

  writeFileSync(path, source.replace(search, replacement));
}

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      return listTypeScriptFiles(path);
    }

    return path.endsWith(".ts") ? [path] : [];
  });
}

function inlineFlagLiterals(root: string): void {
  const pattern = /ReactiveFlags\.(None|Mutable|Watching|RecursedCheck|Recursed|Dirty|Pending|Errored)\b/g;

  for (const path of listTypeScriptFiles(root)) {
    if (path.endsWith(flagsFile)) {
      continue;
    }

    const source = readFileSync(path, "utf8");
    const inlined = source.replace(pattern, (_match, name: string) => String(flagValues[name]));

    writeFileSync(path, inlined);
  }
}

function inlineWalks(root: string): void {
  replaceExact(root, graphFile, `${shippedPropagate}\n\n`, "");
  replaceExact(root, graphFile, `${shippedCheckDirty}\n\n`, "");

  replaceExact(
    root,
    graphFile,
    "  private static propagateAbove(link: Link, stackBase: number): void {\n",
    "  static propagate(link: Link): void {\n    const stackBase = LinkStack.top;\n",
  );

  replaceExact(
    root,
    graphFile,
    "  private static checkDirtyAbove(link: Link, sub: ReactiveNode): boolean {\n",
    "  static checkDirty(link: Link, sub: ReactiveNode): boolean {\n",
  );
}

export const variants: Readonly<Record<string, Variant>> = {
  A: {
    description: "shipped: wrapper call, try/finally, truncate",
    apply: () => {},
  },
  B: {
    description: "wrapper call and truncate, no try/finally",
    apply: (root) => {
      replaceExact(
        root,
        graphFile,
        shippedPropagate,
        `  static propagate(link: Link): void {
    const stackBase = LinkStack.top;
    DependencyGraph.propagateAbove(link, stackBase);
    LinkStack.truncate(stackBase);
  }`,
      );

      replaceExact(
        root,
        graphFile,
        shippedCheckDirty,
        `  static checkDirty(link: Link, sub: ReactiveNode): boolean {
    const stackBase = LinkStack.top;
    const dirty = DependencyGraph.checkDirtyAbove(link, sub);
    LinkStack.truncate(stackBase);
    return dirty;
  }`,
      );
    },
  },
  C: {
    description: "walk bodies inlined: no wrapper, no try/finally, no truncate",
    apply: inlineWalks,
  },
  D: {
    description: "shipped, with every ReactiveFlags.X replaced by its literal",
    apply: inlineFlagLiterals,
  },
  E: {
    description: "shipped, without `?? null` on LinkStack indexed reads",
    apply: (root) => {
      replaceExact(
        root,
        linkStackFile,
        "const link = LinkStack._items[LinkStack.top] ?? null;",
        "const link = LinkStack._items[LinkStack.top];",
      );

      replaceExact(
        root,
        linkStackFile,
        "grown[index] = LinkStack._items[index] ?? null;",
        "grown[index] = LinkStack._items[index];",
      );
    },
  },
};
