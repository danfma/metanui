import type { ClassType } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import type { HTMLElement } from "metanui-spike-counter/metanui/spike/counter/dom";
import { Part } from "./part.js";

let ReactiveTextPart$rt: ClassType<ReactiveTextPart> | undefined;

export class ReactiveTextPart extends Part {
  declare private readonly _text: () => string;

  constructor(text: () => string) {
    super();
    this._text = text;
  }

  static override get $runtimeType(): ClassType<ReactiveTextPart> {
    return (ReactiveTextPart$rt ??= {
      kind: "class",
      name: "ReactiveTextPart",
      fullName: "Metanui.Spike.Dsl.Core.ReactiveTextPart",
      namespace: "Metanui.Spike.Dsl.Core",
      ctor: ReactiveTextPart,
      base: () => Part.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is ReactiveTextPart => v instanceof ReactiveTextPart,
    });
  }

  override attachTo(parent: HTMLElement): void {
    const node = document.createTextNode("");
    Reactivity.effect(this._text, (value: string, previous: string) => node.data = value);
    parent.appendChild(node);
  }
}
