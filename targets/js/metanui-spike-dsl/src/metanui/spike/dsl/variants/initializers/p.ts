import type { ClassType } from "metano-runtime";
import type { Part } from "../../core/part.js";
import { ElementBuilder } from "./element-builder.js";

let P$rt: ClassType<P> | undefined;

export class P extends ElementBuilder {
  constructor(...attributes: Part[]) {
    super("p", attributes);
  }

  static override get $runtimeType(): ClassType<P> {
    return (P$rt ??= {
      kind: "class",
      name: "P",
      fullName: "Metanui.Spike.Dsl.Variants.Initializers.P",
      namespace: "Metanui.Spike.Dsl.Variants.Initializers",
      ctor: P,
      base: () => ElementBuilder.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is P => v instanceof P,
    });
  }
}
