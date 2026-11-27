import type { ClassType } from "metano-runtime";
import { Attributes } from "../../core/attributes.js";
import { Component } from "../../core/component.js";
import { Elements } from "../../core/elements.js";
import { Part } from "../../core/part.js";

let CardC$rt: ClassType<CardC> | undefined;

export class CardC extends Component {
  declare private readonly _highlighted: (() => boolean) | null;
  declare private readonly _title: () => string;
  declare private readonly _content: Part[];
  declare private readonly _onClose: (() => void) | null;

  constructor(title: () => string, highlighted: (() => boolean) | null = null, onClose: (() => void) | null = null, ...content: Part[]) {
    super();
    this._highlighted = highlighted;
    this._title = title;
    this._content = content;
    this._onClose = onClose;
  }

  static override get $runtimeType(): ClassType<CardC> {
    return (CardC$rt ??= {
      kind: "class",
      name: "CardC",
      fullName: "Metanui.Spike.Dsl.Variants.Components.CardC",
      namespace: "Metanui.Spike.Dsl.Variants.Components",
      ctor: CardC,
      base: () => Component.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is CardC => v instanceof CardC,
    });
  }

  override render(): Part {
    return Elements.section(Attributes.classFuncOfString(() => this._highlighted?.() === true ? "card highlighted" : "card"), Elements.h2(Attributes.text(this._title)), Elements.div(...this._content), Elements.button(Attributes.onClick(() => this._onClose?.()), Part.__implicitFromString("close")));
  }
}
