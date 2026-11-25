import { implementsInterface, type InterfaceType } from "metano-runtime";

export interface IFlushScheduler {
  schedule(flush: () => void): void;
}

export const IFlushScheduler$runtimeType: InterfaceType<IFlushScheduler> = {
  kind: "interface",
  name: "IFlushScheduler",
  fullName: "Metanui.Reactive.IFlushScheduler",
  namespace: "Metanui.Reactive",
  baseInterfaces: [],
  plainImplementers: [],
  test: (v: unknown): v is IFlushScheduler => implementsInterface(v, IFlushScheduler$runtimeType),
};
