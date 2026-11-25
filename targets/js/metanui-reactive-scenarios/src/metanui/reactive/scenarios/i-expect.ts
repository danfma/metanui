import { implementsInterface, type InterfaceType } from "metano-runtime";

export interface IExpect {
  equal<T>(expected: T, actual: T, label: string): void;
  isTrue(condition: boolean, label: string): void;
}

export const IExpect$runtimeType: InterfaceType<IExpect> = {
  kind: "interface",
  name: "IExpect",
  fullName: "Metanui.Reactive.Scenarios.IExpect",
  namespace: "Metanui.Reactive.Scenarios",
  baseInterfaces: [],
  plainImplementers: [],
  test: (v: unknown): v is IExpect => implementsInterface(v, IExpect$runtimeType),
};
