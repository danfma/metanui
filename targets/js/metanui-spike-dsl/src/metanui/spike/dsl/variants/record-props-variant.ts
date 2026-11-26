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
    let receiver$temp$0, receiver$temp$1, receiver$temp$2, receiver$temp$3;
    const count = Reactivity.signal(0);

    return PropsElements.section((receiver$temp$0 = new Props(), (receiver$temp$0 as { class_: typeof receiver$temp$0.class_ }).class_ = Prop.__implicitFromT("variant"), receiver$temp$0), PropsElements.h2(new Props(), Part.__implicitFromString("A. Props object")), PropsElements.p(new Props(), Attributes.text(() => `Count: ${count.value}`)), PropsElements.p((receiver$temp$1 = new Props(), (receiver$temp$1 as { class_: typeof receiver$temp$1.class_ }).class_ = PropsElements.bind(() => count.value % 2 === 0 ? "even" : "odd"), receiver$temp$1), Part.__implicitFromString("parity")), PropsElements.button((receiver$temp$2 = new Props(), (receiver$temp$2 as { onClick: typeof receiver$temp$2.onClick }).onClick = () => count.value = (count.value - 1) | 0, receiver$temp$2), Part.__implicitFromString("-1")), PropsElements.button((receiver$temp$3 = new Props(), (receiver$temp$3 as { onClick: typeof receiver$temp$3.onClick }).onClick = () => count.value = (count.value + 1) | 0, receiver$temp$3), Part.__implicitFromString("+1")), new Badge(() => count.value > 5 ? "big" : "small"));
  }
}
