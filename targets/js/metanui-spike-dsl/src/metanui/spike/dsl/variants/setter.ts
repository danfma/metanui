import type { ClassType } from "metano-runtime";

let Setter$rt: ClassType<Setter> | undefined;

export class Setter {
  declare private readonly _apply: (obj: HTMLElement) => void;

  constructor(apply: (obj: HTMLElement) => void) {
    this._apply = apply;
  }

  static get $runtimeType(): ClassType<Setter> {
    return (Setter$rt ??= {
      kind: "class",
      name: "Setter",
      fullName: "Metanui.Spike.Dsl.Variants.Setter",
      namespace: "Metanui.Spike.Dsl.Variants",
      ctor: Setter,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Setter => v instanceof Setter,
    });
  }

  applyTo(element: HTMLElement): void {
    this._apply(element);
  }

  static textContent(value: string): Setter {
    return new Setter((element) => element.textContent = value);
  }

  static className(value: string): Setter {
    return new Setter((element) => element.className = value);
  }
}
