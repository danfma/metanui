import type { ClassType } from "metano-runtime";
import type { El } from "../../core/el.js";

let BuilderComponent$rt: ClassType<BuilderComponent> | undefined;

export abstract class BuilderComponent {
  static get $runtimeType(): ClassType<BuilderComponent> {
    return (BuilderComponent$rt ??= {
      kind: "class",
      name: "BuilderComponent",
      fullName: "Metanui.Spike.Dsl.Variants.Builder.BuilderComponent",
      namespace: "Metanui.Spike.Dsl.Variants.Builder",
      ctor: BuilderComponent,
      interfaces: [],
      typeParameters: [],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is BuilderComponent => v instanceof BuilderComponent,
    });
  }

  abstract render(content: El): El;
}
