import type { ClassType } from "metano-runtime";
import { IFlushScheduler$runtimeType, type IFlushScheduler } from "metanui-reactive/metanui/reactive";

let MicrotaskScheduler$rt: ClassType<MicrotaskScheduler> | undefined;

export class MicrotaskScheduler implements IFlushScheduler {
  static get $runtimeType(): ClassType<MicrotaskScheduler> {
    return (MicrotaskScheduler$rt ??= {
      kind: "class",
      name: "MicrotaskScheduler",
      fullName: "Metanui.Spike.Counter.Ui.MicrotaskScheduler",
      namespace: "Metanui.Spike.Counter.Ui",
      ctor: MicrotaskScheduler,
      interfaces: [
        () => IFlushScheduler$runtimeType,
      ],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new MicrotaskScheduler(),
      test: (v: unknown): v is MicrotaskScheduler => v instanceof MicrotaskScheduler,
    });
  }

  schedule(flush: () => void): void {
    queueMicrotask(flush);
  }
}
