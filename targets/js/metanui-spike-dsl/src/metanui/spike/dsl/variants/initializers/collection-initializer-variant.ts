import { Reactivity } from "metanui-reactive/metanui/reactive";
import { Attributes } from "../../core/attributes.js";
import { Part } from "../../core/part.js";
import { Badge } from "../badge.js";
import { Button } from "./button.js";
import { H2 } from "./h2.js";
import { P } from "./p.js";
import { Section } from "./section.js";

export class CollectionInitializerVariant {
  private constructor() { }

  static counter(): Part {
    const count = Reactivity.signal(0);

    return ((receiver$temp$0) => {
      receiver$temp$0.add(((receiver$temp$1) => {
        receiver$temp$1.add(Part.__implicitFromString("D. Collection initializer"));

        return receiver$temp$1;
      })(new H2()));
      receiver$temp$0.add(((receiver$temp$2) => {
        receiver$temp$2.add(Attributes.text(() => `Count: ${count.value}`));

        return receiver$temp$2;
      })(new P()));
      receiver$temp$0.add(((receiver$temp$3) => {
        receiver$temp$3.add(Part.__implicitFromString("parity"));

        return receiver$temp$3;
      })(new P(Attributes.classFuncOfString(() => count.value % 2 === 0 ? "even" : "odd"))));
      receiver$temp$0.add(((receiver$temp$4) => {
        receiver$temp$4.add(Part.__implicitFromString("-1"));

        return receiver$temp$4;
      })(new Button(Attributes.onClick(() => count.value = (count.value - 1) | 0))));
      receiver$temp$0.add(((receiver$temp$5) => {
        receiver$temp$5.add(Part.__implicitFromString("+1"));

        return receiver$temp$5;
      })(new Button(Attributes.onClick(() => count.value = (count.value + 1) | 0))));
      receiver$temp$0.add(new Badge(() => count.value > 5 ? "big" : "small"));

      return receiver$temp$0;
    })(new Section(Attributes.classString("variant")));
  }
}
