import { Reactivity } from "metanui-reactive/metanui/reactive";
import type { Part } from "../../core/part.js";
import { bindComputeApply, bindTo, bindWrite, onClick } from "./bindings.js";
import { CardH } from "./card-h.js";
import { CounterH } from "./counter-h.js";
import { DirectBuilders } from "./direct-builders.js";

export class DirectUsage {
  private constructor() { }

  static gallery(): Part {
    const count = Reactivity.signal(0);
    const closed = Reactivity.signal(0);

    return DirectBuilders.section((section) => {
      section.className = "variant";
      DirectBuilders.h2((heading) => heading.textContent = "H. Platform elements");
      DirectBuilders.p((p) => bindTo(count, (value: number) => p.textContent = `BindTo: ${value}`));
      DirectBuilders.p((p) => bindComputeApply<string>(() => `Split: ${count.value}`, (text: string) => p.textContent = text));
      DirectBuilders.p((p) => bindWrite(() => p.textContent = `Fused: ${count.value}`));
      CardH.card((card: CardH) => {
        card.title = "Static title";
        card.onClose = () => closed.value = (closed.value + 1) | 0;
        DirectBuilders.p((p) => p.textContent = "Static body");
      });
      CardH.card((card: CardH) => {
        bindComputeApply<string>(() => `Count: ${count.value}`, (title: string) => card.title = title);
        bindComputeApply<boolean>(() => count.value > 5, (on: boolean) => card.highlighted = on);
        card.onClose = () => closed.value = (closed.value + 1) | 0;
        DirectBuilders.p((p) => bindWrite(() => p.textContent = `Closed ${closed.value} times`));
      });
      CounterH.counterBox((counter: CounterH) => counter.start = 10);
      CounterH.counterBox((counter: CounterH) => bindComputeApply<number>(() => (count.value + 100) | 0, (start: number) => counter.start = start));
      DirectBuilders.button((button) => {
        button.textContent = "+1";
        onClick(button, () => count.value = (count.value + 1) | 0);
      });
    });
  }
}
