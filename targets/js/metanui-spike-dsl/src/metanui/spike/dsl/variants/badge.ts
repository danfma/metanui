import type { ClassType } from "metano-runtime";
import { Attributes } from "../core/attributes.js";
import { Component } from "../core/component.js";
import { Elements } from "../core/elements.js";
import type { Part } from "../core/part.js";

let Badge$rt: ClassType<Badge> | undefined;

export class Badge extends Component {
  declare private readonly _size: () => string;

  constructor(size: () => string) {
    super();
    this._size = size;
  }

  static override get $runtimeType(): ClassType<Badge> {
    return (Badge$rt ??= {
      kind: "class",
      name: "Badge",
      fullName: "Metanui.Spike.Dsl.Variants.Badge",
      namespace: "Metanui.Spike.Dsl.Variants",
      ctor: Badge,
      base: () => Component.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Badge => v instanceof Badge,
    });
  }

  override render(): Part {
    return Elements.span(Attributes.classString("badge"), Attributes.text(() => `size: ${this._size()}`));
  }
}
