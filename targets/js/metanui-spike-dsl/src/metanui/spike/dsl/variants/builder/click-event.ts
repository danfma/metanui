import type { ClassType } from "metano-runtime";

let ClickEvent$rt: ClassType<ClickEvent> | undefined;

export class ClickEvent {
  static readonly instance = /* @__PURE__ */ new ClickEvent() as ClickEvent;

  static get $runtimeType(): ClassType<ClickEvent> {
    return (ClickEvent$rt ??= {
      kind: "class",
      name: "ClickEvent",
      fullName: "Metanui.Spike.Dsl.Variants.Builder.ClickEvent",
      namespace: "Metanui.Spike.Dsl.Variants.Builder",
      ctor: ClickEvent,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new ClickEvent(),
      test: (v: unknown): v is ClickEvent => v instanceof ClickEvent,
    });
  }
}
