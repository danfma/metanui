import { Reactivity } from "metanui-reactive/metanui/reactive";
import { Attributes } from "../core/attributes.js";
import { Elements } from "../core/elements.js";
import { Part } from "../core/part.js";
import { Badge } from "./badge.js";
import { whenClicked, withClassFuncOfString, withClassString } from "./modifiers.js";

export class FluentVariant {
  private constructor() { }

  static counter(): Part {
    const count = Reactivity.signal(0);

    return withClassString(Elements.section(Elements.h2(Part.__implicitFromString("E. Fluent modifiers")), Elements.p(Attributes.text(() => `Count: ${count.value}`)), withClassFuncOfString(Elements.p(Part.__implicitFromString("parity")), () => count.value % 2 === 0 ? "even" : "odd"), whenClicked(Elements.button(Part.__implicitFromString("-1")), () => count.value = (count.value - 1) | 0), whenClicked(Elements.button(Part.__implicitFromString("+1")), () => count.value = (count.value + 1) | 0), new Badge(() => count.value > 5 ? "big" : "small")), "variant");
  }
}
