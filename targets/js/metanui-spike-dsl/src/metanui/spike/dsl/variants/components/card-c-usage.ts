import { Reactivity } from "metanui-reactive/metanui/reactive";
import { Attributes } from "../../core/attributes.js";
import { Elements } from "../../core/elements.js";
import { Part } from "../../core/part.js";
import { CardC } from "./card-c.js";

export class CardCUsage {
  private constructor() { }

  static cards(): Part {
    const count = Reactivity.signal(0);
    const closed = Reactivity.signal(0);

    return Elements.section(Attributes.classString("variant"), Elements.h2(Part.__implicitFromString("C. Components")), new CardC(() => "Static title", null, () => closed.value = (closed.value + 1) | 0, Elements.p(Part.__implicitFromString("Static body"))), new CardC(() => `Count: ${count.value}`, () => count.value > 5, () => closed.value = (closed.value + 1) | 0, Elements.p(Attributes.text(() => `Closed ${closed.value} times`))), Elements.button(Attributes.onClick(() => count.value = (count.value + 1) | 0), Part.__implicitFromString("+1")));
  }
}
