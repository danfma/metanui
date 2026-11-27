import { Reactivity } from "metanui-reactive/metanui/reactive";
import type { Part } from "../../core/part.js";
import { Bindable } from "./bindable.js";
import { Builders } from "./builders.js";
import { CardG } from "./card-g.js";
import type { ClickEvent } from "./click-event.js";
import type { ElementScope } from "./element-scope.js";

export class CardGUsage {
  private constructor() { }

  static cards(): Part {
    const count = Reactivity.signal(0);
    const closed = Reactivity.signal(0);

    return Builders.section((section: ElementScope) => {
      section.className = Bindable.__implicitFromT("variant");
      Builders.h2((heading: ElementScope) => heading.textContent = Bindable.__implicitFromT("G. Components"));
      CardG.card((card: CardG) => {
        card.title = Bindable.__implicitFromT("Static title");
        card.onClose = (_: ClickEvent) => closed.value = (closed.value + 1) | 0;
        Builders.p((p: ElementScope) => p.textContent = Bindable.__implicitFromT("Static body"));
      });
      CardG.card((card: CardG) => {
        card.title = Bindable.__implicitFromBindingOfT(Builders.bindFuncOfT<string>(() => `Count: ${count.value}`));
        card.highlighted = Bindable.__implicitFromBindingOfT(Builders.bindFuncOfT<boolean>(() => count.value > 5));
        card.onClose = (_: ClickEvent) => closed.value = (closed.value + 1) | 0;
        Builders.p((p: ElementScope) => p.textContent = Bindable.__implicitFromBindingOfT(Builders.bindFuncOfT<string>(() => `Closed ${closed.value} times`)));
      });
      Builders.button((button: ElementScope) => {
        button.textContent = Bindable.__implicitFromT("+1");
        button.onClick = (_: ClickEvent) => count.value = (count.value + 1) | 0;
      });
    });
  }
}
