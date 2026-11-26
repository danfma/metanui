import { El } from "../core/el.js";
import type { Part } from "../core/part.js";
import { Prop } from "./prop.js";
import type { Props } from "./props.js";

export class PropsElements {
  private constructor() { }

  static bind<T>(read: () => T): Prop<T> {
    return Prop.bound(read);
  }

  static element(tagName: string, props: Props, children: Part[]): El {
    const element = El.create(tagName, children);
    props.applyTo(element.node);

    return element;
  }

  static section(props: Props, ...children: Part[]): El {
    return PropsElements.element("section", props, children);
  }

  static h2(props: Props, ...children: Part[]): El {
    return PropsElements.element("h2", props, children);
  }

  static p(props: Props, ...children: Part[]): El {
    return PropsElements.element("p", props, children);
  }

  static button(props: Props, ...children: Part[]): El {
    return PropsElements.element("button", props, children);
  }
}
