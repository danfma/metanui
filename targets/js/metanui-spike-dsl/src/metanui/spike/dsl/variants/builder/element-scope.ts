import type { ClassType } from "metano-runtime";
import { Bindable } from "./bindable.js";
import { ClickEvent } from "./click-event.js";

let ElementScope$rt: ClassType<ElementScope> | undefined;

export class ElementScope {
  declare readonly node: HTMLElement;
  declare private _textContent: Bindable<string>;
  declare private _className: Bindable<string>;

  constructor(node: HTMLElement) {
    this.node = node;
    this._textContent = Bindable.__implicitFromT("");
    this._className = Bindable.__implicitFromT("");
  }

  static get $runtimeType(): ClassType<ElementScope> {
    return (ElementScope$rt ??= {
      kind: "class",
      name: "ElementScope",
      fullName: "Metanui.Spike.Dsl.Variants.Builder.ElementScope",
      namespace: "Metanui.Spike.Dsl.Variants.Builder",
      ctor: ElementScope,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is ElementScope => v instanceof ElementScope,
    });
  }

  get textContent(): Bindable<string> {
    return this._textContent;
  }

  set textContent(value: Bindable<string>) {
    this._textContent = value;
    value.applyTo((text: string) => this.node.textContent = text);
  }

  get className(): Bindable<string> {
    return this._className;
  }

  set className(value: Bindable<string>) {
    this._className = value;
    value.applyTo((name: string) => this.node.className = name);
  }

  set onClick(value: (obj: ClickEvent) => void) {
    this.node.addEventListener("click", () => value(ClickEvent.instance));
  }
}
