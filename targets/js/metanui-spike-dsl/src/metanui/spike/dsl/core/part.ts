import type { ClassType } from "metano-runtime";
import type { HTMLElement } from "metanui-spike-counter/metanui/spike/counter/dom";

let Part$StaticText$rt: ClassType<Part$StaticText> | undefined;
let Part$rt: ClassType<Part> | undefined;

export abstract class Part {
  static get $runtimeType(): ClassType<Part> {
    return (Part$rt ??= {
      kind: "class",
      name: "Part",
      fullName: "Metanui.Spike.Dsl.Core.Part",
      namespace: "Metanui.Spike.Dsl.Core",
      ctor: Part,
      interfaces: [],
      typeParameters: [],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is Part => v instanceof Part,
    });
  }

  static __implicitFromString(text: string): Part {
    return new Part$StaticText(text);
  }

  abstract attachTo(parent: HTMLElement): void;
}

class Part$StaticText extends Part {
  declare private readonly _text: string;

  constructor(text: string) {
    super();
    this._text = text;
  }

  static override get $runtimeType(): ClassType<Part$StaticText> {
    return (Part$StaticText$rt ??= {
      kind: "class",
      name: "StaticText",
      fullName: "Metanui.Spike.Dsl.Core.Part+StaticText",
      namespace: "Metanui.Spike.Dsl.Core",
      ctor: Part$StaticText,
      base: () => Part.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Part$StaticText => v instanceof Part$StaticText,
    });
  }

  override attachTo(parent: HTMLElement): void {
    parent.appendChild(document.createTextNode(this._text));
  }
}
