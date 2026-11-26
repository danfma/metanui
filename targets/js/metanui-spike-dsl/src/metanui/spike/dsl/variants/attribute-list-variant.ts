import { Reactivity } from "metanui-reactive/metanui/reactive";
import { Attributes } from "../core/attributes.js";
import { Elements } from "../core/elements.js";
import { Part } from "../core/part.js";
import { Badge } from "./badge.js";

export class AttributeListVariant {
  private constructor() { }

  static counter(): Part {
    const count = Reactivity.signal(0);

    return Elements.section(Attributes.classString("variant"), Elements.h2(Part.__implicitFromString("C. Attribute list")), Elements.p(Attributes.text(() => `Count: ${count.value}`)), Elements.p(Attributes.classFuncOfString(() => count.value % 2 === 0 ? "even" : "odd"), Part.__implicitFromString("parity")), Elements.button(Attributes.onClick(() => count.value = (count.value - 1) | 0), Part.__implicitFromString("-1")), Elements.button(Attributes.onClick(() => count.value = (count.value + 1) | 0), Part.__implicitFromString("+1")), new Badge(() => count.value > 5 ? "big" : "small"));
  }
}
