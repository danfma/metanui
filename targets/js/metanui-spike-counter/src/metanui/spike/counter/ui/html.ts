import { isString } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";

export class Html {
  private constructor() { }

  static element(tagName: string, ...children: Node[]): HTMLElement {
    const element = document.createElement(tagName);
    for (const child of children) {
      element.appendChild(child);
    }

    return element;
  }

  static textString(text: string): Node {
    return document.createTextNode(text);
  }

  static textFuncOfString(text: () => string): Node {
    const node = document.createTextNode("");
    Reactivity.effect(text, (value: string, previous: string) => node.data = value);

    return node;
  }

  static text(text: string): Node;
  static text(text: () => string): Node;
  static text(...args: unknown[]): Node {
    if (args.length === 1 && isString(args[0])) {
      return Html.textString(args[0] as string);
    }

    if (args.length === 1 && typeof args[0] === "function") {
      return Html.textFuncOfString(args[0] as () => string);
    }

    throw new Error("No matching overload for text");
  }

  static button(label: string, onClick: () => void): HTMLElement {
    const button = document.createElement("button");
    button.textContent = label;
    button.addEventListener("click", onClick);

    return button;
  }

  static mount(app: () => Node, container: HTMLElement): () => void {
    return Reactivity.rootBody<() => void>((dispose: () => void) => {
      container.appendChild(app());

      return dispose;
    });
  }
}
