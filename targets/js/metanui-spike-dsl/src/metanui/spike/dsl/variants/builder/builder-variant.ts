import { Reactivity } from "metanui-reactive/metanui/reactive";
import type { Part } from "../../core/part.js";
import { Badge } from "../badge.js";
import { Bindable } from "./bindable.js";
import { Builders } from "./builders.js";
import type { ClickEvent } from "./click-event.js";
import type { ElementScope } from "./element-scope.js";

export class BuilderVariant {
  private constructor() { }

  static counter(): Part {
    const count = Reactivity.signal(0);

    return Builders.section((section: ElementScope) => {
      section.className = Bindable.__implicitFromT("variant");
      Builders.h2((title: ElementScope) => title.textContent = Bindable.__implicitFromT("G. Builder lambdas"));
      Builders.p((p: ElementScope) => Builders.bindSignalOfTActionOfT<number>(count, (value: number) => p.textContent = Bindable.__implicitFromT(`1. Count: ${value}`)));
      Builders.p((p: ElementScope) => Builders.bindSignalOfTAction<number>(count, () => p.textContent = Bindable.__implicitFromT(`2. Count: ${count.value}`)));
      Builders.p((p: ElementScope) => {
        p.textContent = Bindable.__implicitFromT("3. parity");
        p.className = Bindable.__shiftLeft(p.className, () => count.value % 2 === 0 ? "even" : "odd");
      });
      Builders.p((p: ElementScope) => p.textContent = Bindable.__implicitFromBindingOfT(Builders.bindFuncOfT<string>(() => `4a. Count: ${count.value}`)));
      Builders.button((button: ElementScope) => {
        button.textContent = Bindable.__implicitFromT("-1");
        button.onClick = (_: ClickEvent) => count.value = (count.value - 1) | 0;
      });
      Builders.button((button: ElementScope) => {
        button.textContent = Bindable.__implicitFromT("+1");
        button.onClick = (_: ClickEvent) => count.value = (count.value + 1) | 0;
      });
      Builders.add(new Badge(() => count.value > 5 ? "big" : "small"));
    });
  }
}
