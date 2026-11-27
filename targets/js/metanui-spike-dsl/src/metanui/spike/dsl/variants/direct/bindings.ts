import type { IDisposable } from "metano-runtime";
import { Reactivity, type Signal } from "metanui-reactive/metanui/reactive";

export function bindTo<T>(source: Signal<T>, apply: (obj: T) => void): IDisposable {
  return Reactivity.effect(() => source.value, (value: T, previous: T) => apply(value));
}

export function onClick(element: HTMLElement, handler: () => void): void {
  element.addEventListener("click", handler);
}

export function bindComputeApply<T>(compute: () => T, apply: (obj: T) => void): IDisposable {
  return Reactivity.effect(compute, (value: T, previous: T) => apply(value));
}

export function bindWrite(write: () => void): IDisposable {
  return Reactivity.effect(() => {
    write();

    return 0;
  }, (value: number, previous: number) => {
  });
}

export function bind<T>(compute: () => T, apply: (obj: T) => void): IDisposable;
export function bind(write: () => void): IDisposable;
export function bind(...args: unknown[]): any {
  if (args.length === 2 && typeof args[0] === "function" && typeof args[1] === "function") {
    return bindComputeApply(args[0] as any, args[1] as any);
  }

  if (args.length === 1 && typeof args[0] === "function") {
    return bindWrite(args[0] as () => void);
  }

  throw new Error("No matching overload for bind");
}
