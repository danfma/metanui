import { Reactivity } from "metanui-reactive/metanui/reactive";
import type { El } from "../core/el.js";
import type { Setter } from "./setter.js";

export function bind(element: El, setters: () => Setter[]): El {
  Reactivity.effect(setters, (current: Setter[], previous: Setter[]) => {
    for (const setter of current) {
      setter.applyTo(element.node);
    }
  });

  return element;
}
