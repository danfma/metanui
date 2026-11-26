import type { ClassType } from "metano-runtime";
import type { Part } from "../../core/part.js";
import { ElementBuilder } from "./element-builder.js";

let Button$rt: ClassType<Button> | undefined;

export class Button extends ElementBuilder {
  constructor(...attributes: Part[]) {
    super("button", attributes);
  }

  static override get $runtimeType(): ClassType<Button> {
    return (Button$rt ??= {
      kind: "class",
      name: "Button",
      fullName: "Metanui.Spike.Dsl.Variants.Initializers.Button",
      namespace: "Metanui.Spike.Dsl.Variants.Initializers",
      ctor: Button,
      base: () => ElementBuilder.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Button => v instanceof Button,
    });
  }
}
