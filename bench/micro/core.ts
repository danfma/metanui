import { join } from "node:path";

/** Where `prepare.ts` writes one scratch copy of the generated package per variant. */
export const workRoot = join(import.meta.dir, ".work");

export interface ReadableNode {
  readonly value: number;
}

export interface WritableSignal {
  value: number;
}

export interface ReactivityApi {
  useScheduler(scheduler: unknown): void;
  flush(): void;
  signal(initialValue: number): WritableSignal;
  computed(compute: () => number): ReadableNode;
  effect(compute: () => number, apply: (value: number) => void): void;
  root<T>(body: (dispose: () => void) => T): T;
}

interface CoreModule {
  readonly Reactivity: ReactivityApi;
  readonly ManualFlushScheduler: new () => unknown;
}

export function variantModulePath(variant: string, file: string): string {
  return join(workRoot, variant, "metanui/reactive", file);
}

/** Loads a variant's `Reactivity` with a manual scheduler, so only `flush()` drives the graph. */
export async function loadReactivity(variant: string): Promise<ReactivityApi> {
  const core = (await import(variantModulePath(variant, "index.ts"))) as CoreModule;

  core.Reactivity.useScheduler(new core.ManualFlushScheduler());

  return core.Reactivity;
}
