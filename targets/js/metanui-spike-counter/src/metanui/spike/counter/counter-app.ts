import { Reactivity } from "metanui-reactive/metanui/reactive";
import { Html } from "./ui/html.js";
import { MicrotaskScheduler } from "./ui/microtask-scheduler.js";

export class CounterApp {
  private constructor() { }

  static counter(): Node {
    const count = Reactivity.signal(0);
    const doubled = Reactivity.computed(() => Math.imul(count.value, 2));

    return Html.element("div", Html.element("h1", Html.textFuncOfString(() => `Count: ${count.value}`)), Html.element("p", Html.textFuncOfString(() => `Doubled: ${doubled.value}`)), Html.button("-1", () => count.value = (count.value - 1) | 0), Html.button("+1", () => count.value = (count.value + 1) | 0));
  }

  static main(): void {
    Reactivity.useScheduler(new MicrotaskScheduler());
    Html.mount(CounterApp.counter, document.body);
  }
}
