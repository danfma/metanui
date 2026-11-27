import type { ClassType } from "metano-runtime";
import type { El } from "../../core/el.js";
import { Bindable } from "./bindable.js";
import { BuilderComponent } from "./builder-component.js";
import { Builders } from "./builders.js";
import type { ClickEvent } from "./click-event.js";
import type { ElementScope } from "./element-scope.js";

let CardG$rt: ClassType<CardG> | undefined;

export class CardG extends BuilderComponent {
  declare title: Bindable<string>;
  declare highlighted: Bindable<boolean>;
  declare onClose: (obj: ClickEvent) => void;

  constructor() {
    super();
    this.title = Bindable.__implicitFromT("");
    this.highlighted = Bindable.__implicitFromT(false);
    this.onClose = (_: ClickEvent) => {
    };
  }

  static override get $runtimeType(): ClassType<CardG> {
    return (CardG$rt ??= {
      kind: "class",
      name: "CardG",
      fullName: "Metanui.Spike.Dsl.Variants.Builder.CardG",
      namespace: "Metanui.Spike.Dsl.Variants.Builder",
      ctor: CardG,
      base: () => BuilderComponent.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new CardG(),
      test: (v: unknown): v is CardG => v instanceof CardG,
    });
  }

  static card(build: (obj: CardG) => void): El {
    return Builders.mount(new CardG(), build);
  }

  override render(content: El): El {
    return Builders.section((section: ElementScope) => {
      section.className = Bindable.__implicitFromBindingOfT(Builders.bindFuncOfT<string>(() => this.highlighted.get() ? "card highlighted" : "card"));
      Builders.h2((heading: ElementScope) => heading.textContent = this.title);
      Builders.add(content);
      Builders.button((close: ElementScope) => {
        close.textContent = Bindable.__implicitFromT("close");
        close.onClick = this.onClose;
      });
    });
  }
}
