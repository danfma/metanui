import type { ClassType } from "metano-runtime";
import type { HTMLElement } from "metanui-spike-counter/metanui/spike/counter/dom";
import { Part } from "./part.js";

let AttributePart$rt: ClassType<AttributePart> | undefined;

export class AttributePart extends Part {
  declare private readonly _apply: (obj: HTMLElement) => void;

  constructor(apply: (obj: HTMLElement) => void) {
    super();
    this._apply = apply;
  }

  static override get $runtimeType(): ClassType<AttributePart> {
    return (AttributePart$rt ??= {
      kind: "class",
      name: "AttributePart",
      fullName: "Metanui.Spike.Dsl.Core.AttributePart",
      namespace: "Metanui.Spike.Dsl.Core",
      ctor: AttributePart,
      base: () => Part.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is AttributePart => v instanceof AttributePart,
    });
  }

  override attachTo(parent: HTMLElement): void {
    this._apply(parent);
  }
}
