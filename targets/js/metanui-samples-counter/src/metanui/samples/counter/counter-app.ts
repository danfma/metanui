import type { IDisposable } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { WebApp, h1, input, onInput } from "metanui-ui-web/metanui/ui/web";
import { View } from "metanui-ui/metanui/ui";
import { CounterList } from "./counter-list.js";
import { Counter } from "./counter.js";

export class CounterApp {
  private constructor() { }

  static start(container: HTMLElement): IDisposable {
    return WebApp.render(CounterApp.build, container);
  }

  static build(): void {
    const name = Reactivity.signal("Solo");
    h1((heading) => heading.textContent = "Metanui counters");
    input((field) => {
      field.value = name.value;
      onInput(field, (value: string) => name.value = value);
    });
    Counter.create((counter: Counter) => counter.label = View.live(() => name.value));
    CounterList.createDefault();
  }
}
