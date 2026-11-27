import type { ClassType } from "metano-runtime";
import { Reactivity, type Signal } from "metanui-reactive/metanui/reactive";
import type { El } from "../../core/el.js";
import { bindWrite, onClick } from "./bindings.js";
import { Component } from "./component.js";
import { DirectBuilders } from "./direct-builders.js";

let CardH$rt: ClassType<CardH> | undefined;

export class CardH extends Component<CardH> {
  declare private readonly _title: Signal<string>;
  declare private readonly _highlighted: Signal<boolean>;
  declare onClose: () => void;

  constructor() {
    super();
    this._title = Reactivity.signal("");
    this._highlighted = Reactivity.signal(false);
    this.onClose = () => {
    };
  }

  static override get $runtimeType(): ClassType<CardH> {
    return (CardH$rt ??= {
      kind: "class",
      name: "CardH",
      fullName: "Metanui.Spike.Dsl.Variants.Direct.CardH",
      namespace: "Metanui.Spike.Dsl.Variants.Direct",
      ctor: CardH,
      base: () => Component.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new CardH(),
      test: (v: unknown): v is CardH => v instanceof CardH,
    });
  }

  get title(): string {
    return this._title.value;
  }

  set title(value: string) {
    this._title.value = value;
  }

  get highlighted(): boolean {
    return this._highlighted.value;
  }

  set highlighted(value: boolean) {
    this._highlighted.value = value;
  }

  static card(build: (obj: CardH) => void): El {
    return DirectBuilders.mount(new CardH(), build);
  }

  override render(content: El): El {
    return DirectBuilders.section((section) => {
      bindWrite(() => section.className = this.highlighted ? "card highlighted" : "card");
      DirectBuilders.h2((heading) => bindWrite(() => heading.textContent = this.title));
      DirectBuilders.add(content);
      DirectBuilders.button((close) => {
        close.textContent = "close";
        onClick(close, () => this.onClose());
      });
    });
  }
}
