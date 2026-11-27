import type { IDisposable } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { View } from "metanui-ui/metanui/ui";
import { DomNodePort } from "./dom-node-port.js";
import { MicrotaskScheduler } from "./microtask-scheduler.js";

export class WebApp {
  private constructor() { }

  static render(build: () => void, container: HTMLElement): IDisposable {
    if (!(Reactivity.scheduler instanceof MicrotaskScheduler)) {
      Reactivity.useScheduler(new MicrotaskScheduler());
    }

    return View.render(build, container, new DomNodePort());
  }
}
