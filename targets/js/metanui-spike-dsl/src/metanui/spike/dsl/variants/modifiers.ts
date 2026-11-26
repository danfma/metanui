import { isString } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { El } from "../core/el.js";

export function whenClicked(element: El, handler: () => void): El {
  element.node.addEventListener("click", handler);

  return element;
}

export function withClassString(element: El, value: string): El {
  element.node.className = value;

  return element;
}

export function withClassFuncOfString(element: El, value: () => string): El {
  Reactivity.effect(value, (current: string, previous: string) => element.node.className = current);

  return element;
}

export function withClass(element: El, value: string): El;
export function withClass(element: El, value: () => string): El;
export function withClass(...args: unknown[]): El {
  if (args.length === 2 && args[0] instanceof El && isString(args[1])) {
    return withClassString(args[0] as El, args[1] as string);
  }

  if (args.length === 2 && args[0] instanceof El && typeof args[1] === "function") {
    return withClassFuncOfString(args[0] as El, args[1] as () => string);
  }

  throw new Error("No matching overload for withClass");
}
