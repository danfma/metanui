import type { ClassType } from "metano-runtime";
import type { Part } from "../../core/part.js";
import { ElementBuilder } from "./element-builder.js";

let H2$rt: ClassType<H2> | undefined;

export class H2 extends ElementBuilder {
  constructor(...attributes: Part[]) {
    super("h2", attributes);
  }

  static override get $runtimeType(): ClassType<H2> {
    return (H2$rt ??= {
      kind: "class",
      name: "H2",
      fullName: "Metanui.Spike.Dsl.Variants.Initializers.H2",
      namespace: "Metanui.Spike.Dsl.Variants.Initializers",
      ctor: H2,
      base: () => ElementBuilder.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is H2 => v instanceof H2,
    });
  }
}
