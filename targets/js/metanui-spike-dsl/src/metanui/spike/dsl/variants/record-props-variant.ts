import { Reactivity } from "metanui-reactive/metanui/reactive";
import { Attributes } from "../core/attributes.js";
import { Part } from "../core/part.js";
import { Badge } from "./badge.js";
import { Prop } from "./prop.js";
import { PropsElements } from "./props-elements.js";
import { Props } from "./props.js";

export class RecordPropsVariant {
  private constructor() { }

  static counter(): Part {
    const count = Reactivity.signal(0);

    return PropsElements.section(((receiver$temp$0) => {
      Object.assign(receiver$temp$0, { class_: Prop.__implicitFromT("variant") });

      return receiver$temp$0;
    })(new Props()), PropsElements.h2(new Props(), Part.__implicitFromString("A. Props object")), PropsElements.p(new Props(), Attributes.text(() => `Count: ${count.value}`)), PropsElements.p(((receiver$temp$1) => {
      Object.assign(receiver$temp$1, { class_: PropsElements.bind(() => count.value % 2 === 0 ? "even" : "odd") });

      return receiver$temp$1;
    })(new Props()), Part.__implicitFromString("parity")), PropsElements.button(((receiver$temp$2) => {
      Object.assign(receiver$temp$2, {
        onClick: () => count.value = (count.value - 1) | 0,
      });

      return receiver$temp$2;
    })(new Props()), Part.__implicitFromString("-1")), PropsElements.button(((receiver$temp$3) => {
      Object.assign(receiver$temp$3, {
        onClick: () => count.value = (count.value + 1) | 0,
      });

      return receiver$temp$3;
    })(new Props()), Part.__implicitFromString("+1")), new Badge(() => count.value > 5 ? "big" : "small"));
  }
}
