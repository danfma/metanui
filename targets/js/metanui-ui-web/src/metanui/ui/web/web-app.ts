import type { IDisposable } from "metano-runtime";
import { ManualFlushScheduler, Reactivity } from "metanui-reactive/metanui/reactive";
import { View } from "metanui-ui/metanui/ui";
import { DomNodePort } from "./dom-node-port.js";
import { MicrotaskScheduler } from "./microtask-scheduler.js";

export class WebApp {
  private constructor() { }

  static render(build: () => void, container: HTMLElement): IDisposable {
    WebApp.ensureMicrotaskScheduler();

    return View.render(build, container, new DomNodePort());
  }

  static ensureMicrotaskScheduler(): void {
    if (Reactivity.scheduler instanceof ManualFlushScheduler) {
      Reactivity.useScheduler(new MicrotaskScheduler());
    }
  }
}
