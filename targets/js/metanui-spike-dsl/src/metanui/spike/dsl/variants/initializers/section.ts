import type { ClassType } from "metano-runtime";
import type { Part } from "../../core/part.js";
import { ElementBuilder } from "./element-builder.js";

let Section$rt: ClassType<Section> | undefined;

export class Section extends ElementBuilder {
  constructor(...attributes: Part[]) {
    super("section", attributes);
  }

  static override get $runtimeType(): ClassType<Section> {
    return (Section$rt ??= {
      kind: "class",
      name: "Section",
      fullName: "Metanui.Spike.Dsl.Variants.Initializers.Section",
      namespace: "Metanui.Spike.Dsl.Variants.Initializers",
      ctor: Section,
      base: () => ElementBuilder.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Section => v instanceof Section,
    });
  }
}
