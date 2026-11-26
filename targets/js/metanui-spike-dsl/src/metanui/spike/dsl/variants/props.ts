import type { ClassType } from "metano-runtime";
import type { HTMLElement } from "metanui-spike-counter/metanui/spike/counter/dom";
import type { Prop } from "./prop.js";

let Props$rt: ClassType<Props> | undefined;

export class Props {
  declare readonly class_: Prop<string> | null;
  declare readonly onClick: (() => void) | null;

  constructor() {
    this.class_ = null;
    this.onClick = null;
  }

  static get $runtimeType(): ClassType<Props> {
    return (Props$rt ??= {
      kind: "class",
      name: "Props",
      fullName: "Metanui.Spike.Dsl.Variants.Props",
      namespace: "Metanui.Spike.Dsl.Variants",
      ctor: Props,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new Props(),
      test: (v: unknown): v is Props => v instanceof Props,
    });
  }

  applyTo(element: HTMLElement): void {
    this.class_?.applyTo((value: string) => element.className = value);

    if (this.onClick != null) {
      element.addEventListener("click", this.onClick);
    }
  }
}
