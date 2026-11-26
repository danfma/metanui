import type { ClassType } from "metano-runtime";
import { IFlushScheduler$runtimeType, type IFlushScheduler } from "./i-flush-scheduler.js";

let ManualFlushScheduler$rt: ClassType<ManualFlushScheduler> | undefined;

export class ManualFlushScheduler implements IFlushScheduler {
  static get $runtimeType(): ClassType<ManualFlushScheduler> {
    return (ManualFlushScheduler$rt ??= {
      kind: "class",
      name: "ManualFlushScheduler",
      fullName: "Metanui.Reactive.ManualFlushScheduler",
      namespace: "Metanui.Reactive",
      ctor: ManualFlushScheduler,
      interfaces: [
        () => IFlushScheduler$runtimeType,
      ],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new ManualFlushScheduler(),
      test: (v: unknown): v is ManualFlushScheduler => v instanceof ManualFlushScheduler,
    });
  }

  schedule(flush: () => void): void {
  }
}
